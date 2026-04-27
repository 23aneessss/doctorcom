import { z } from "zod";

export type RecommendationResponseMode = "ordonnance" | "medicaments";
export type OrdonnanceAiGenerationStatus =
  | "draft_ready"
  | "verifying"
  | "verified"
  | "verification_failed";

export const recommendationMedicamentSchema = z.object({
  medicament_externe_id: z.string().trim().min(1),
  nom_medicament: z.string().trim().min(1).max(180),
  dci: z.string().trim().min(1).max(180).nullable().optional(),
  dosage: z.string().trim().min(1).max(180).nullable().optional(),
  posologie: z.string().trim().min(1).max(600),
  duree_traitement: z.string().trim().min(1).max(180).nullable().optional(),
  instructions: z.string().trim().min(1).max(600).nullable().optional(),
  justification: z.string().trim().min(1).max(800),
  is_active_treatment: z.boolean().optional().default(false),
});

export const recommendationSchema = z.object({
  rank: z.number().int().min(1).max(3),
  label: z.string().trim().min(1).max(120),
  rationale: z.string().trim().min(1).max(2400),
  warnings: z.array(z.string().trim().min(1).max(500)).max(10),
  ordonnance_draft: z.object({
    remarques: z.string().trim().min(1).max(800).nullable().optional(),
    medicaments: z.array(recommendationMedicamentSchema).min(1).max(6),
  }),
});

export const aiResponseSchema = z.object({
  recommendations: z.array(recommendationSchema).max(3),
  global_warnings: z.array(z.string().trim().min(1).max(500)).max(12),
  verification_justification: z.string().trim().min(1).max(2000),
});

export const aiVerificationMedicamentSchema = z.object({
  medicament_externe_id: z
    .string()
    .trim()
    .min(1)
    .describe("Identifiant externe du medicament conserve depuis le brouillon."),
  nom_medicament: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .describe("Nom commercial ou libelle du medicament."),
  dci: z
    .string()
    .max(180)
    .describe("DCI si connue, sinon chaine vide."),
  dosage: z
    .string()
    .max(180)
    .describe("Dosage si connu, sinon chaine vide."),
  posologie: z
    .string()
    .trim()
    .min(1)
    .max(600)
    .describe("Posologie proposee ou conservee depuis le brouillon."),
  duree_traitement: z
    .string()
    .max(180)
    .describe("Duree de traitement si connue, sinon chaine vide."),
  instructions: z
    .string()
    .max(600)
    .describe("Instructions patient ou prescripteur si connues, sinon chaine vide."),
  justification: z
    .string()
    .trim()
    .min(1)
    .max(800)
    .describe("Justification clinique courte pour garder ou ajuster ce medicament."),
  is_active_treatment: z
    .boolean()
    .describe("True si ce medicament correspond deja a un traitement actif du patient."),
});

export const aiVerificationPayloadSchema = z.object({
  medicaments: z
    .array(aiVerificationMedicamentSchema)
    .min(1)
    .max(6)
    .describe("Medicament objects kept by the AI after verification and duplicate removal."),
  remarques: z
    .string()
    .max(800)
    .describe("Prescription remarks if needed, otherwise an empty string."),
  warnings: z
    .array(z.string().trim().min(1).max(500))
    .max(10)
    .describe("Warnings for the verified prescription."),
  global_warnings: z
    .array(z.string().trim().min(1).max(500))
    .max(12)
    .describe("Global warnings after verification."),
  verification_justification: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .describe("Short explanation of the checks, removed duplicates, and retained changes."),
});

export interface MedicationRecommendationSuggestion {
  rank: number;
  medicament_externe_id: string;
  nom_medicament: string;
  dci: string | null;
  dosage: string | null;
  posologie: string;
  duree_traitement: string | null;
  instructions: string | null;
  justification: string;
  warnings: string[];
  is_active_treatment?: boolean;
}

export const ordonnanceAiGenerationStatusSchema = z.enum([
  "draft_ready",
  "verifying",
  "verified",
  "verification_failed",
]);

export const ordonnanceAiAsyncEnvelopeSchema = z.object({
  generation_id: z.string().uuid(),
  verification_status: ordonnanceAiGenerationStatusSchema,
  verification_error: z.string().nullable(),
  verification_justification: z.string().nullable(),
  poll_after_ms: z.number().int().min(500).max(10000),
  result: z.unknown(),
  draft_result: z.unknown(),
  verified_result: z.unknown().nullable(),
  updated_at: z.string().trim().min(1),
});
