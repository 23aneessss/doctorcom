import { TRPCError } from "@trpc/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
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

export function resolveGeminiProvider(): GeminiProviderConfig {
  if (!env.GEMINI_API_KEY) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "La clé Gemini est absente. Ajoute GEMINI_API_KEY dans apps/server/.env.",
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
