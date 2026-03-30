import { z } from "zod";

export type MedicationAssistantIntent =
  | "search"
  | "explain"
  | "compare"
  | "safety"
  | "out_of_scope";

export type MedicationPolicyProfile =
  | "generic"
  | "antipyretic_simple"
  | "analgesic_simple"
  | "cough_wet"
  | "cough_dry"
  | "nasal_congestion"
  | "bronchodilator_inhaled"
  | "antibiotic_general"
  | "safety_lookup"
  | "comparison_general";

export interface StructuredMedicationQuery {
  intent: MedicationAssistantIntent;
  normalized_user_goal: string;
  requires_patient_context: boolean;
  medication_names_mentioned: string[];
  substances_mentioned: string[];
  therapeutic_classes_mentioned: string[];
  clinical_uses_mentioned: string[];
  safety_topics_requested: string[];
  requested_constraints: string[];
  comparison_requested: boolean;
  response_style: string;
  confidence: number | null;
}

export interface ModelReferencedMedication {
  medicament_externe_id: string;
  why_relevant: string;
  highlights: string[];
}

export interface ModelComparisonItem {
  medicament_externe_id: string;
  strengths: string[];
  cautions: string[];
}

export interface NormalizedModelResponse {
  answer: string;
  referenced_medicaments: ModelReferencedMedication[];
  comparison: {
    summary: string;
    items: ModelComparisonItem[];
  } | null;
  warnings: string[];
  follow_up_suggestions: string[];
}

export const medicationReferenceSchema = z.object({
  medicament_externe_id: z.string().trim().min(1),
  why_relevant: z.string().trim().min(1).max(500),
  highlights: z.array(z.string().trim().min(1).max(280)).max(6),
});

export const comparisonItemSchema = z.object({
  medicament_externe_id: z.string().trim().min(1),
  strengths: z.array(z.string().trim().min(1).max(280)).max(6),
  cautions: z.array(z.string().trim().min(1).max(280)).max(6),
});

export const aiResponseSchema = z.object({
  answer: z.string().trim().min(1).max(2500),
  referenced_medicaments: z.array(medicationReferenceSchema).max(8).default([]),
  comparison: z
    .object({
      summary: z.string().trim().min(1).max(1200),
      items: z.array(comparisonItemSchema).min(2).max(4),
    })
    .nullable()
    .default(null),
  warnings: z.array(z.string().trim().min(1).max(280)).max(12).default([]),
  follow_up_suggestions: z
    .array(z.string().trim().min(1).max(280))
    .max(8)
    .default([]),
});

export const structuredQuerySchema = z.object({
  intent: z
    .enum(["search", "explain", "compare", "safety", "out_of_scope"])
    .default("search"),
  normalized_user_goal: z.string().trim().min(1).max(500),
  requires_patient_context: z.boolean().default(false),
  medication_names_mentioned: z.array(z.string().trim().min(1).max(160)).max(8).default([]),
  substances_mentioned: z.array(z.string().trim().min(1).max(160)).max(8).default([]),
  therapeutic_classes_mentioned: z
    .array(z.string().trim().min(1).max(200))
    .max(8)
    .default([]),
  clinical_uses_mentioned: z.array(z.string().trim().min(1).max(200)).max(8).default([]),
  safety_topics_requested: z.array(z.string().trim().min(1).max(200)).max(8).default([]),
  requested_constraints: z.array(z.string().trim().min(1).max(200)).max(8).default([]),
  comparison_requested: z.boolean().default(false),
  response_style: z.string().trim().min(1).max(120).default("concise_clinical"),
  confidence: z.number().min(0).max(1).nullable().default(null),
});
