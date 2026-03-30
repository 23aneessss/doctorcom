import { z } from "zod";

export type RecommendationResponseMode = "ordonnance" | "medicaments";

export const recommendationMedicamentSchema = z.object({
  medicament_externe_id: z.string().trim().min(1),
  nom_medicament: z.string().trim().min(1).max(180),
  dci: z.string().trim().min(1).max(180).nullable(),
  dosage: z.string().trim().min(1).max(180).nullable(),
  posologie: z.string().trim().min(1).max(600),
  duree_traitement: z.string().trim().min(1).max(180).nullable(),
  instructions: z.string().trim().min(1).max(600).nullable(),
  justification: z.string().trim().min(1).max(800),
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
}
