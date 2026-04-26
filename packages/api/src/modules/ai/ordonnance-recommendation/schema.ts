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
  dci: z.string().trim().min(1).max(180).nullable(),
  dosage: z.string().trim().min(1).max(180).nullable(),
  posologie: z.string().trim().min(1).max(600),
  duree_traitement: z.string().trim().min(1).max(180).nullable(),
  instructions: z.string().trim().min(1).max(600).nullable(),
  justification: z.string().trim().min(1).max(800),
  is_active_treatment: z.boolean().optional().default(false),
});

export const recommendationSchema = z.object({
  rank: z.number().int().min(1).max(3),
  label: z.string().trim().min(1).max(120),
  rationale: z.string().trim().min(1).max(1400),
  warnings: z.array(z.string().trim().min(1).max(280)).max(10),
  ordonnance_draft: z.object({
    remarques: z.string().trim().min(1).max(500).nullable(),
    medicaments: z.array(recommendationMedicamentSchema).min(1).max(6),
  }),
});

export const aiResponseSchema = z.object({
  recommendations: z.array(recommendationSchema).max(3),
  global_warnings: z.array(z.string().trim().min(1).max(280)).max(12),
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
  poll_after_ms: z.number().int().min(500).max(10000),
  result: z.unknown(),
  draft_result: z.unknown(),
  verified_result: z.unknown().nullable(),
  updated_at: z.string().trim().min(1),
});
