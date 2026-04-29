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
    const cause = "cause" in error ? extractMessage(error.cause) : "";
    return cause ? `${error.message} ${cause}` : error.message;
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
    return "Le service d’aide médicale met trop de temps à répondre. Réessaie dans un instant.";
  }

  if (status === 401 || status === 403 || message.includes("api key")) {
    return "Le service d’aide médicale n’est pas disponible pour le moment.";
  }

  if (
    status === 429 ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return "Le service d’aide médicale est temporairement saturé. Réessaie un peu plus tard.";
  }

  if (
    status === 400 ||
    message.includes("schema") ||
    message.includes("constraint") ||
    message.includes("invalid") ||
    message.includes("json") ||
    message.includes("no object generated") ||
    message.includes("could not parse") ||
    message.includes("did not match") ||
    message.includes("tool was not called")
  ) {
    return "La réponse du service d’aide médicale n’a pas pu être exploitée. Réessaie avec une demande plus simple.";
  }

  return "Aucune réponse fiable n’a pu être produite pour le moment.";
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
