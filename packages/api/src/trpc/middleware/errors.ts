import { ERROR_MESSAGES } from "@doctor.com/shared/errors";

export function resolveAppErrorMessage(code: string): string {
  return ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] ?? "Une erreur interne est survenue.";
}
