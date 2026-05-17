import { describe, expect, test } from "bun:test";

import { createPatientSchema, updatePatientSchema } from "./patients";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PATIENT_ID = "22222222-2222-4222-8222-222222222222";

const validPatient = {
  nom: "Benali",
  prenom: "Sara",
  matricule: "PAT-0001",
  date_naissance: "1990-03-15",
  cree_par_utilisateur: USER_ID,
};

describe("patient schemas", () => {
  test("accepts a minimal valid patient", () => {
    expect(createPatientSchema.safeParse(validPatient).success).toBe(true);
  });

  test("trims required names and rejects blank values", () => {
    expect(
      createPatientSchema.safeParse({
        ...validPatient,
        nom: "  Benali  ",
        prenom: "  Sara  ",
      }).success,
    ).toBe(true);

    expect(
      createPatientSchema.safeParse({
        ...validPatient,
        nom: "   ",
      }).success,
    ).toBe(false);
  });

  test("validates contact, date, and NSS formats", () => {
    expect(createPatientSchema.safeParse({ ...validPatient, email: "bad" }).success).toBe(false);
    expect(createPatientSchema.safeParse({ ...validPatient, telephone: "" }).success).toBe(false);
    expect(
      createPatientSchema.safeParse({ ...validPatient, date_naissance: "15/03/1990" }).success,
    ).toBe(false);
    expect(createPatientSchema.safeParse({ ...validPatient, nss: "123" }).success).toBe(false);
    expect(
      createPatientSchema.safeParse({ ...validPatient, nss: "123456789012345" }).success,
    ).toBe(true);
  });

  test("supports partial patient updates but still requires id", () => {
    expect(updatePatientSchema.safeParse({ id: PATIENT_ID, adresse: "Alger" }).success).toBe(true);
    expect(updatePatientSchema.safeParse({ adresse: "Alger" }).success).toBe(false);
    expect(updatePatientSchema.safeParse({ id: PATIENT_ID, email: "bad" }).success).toBe(false);
  });
});
