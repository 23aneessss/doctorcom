import { z } from "zod";

export const aiHypothesisSchema = z.object({
  label: z.string().trim().min(1).max(180),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().trim().min(1).max(1200),
  evidence_for: z.array(z.string().trim().min(1).max(280)).max(8).default([]),
  evidence_against: z.array(z.string().trim().min(1).max(280)).max(8).default([]),
  missing_information: z.array(z.string().trim().min(1).max(280)).max(8).default([]),
  recommended_next_questions: z
    .array(z.string().trim().min(1).max(280))
    .max(8)
    .default([]),
  recommended_next_checks: z
    .array(z.string().trim().min(1).max(280))
    .max(8)
    .default([]),
});

export const aiResponseSchema = z.object({
  recommendation_readiness: z.enum([
    "ready_for_recommendation",
    "needs_more_information",
    "urgent_medical_review",
  ]),
  chief_problem: z.string().trim().min(1).max(280),
  diagnostic_summary: z.string().trim().min(1).max(1600),
  hypotheses: z.array(aiHypothesisSchema).min(1).max(5),
  red_flags: z.array(z.string().trim().min(1).max(280)).max(8).default([]),
  caution_notes: z.array(z.string().trim().min(1).max(280)).max(8).default([]),
  global_missing_information: z
    .array(z.string().trim().min(1).max(280))
    .max(10)
    .default([]),
});

export type HypotheseAiResponse = z.infer<typeof aiResponseSchema>;
