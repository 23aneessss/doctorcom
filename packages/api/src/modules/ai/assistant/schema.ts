import { z } from "zod";

export const assistantChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

export const assistantChatInputSchema = z.object({
  messages: z.array(assistantChatMessageSchema).min(1).max(20),
  patient_id: z.string().uuid().optional(),
  max_history_messages: z.coerce.number().int().min(1).max(12).optional(),
});

export const assistantResolvedIntentSchema = z.enum([
  "patient_qna",
  "medication_qna",
  "patient_context_required",
]);

export const assistantIntentClassificationSchema = z.object({
  intent: z.enum(["patient", "medication", "mixed", "unknown"]).default("unknown"),
  confidence: z.number().min(0).max(1).nullable().default(null),
  reason: z.string().trim().min(1).max(240).default("heuristic"),
});

export type AssistantChatInput = z.infer<typeof assistantChatInputSchema>;
export type AssistantChatMessage = z.infer<typeof assistantChatMessageSchema>;
export type AssistantResolvedIntent = z.infer<
  typeof assistantResolvedIntentSchema
>;

export interface AssistantReferencedMedication {
  medicament_externe_id: string;
  nom_medicament: string;
  dci: string | null;
  classe_therapeutique: string | null;
  why_relevant: string;
  highlights: string[];
}

export interface AssistantChatResult {
  resolved_intent: AssistantResolvedIntent;
  answer: string;
  warnings: string[];
  follow_up_suggestions: string[];
  referenced_medicaments?: AssistantReferencedMedication[];
}
