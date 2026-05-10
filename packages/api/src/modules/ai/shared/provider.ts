import { TRPCError } from "@trpc/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed, generateText } from "ai";
import { env } from "@doctor.com/env/server";

import { mapGeminiProviderError } from "./errors";

export const GEMINI_PROVIDER_NAME = "google-ai-studio" as const;
export const OLLAMA_PROVIDER_NAME = "ollama" as const;
export const DEFAULT_APP_AI_SETTINGS_ID = "default" as const;

export type GeminiProviderName = typeof GEMINI_PROVIDER_NAME;
export type OllamaProviderName = typeof OLLAMA_PROVIDER_NAME;
export type AITextProviderName = GeminiProviderName | OllamaProviderName;
export type PreferredAIProvider = "gemini" | "ollama";

export interface AITextProviderConfig {
  name: AITextProviderName;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export type GeminiProviderConfig = AITextProviderConfig & {
  name: GeminiProviderName;
  apiKey: string;
};

interface RuntimeAISettings {
  preferredProvider: PreferredAIProvider;
  geminiApiKey: string | null;
}

let runtimeAISettings: RuntimeAISettings | null = null;

export function setRuntimeAISettings(settings: RuntimeAISettings): void {
  runtimeAISettings = settings;
}

export interface GeminiTextGenerationInput {
  provider?: AITextProviderConfig;
  system?: string;
  prompt: string;
  timeoutMs?: number;
  temperature?: number;
}

export const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001" as const;
export const GEMINI_EMBEDDING_DIMENSIONS = 3072 as const;

const EMBEDDING_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const EMBEDDING_CACHE_MAX_ENTRIES = 200;
const embeddingCache = new Map<
  string,
  { value: number[]; expiresAt: number }
>();

function buildEmbeddingCacheKey(value: string): string {
  const normalized = value.normalize("NFC").trim().toLowerCase();
  let hash = 5381;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
  }
  return `${normalized.length}:${hash}`;
}

function getCachedEmbedding(key: string): number[] | null {
  const entry = embeddingCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    embeddingCache.delete(key);
    return null;
  }
  embeddingCache.delete(key);
  embeddingCache.set(key, entry);
  return entry.value;
}

function setCachedEmbedding(key: string, value: number[]): void {
  embeddingCache.set(key, {
    value,
    expiresAt: Date.now() + EMBEDDING_CACHE_TTL_MS,
  });
  while (embeddingCache.size > EMBEDDING_CACHE_MAX_ENTRIES) {
    const oldestKey = embeddingCache.keys().next().value;
    if (oldestKey === undefined) break;
    embeddingCache.delete(oldestKey);
  }
}

function getConfiguredGeminiApiKey(): string | undefined {
  return runtimeAISettings?.geminiApiKey ?? env.GEMINI_API_KEY;
}

function getPreferredAIProvider(): PreferredAIProvider {
  return runtimeAISettings?.preferredProvider ?? env.AI_PROVIDER;
}

export function resolveGeminiProvider(): GeminiProviderConfig {
  const apiKey = getConfiguredGeminiApiKey();
  if (!apiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Le service d’aide médicale n’est pas disponible pour le moment.",
    });
  }

  return {
    name: GEMINI_PROVIDER_NAME,
    model: env.GEMINI_MODEL,
    apiKey,
  };
}

export function resolveTextProvider(): AITextProviderConfig {
  const preferredProvider = getPreferredAIProvider();
  const geminiApiKey = getConfiguredGeminiApiKey();

  if (preferredProvider === "ollama" || !geminiApiKey) {
    return {
      name: OLLAMA_PROVIDER_NAME,
      model: env.OLLAMA_MODEL,
      baseUrl: env.OLLAMA_BASE_URL,
      timeoutMs: env.OLLAMA_TIMEOUT_MS,
    };
  }

  return resolveGeminiProvider();
}

export async function generateGeminiText(
  input: GeminiTextGenerationInput,
): Promise<{ provider: AITextProviderConfig; text: string }> {
  const provider = input.provider ?? resolveTextProvider();
  if (provider.name === OLLAMA_PROVIDER_NAME) {
    const text = await generateOllamaText({
      provider,
      system: input.system,
      prompt: input.prompt,
      timeoutMs: input.timeoutMs,
      temperature: input.temperature,
    });

    return { provider, text };
  }

  if (!provider.apiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Le service d'aide medicale n'est pas disponible pour le moment.",
    });
  }

  const google = createGoogleGenerativeAI({
    apiKey: provider.apiKey,
  });

  try {
    const result = await generateText({
      model: google(provider.model),
      system: input.system,
      prompt: input.prompt,
      abortSignal: input.timeoutMs
        ? AbortSignal.timeout(input.timeoutMs)
        : undefined,
      temperature: input.temperature,
      maxRetries: 0,
    });

    return {
      provider,
      text: result.text,
    };
  } catch (error) {
    throw mapGeminiProviderError(error);
  }
}

async function generateOllamaText(input: {
  provider: AITextProviderConfig;
  system?: string;
  prompt: string;
  timeoutMs?: number;
  temperature?: number;
}): Promise<string> {
  const baseUrl = input.provider.baseUrl?.replace(/\/+$/, "");
  if (!baseUrl) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "La configuration Ollama est incomplete.",
    });
  }

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: input.provider.model,
        prompt: input.system
          ? `${input.system.trim()}\n\n${input.prompt}`
          : input.prompt,
        stream: false,
        options:
          input.temperature === undefined
            ? undefined
            : { temperature: input.temperature },
      }),
      signal: AbortSignal.timeout(
        input.timeoutMs ?? input.provider.timeoutMs ?? env.OLLAMA_TIMEOUT_MS,
      ),
    });

    if (!response.ok) {
      throw new Error(`Ollama responded with ${response.status}`);
    }

    const payload = (await response.json()) as { response?: unknown };
    if (typeof payload.response !== "string" || !payload.response.trim()) {
      throw new Error("Ollama response is empty.");
    }

    return payload.response;
  } catch (error) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message:
        "Le modele local Ollama n'a pas pu repondre. Verifiez OLLAMA_BASE_URL et OLLAMA_MODEL.",
      cause: error,
    });
  }
}

export async function generateGeminiEmbedding(
  value: string,
): Promise<number[]> {
  const cacheKey = buildEmbeddingCacheKey(value);
  const cached = getCachedEmbedding(cacheKey);
  if (cached) {
    return cached;
  }

  const apiKey = getConfiguredGeminiApiKey();
  if (!apiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Le service d'aide medicale n'est pas disponible pour le moment.",
    });
  }

  const google = createGoogleGenerativeAI({ apiKey });
  try {
    const result = await embed({
      model: google.textEmbedding(GEMINI_EMBEDDING_MODEL),
      value,
      maxRetries: 0,
    });

    if (result.embedding.length !== GEMINI_EMBEDDING_DIMENSIONS) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Dimension d'embedding inattendue pour Gemini.",
      });
    }

    setCachedEmbedding(cacheKey, result.embedding);
    return result.embedding;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw mapGeminiProviderError(error);
  }
}
