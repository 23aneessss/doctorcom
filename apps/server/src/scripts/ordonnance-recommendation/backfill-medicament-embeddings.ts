import "dotenv/config";

import "../load-env";

import { medicationsPool, withMedicationsTx } from "@doctor.com/medications-db";
import { medicamentsService } from "@doctor.com/api/modules/medicaments/service";
import { buildMedicamentEmbeddingPayload } from "@doctor.com/api/modules/ai/ordonnance-recommendation/embedding";
import { ordonnanceVectorRepository } from "@doctor.com/api/modules/ai/ordonnance-recommendation/vector-repo";
import {
  GEMINI_EMBEDDING_MODEL,
  generateGeminiEmbedding,
} from "@doctor.com/api/modules/ai/shared/provider";

const DEFAULT_BATCH_SIZE = 40;
const DEFAULT_PARALLELISM = 8;
const DEFAULT_RETRY_COUNT = 6;
const DEFAULT_RETRY_BASE_MS = 500;
const DEFAULT_RETRY_MAX_MS = 20_000;

medicationsPool.on("error", (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[embedding-backfill] pool error: ${message}`);
});

interface CliOptions {
  startAfterId: number;
  limit: number | null;
  batchSize: number;
  parallelism: number;
  retries: number;
  retryBaseMs: number;
  retryMaxMs: number;
}

interface BuildJobResult {
  medicament_id: number;
  payload_hash: string;
  payload_preview: string;
  embedding: number[];
}

interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry: (error: unknown) => boolean;
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

function parseCliOptions(argv: string[]): CliOptions {
  let startAfterId = 0;
  let limit: number | null = null;
  let batchSize = DEFAULT_BATCH_SIZE;
  let parallelism = DEFAULT_PARALLELISM;
  let retries = DEFAULT_RETRY_COUNT;
  let retryBaseMs = DEFAULT_RETRY_BASE_MS;
  let retryMaxMs = DEFAULT_RETRY_MAX_MS;

  for (const arg of argv) {
    if (arg.startsWith("--start-after-id=")) {
      const value = Number(arg.slice("--start-after-id=".length));
      if (Number.isFinite(value) && value >= 0) {
        startAfterId = Math.floor(value);
      }
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const value = parsePositiveInt(arg.slice("--limit=".length));
      if (value !== null) {
        limit = value;
      }
      continue;
    }

    if (arg.startsWith("--batch-size=")) {
      const value = parsePositiveInt(arg.slice("--batch-size=".length));
      if (value !== null) {
        batchSize = value;
      }
      continue;
    }

    if (arg.startsWith("--parallelism=")) {
      const value = parsePositiveInt(arg.slice("--parallelism=".length));
      if (value !== null) {
        parallelism = value;
      }
      continue;
    }

    if (arg.startsWith("--retries=")) {
      const value = parsePositiveInt(arg.slice("--retries=".length));
      if (value !== null) {
        retries = value;
      }
      continue;
    }

    if (arg.startsWith("--retry-base-ms=")) {
      const value = parsePositiveInt(arg.slice("--retry-base-ms=".length));
      if (value !== null) {
        retryBaseMs = value;
      }
      continue;
    }

    if (arg.startsWith("--retry-max-ms=")) {
      const value = parsePositiveInt(arg.slice("--retry-max-ms=".length));
      if (value !== null) {
        retryMaxMs = value;
      }
    }
  }

  return {
    startAfterId,
    limit,
    batchSize,
    parallelism,
    retries,
    retryBaseMs,
    retryMaxMs,
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

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

function isTransientDatabaseError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code) {
    const transientCodes = new Set([
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
    ]);
    if (transientCodes.has(code)) {
      return true;
    }
  }

  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("enotfound") ||
    message.includes("eai_again") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("timeout") ||
    message.includes("server closed the connection") ||
    message.includes("could not connect")
  );
}

async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const canRetry = options.shouldRetry(error);
      if (!canRetry || attempt >= options.attempts) {
        break;
      }

      const expDelay = options.baseDelayMs * 2 ** (attempt - 1);
      const cappedDelay = Math.min(options.maxDelayMs, expDelay);
      const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(cappedDelay * 0.25)));
      const delay = cappedDelay + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const currentIndex = cursor;
      cursor += 1;
      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex]!);
    }
  });

  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const transientRetry: RetryOptions = {
    attempts: options.retries,
    baseDelayMs: options.retryBaseMs,
    maxDelayMs: options.retryMaxMs,
    shouldRetry: (error) => isTransientDatabaseError(error),
  };

  const allMedicaments = await medicamentsService.listAllMedicaments();

  const medicaments = allMedicaments
    .slice()
    .sort((left, right) => left.id - right.id)
    .filter((item) => item.id > options.startAfterId)
    .slice(0, options.limit ?? Number.POSITIVE_INFINITY);

  console.log(
    `[embedding-backfill] medicaments selected: ${medicaments.length} (start-after-id=${options.startAfterId})`,
  );
  console.log(
    `[embedding-backfill] runtime config: batch=${options.batchSize}, parallelism=${options.parallelism}, retries=${options.retries}, retry-base-ms=${options.retryBaseMs}, retry-max-ms=${options.retryMaxMs}`,
  );

  let queuedTotal = 0;
  const failedPermanentIds: number[] = [];
  const deferredTransientIds: number[] = [];

  for (const chunk of chunkArray(medicaments, options.batchSize)) {
    const jobs = await mapWithConcurrency(
      chunk,
      options.parallelism,
      async (medicament): Promise<BuildJobResult | null> => {
        try {
          const job = await withRetry(
            async () => {
              const aggregate = await medicamentsService.getMedicamentById(medicament.id);
              const payload = buildMedicamentEmbeddingPayload(aggregate);
              const existingHash = await ordonnanceVectorRepository.getEmbeddingContentHash(
                medicament.id,
              );

              if (existingHash && existingHash === payload.contentHash) {
                return null;
              }

              const embedding = await generateGeminiEmbedding(payload.content);
              return {
                medicament_id: medicament.id,
                payload_hash: payload.contentHash,
                payload_preview: payload.preview,
                embedding,
              };
            },
            {
              ...transientRetry,
              shouldRetry: (error) => isTransientDatabaseError(error),
            },
          );

          return job;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          if (isTransientDatabaseError(error)) {
            console.warn(
              `[embedding-backfill] defer medicament ${medicament.id} after transient retries: ${message}`,
            );
            deferredTransientIds.push(medicament.id);
            return null;
          }

          console.warn(`[embedding-backfill] permanent skip medicament ${medicament.id}: ${message}`);
          failedPermanentIds.push(medicament.id);
          return null;
        }
      },
    );

    const filteredJobs = jobs.filter((item): item is BuildJobResult => Boolean(item));
    if (filteredJobs.length > 0) {
      try {
        const queued = await withRetry(
          () =>
            withMedicationsTx(async () => {
              await Promise.all(
                filteredJobs.map((job) =>
                  ordonnanceVectorRepository.upsertEmbedding({
                    medicamentId: job.medicament_id,
                    embedding: job.embedding,
                    embeddingModel: GEMINI_EMBEDDING_MODEL,
                    contentHash: job.payload_hash,
                    preview: job.payload_preview,
                  }),
                ),
              );

              return filteredJobs.length;
            }),
          transientRetry,
        );
        queuedTotal += queued;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const chunkIds = filteredJobs.map((job) => job.medicament_id);
        console.warn(
          `[embedding-backfill] chunk enqueue failed for ids ${chunkIds[0]}..${chunkIds[chunkIds.length - 1]}: ${message}`,
        );

        if (isTransientDatabaseError(error)) {
          deferredTransientIds.push(...chunkIds);
        } else {
          failedPermanentIds.push(...chunkIds);
        }
      }
    }

    if (queuedTotal % 100 === 0 || queuedTotal >= medicaments.length) {
      const lastProcessedId = chunk[chunk.length - 1]?.id;
      console.log(
        `[embedding-backfill] queued ${queuedTotal}/${medicaments.length} (last-id=${lastProcessedId})`,
      );
    }
  }

  console.log(`[embedding-backfill] done. queued: ${queuedTotal}`);

  if (failedPermanentIds.length > 0) {
    const unique = [...new Set(failedPermanentIds)].sort((a, b) => a - b);
    console.log(
      `[embedding-backfill] permanent failed ids (${unique.length}): ${unique.join(",")}`,
    );
    console.log(
      `[embedding-backfill] permanent resume suggestion: --start-after-id=${Math.min(...unique) - 1}`,
    );
  }

  if (deferredTransientIds.length > 0) {
    const unique = [...new Set(deferredTransientIds)].sort((a, b) => a - b);
    console.log(
      `[embedding-backfill] transient deferred ids (${unique.length}): ${unique.join(",")}`,
    );
    console.log(
      `[embedding-backfill] transient resume suggestion: --start-after-id=${Math.min(...unique) - 1}`,
    );
  }
}

void main()
  .catch((error) => {
    console.error("[embedding-backfill] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await medicationsPool.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[embedding-backfill] pool shutdown warning: ${message}`);
    }
  });
