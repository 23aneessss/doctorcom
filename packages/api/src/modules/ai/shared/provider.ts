import { TRPCError } from "@trpc/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed, generateText } from "ai";
import { env } from "@doctor.com/env/server";

import { mapGeminiProviderError } from "./errors";

export const GEMINI_PROVIDER_NAME = "google-ai-studio" as const;

export type GeminiProviderName = typeof GEMINI_PROVIDER_NAME;

export interface GeminiProviderConfig {
  name: GeminiProviderName;
  model: string;
  apiKey: string;
}

export interface GeminiTextGenerationInput {
  provider?: GeminiProviderConfig;
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

export async function generateGeminiText(
  input: GeminiTextGenerationInput,
): Promise<{ provider: GeminiProviderConfig; text: string }> {
  const provider = input.provider ?? resolveGeminiProvider();
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
}
