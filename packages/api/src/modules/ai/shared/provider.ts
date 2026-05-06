import { TRPCError } from "@trpc/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed, generateText } from "ai";
import { env } from "@doctor.com/env/server";

import { mapGeminiProviderError } from "./errors";

export const GEMINI_PROVIDER_NAME = "google-ai-studio" as const;
export const OLLAMA_PROVIDER_NAME = "ollama" as const;

export type GeminiProviderName = typeof GEMINI_PROVIDER_NAME;
export type OllamaProviderName = typeof OLLAMA_PROVIDER_NAME;
export type AITextProviderName = GeminiProviderName | OllamaProviderName;

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

export interface GeminiTextGenerationInput {
  provider?: AITextProviderConfig;
  system?: string;
  prompt: string;
  timeoutMs?: number;
  temperature?: number;
}

export const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001" as const;
export const GEMINI_EMBEDDING_DIMENSIONS = 3072 as const;

export function resolveGeminiProvider(): GeminiProviderConfig {
  if (!env.GEMINI_API_KEY) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Le service d’aide médicale n’est pas disponible pour le moment.",
    });
  }

  return {
    name: GEMINI_PROVIDER_NAME,
    model: env.GEMINI_MODEL,
    apiKey: env.GEMINI_API_KEY,
  };
}

export function resolveTextProvider(): AITextProviderConfig {
  if (env.AI_PROVIDER === "ollama") {
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
  if (!env.GEMINI_API_KEY) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Le service d'aide medicale n'est pas disponible pour le moment.",
    });
  }

  const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
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

    return result.embedding;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw mapGeminiProviderError(error);
  }
}
