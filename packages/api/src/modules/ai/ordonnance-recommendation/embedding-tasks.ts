import {
  GEMINI_EMBEDDING_MODEL,
  generateGeminiEmbedding,
} from "../shared/provider";
import type { MedicamentAggregate } from "../../medicaments/service";
import { buildMedicamentEmbeddingPayload } from "./embedding";
import { ordonnanceVectorRepository } from "./vector-repo";

type EmbeddingTask =
  | { operation: "upsert"; aggregate: MedicamentAggregate }
  | { operation: "delete"; medicamentId: number };

const MAX_CONCURRENCY = 6;
const RETRY_ATTEMPTS = 6;
const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 30_000;

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const record = error as Record<string, unknown>;
  const code = record.code;
  if (typeof code === "string") {
    return code.toUpperCase();
  }

  const cause = record.cause;
  if (cause && typeof cause === "object") {
    return getErrorCode(cause);
  }

  return null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isTransientError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code) {
    const retryable = new Set([
      "ENOTFOUND",
      "EAI_AGAIN",
      "ECONNRESET",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "57P01",
      "57P02",
      "57P03",
      "08000",
      "08001",
      "08003",
      "08004",
      "08006",
      "429",
      "503",
    ]);
    if (retryable.has(code)) {
      return true;
    }
  }

  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("enotfound") ||
    message.includes("eai_again") ||
    message.includes("rate limit") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("temporarily unavailable") ||
    message.includes("internal")
  );
}

async function retryTransient<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientError(error) || attempt >= RETRY_ATTEMPTS) {
        break;
      }

      const expDelay = RETRY_BASE_MS * 2 ** (attempt - 1);
      const cappedDelay = Math.min(RETRY_MAX_MS, expDelay);
      const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(cappedDelay * 0.25)));
      const delay = cappedDelay + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

class OrdonnanceEmbeddingTasks {
  private pending = new Map<number, EmbeddingTask>();

  private running = 0;

  scheduleUpsertFromAggregate(aggregate: MedicamentAggregate): void {
    const medicamentId = aggregate.medicament.id;
    this.pending.set(medicamentId, { operation: "upsert", aggregate });
    this.pump();
  }

  scheduleDelete(medicamentId: number): void {
    this.pending.set(medicamentId, { operation: "delete", medicamentId });
    this.pump();
  }

  private pump(): void {
    while (this.running < MAX_CONCURRENCY && this.pending.size > 0) {
      const next = this.pending.entries().next();
      if (next.done) {
        break;
      }

      const [medicamentId, task] = next.value;
      this.pending.delete(medicamentId);
      this.running += 1;

      void this.executeTask(task)
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(
            `[embedding-tasks] task failed for medicament ${medicamentId}: ${message}`,
          );
        })
        .finally(() => {
          this.running -= 1;
          this.pump();
        });
    }
  }

  private async executeTask(task: EmbeddingTask): Promise<void> {
    if (task.operation === "delete") {
      await retryTransient(() => ordonnanceVectorRepository.deleteEmbedding(task.medicamentId));
      return;
    }

    await retryTransient(async () => {
      const payload = buildMedicamentEmbeddingPayload(task.aggregate);
      const existingHash = await ordonnanceVectorRepository.getEmbeddingContentHash(
        task.aggregate.medicament.id,
      );
      if (existingHash && existingHash === payload.contentHash) {
        return;
      }

      const embedding = await generateGeminiEmbedding(payload.content);
      await ordonnanceVectorRepository.upsertEmbedding({
        medicamentId: task.aggregate.medicament.id,
        embedding,
        embeddingModel: GEMINI_EMBEDDING_MODEL,
        contentHash: payload.contentHash,
        preview: payload.preview,
      });
    });
  }
}

export const ordonnanceEmbeddingTasks = new OrdonnanceEmbeddingTasks();
