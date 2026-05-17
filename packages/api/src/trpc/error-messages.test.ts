import { describe, expect, test } from "bun:test";

import { toSimpleFrenchRuntimeMessage } from "./error-messages";

describe("toSimpleFrenchRuntimeMessage", () => {
  test("normalizes auth boundaries without leaking backend wording", () => {
    expect(toSimpleFrenchRuntimeMessage({ code: "UNAUTHORIZED" })).toBe(
      "La session a expiré. Reconnectez-vous.",
    );
    expect(
      toSimpleFrenchRuntimeMessage({
        code: "BAD_REQUEST",
        message: "Authentification requise.",
      }),
    ).toBe("La session a expiré. Reconnectez-vous.");
  });

  test("normalizes not found messages by entity", () => {
    expect(
      toSimpleFrenchRuntimeMessage({
        code: "NOT_FOUND",
        message: "Patient introuvable.",
      }),
    ).toBe("Le patient demandé est introuvable.");
    expect(
      toSimpleFrenchRuntimeMessage({
        code: "NOT_FOUND",
        message: "Rendez-vous introuvable.",
      }),
    ).toBe("Ce rendez-vous est introuvable.");
  });

  test("normalizes validation and conflict failures", () => {
    expect(
      toSimpleFrenchRuntimeMessage({
        code: "BAD_REQUEST",
        message: "Invalid schema: missing suivi_id",
      }),
    ).toBe("La demande n’a pas pu être analysée correctement. Vérifie les informations saisies.");
    expect(
      toSimpleFrenchRuntimeMessage({
        code: "CONFLICT",
        message: "Ce créneau est déjà occupé",
      }),
    ).toBe("Ce créneau est déjà occupé.");
  });

  test("falls back safely for empty internal errors", () => {
    expect(toSimpleFrenchRuntimeMessage({ code: "INTERNAL_SERVER_ERROR", message: "" })).toBe(
      "La demande n’a pas pu être traitée pour le moment.",
    );
  });
});
