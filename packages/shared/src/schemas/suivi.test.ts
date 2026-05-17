import { describe, expect, test } from "bun:test";

import { createSuiviSchema, updateSuiviSchema } from "./suivi";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("suivi schemas", () => {
  test("requires either motif or symptoms when creating", () => {
    const base = {
      patient_id: UUID_A,
      utilisateur_id: UUID_B,
      date_ouverture: "2026-05-12",
      est_actif: true,
    };

    expect(createSuiviSchema.safeParse(base).success).toBe(false);
    expect(createSuiviSchema.safeParse({ ...base, motif: "Diabete" }).success).toBe(true);
    expect(createSuiviSchema.safeParse({ ...base, symptoms: ["toux"] }).success).toBe(true);
  });

  test("rejects empty symptoms and invalid dates", () => {
    const result = createSuiviSchema.safeParse({
      patient_id: UUID_A,
      utilisateur_id: UUID_B,
      symptoms: [""],
      date_ouverture: "12/05/2026",
      est_actif: true,
    });

    expect(result.success).toBe(false);
  });

  test("allows partial updates with an id", () => {
    expect(
      updateSuiviSchema.safeParse({
        id: UUID_A,
        est_actif: false,
        date_fermeture: "2026-05-13",
      }).success,
    ).toBe(true);

    expect(updateSuiviSchema.safeParse({ est_actif: false }).success).toBe(false);
  });
});
