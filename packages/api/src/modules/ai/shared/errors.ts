import { TRPCError } from "@trpc/server";

function extractStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const record = error as Record<string, unknown>;
  const status = record.status ?? record.statusCode;

  return typeof status === "number" ? status : null;
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Erreur inconnue";
  }
}

export function logAiError(scope: string, error: unknown): void {
  console.error(`[${scope}]`, error);
}

export function toSimpleFrenchAiMessage(error: unknown): string {
  const message = extractMessage(error).toLowerCase();
  const status = extractStatus(error);

  if (
    message.includes("abort") ||
    message.includes("timeout") ||
    status === 408
  ) {
    return "Le service AI met trop de temps à répondre. Réessaie dans un instant.";
  }

  if (status === 401 || status === 403 || message.includes("api key")) {
    return "La configuration du service AI est invalide. Vérifie la clé Gemini.";
  }

  if (
    status === 429 ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return "Le service AI est temporairement saturé ou le quota Gemini est atteint. Réessaie un peu plus tard.";
  }

  if (
    status === 400 ||
    message.includes("schema") ||
    message.includes("constraint") ||
    message.includes("invalid")
  ) {
    return "La demande AI n’a pas pu être traitée avec ce format. Réessaie avec une demande plus simple.";
  }

  return "Le service AI n’a pas pu produire une réponse exploitable pour le moment.";
}

export function mapGeminiProviderError(error: unknown): TRPCError {
  const message = toSimpleFrenchAiMessage(error);

  if (message.includes("trop de temps")) {
    return new TRPCError({
      code: "TIMEOUT",
      message,
      cause: error,
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message,
    cause: error,
  });
}
