import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";
import { env } from "@doctor.com/env/server";

import {
  GEMINI_PROVIDER_NAME,
  resolveTextProvider,
  setRuntimeAISettings,
  type PreferredAIProvider,
} from "../shared/provider";
import {
  aiSettingsRepository,
  type AppAISettingsRecord,
  type AppAISettingsUpdate,
} from "./repo";

type DatabaseClient = typeof databaseClient;

interface OllamaModelStatus {
  base_url: string;
  model: string;
  reachable: boolean;
  installed: boolean;
  running: boolean;
}

export interface AISettingsResult {
  preferred_provider: PreferredAIProvider;
  active_provider: "gemini" | "ollama";
  active_model: string;
  gemini_model: string;
  gemini_api_key_configured: boolean;
  gemini_api_key_source: "database" | "environment" | "none";
  ollama: OllamaModelStatus;
  updated_at: string;
}

export interface UpdateAISettingsInput {
  preferred_provider?: PreferredAIProvider;
  gemini_api_key?: string | null;
  clear_gemini_api_key?: boolean;
}

interface OllamaTagsResponse {
  models?: Array<{ name?: unknown; model?: unknown }>;
}

export class AISettingsService {
  async initializeRuntimeSettings(database: DatabaseClient): Promise<void> {
    const settings = await aiSettingsRepository.ensure(database);
    this.applyRuntimeSettings(settings);
  }

  async getSettings(database: DatabaseClient): Promise<AISettingsResult> {
    const settings = await aiSettingsRepository.ensure(database);
    this.applyRuntimeSettings(settings);

    const provider = resolveTextProvider();
    const ollama = await this.getOllamaStatus();

    return {
      preferred_provider: this.normalizeProvider(settings.ai_provider),
      active_provider:
        provider.name === GEMINI_PROVIDER_NAME ? "gemini" : "ollama",
      active_model: provider.model,
      gemini_model: env.GEMINI_MODEL,
      gemini_api_key_configured: this.hasGeminiApiKey(settings),
      gemini_api_key_source: this.getGeminiApiKeySource(settings),
      ollama,
      updated_at: settings.updated_at,
    };
  }

  async updateSettings(
    database: DatabaseClient,
    input: UpdateAISettingsInput,
  ): Promise<AISettingsResult> {
    const update: AppAISettingsUpdate = {};

    if (input.preferred_provider) {
      update.ai_provider = input.preferred_provider;
    }

    if (input.clear_gemini_api_key) {
      update.gemini_api_key = null;
    } else if (input.gemini_api_key !== undefined) {
      const normalizedKey = input.gemini_api_key?.trim() ?? "";
      update.gemini_api_key = normalizedKey || null;
    }

    if (Object.keys(update).length === 0) {
      return this.getSettings(database);
    }

    const settings = await aiSettingsRepository.update(database, update);
    this.applyRuntimeSettings(settings);
    return this.getSettings(database);
  }

  async downloadLocalModel(database: DatabaseClient): Promise<AISettingsResult> {
    await aiSettingsRepository.ensure(database);
    await this.pullOllamaModel();
    return this.getSettings(database);
  }

  async deleteLocalModel(database: DatabaseClient): Promise<AISettingsResult> {
    await aiSettingsRepository.ensure(database);
    await this.deleteOllamaModel();
    return this.getSettings(database);
  }

  private applyRuntimeSettings(settings: AppAISettingsRecord): void {
    setRuntimeAISettings({
      preferredProvider: this.normalizeProvider(settings.ai_provider),
      geminiApiKey: settings.gemini_api_key?.trim() || null,
    });
  }

  private normalizeProvider(value: string): PreferredAIProvider {
    return value === "ollama" ? "ollama" : "gemini";
  }

  private hasGeminiApiKey(settings: AppAISettingsRecord): boolean {
    return Boolean(settings.gemini_api_key?.trim() || env.GEMINI_API_KEY);
  }

  private getGeminiApiKeySource(
    settings: AppAISettingsRecord,
  ): AISettingsResult["gemini_api_key_source"] {
    if (settings.gemini_api_key?.trim()) return "database";
    if (env.GEMINI_API_KEY) return "environment";
    return "none";
  }

  private async getOllamaStatus(): Promise<OllamaModelStatus> {
    const model = env.OLLAMA_MODEL;
    const baseUrl = this.getOllamaBaseUrl();

    const [tags, running] = await Promise.all([
      this.fetchOllamaTags().catch(() => null),
      this.fetchOllamaRunningModels().catch(() => null),
    ]);

    return {
      base_url: baseUrl,
      model,
      reachable: tags !== null || running !== null,
      installed: this.hasModel(tags, model),
      running: this.hasModel(running, model),
    };
  }

  private async pullOllamaModel(): Promise<void> {
    const response = await fetch(`${this.getOllamaBaseUrl()}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: env.OLLAMA_MODEL, stream: false }),
    });

    if (!response.ok) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message:
          "Impossible de telecharger le modele local. Verifiez que le service Ollama est demarre.",
      });
    }
  }

  private async deleteOllamaModel(): Promise<void> {
    const response = await fetch(`${this.getOllamaBaseUrl()}/api/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: env.OLLAMA_MODEL }),
    });

    if (!response.ok && response.status !== 404) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message:
          "Impossible de supprimer le modele local. Verifiez que le service Ollama est demarre.",
      });
    }
  }

  private async fetchOllamaTags(): Promise<OllamaTagsResponse> {
    const response = await fetch(`${this.getOllamaBaseUrl()}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });

    if (!response.ok) {
      throw new Error(`Ollama tags failed with ${response.status}`);
    }

    return (await response.json()) as OllamaTagsResponse;
  }

  private async fetchOllamaRunningModels(): Promise<OllamaTagsResponse> {
    const response = await fetch(`${this.getOllamaBaseUrl()}/api/ps`, {
      signal: AbortSignal.timeout(2500),
    });

    if (!response.ok) {
      throw new Error(`Ollama ps failed with ${response.status}`);
    }

    return (await response.json()) as OllamaTagsResponse;
  }

  private hasModel(payload: OllamaTagsResponse | null, model: string): boolean {
    return Boolean(
      payload?.models?.some((candidate) => {
        const name = String(candidate.name ?? candidate.model ?? "");
        return name === model;
      }),
    );
  }

  private getOllamaBaseUrl(): string {
    return env.OLLAMA_BASE_URL.replace(/\/+$/, "");
  }
}

export const aiSettingsService = new AISettingsService();
