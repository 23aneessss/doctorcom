import { describe, expect, test } from "bun:test";

import { createRendezVousSchema, updateRendezVousSchema } from "./rendez-vous";

const PATIENT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const RDV_ID = "33333333-3333-4333-8333-333333333333";
const SUIVI_ID = "44444444-4444-4444-8444-444444444444";

const validRdv = {
  patient_id: PATIENT_ID,
  utilisateur_id: USER_ID,
  date: "2026-05-12",
  heure: "09:30",
  statut: "planifie",
  important: false,
};

describe("rendez-vous schemas", () => {
  test("accepts a minimal rendez-vous", () => {
    expect(createRendezVousSchema.safeParse(validRdv).success).toBe(true);
  });

  test("allows optional null suivi and valid linked suivi", () => {
    expect(createRendezVousSchema.safeParse({ ...validRdv, suivi_id: null }).success).toBe(true);
    expect(createRendezVousSchema.safeParse({ ...validRdv, suivi_id: SUIVI_ID }).success).toBe(true);
  });

  test("rejects invalid time, date, status, and ids", () => {
    expect(createRendezVousSchema.safeParse({ ...validRdv, heure: "9:30" }).success).toBe(false);
    expect(createRendezVousSchema.safeParse({ ...validRdv, date: "12/05/2026" }).success).toBe(false);
    expect(createRendezVousSchema.safeParse({ ...validRdv, statut: "unknown" }).success).toBe(false);
    expect(createRendezVousSchema.safeParse({ ...validRdv, patient_id: "bad" }).success).toBe(false);
  });

  test("allows partial updates with id", () => {
    expect(updateRendezVousSchema.safeParse({ id: RDV_ID, statut: "annule" }).success).toBe(true);
    expect(updateRendezVousSchema.safeParse({ statut: "annule" }).success).toBe(false);
  });
});
