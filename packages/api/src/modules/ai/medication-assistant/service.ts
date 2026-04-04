import { TRPCError } from "@trpc/server";
import { GoogleGenAI } from "@google/genai";
import type { db as databaseClient } from "@doctor.com/db";
import { env } from "@doctor.com/env/server";
import { z } from "zod";

import type { SessionUtilisateur } from "../../../trpc/context";
import {
  medicationAssistantRepository,
  type MedicationAggregate,
  type UtilisateurRecord,
} from "./repo";

type DatabaseClient = typeof databaseClient;
type MedicationAssistantSession = Exclude<SessionUtilisateur, null>;
type AIProviderName =
  | "openrouter"
  | "together"
  | "mistral"
  | "google-ai-studio";
type MedicationAssistantIntent =
  | "search"
  | "explain"
  | "compare"
  | "safety"
  | "out_of_scope";
type MedicationPolicyProfile =
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

interface AIProviderConfig {
  name: AIProviderName;
  model: string;
  apiKey: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface MedicationAssistantInput {
  messages: ChatMessage[];
  selected_medicament_ids?: number[];
  max_candidates?: number;
  max_history_messages?: number;
}

interface CandidateMedicationFeatures {
  active_substance_count: number;
  is_monotherapy: boolean;
  is_combination: boolean;
  is_suppressed: boolean;
  is_cold_flu_combo: boolean;
  is_aspirin_like: boolean;
  is_nsaid_like: boolean;
  is_paracetamol_like: boolean;
  is_antipyretic_like: boolean;
  is_analgesic_like: boolean;
  has_fever_indication: boolean;
  has_pain_indication: boolean;
  is_cough_wet_like: boolean;
  is_cough_dry_like: boolean;
  is_nasal_congestion_like: boolean;
  is_bronchodilator_like: boolean;
  is_inhaled_like: boolean;
  is_antibiotic_like: boolean;
  has_adult_posology: boolean;
  has_safety_content: boolean;
}

interface CandidateMedication {
  aggregate: MedicationAggregate;
  score: number;
  matched_terms: string[];
  match_reasons: string[];
  is_selected: boolean;
  policy_notes: string[];
  deprioritized_reasons: string[];
  safety_notes: string[];
  status_notes: string[];
  features: CandidateMedicationFeatures;
}

interface StructuredMedicationQuery {
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

interface ModelReferencedMedication {
  medicament_externe_id: string;
  why_relevant: string;
  highlights: string[];
}

interface ModelComparisonItem {
  medicament_externe_id: string;
  strengths: string[];
  cautions: string[];
}

interface NormalizedModelResponse {
  answer: string;
  referenced_medicaments: ModelReferencedMedication[];
  comparison: {
    summary: string;
    items: ModelComparisonItem[];
  } | null;
  warnings: string[];
  follow_up_suggestions: string[];
}

export interface MedicationAssistantResult {
  provider: AIProviderName;
  model: string;
  generated_at: string;
  intent: MedicationAssistantIntent;
  answer: string;
  referenced_medicaments: Array<{
    medicament_externe_id: string;
    nom_medicament: string;
    dci: string | null;
    classe_therapeutique: string | null;
    why_relevant: string;
    highlights: string[];
  }>;
  comparison: {
    summary: string;
    items: Array<{
      medicament_externe_id: string;
      nom_medicament: string;
      dci: string | null;
      strengths: string[];
      cautions: string[];
    }>;
  } | null;
  warnings: string[];
  follow_up_suggestions: string[];
  requires_patient_context: boolean;
}

const providerTimeoutMs = 25000;
const medicationAssistantDisclaimer =
  "Assistant global du catalogue medicaments. Il ne remplace pas la verification contextuelle sur un patient reel.";

const medicationReferenceSchema = z.object({
  medicament_externe_id: z.string().trim().min(1),
  why_relevant: z.string().trim().min(1).max(500),
  highlights: z.array(z.string().trim().min(1).max(280)).max(6),
});

const comparisonItemSchema = z.object({
  medicament_externe_id: z.string().trim().min(1),
  strengths: z.array(z.string().trim().min(1).max(280)).max(6),
  cautions: z.array(z.string().trim().min(1).max(280)).max(6),
});

const aiResponseSchema = z.object({
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

const structuredQuerySchema = z.object({
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

const openRouterResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "answer",
    "referenced_medicaments",
    "comparison",
    "warnings",
    "follow_up_suggestions",
  ],
  properties: {
    answer: { type: "string" },
    referenced_medicaments: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["medicament_externe_id", "why_relevant", "highlights"],
        properties: {
          medicament_externe_id: { type: "string" },
          why_relevant: { type: "string" },
          highlights: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    comparison: {
      anyOf: [
        {
          type: "null",
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["summary", "items"],
          properties: {
            summary: { type: "string" },
            items: {
              type: "array",
              minItems: 2,
              maxItems: 4,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["medicament_externe_id", "strengths", "cautions"],
                properties: {
                  medicament_externe_id: { type: "string" },
                  strengths: {
                    type: "array",
                    items: { type: "string" },
                  },
                  cautions: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
            },
          },
        },
      ],
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
    follow_up_suggestions: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

const structuredQueryJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "intent",
    "normalized_user_goal",
    "requires_patient_context",
    "medication_names_mentioned",
    "substances_mentioned",
    "therapeutic_classes_mentioned",
    "clinical_uses_mentioned",
    "safety_topics_requested",
    "requested_constraints",
    "comparison_requested",
    "response_style",
    "confidence",
  ],
  properties: {
    intent: {
      type: "string",
      enum: ["search", "explain", "compare", "safety", "out_of_scope"],
    },
    normalized_user_goal: { type: "string" },
    requires_patient_context: { type: "boolean" },
    medication_names_mentioned: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    substances_mentioned: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    therapeutic_classes_mentioned: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    clinical_uses_mentioned: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    safety_topics_requested: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    requested_constraints: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    comparison_requested: { type: "boolean" },
    response_style: { type: "string" },
    confidence: {
      anyOf: [{ type: "null" }, { type: "number", minimum: 0, maximum: 1 }],
    },
  },
} as const;

const medicationStopWords = new Set([
  "alors",
  "avec",
  "avoir",
  "besoin",
  "ce",
  "cette",
  "ces",
  "compare",
  "comparer",
  "contre",
  "dans",
  "de",
  "des",
  "difference",
  "differences",
  "donne",
  "donner",
  "du",
  "est",
  "et",
  "global",
  "important",
  "importantes",
  "interactions",
  "je",
  "la",
  "le",
  "les",
  "medicament",
  "medicaments",
  "moi",
  "mon",
  "pas",
  "peux",
  "pour",
  "precautions",
  "principales",
  "quelles",
  "quel",
  "quelle",
  "recherche",
  "risques",
  "sa",
  "ses",
  "sur",
  "toi",
  "un",
  "une",
  "veux",
  "voir",
]);

const medicationRelatedKeywords = [
  "antalgique",
  "antibiotique",
  "antipyretique",
  "bronchodilatateur",
  "contre-indication",
  "contre indication",
  "dosage",
  "effets secondaires",
  "forme",
  "ibuprofene",
  "indication",
  "interaction",
  "medicament",
  "molecule",
  "ordonnance",
  "paracetamol",
  "posologie",
  "precaution",
  "substance active",
  "toux",
];

export class MedicationAssistantService {
  async chat(data: {
    db: DatabaseClient;
    session: MedicationAssistantSession;
    input: MedicationAssistantInput;
  }): Promise<MedicationAssistantResult> {
    const provider = this.resolveAiProvider();
    await this.resolveUtilisateur(data.db, data.session);

    const maxHistoryMessages = this.clamp(
      data.input.max_history_messages ?? 8,
      1,
      12,
    );
    const maxCandidates = this.clamp(data.input.max_candidates ?? 12, 3, 20);

    const normalizedMessages = this.normalizeMessages(
      data.input.messages,
      maxHistoryMessages,
    );
    const lastUserMessage = this.getLastUserMessage(normalizedMessages);

    if (!lastUserMessage) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Le dernier message utile doit etre un message utilisateur non vide.",
      });
    }

    const warnings: string[] = [];
    const selectedIds = [
      ...new Set((data.input.selected_medicament_ids ?? []).filter(Boolean)),
    ];
    const heuristicIntent = this.detectIntent(lastUserMessage, selectedIds);
    const structuredQuery = await this.buildStructuredQuery({
      provider,
      messages: normalizedMessages,
      selectedIds,
      heuristicIntent,
    }).catch((error) => {
      warnings.push(this.buildProviderFallbackWarning(error, "analyse de la requete"));
      return this.buildFallbackStructuredQuery(
        lastUserMessage,
        selectedIds,
        heuristicIntent,
      );
    });

    const detectedIntent = this.resolveFinalIntent(
      structuredQuery,
      heuristicIntent,
      selectedIds,
    );

    if (
      structuredQuery.requires_patient_context ||
      this.requiresPatientContext(lastUserMessage)
    ) {
      return this.buildPatientContextRequiredResponse(
        provider,
        detectedIntent,
        medicationAssistantDisclaimer,
        warnings,
      );
    }

    const policyProfile = this.derivePolicyProfile(structuredQuery, detectedIntent);
    const searchTerms = this.buildSearchTerms(
      lastUserMessage,
      structuredQuery,
      policyProfile,
    );
    const identitySearchTerms = this.buildIdentitySearchTerms(
      structuredQuery,
      policyProfile,
    );
    const selectedAggregates =
      await medicationAssistantRepository.getMedicationAggregatesByIds(selectedIds);
    const selectedFoundIds = selectedAggregates.map(
      (aggregate) => aggregate.medicament.id,
    );
    const missingSelectedIds = selectedIds.filter((id) => !selectedFoundIds.includes(id));
    const directNameMatches = await medicationAssistantRepository.searchMedicamentsByNames(
      [
        ...structuredQuery.medication_names_mentioned,
        ...structuredQuery.substances_mentioned,
        ...identitySearchTerms,
      ],
      24,
    );

    const broadRecallRows =
      await medicationAssistantRepository.searchMedicamentsBroadRecall(
        searchTerms,
        Math.min(Math.max(maxCandidates * 5, 28), 72),
      );

    const aggregateIds = [
      ...selectedFoundIds,
      ...directNameMatches
        .map((row) => row.id)
        .filter((id) => !selectedFoundIds.includes(id)),
      ...broadRecallRows
        .map((row) => row.id)
        .filter(
          (id) =>
            !selectedFoundIds.includes(id) &&
            !directNameMatches.some((row) => row.id === id),
        ),
    ];

    const candidateAggregates =
      aggregateIds.length === selectedFoundIds.length && selectedAggregates.length > 0
        ? selectedAggregates
        : await medicationAssistantRepository.getMedicationAggregatesByIds(
            aggregateIds.slice(0, Math.min(Math.max(maxCandidates * 5, 28), 72)),
          );

    const scoredCandidates = this.scoreCandidates(
      candidateAggregates,
      {
        searchTerms,
        intent: detectedIntent,
        structuredQuery,
        policyProfile,
        selectedIds: new Set(selectedFoundIds),
      },
    );
    const shortlistedCandidates = this.buildShortlist(
      scoredCandidates,
      detectedIntent,
      policyProfile,
      maxCandidates,
    );

    if (
      shortlistedCandidates.length === 0 &&
      scoredCandidates.some((candidate) => candidate.score > 0)
    ) {
      warnings.push(
        "Aucun candidat n'a passe le filtre clinique de pertinence pour cette demande; les faux positifs ont ete exclus.",
      );
    }

    if (missingSelectedIds.length > 0) {
      warnings.push(
        `Certains medicaments selectionnes n'ont pas ete trouves dans la base locale: ${missingSelectedIds.join(", ")}.`,
      );
    }

    if (shortlistedCandidates.length === 0) {
      return this.buildNoCandidateResponse(
        provider,
        detectedIntent,
        lastUserMessage,
        warnings,
        structuredQuery,
        policyProfile,
      );
    }

    if (detectedIntent === "compare" && shortlistedCandidates.length < 2) {
      warnings.push(
        "Comparaison incomplete: moins de deux medicaments exploitables ont ete identifies.",
      );
    }

    const aiResponse = await this.generateAiResponse({
      provider,
      intent: detectedIntent,
      messages: normalizedMessages,
      shortlistedCandidates,
      structuredQuery,
      policyProfile,
    }).catch((error) => {
      warnings.push(this.buildProviderFallbackWarning(error, "reponse finale"));
      return null;
    });

    const validatedResponse = this.postValidateResponse(
      detectedIntent,
      structuredQuery,
      policyProfile,
      shortlistedCandidates,
      aiResponse,
    );

    return {
      provider: provider.name,
      model: provider.model,
      generated_at: new Date().toISOString(),
      intent: detectedIntent,
      answer: validatedResponse.answer,
      referenced_medicaments: validatedResponse.referenced_medicaments,
      comparison: validatedResponse.comparison,
      warnings: [...new Set([...warnings, ...validatedResponse.warnings])],
      follow_up_suggestions: validatedResponse.follow_up_suggestions,
      requires_patient_context: false,
    };
  }

  private resolveAiProvider(): AIProviderConfig {
    const providerConfigs: Record<AIProviderName, AIProviderConfig | null> = {
      openrouter: env.OPENROUTER_API_KEY
        ? {
            name: "openrouter",
            model: env.OPENROUTER_MODEL,
            apiKey: env.OPENROUTER_API_KEY,
          }
        : null,
      together: env.TOGETHER_API_KEY
        ? {
            name: "together",
            model: env.TOGETHER_MODEL,
            apiKey: env.TOGETHER_API_KEY,
          }
        : null,
      mistral: env.MISTRAL_API_KEY
        ? {
            name: "mistral",
            model: env.MISTRAL_MODEL,
            apiKey: env.MISTRAL_API_KEY,
          }
        : null,
      "google-ai-studio": env.GEMINI_API_KEY
        ? {
            name: "google-ai-studio",
            model: env.GEMINI_MODEL,
            apiKey: env.GEMINI_API_KEY,
          }
        : null,
    };

    if (env.AI_PROVIDER) {
      const selectedProvider = providerConfigs[env.AI_PROVIDER];
      if (!selectedProvider) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `AI_PROVIDER=${env.AI_PROVIDER} est configure, mais la cle API correspondante est absente dans apps/server/.env.`,
        });
      }

      return selectedProvider;
    }

    if (providerConfigs.openrouter) {
      return providerConfigs.openrouter;
    }

    if (providerConfigs.together) {
      return providerConfigs.together;
    }

    if (providerConfigs.mistral) {
      return providerConfigs.mistral;
    }

    if (providerConfigs["google-ai-studio"]) {
      return providerConfigs["google-ai-studio"];
    }

    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Aucune cle AI n'est configuree. Ajoute OPENROUTER_API_KEY, TOGETHER_API_KEY, MISTRAL_API_KEY ou GEMINI_API_KEY dans apps/server/.env. Tu peux aussi forcer le provider avec AI_PROVIDER.",
    });
  }

  private async resolveUtilisateur(
    db: DatabaseClient,
    session: MedicationAssistantSession,
  ): Promise<UtilisateurRecord> {
    const email = session.user.email;
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Session invalide: email utilisateur manquant.",
      });
    }

    const utilisateur = await medicationAssistantRepository.findUtilisateurByEmail(
      db,
      email,
    );

    if (!utilisateur) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Utilisateur metier introuvable pour cette session.",
      });
    }

    return utilisateur;
  }

  private normalizeMessages(
    messages: ChatMessage[],
    maxHistoryMessages: number,
  ): ChatMessage[] {
    return messages
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }))
      .filter((message) => message.content.length > 0)
      .slice(-maxHistoryMessages);
  }

  private getLastUserMessage(messages: ChatMessage[]): string | null {
    const lastMessage = [...messages].reverse().find((message) => message.role === "user");
    return lastMessage?.content ?? null;
  }

  private detectIntent(
    question: string,
    selectedIds: number[],
  ): MedicationAssistantIntent {
    const normalizedQuestion = this.normalizeText(question);

    if (
      /(compare|comparer|difference|différence|versus|\bvs\b)/i.test(question) ||
      selectedIds.length >= 2
    ) {
      return "compare";
    }

    if (
      /(contre[- ]indication|interaction|danger|risque|precaution|précaution|effet secondaire|allaitement|grossesse)/i.test(
        question,
      )
    ) {
      return "safety";
    }

    if (selectedIds.length > 0) {
      return "explain";
    }

    if (
      medicationRelatedKeywords.some((keyword) =>
        normalizedQuestion.includes(this.normalizeText(keyword)),
      )
    ) {
      return "search";
    }

    return "search";
  }

  private resolveFinalIntent(
    structuredQuery: StructuredMedicationQuery,
    heuristicIntent: MedicationAssistantIntent,
    selectedIds: number[],
  ): MedicationAssistantIntent {
    if (selectedIds.length >= 2 || structuredQuery.comparison_requested) {
      return "compare";
    }

    if (
      structuredQuery.safety_topics_requested.length > 0 &&
      heuristicIntent !== "compare"
    ) {
      return "safety";
    }

    if (selectedIds.length > 0 && structuredQuery.intent === "search") {
      return "explain";
    }

    return structuredQuery.intent || heuristicIntent;
  }

  private async buildStructuredQuery(data: {
    provider: AIProviderConfig;
    messages: ChatMessage[];
    selectedIds: number[];
    heuristicIntent: MedicationAssistantIntent;
  }): Promise<StructuredMedicationQuery> {
    const rawText =
      data.provider.name === "openrouter"
        ? await this.generateStructuredQueryWithOpenRouter(
            data.provider,
            data.messages,
            data.selectedIds,
            data.heuristicIntent,
          )
        : data.provider.name === "together"
          ? await this.generateStructuredQueryWithTogether(
              data.provider,
              data.messages,
              data.selectedIds,
              data.heuristicIntent,
            )
          : data.provider.name === "mistral"
            ? await this.generateStructuredQueryWithMistral(
                data.provider,
                data.messages,
                data.selectedIds,
                data.heuristicIntent,
              )
            : await this.generateStructuredQueryWithGemini(
                data.provider,
                data.messages,
                data.selectedIds,
                data.heuristicIntent,
              );

    const parsed = this.parseModelJson(rawText);
    if (!parsed) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "La passe de construction de contexte medicament n'a pas retourne de JSON exploitable.",
      });
    }

    return this.normalizeStructuredQuery(parsed, data.heuristicIntent);
  }

  private buildFallbackStructuredQuery(
    question: string,
    selectedIds: number[],
    heuristicIntent: MedicationAssistantIntent,
  ): StructuredMedicationQuery {
    const normalizedQuestion = this.normalizeText(question);
    const clinicalUsesMentioned: string[] = [];

    if (/antipyret|fievre/.test(normalizedQuestion)) {
      clinicalUsesMentioned.push("antipyretique");
    }
    if (/antalg|douleur|migraine|cephalee|mal de tete/.test(normalizedQuestion)) {
      clinicalUsesMentioned.push("antalgique");
    }
    if (/bronchodilat|asthme|sifflement|wheezing|inhal/.test(normalizedQuestion)) {
      clinicalUsesMentioned.push("bronchodilatateur");
    }
    if (/rhume|nez bouche|congestion/.test(normalizedQuestion)) {
      clinicalUsesMentioned.push("congestion nasale");
    }
    if (/toux grasse|expectoration|mucos|productive/.test(normalizedQuestion)) {
      clinicalUsesMentioned.push("toux grasse");
    }
    if (/toux seche/.test(normalizedQuestion)) {
      clinicalUsesMentioned.push("toux seche");
    }
    if (/antibioti|infection bacter/.test(normalizedQuestion)) {
      clinicalUsesMentioned.push("antibiotique");
    }

    return {
      intent: heuristicIntent,
      normalized_user_goal: question.trim(),
      requires_patient_context: this.requiresPatientContext(question),
      medication_names_mentioned: selectedIds.length > 0 ? [] : [],
      substances_mentioned: [],
      therapeutic_classes_mentioned: [],
      clinical_uses_mentioned: [...new Set(clinicalUsesMentioned)],
      safety_topics_requested: /(contre[- ]indication|interaction|danger|risque|precaution|grossesse|allaitement)/i.test(
        question,
      )
        ? ["securite medicament"]
        : [],
      requested_constraints: [],
      comparison_requested:
        heuristicIntent === "compare" ||
        /(compare|comparer|difference|différence|versus|\bvs\b)/i.test(question),
      response_style: "concise_clinical",
      confidence: null,
    };
  }

  private requiresPatientContext(question: string): boolean {
    return /(mon patient|ma patiente|ce patient|cette patiente|pour lui|pour elle|ses allergies|ses antecedents|ses antécédents|son traitement|lui prescrire|puis-je lui prescrire|adapter a ce patient|adapte a ce patient)/i.test(
      question,
    );
  }

  private derivePolicyProfile(
    structuredQuery: StructuredMedicationQuery,
    intent: MedicationAssistantIntent,
  ): MedicationPolicyProfile {
    if (intent === "compare" || structuredQuery.comparison_requested) {
      return "comparison_general";
    }

    if (intent === "safety" || structuredQuery.safety_topics_requested.length > 0) {
      return "safety_lookup";
    }

    const normalizedContext = this.normalizeText(
      [
        structuredQuery.normalized_user_goal,
        ...structuredQuery.therapeutic_classes_mentioned,
        ...structuredQuery.clinical_uses_mentioned,
        ...structuredQuery.requested_constraints,
      ].join(" "),
    );

    if (/antipyret|fievre/.test(normalizedContext)) {
      return "antipyretic_simple";
    }
    if (/antalg|douleur|cephalee|mal de tete/.test(normalizedContext)) {
      return "analgesic_simple";
    }
    if (/toux grasse|expectoration|productiv|mucolyt|expector/.test(normalizedContext)) {
      return "cough_wet";
    }
    if (/toux seche|toux sèche|antituss/.test(normalizedContext)) {
      return "cough_dry";
    }
    if (/rhume|nez bouche|congestion nasale|decongestion/.test(normalizedContext)) {
      return "nasal_congestion";
    }
    if (/bronchodilat|asthme|inhal/.test(normalizedContext)) {
      return "bronchodilator_inhaled";
    }
    if (/antibioti|macrolide|infection bacter/.test(normalizedContext)) {
      return "antibiotic_general";
    }

    return "generic";
  }

  private buildSearchTerms(
    question: string,
    structuredQuery: StructuredMedicationQuery,
    policyProfile: MedicationPolicyProfile,
  ): string[] {
    const seededTerms = [
      structuredQuery.normalized_user_goal,
      ...structuredQuery.medication_names_mentioned,
      ...structuredQuery.substances_mentioned,
      ...structuredQuery.therapeutic_classes_mentioned,
      ...structuredQuery.clinical_uses_mentioned,
      ...structuredQuery.safety_topics_requested,
      ...structuredQuery.requested_constraints,
      ...this.getPolicyExpansionTerms(policyProfile, structuredQuery),
    ]
      .map((term) => term.trim())
      .filter(Boolean);

    if (seededTerms.length > 0) {
      return this.expandSearchTerms(seededTerms);
    }

    return this.expandSearchTerms([question]);
  }

  private buildIdentitySearchTerms(
    structuredQuery: StructuredMedicationQuery,
    policyProfile: MedicationPolicyProfile,
  ): string[] {
    const seededTerms = [
      ...structuredQuery.medication_names_mentioned,
      ...structuredQuery.substances_mentioned,
    ];

    switch (policyProfile) {
      case "antipyretic_simple":
        seededTerms.push("paracetamol", "paracétamol", "dafalgan", "doliprane");
        break;
      case "analgesic_simple":
        seededTerms.push(
          "paracetamol",
          "paracétamol",
          "dafalgan",
          "doliprane",
          "ibuprofene",
          "ibuprofène",
        );
        break;
      case "bronchodilator_inhaled":
        seededTerms.push("salbutamol", "ventoline", "terbutaline", "bricanyl");
        break;
      case "antibiotic_general":
        seededTerms.push(
          "amoxicilline",
          "azithromycine",
          "clarithromycine",
          "ceftriaxone",
        );
        break;
      case "cough_wet":
        seededTerms.push("acetylcysteine", "acétylcystéine", "carbocisteine");
        break;
      case "cough_dry":
        seededTerms.push("dextromethorphane", "pholcodine");
        break;
      case "nasal_congestion":
        seededTerms.push("pseudoephedrine", "pseudoéphédrine", "oxymetazoline");
        break;
      case "safety_lookup":
      case "comparison_general":
      case "generic":
      default:
        break;
    }

    return [...new Set(seededTerms.map((term) => term.trim()).filter(Boolean))].slice(
      0,
      12,
    );
  }

  private getPolicyExpansionTerms(
    policyProfile: MedicationPolicyProfile,
    structuredQuery: StructuredMedicationQuery,
  ): string[] {
    const requestContext = this.normalizeText(
      [
        structuredQuery.normalized_user_goal,
        ...structuredQuery.requested_constraints,
      ].join(" "),
    );

    switch (policyProfile) {
      case "antipyretic_simple":
        return [
          "antipyretique",
          "antipyrétique",
          "fievre",
          "fièvre",
          "paracetamol",
          "paracétamol",
          "antalgique antipyretique",
        ];

      case "analgesic_simple":
        return [
          "antalgique",
          "douleur",
          "paracetamol",
          "paracétamol",
        ];

      case "bronchodilator_inhaled":
        return [
          "bronchodilatateur",
          "bronchodilatateur inhale",
          "inhalation",
          "inhalé",
          "aerosol",
          "aérosol",
          "salbutamol",
        ];

      case "antibiotic_general":
        return [
          "antibiotique",
          "anti infectieux",
          "macrolide",
          "amoxicilline",
          "azithromycine",
        ];

      case "cough_wet":
        return [
          "toux grasse",
          "expectorant",
          "expectorations",
          "mucolytique",
          "fluidifiant bronchique",
        ];

      case "cough_dry":
        return ["toux seche", "toux sèche", "antitussif"];

      case "nasal_congestion":
        return [
          "congestion nasale",
          "nez bouche",
          "nez bouché",
          "decongestionnant",
          "vasoconstricteur",
        ];

      case "safety_lookup":
        return requestContext.includes("interaction")
          ? ["interaction", "interactions"]
          : requestContext.includes("grossesse")
            ? ["grossesse", "allaitement"]
            : ["contre indication", "contre-indication", "precaution", "interaction"];

      case "comparison_general":
      case "generic":
      default:
        return [];
    }
  }

  private expandSearchTerms(terms: string[]): string[] {
    const phrases = [...new Set(terms.filter(Boolean))].slice(0, 12);
    const tokens = phrases
      .flatMap((term) =>
        term
          .replace(/[^\p{L}\p{N}\s-]/gu, " ")
          .replace(/\s+/g, " ")
          .trim()
          .split(/[\s-]+/),
      )
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
      .filter((token) => !medicationStopWords.has(this.normalizeText(token)));

    const bigrams: string[] = [];
    for (let index = 0; index < tokens.length - 1; index += 1) {
      bigrams.push(`${tokens[index]} ${tokens[index + 1]}`);
    }

    return [...new Set([...phrases, ...bigrams, ...tokens])].slice(0, 18);
  }

  private scoreCandidates(
    aggregates: MedicationAggregate[],
    data: {
      searchTerms: string[];
      intent: MedicationAssistantIntent;
      structuredQuery: StructuredMedicationQuery;
      policyProfile: MedicationPolicyProfile;
      selectedIds: Set<number>;
    },
  ): CandidateMedication[] {
    return aggregates
      .map((aggregate) => {
        const medicament = aggregate.medicament;
        const features = this.computeCandidateFeatures(aggregate);
        let score = data.selectedIds.has(medicament.id) ? 120 : 0;
        const matchedTerms = new Set<string>();
        const matchReasons = new Set<string>();
        const policyNotes = new Set<string>();
        const deprioritizedReasons = new Set<string>();
        const safetyNotes = new Set<string>();
        const statusNotes = new Set<string>();

        const fieldCorpus = {
          nom: this.normalizeText(medicament.nom_medicament),
          dci: this.normalizeText(medicament.nom_generique),
          classe: this.normalizeText(medicament.classe_therapeutique),
          famille: this.normalizeText(medicament.famille_pharmacologique),
          substances: this.normalizeText(
            aggregate.substances_actives.map((item) => item.nom_substance).join(" "),
          ),
          indications: this.normalizeText(
            aggregate.indications.map((item) => item.indication).join(" "),
          ),
          contre: this.normalizeText(
            aggregate.contre_indications.map((item) => item.description).join(" "),
          ),
          precautions: this.normalizeText(
            aggregate.precautions.map((item) => item.description).join(" "),
          ),
          interactions: this.normalizeText(
            aggregate.interactions.map((item) => item.medicament_interaction).join(" "),
          ),
          presentations: this.normalizeText(
            aggregate.presentations
              .map((item) => [item.forme, item.dosage].filter(Boolean).join(" "))
              .join(" "),
          ),
        };

        for (const term of data.searchTerms) {
          const normalizedTerm = this.normalizeText(term);
          if (!normalizedTerm) {
            continue;
          }

          let termMatched = false;

          if (fieldCorpus.nom.includes(normalizedTerm)) {
            score += 16;
            termMatched = true;
            matchReasons.add("Match sur le nom du medicament");
          }
          if (fieldCorpus.dci.includes(normalizedTerm)) {
            score += 14;
            termMatched = true;
            matchReasons.add("Match sur la DCI / nom generique");
          }
          if (fieldCorpus.substances.includes(normalizedTerm)) {
            score += 13;
            termMatched = true;
            matchReasons.add("Match sur la substance active");
          }
          if (fieldCorpus.classe.includes(normalizedTerm)) {
            score += 11;
            termMatched = true;
            matchReasons.add("Match sur la classe therapeutique");
          }
          if (fieldCorpus.famille.includes(normalizedTerm)) {
            score += 9;
            termMatched = true;
            matchReasons.add("Match sur la famille pharmacologique");
          }
          if (fieldCorpus.indications.includes(normalizedTerm)) {
            score += 12;
            termMatched = true;
            matchReasons.add("Match sur une indication");
          }
          if (fieldCorpus.presentations.includes(normalizedTerm)) {
            score += 5;
            termMatched = true;
            matchReasons.add("Match sur la forme / presentation");
          }

          if (data.intent === "safety") {
            if (fieldCorpus.contre.includes(normalizedTerm)) {
              score += 10;
              termMatched = true;
              matchReasons.add("Match sur les contre-indications");
            }
            if (fieldCorpus.precautions.includes(normalizedTerm)) {
              score += 10;
              termMatched = true;
              matchReasons.add("Match sur les precautions");
            }
            if (fieldCorpus.interactions.includes(normalizedTerm)) {
              score += 10;
              termMatched = true;
              matchReasons.add("Match sur les interactions");
            }
          }

          if (termMatched) {
            matchedTerms.add(term);
          }
        }

        if (features.has_adult_posology) {
          score += 4;
          policyNotes.add("Posologie adulte disponible");
        }
        if (aggregate.indications.length > 0) {
          score += 3;
        }
        if (features.is_monotherapy) {
          score += 5;
          policyNotes.add("Monotherapie plus simple a expliquer");
        }
        if (features.has_safety_content && data.intent === "safety") {
          score += 8;
          safetyNotes.add("Contenu de securite disponible");
        }

        if (features.is_suppressed) {
          score -= 20;
          statusNotes.add("Statut supprime repere dans les donnees scrapees");
          deprioritizedReasons.add("Produit de-priorise car statut supprime");
        }

        this.applyPolicyScoring(
          {
            aggregate,
            features,
            fieldCorpus,
          },
          {
            policyProfile: data.policyProfile,
            policyNotes,
            deprioritizedReasons,
            safetyNotes,
            scoreRef: {
              add: (value: number) => {
                score += value;
              },
            },
          },
        );

        return {
          aggregate,
          score,
          matched_terms: [...matchedTerms],
          match_reasons: [...matchReasons],
          is_selected: data.selectedIds.has(medicament.id),
          policy_notes: [...policyNotes],
          deprioritized_reasons: [...deprioritizedReasons],
          safety_notes: [...safetyNotes],
          status_notes: [...statusNotes],
          features,
        };
      })
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.aggregate.medicament.nom_medicament.localeCompare(
          right.aggregate.medicament.nom_medicament,
        );
      });
  }

  private buildShortlist(
    candidates: CandidateMedication[],
    intent: MedicationAssistantIntent,
    policyProfile: MedicationPolicyProfile,
    maxCandidates: number,
  ): CandidateMedication[] {
    const minimum = intent === "compare" ? 2 : 1;
    const policyLimit =
      policyProfile === "comparison_general"
        ? 4
        : policyProfile === "safety_lookup"
          ? 4
          : policyProfile === "generic"
            ? 8
            : 6;
    const limit = Math.max(minimum, Math.min(maxCandidates, policyLimit));
    const positiveCandidates = candidates.filter((candidate) => candidate.score > 0);
    const gatedCandidates = positiveCandidates.filter((candidate) =>
      this.passesClinicalGate(candidate, intent, policyProfile),
    );

    if (gatedCandidates.length > 0) {
      return gatedCandidates.slice(0, limit);
    }

    return [];
  }

  private passesClinicalGate(
    candidate: CandidateMedication,
    intent: MedicationAssistantIntent,
    policyProfile: MedicationPolicyProfile,
  ): boolean {
    if (candidate.is_selected) {
      return true;
    }

    if (intent === "explain" && candidate.matched_terms.length > 0) {
      return true;
    }

    switch (policyProfile) {
      case "antipyretic_simple":
        return candidate.features.is_paracetamol_like || candidate.features.has_fever_indication;

      case "analgesic_simple":
        return candidate.features.is_paracetamol_like || candidate.features.has_pain_indication;

      case "bronchodilator_inhaled":
        return candidate.features.is_bronchodilator_like && candidate.features.is_inhaled_like;

      case "antibiotic_general":
        return candidate.features.is_antibiotic_like;

      case "cough_wet":
        return candidate.features.is_cough_wet_like;

      case "cough_dry":
        return candidate.features.is_cough_dry_like;

      case "nasal_congestion":
        return candidate.features.is_nasal_congestion_like;

      case "safety_lookup":
        return candidate.features.has_safety_content || candidate.match_reasons.length > 0;

      case "comparison_general":
        return candidate.match_reasons.length > 0 || candidate.features.has_safety_content;

      case "generic":
      default:
        return candidate.match_reasons.length > 0;
    }
  }

  private buildStructuredQueryPrompt(data: {
    messages: ChatMessage[];
    selectedIds: number[];
    heuristicIntent: MedicationAssistantIntent;
  }): string {
    const historyText = data.messages
      .map((message) => `${message.role === "user" ? "Utilisateur" : "Assistant"}: ${message.content}`)
      .join("\n");

    return [
      "Tu es un normalisateur de requetes pour un assistant catalogue medicaments.",
      "Ta mission est de transformer la demande brute en intention structuree pour le backend.",
      "Tu ne donnes pas encore la reponse finale au medecin.",
      "Tu n'inventes ni medicament ni patient ni contexte absent.",
      "Si la demande depend d'un patient reel (allergies, antecedents, traitements, prescription pour ce patient), marque requires_patient_context=true.",
      "Si la demande est globale catalogue, reste requires_patient_context=false.",
      "Retourne uniquement un JSON valide conforme au schema demande.",
      "",
      `Intent heuristique backend: ${data.heuristicIntent}`,
      `Nombre de medicaments deja selectionnes par le frontend: ${data.selectedIds.length}`,
      "",
      "Historique recent:",
      historyText,
    ].join("\n");
  }

  private async generateStructuredQueryWithOpenRouter(
    provider: AIProviderConfig,
    messages: ChatMessage[],
    selectedIds: number[],
    heuristicIntent: MedicationAssistantIntent,
  ): Promise<string> {
    const response = await this.withProviderTimeout(
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": env.CORS_ORIGIN,
          "X-Title": "doctor-com-backend",
        },
        body: JSON.stringify({
          model: provider.model,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content:
                "Tu es un constructeur de contexte pour un assistant medicaments. Tu retournes uniquement du JSON conforme au schema.",
            },
            {
              role: "user",
              content: this.buildStructuredQueryPrompt({
                messages,
                selectedIds,
                heuristicIntent,
              }),
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "medication_assistant_query_builder",
              strict: true,
              schema: structuredQueryJsonSchema,
            },
          },
        }),
      }),
    ).catch((error) => {
      throw this.mapAiProviderError(provider.name, error);
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw this.mapAiProviderHttpError(provider.name, response.status, errorText);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?:
            | string
            | Array<{
                type?: string;
                text?: string;
              }>;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      return content.trim();
    }

    if (Array.isArray(content)) {
      return content
        .map((item) => item.text ?? "")
        .join("")
        .trim();
    }

    return "";
  }

  private async generateStructuredQueryWithGemini(
    provider: AIProviderConfig,
    messages: ChatMessage[],
    selectedIds: number[],
    heuristicIntent: MedicationAssistantIntent,
  ): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: provider.apiKey });

    const response = await this.withProviderTimeout(
      ai.models.generateContent({
        model: provider.model,
        contents: this.buildStructuredQueryPrompt({
          messages,
          selectedIds,
          heuristicIntent,
        }),
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseJsonSchema: structuredQueryJsonSchema,
        },
      }),
    ).catch((error) => {
      throw this.mapAiProviderError(provider.name, error);
    });

    return response.text?.trim() ?? "";
  }

  private async generateStructuredQueryWithTogether(
    provider: AIProviderConfig,
    messages: ChatMessage[],
    selectedIds: number[],
    heuristicIntent: MedicationAssistantIntent,
  ): Promise<string> {
    const response = await this.withProviderTimeout(
      fetch("https://api.together.xyz/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content:
                "Tu es un constructeur de contexte pour un assistant medicaments. Tu retournes uniquement du JSON conforme au schema.",
            },
            {
              role: "user",
              content: this.buildStructuredQueryPrompt({
                messages,
                selectedIds,
                heuristicIntent,
              }),
            },
          ],
          response_format: {
            type: "json_object",
          },
        }),
      }),
    ).catch((error) => {
      throw this.mapAiProviderError(provider.name, error);
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw this.mapAiProviderHttpError(provider.name, response.status, errorText);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    return payload.choices?.[0]?.message?.content?.trim() ?? "";
  }

  private async generateStructuredQueryWithMistral(
    provider: AIProviderConfig,
    messages: ChatMessage[],
    selectedIds: number[],
    heuristicIntent: MedicationAssistantIntent,
  ): Promise<string> {
    const response = await this.withProviderTimeout(
      fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content:
                "Tu es un constructeur de contexte pour un assistant medicaments. Tu retournes uniquement du JSON conforme au schema.",
            },
            {
              role: "user",
              content: this.buildStructuredQueryPrompt({
                messages,
                selectedIds,
                heuristicIntent,
              }),
            },
          ],
        }),
      }),
    ).catch((error) => {
      throw this.mapAiProviderError(provider.name, error);
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw this.mapAiProviderHttpError(provider.name, response.status, errorText);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    return payload.choices?.[0]?.message?.content?.trim() ?? "";
  }

  private normalizeStructuredQuery(
    raw: unknown,
    heuristicIntent: MedicationAssistantIntent,
  ): StructuredMedicationQuery {
    const payload = this.asRecord(raw) ?? {};

    const normalized = {
      intent: this.normalizeIntent(this.toNullableString(payload.intent), heuristicIntent),
      normalized_user_goal:
        this.toNullableString(payload.normalized_user_goal) ??
        "Recherche medicament globale",
      requires_patient_context:
        payload.requires_patient_context === true ||
        this.requiresPatientContext(
          this.toNullableString(payload.normalized_user_goal) ?? "",
        ),
      medication_names_mentioned: this.normalizeStringArray(
        payload.medication_names_mentioned,
        8,
      ),
      substances_mentioned: this.normalizeStringArray(payload.substances_mentioned, 8),
      therapeutic_classes_mentioned: this.normalizeStringArray(
        payload.therapeutic_classes_mentioned,
        8,
      ),
      clinical_uses_mentioned: this.normalizeStringArray(payload.clinical_uses_mentioned, 8),
      safety_topics_requested: this.normalizeStringArray(
        payload.safety_topics_requested,
        8,
      ),
      requested_constraints: this.normalizeStringArray(
        payload.requested_constraints,
        8,
      ),
      comparison_requested:
        payload.comparison_requested === true || heuristicIntent === "compare",
      response_style:
        this.toNullableString(payload.response_style) ?? "concise_clinical",
      confidence:
        typeof payload.confidence === "number"
          ? this.clamp(payload.confidence, 0, 1)
          : null,
    } satisfies StructuredMedicationQuery;

    const validation = structuredQuerySchema.safeParse(normalized);
    if (!validation.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "La passe de construction de contexte medicament a retourne une structure invalide.",
      });
    }

    return validation.data;
  }

  private normalizeIntent(
    value: string | null,
    fallback: MedicationAssistantIntent,
  ): MedicationAssistantIntent {
    if (
      value === "search" ||
      value === "explain" ||
      value === "compare" ||
      value === "safety" ||
      value === "out_of_scope"
    ) {
      return value;
    }

    return fallback;
  }

  private computeCandidateFeatures(
    aggregate: MedicationAggregate,
  ): CandidateMedicationFeatures {
    const indicationsCorpus = this.normalizeText(
      aggregate.indications.map((item) => item.indication).join(" "),
    );
    const corpus = this.normalizeText(
      [
        aggregate.medicament.nom_medicament,
        aggregate.medicament.nom_generique,
        aggregate.medicament.classe_therapeutique,
        aggregate.medicament.famille_pharmacologique,
        aggregate.medicament.posologie_adulte,
        aggregate.medicament.grossesse,
        aggregate.medicament.allaitement,
        aggregate.substances_actives.map((item) => item.nom_substance).join(" "),
        aggregate.indications.map((item) => item.indication).join(" "),
        aggregate.contre_indications.map((item) => item.description).join(" "),
        aggregate.precautions.map((item) => item.description).join(" "),
        aggregate.interactions.map((item) => item.medicament_interaction).join(" "),
        aggregate.presentations
          .map((item) => [item.forme, item.dosage].filter(Boolean).join(" "))
          .join(" "),
      ].join(" "),
    );

    const uniqueSubstances = [
      ...new Set(
        aggregate.substances_actives
          .map((item) => this.normalizeText(item.nom_substance))
          .filter(Boolean),
      ),
    ];

    return {
      active_substance_count: uniqueSubstances.length,
      is_monotherapy: uniqueSubstances.length === 1,
      is_combination: uniqueSubstances.length >= 2,
      is_suppressed: /supprim/.test(corpus),
      is_cold_flu_combo:
        /rhume|jour nuit|vasoconstricteur|antihistamini|decongestion/.test(corpus),
      is_aspirin_like: /acide acetylsalicylique|aspirine/.test(corpus),
      is_nsaid_like:
        /ains|ibuprofene|ketoprofene|diclofenac|naproxene|piroxicam/.test(corpus),
      is_paracetamol_like: /paracetamol/.test(corpus),
      is_antipyretic_like: /antipyret|faire baisser la fievre|fievre/.test(
        indicationsCorpus,
      ),
      is_analgesic_like: /antalg|douleur|migraine|cephale|maux de tete/.test(corpus),
      has_fever_indication: /antipyret|faire baisser la fievre|fievre/.test(
        indicationsCorpus,
      ),
      has_pain_indication: /antalg|douleur|migraine|cephale|maux de tete/.test(
        indicationsCorpus,
      ),
      is_cough_wet_like:
        /toux grasse|expectoration|mucol|expector|fluidif|encombrement bronchique/.test(
          corpus,
        ),
      is_cough_dry_like: /toux seche|antituss/.test(corpus),
      is_nasal_congestion_like:
        /congestion nasale|nez bouche|decongestion|vasoconstricteur/.test(corpus),
      is_bronchodilator_like:
        /bronchodilat|salbutamol|terbutaline|formoterol|salmeterol|beta 2/.test(
          corpus,
        ),
      is_inhaled_like: /inhal|aerosol|nebul|poudre.*inhal|diskus|turbuhaler/.test(
        corpus,
      ),
      is_antibiotic_like:
        /antibioti|anti infectieux|macrolide|amoxicilline|azithromycine|cephalospor/.test(
          corpus,
        ),
      has_adult_posology: Boolean(
        aggregate.medicament.posologie_adulte?.trim() ||
          aggregate.medicament.frequence_administration?.trim(),
      ),
      has_safety_content:
        aggregate.contre_indications.length > 0 ||
        aggregate.precautions.length > 0 ||
        aggregate.interactions.length > 0,
    };
  }

  private applyPolicyScoring(
    candidate: {
      aggregate: MedicationAggregate;
      features: CandidateMedicationFeatures;
      fieldCorpus: Record<string, string>;
    },
    context: {
      policyProfile: MedicationPolicyProfile;
      policyNotes: Set<string>;
      deprioritizedReasons: Set<string>;
      safetyNotes: Set<string>;
      scoreRef: { add: (value: number) => void };
    },
  ): void {
    const add = context.scoreRef.add;

    if (candidate.features.is_combination) {
      add(-4);
      context.deprioritizedReasons.add(
        "Association fixe de-priorisee pour une demande generique",
      );
    }

    switch (context.policyProfile) {
      case "antipyretic_simple":
        if (candidate.features.is_paracetamol_like) {
          add(34);
          context.policyNotes.add("Option simple et usuelle de premiere intention");
        }
        if (candidate.features.has_fever_indication) {
          add(20);
        }
        if (candidate.features.is_monotherapy) {
          add(12);
        }
        if (candidate.features.is_cold_flu_combo) {
          add(-20);
          context.deprioritizedReasons.add(
            "Association type rhume de-priorisee pour une demande d'antipyretique simple",
          );
        }
        if (candidate.features.is_aspirin_like) {
          add(-18);
          context.deprioritizedReasons.add(
            "Aspirine de-priorisee sans contexte patient ni indication specifique",
          );
        }
        if (candidate.features.is_nsaid_like && !candidate.features.is_paracetamol_like) {
          add(-12);
          context.deprioritizedReasons.add(
            "AINS de-priorise par rapport a une option simple de premiere intention",
          );
        }
        break;

      case "analgesic_simple":
        if (candidate.features.is_paracetamol_like) {
          add(20);
          context.policyNotes.add("Antalgique simple de premiere intention");
        }
        if (candidate.features.has_pain_indication || candidate.features.is_analgesic_like) {
          add(16);
        }
        if (candidate.features.is_cold_flu_combo) {
          add(-16);
          context.deprioritizedReasons.add(
            "Association symptomatique de rhume de-priorisee pour une demande antalgique simple",
          );
        }
        if (candidate.features.is_aspirin_like) {
          add(-10);
        }
        break;

      case "bronchodilator_inhaled":
        if (candidate.features.is_bronchodilator_like) {
          add(24);
        }
        if (candidate.features.is_inhaled_like) {
          add(24);
          context.policyNotes.add("Forme inalee coherente avec la demande");
        } else {
          add(-14);
          context.deprioritizedReasons.add(
            "Forme non inalee de-priorisee pour cette demande",
          );
        }
        break;

      case "antibiotic_general":
        if (candidate.features.is_antibiotic_like) {
          add(24);
          context.policyNotes.add("Profil compatible avec une demande antibiotique");
        } else {
          add(-18);
        }
        if (candidate.features.is_cold_flu_combo) {
          add(-18);
        }
        break;

      case "cough_wet":
        if (/toux grasse|expectoration|mucol|expector|fluidif/.test(candidate.fieldCorpus.indications + " " + candidate.fieldCorpus.classe)) {
          add(24);
          context.policyNotes.add("Compatible avec une demande de toux grasse");
        }
        if (/antituss|toux seche/.test(candidate.fieldCorpus.indications + " " + candidate.fieldCorpus.classe)) {
          add(-14);
        }
        break;

      case "cough_dry":
        if (/antituss|toux seche/.test(candidate.fieldCorpus.indications + " " + candidate.fieldCorpus.classe)) {
          add(24);
          context.policyNotes.add("Compatible avec une demande de toux seche");
        }
        if (/mucol|expector|toux grasse/.test(candidate.fieldCorpus.indications + " " + candidate.fieldCorpus.classe)) {
          add(-14);
        }
        break;

      case "nasal_congestion":
        if (/congestion|nez bouche|vasoconstricteur|decongestion/.test(candidate.fieldCorpus.indications + " " + candidate.fieldCorpus.classe)) {
          add(22);
        }
        break;

      case "safety_lookup":
        if (candidate.features.has_safety_content) {
          add(18);
          context.safetyNotes.add("Contenu de securite disponible dans la base locale");
        }
        add(candidate.aggregate.contre_indications.length * 2);
        add(candidate.aggregate.precautions.length * 2);
        add(candidate.aggregate.interactions.length * 2);
        break;

      case "comparison_general":
        if (candidate.features.has_safety_content) {
          add(6);
        }
        if (candidate.features.has_adult_posology) {
          add(6);
        }
        break;

      case "generic":
      default:
        if (candidate.features.is_monotherapy) {
          add(4);
        }
        if (candidate.features.is_cold_flu_combo) {
          add(-6);
        }
        break;
    }
  }

  private buildProviderFallbackWarning(error: unknown, stage: string): string {
    if (error instanceof TRPCError) {
      return `Le provider AI n'a pas pu finaliser la ${stage}; une logique locale de secours a ete utilisee. Detail: ${error.message}`;
    }

    if (error instanceof Error && error.message.trim()) {
      return `Le provider AI n'a pas pu finaliser la ${stage}; une logique locale de secours a ete utilisee. Detail: ${error.message.trim()}`;
    }

    return `Le provider AI n'a pas pu finaliser la ${stage}; une logique locale de secours a ete utilisee.`;
  }

  private async generateAiResponse(data: {
    provider: AIProviderConfig;
    intent: MedicationAssistantIntent;
    messages: ChatMessage[];
    shortlistedCandidates: CandidateMedication[];
    structuredQuery: StructuredMedicationQuery;
    policyProfile: MedicationPolicyProfile;
  }): Promise<NormalizedModelResponse | null> {
    let rawText = "";

    try {
      rawText =
        data.provider.name === "openrouter"
          ? await this.generateWithOpenRouter(
              data.provider,
              data.intent,
              data.messages,
              data.shortlistedCandidates,
              data.structuredQuery,
              data.policyProfile,
            )
          : data.provider.name === "together"
            ? await this.generateWithTogether(
                data.provider,
                data.intent,
                data.messages,
                data.shortlistedCandidates,
                data.structuredQuery,
                data.policyProfile,
              )
            : data.provider.name === "mistral"
              ? await this.generateWithMistral(
                  data.provider,
                  data.intent,
                  data.messages,
                  data.shortlistedCandidates,
                  data.structuredQuery,
                  data.policyProfile,
                )
              : await this.generateWithGemini(
                  data.provider,
                  data.intent,
                  data.messages,
                  data.shortlistedCandidates,
                  data.structuredQuery,
                  data.policyProfile,
                );
    } catch (error) {
      throw error;
    }

    const parsed = this.parseModelJson(rawText);
    if (!parsed) {
      return null;
    }

    const normalized = this.normalizeModelResponse(parsed);
    const validation = aiResponseSchema.safeParse(normalized);

    if (!validation.success) {
      return null;
    }

    return validation.data;
  }

  private parseModelJson(rawText: string): unknown | null {
    const trimmed = rawText.trim();
    if (!trimmed) {
      return null;
    }

    const directParse = this.tryParseJson(trimmed);
    if (directParse !== null) {
      return directParse;
    }

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      const fencedParse = this.tryParseJson(fencedMatch[1].trim());
      if (fencedParse !== null) {
        return fencedParse;
      }
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return this.tryParseJson(trimmed.slice(firstBrace, lastBrace + 1));
    }

    return null;
  }

  private tryParseJson(value: string): unknown | null {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private normalizeModelResponse(raw: unknown): NormalizedModelResponse {
    const payload = this.asRecord(raw) ?? {};

    const comparisonPayload = this.asRecord(payload.comparison);
    const comparisonItemsRaw = Array.isArray(comparisonPayload?.items)
      ? comparisonPayload.items
      : [];

    return {
      answer:
        this.toNullableString(payload.answer) ??
        "Je n'ai pas pu formuler une reponse structuree exploitable pour cette question.",
      referenced_medicaments: Array.isArray(payload.referenced_medicaments)
        ? payload.referenced_medicaments
            .map((item) => this.asRecord(item))
            .filter((item): item is Record<string, unknown> => Boolean(item))
            .map((item) => ({
              medicament_externe_id:
                this.toNullableString(item.medicament_externe_id) ?? "",
              why_relevant:
                this.toNullableString(item.why_relevant) ??
                "Mentionne dans la reponse du modele.",
              highlights: this.normalizeStringArray(item.highlights, 6),
            }))
            .filter((item) => item.medicament_externe_id.length > 0)
        : [],
      comparison:
        comparisonPayload &&
        comparisonItemsRaw.length > 0 &&
        this.toNullableString(comparisonPayload.summary)
          ? {
              summary:
                this.toNullableString(comparisonPayload.summary) ??
                "Comparaison synthetique fournie par le modele.",
              items: comparisonItemsRaw
                .map((item) => this.asRecord(item))
                .filter((item): item is Record<string, unknown> => Boolean(item))
                .map((item) => ({
                  medicament_externe_id:
                    this.toNullableString(item.medicament_externe_id) ?? "",
                  strengths: this.normalizeStringArray(item.strengths, 6),
                  cautions: this.normalizeStringArray(item.cautions, 6),
                }))
                .filter((item) => item.medicament_externe_id.length > 0),
            }
          : null,
      warnings: this.normalizeStringArray(payload.warnings, 12),
      follow_up_suggestions: this.normalizeStringArray(
        payload.follow_up_suggestions,
        8,
      ),
    };
  }

  private postValidateResponse(
    intent: MedicationAssistantIntent,
    structuredQuery: StructuredMedicationQuery,
    policyProfile: MedicationPolicyProfile,
    shortlistedCandidates: CandidateMedication[],
    aiResponse: NormalizedModelResponse | null,
  ): Omit<
    MedicationAssistantResult,
    "provider" | "model" | "generated_at" | "requires_patient_context"
  > {
    const candidatesById = new Map(
      shortlistedCandidates.map((candidate) => [
        String(candidate.aggregate.medicament.id),
        candidate,
      ]),
    );

    const fallback = this.buildFallbackResponse(
      intent,
      structuredQuery,
      policyProfile,
      shortlistedCandidates,
    );
    const response =
      this.shouldPreferDeterministicResponse(intent, policyProfile) || !aiResponse
        ? fallback
        : aiResponse;
    const warnings = [...response.warnings];
    const followUpSuggestions =
      response.follow_up_suggestions.length > 0
        ? response.follow_up_suggestions
        : fallback.follow_up_suggestions;

    const referencedIds = response.referenced_medicaments
      .map((item) => item.medicament_externe_id)
      .filter((id) => candidatesById.has(id));

    const referencedMedicaments = referencedIds.map((id) => {
      const candidate = candidatesById.get(id);
      if (!candidate) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Le modele a reference un medicament hors shortlist.",
        });
      }

      const modelReference = response.referenced_medicaments.find(
        (item) => item.medicament_externe_id === id,
      );

      return {
        medicament_externe_id: id,
        nom_medicament: candidate.aggregate.medicament.nom_medicament,
        dci: candidate.aggregate.medicament.nom_generique ?? null,
        classe_therapeutique:
          candidate.aggregate.medicament.classe_therapeutique ?? null,
        why_relevant:
          modelReference?.why_relevant ??
          this.buildWhyRelevant(candidate, intent, policyProfile),
        highlights:
          modelReference?.highlights.length
            ? modelReference.highlights
            : this.buildHighlights(candidate),
      };
    });

    let comparison: MedicationAssistantResult["comparison"] = null;
    if (response.comparison) {
      const validComparisonItems = response.comparison.items
        .map((item) => {
          const candidate = candidatesById.get(item.medicament_externe_id);
          if (!candidate) {
            return null;
          }

          return {
            medicament_externe_id: item.medicament_externe_id,
            nom_medicament: candidate.aggregate.medicament.nom_medicament,
            dci: candidate.aggregate.medicament.nom_generique ?? null,
            strengths: item.strengths,
            cautions: item.cautions,
          };
        })
        .filter(
          (
            item,
          ): item is NonNullable<MedicationAssistantResult["comparison"]>["items"][number] =>
            Boolean(item),
        );

      if (validComparisonItems.length >= 2) {
        comparison = {
          summary: response.comparison.summary,
          items: validComparisonItems,
        };
      }
    }

    if (intent === "compare" && comparison === null) {
      comparison = fallback.comparison;
      warnings.push(
        "Le modele n'a pas fourni de comparaison structuree exploitable; une comparaison de secours basee sur la base locale est affichee.",
      );
    }

    if (intent === "explain" && referencedMedicaments.length === 0) {
      const firstCandidate = shortlistedCandidates[0];
      if (firstCandidate) {
        referencedMedicaments.push({
          medicament_externe_id: String(firstCandidate.aggregate.medicament.id),
          nom_medicament: firstCandidate.aggregate.medicament.nom_medicament,
          dci: firstCandidate.aggregate.medicament.nom_generique ?? null,
          classe_therapeutique:
            firstCandidate.aggregate.medicament.classe_therapeutique ?? null,
          why_relevant: this.buildWhyRelevant(
            firstCandidate,
            intent,
            policyProfile,
          ),
          highlights: this.buildHighlights(firstCandidate),
        });
        warnings.push(
          "Le modele n'a pas reference explicitement de medicament; le premier candidat local a ete retenu comme support de reponse.",
        );
      }
    }

    return {
      intent,
      answer: response.answer || fallback.answer,
      referenced_medicaments:
        referencedMedicaments.length > 0
          ? referencedMedicaments
          : fallback.referenced_medicaments,
      comparison,
      warnings: [...new Set(warnings)],
      follow_up_suggestions: followUpSuggestions,
    };
  }

  private shouldPreferDeterministicResponse(
    intent: MedicationAssistantIntent,
    policyProfile: MedicationPolicyProfile,
  ): boolean {
    if (intent === "compare" || intent === "explain" || intent === "safety") {
      return true;
    }

    return policyProfile !== "generic";
  }

  private buildFallbackResponse(
    intent: MedicationAssistantIntent,
    structuredQuery: StructuredMedicationQuery,
    policyProfile: MedicationPolicyProfile,
    shortlistedCandidates: CandidateMedication[],
  ): Omit<
    MedicationAssistantResult,
    "provider" | "model" | "generated_at" | "requires_patient_context"
  > {
    const topCandidates = shortlistedCandidates.slice(0, 4);
    const referencedMedicaments = topCandidates.map((candidate) => ({
      medicament_externe_id: String(candidate.aggregate.medicament.id),
      nom_medicament: candidate.aggregate.medicament.nom_medicament,
      dci: candidate.aggregate.medicament.nom_generique ?? null,
      classe_therapeutique:
        candidate.aggregate.medicament.classe_therapeutique ?? null,
      why_relevant: this.buildWhyRelevant(candidate, intent, policyProfile),
      highlights: this.buildHighlights(candidate),
    }));

    if (intent === "compare" && topCandidates.length >= 2) {
      const comparisonItems = topCandidates.slice(0, 2).map((candidate) => ({
        medicament_externe_id: String(candidate.aggregate.medicament.id),
        nom_medicament: candidate.aggregate.medicament.nom_medicament,
        dci: candidate.aggregate.medicament.nom_generique ?? null,
        strengths: this.buildStrengths(candidate.aggregate),
        cautions: this.buildCautions(candidate.aggregate),
      }));

      return {
        intent,
        answer: `J'ai compare ${comparisonItems[0]?.nom_medicament ?? "le premier medicament"} et ${comparisonItems[1]?.nom_medicament ?? "le second medicament"} a partir des informations structurees de la base locale.`,
        referenced_medicaments: referencedMedicaments,
        comparison: {
          summary:
            "Comparaison de secours generee a partir des informations structurees de la base locale.",
          items: comparisonItems,
        },
        warnings: [
          "Le modele n'a pas fourni de comparaison structuree; une synthese locale a ete construite a partir de la base medicaments.",
        ],
        follow_up_suggestions: [
          "Affiner la comparaison avec un critere clinique plus precis.",
          "Selectionner explicitement deux medicaments si tu veux une comparaison plus ciblee.",
        ],
      };
    }

    if (policyProfile === "antipyretic_simple") {
      const firstLine = topCandidates.find(
        (candidate) => candidate.features.is_paracetamol_like,
      );
      return {
        intent,
        answer: firstLine
          ? `Antipyretique usuel: ${firstLine.aggregate.medicament.nom_medicament}. Verifier l'age, le poids, la grossesse, les antecedents hepatiques et les autres medicaments en cours. Eviter de proposer d'emblee l'aspirine ou des associations type rhume sans contexte patient.`
          : "Pour une demande d'antipyretique simple, il faut privilegier une option de premiere intention, verifier l'age, le poids, la grossesse, le terrain hepatique et eviter les associations inutiles sans contexte patient.",
        referenced_medicaments: referencedMedicaments,
        comparison: null,
        warnings: topCandidates.some((candidate) => candidate.features.is_aspirin_like)
          ? [
              "Les produits a base d'aspirine sont de-priorises ici sans contexte patient.",
            ]
          : [],
        follow_up_suggestions: [
          "Affiner si tu veux une forme pediatrique, adulte ou une substance active precise.",
          "Selectionne un medicament si tu veux un resume plus cible.",
        ],
      };
    }

    if (intent === "safety") {
      const first = topCandidates[0];
      return {
        intent,
        answer: first
          ? `Voici les principaux points de vigilance de ${first.aggregate.medicament.nom_medicament} a partir de la base locale.`
          : "Je n'ai pas trouve de fiche medicament exploitable pour cette demande de securite.",
        referenced_medicaments: referencedMedicaments,
        comparison: null,
        warnings: [],
        follow_up_suggestions: [
          "Demande-moi les contre-indications, precautions ou interactions d'un medicament precis.",
          "Selectionne un medicament dans la liste pour une reponse plus ciblee.",
        ],
      };
    }

    if (intent === "explain") {
      const first = topCandidates[0];
      return {
        intent,
        answer: first
          ? `Voici un resume rapide de ${first.aggregate.medicament.nom_medicament} base sur les informations structurees de la base locale.`
          : "Je n'ai pas trouve de medicament exploitable a resumer dans la base locale.",
        referenced_medicaments: referencedMedicaments,
        comparison: null,
        warnings: [],
        follow_up_suggestions: [
          "Demande-moi les indications, interactions ou precautions d'un medicament.",
          "Selectionne explicitement un medicament si tu veux une reponse plus ciblee.",
        ],
      };
    }

    return {
      intent,
      answer:
        referencedMedicaments.length > 0
          ? `J'ai trouve ${referencedMedicaments.length} medicament(s) pertinents dans la base locale pour cette demande: ${structuredQuery.normalized_user_goal}.`
          : "Je n'ai pas trouve de medicament pertinent dans la base locale pour cette demande.",
      referenced_medicaments: referencedMedicaments,
      comparison: null,
      warnings: [],
      follow_up_suggestions: [
        "Affiner la recherche avec une classe therapeutique, une substance active ou une indication.",
        "Selectionner un medicament pour obtenir un resume plus cible.",
      ],
    };
  }

  private buildPatientContextRequiredResponse(
    provider: AIProviderConfig,
    intent: MedicationAssistantIntent,
    disclaimer: string,
    warnings: string[],
  ): MedicationAssistantResult {
    return {
      provider: provider.name,
      model: provider.model,
      generated_at: new Date().toISOString(),
      intent,
      answer:
        "Je peux aider sur le catalogue global des medicaments, mais la verification d'un medicament pour un patient reel doit se faire depuis la page patient ou ordonnance avec le contexte clinique approprie.",
      referenced_medicaments: [],
      comparison: null,
      warnings: [...new Set([disclaimer, ...warnings])],
      follow_up_suggestions: [
        "Depuis la page medicaments, demande une recherche globale, un resume ou une comparaison.",
        "Depuis la page patient, utilise l'assistant contextuel medicament ↔ patient quand il sera disponible.",
      ],
      requires_patient_context: true,
    };
  }

  private buildNoCandidateResponse(
    provider: AIProviderConfig,
    intent: MedicationAssistantIntent,
    question: string,
    warnings: string[],
    structuredQuery: StructuredMedicationQuery,
    policyProfile: MedicationPolicyProfile,
  ): MedicationAssistantResult {
    const normalizedQuestion = this.normalizeText(question);
    const medicationRelated = medicationRelatedKeywords.some((keyword) =>
      normalizedQuestion.includes(this.normalizeText(keyword)),
    );

    return {
      provider: provider.name,
      model: provider.model,
      generated_at: new Date().toISOString(),
      intent:
        medicationRelated ||
        structuredQuery.clinical_uses_mentioned.length > 0 ||
        structuredQuery.therapeutic_classes_mentioned.length > 0
          ? intent
          : "out_of_scope",
      answer: medicationRelated
        ? policyProfile === "antipyretic_simple"
          ? "Je n'ai pas trouve de candidat antipyrétique cliniquement fiable dans la base locale pour cette demande. En pratique, il faut prioriser une option simple de premiere intention et eviter les associations ou alternatives non justifiees sans contexte patient."
          : "Je n'ai pas trouve de medicament suffisamment pertinent dans la base locale pour cette demande."
        : "Cette demande semble sortir du perimetre du catalogue medicaments. Je peux surtout aider a chercher, comparer et expliquer des medicaments de la base locale.",
      referenced_medicaments: [],
      comparison: null,
      warnings,
      follow_up_suggestions: medicationRelated
        ? [
            "Reformule avec une indication, une classe therapeutique ou une substance active.",
            "Selectionne un medicament si tu veux une explication plus ciblee.",
          ]
        : [
            "Demande-moi un antalgique, un antibiotique, une comparaison ou les interactions d'un medicament.",
          ],
      requires_patient_context: false,
    };
  }

  private buildWhyRelevant(
    candidate: CandidateMedication,
    intent: MedicationAssistantIntent,
    policyProfile: MedicationPolicyProfile,
  ): string {
    if (candidate.policy_notes.length > 0) {
      return candidate.policy_notes.slice(0, 2).join(" ; ");
    }

    if (candidate.match_reasons.length > 0) {
      return candidate.match_reasons.slice(0, 2).join(" ; ");
    }

    if (candidate.is_selected) {
      return "Medicament explicitement selectionne par le frontend.";
    }

    if (intent === "safety") {
      return "Pertinent pour une lecture rapide des contre-indications, precautions et interactions.";
    }

    if (policyProfile === "antipyretic_simple" && candidate.features.is_paracetamol_like) {
      return "Option simple de premiere intention privilegiee par le ranking backend.";
    }

    return "Pertinent par rapport aux termes de recherche et au contenu de la base locale.";
  }

  private buildHighlights(candidate: CandidateMedication): string[] {
    const aggregate = candidate.aggregate;
    const highlights: string[] = [];

    if (candidate.policy_notes.length > 0) {
      highlights.push(...candidate.policy_notes.slice(0, 2));
    }

    if (candidate.status_notes.length > 0) {
      highlights.push(...candidate.status_notes.slice(0, 1));
    }

    if (aggregate.medicament.nom_generique) {
      highlights.push(`DCI: ${aggregate.medicament.nom_generique}`);
    }

    if (aggregate.medicament.classe_therapeutique) {
      highlights.push(`Classe: ${aggregate.medicament.classe_therapeutique}`);
    }

    if (aggregate.substances_actives.length > 0) {
      highlights.push(
        `Substances: ${aggregate.substances_actives
          .map((item) => item.nom_substance)
          .slice(0, 3)
          .join(", ")}`,
      );
    }

    if (aggregate.indications.length > 0) {
      highlights.push(
        `Indications: ${aggregate.indications
          .map((item) => item.indication)
          .slice(0, 2)
          .join(" | ")}`,
      );
    }

    if (aggregate.presentations.length > 0) {
      highlights.push(
        `Presentations: ${aggregate.presentations
          .map((item) => [item.forme, item.dosage].filter(Boolean).join(" "))
          .slice(0, 2)
          .join(" | ")}`,
      );
    }

    return [...new Set(highlights)].slice(0, 5);
  }

  private buildStrengths(aggregate: MedicationAggregate): string[] {
    const strengths: string[] = [];

    if (aggregate.indications.length > 0) {
      strengths.push(
        `Indications disponibles: ${aggregate.indications
          .map((item) => item.indication)
          .slice(0, 2)
          .join(" | ")}`,
      );
    }

    if (aggregate.presentations.length > 0) {
      strengths.push(
        `Presentations: ${aggregate.presentations
          .map((item) => [item.forme, item.dosage].filter(Boolean).join(" "))
          .slice(0, 2)
          .join(" | ")}`,
      );
    }

    if (aggregate.medicament.posologie_adulte) {
      strengths.push(`Posologie adulte: ${aggregate.medicament.posologie_adulte}`);
    }

    return strengths.slice(0, 4);
  }

  private buildCautions(aggregate: MedicationAggregate): string[] {
    const cautions: string[] = [];

    if (aggregate.contre_indications.length > 0) {
      cautions.push(
        `Contre-indications: ${aggregate.contre_indications
          .map((item) => item.description)
          .slice(0, 2)
          .join(" | ")}`,
      );
    }

    if (aggregate.precautions.length > 0) {
      cautions.push(
        `Precautions: ${aggregate.precautions
          .map((item) => item.description)
          .slice(0, 2)
          .join(" | ")}`,
      );
    }

    if (aggregate.interactions.length > 0) {
      cautions.push(
        `Interactions: ${aggregate.interactions
          .map((item) => item.medicament_interaction)
          .slice(0, 2)
          .join(" | ")}`,
      );
    }

    return cautions.slice(0, 4);
  }

  private buildAnswerPrompt(data: {
    intent: MedicationAssistantIntent;
    messages: ChatMessage[];
    shortlistedCandidates: CandidateMedication[];
    structuredQuery: StructuredMedicationQuery;
    policyProfile: MedicationPolicyProfile;
  }): string {
    const historyText = data.messages
      .map((message) => `${message.role === "user" ? "Utilisateur" : "Assistant"}: ${message.content}`)
      .join("\n");

    const candidatesText = JSON.stringify(
      data.shortlistedCandidates.map((candidate) => ({
        medicament_externe_id: String(candidate.aggregate.medicament.id),
        nom_medicament: candidate.aggregate.medicament.nom_medicament,
        dci: candidate.aggregate.medicament.nom_generique ?? null,
        classe_therapeutique:
          candidate.aggregate.medicament.classe_therapeutique ?? null,
        famille_pharmacologique:
          candidate.aggregate.medicament.famille_pharmacologique ?? null,
        substances_actives: candidate.aggregate.substances_actives.map(
          (item) => item.nom_substance,
        ),
        indications: candidate.aggregate.indications.map((item) => item.indication),
        contre_indications: candidate.aggregate.contre_indications.map(
          (item) => item.description,
        ),
        precautions: candidate.aggregate.precautions.map((item) => item.description),
        interactions: candidate.aggregate.interactions.map(
          (item) => item.medicament_interaction,
        ),
        effets_indesirables: candidate.aggregate.effets_indesirables.map((item) =>
          [item.frequence, item.effet].filter(Boolean).join(": "),
        ),
        presentations: candidate.aggregate.presentations.map((item) =>
          [item.forme, item.dosage].filter(Boolean).join(" "),
        ),
        grossesse: candidate.aggregate.medicament.grossesse ?? null,
        allaitement: candidate.aggregate.medicament.allaitement ?? null,
        matched_terms: candidate.matched_terms,
        match_reasons: candidate.match_reasons,
        policy_notes: candidate.policy_notes,
        deprioritized_reasons: candidate.deprioritized_reasons,
        safety_notes: candidate.safety_notes,
        status_notes: candidate.status_notes,
        features: candidate.features,
        selected: candidate.is_selected,
      })),
      null,
      2,
    );

    return [
      "Tu es un assistant medicaments pour medecins dans la page catalogue des medicaments.",
      "Tu aides a chercher, expliquer et comparer des medicaments a partir d'une base locale.",
      "Contraintes absolues:",
      "- Tu n'utilises QUE les medicaments fournis dans la shortlist.",
      "- Tu n'inventes jamais de medicament, de molecule ou de donnees absentes.",
      "- Tu restes global au catalogue; pas d'avis patient-specifique.",
      "- Si la question ressemble a une validation pour un patient, tu le signales dans warnings mais sans evaluer le patient.",
      "- Les policy_notes et deprioritized_reasons sont des signaux backend prioritaires: tu les respectes.",
      "- Pour une demande generique, commence par l'option cliniquement la plus usuelle parmi la shortlist, pas par un dump de recherche.",
      "- Evite de mettre en avant des associations complexes ou des options de-priorisees si une option simple et de premiere intention existe dans la shortlist.",
      "- Si l'intention est compare, concentre-toi sur les medicaments les plus pertinents et fournis une comparaison structuree.",
      "- Reponds en francais.",
      "- Retourne uniquement un JSON valide correspondant au schema demande.",
      "",
      `Intent detecte: ${data.intent}`,
      `Profil metier backend: ${data.policyProfile}`,
      this.buildPromptCandidateCountHint(data.intent),
      "",
      "Contexte structure de la requete:",
      JSON.stringify(data.structuredQuery, null, 2),
      "",
      "Historique recent:",
      historyText,
      "",
      "Shortlist medicaments JSON:",
      candidatesText,
    ].join("\n");
  }

  private async generateWithOpenRouter(
    provider: AIProviderConfig,
    intent: MedicationAssistantIntent,
    messages: ChatMessage[],
    shortlistedCandidates: CandidateMedication[],
    structuredQuery: StructuredMedicationQuery,
    policyProfile: MedicationPolicyProfile,
  ): Promise<string> {
    let response: Response;

    try {
      response = await this.withProviderTimeout(
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": env.CORS_ORIGIN,
            "X-Title": "doctor-com-backend",
          },
          body: JSON.stringify({
            model: provider.model,
            temperature: 0.2,
            messages: [
              {
                role: "system",
                content:
                  "Tu es un assistant medicaments. Tu reponds uniquement avec un JSON valide conforme au schema demande.",
              },
              {
                role: "user",
                content: this.buildAnswerPrompt({
                  intent,
                  messages,
                  shortlistedCandidates,
                  structuredQuery,
                  policyProfile,
                }),
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "medication_assistant_chat",
                strict: true,
                schema: openRouterResponseJsonSchema,
              },
            },
          }),
        }),
      );
    } catch (error) {
      throw this.mapAiProviderError(provider.name, error);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw this.mapAiProviderHttpError(provider.name, response.status, errorText);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?:
            | string
            | Array<{
                type?: string;
                text?: string;
              }>;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      return content.trim();
    }

    if (Array.isArray(content)) {
      return content
        .map((item) => item.text ?? "")
        .join("")
        .trim();
    }

    return "";
  }

  private async generateWithGemini(
    provider: AIProviderConfig,
    intent: MedicationAssistantIntent,
    messages: ChatMessage[],
    shortlistedCandidates: CandidateMedication[],
    structuredQuery: StructuredMedicationQuery,
    policyProfile: MedicationPolicyProfile,
  ): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: provider.apiKey });

    let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
    try {
      response = await this.withProviderTimeout(
        ai.models.generateContent({
          model: provider.model,
          contents: this.buildAnswerPrompt({
            intent,
            messages,
            shortlistedCandidates,
            structuredQuery,
            policyProfile,
          }),
          config: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseJsonSchema: openRouterResponseJsonSchema,
          },
        }),
      );
    } catch (error) {
      throw this.mapAiProviderError(provider.name, error);
    }

    return response.text?.trim() ?? "";
  }

  private async generateWithTogether(
    provider: AIProviderConfig,
    intent: MedicationAssistantIntent,
    messages: ChatMessage[],
    shortlistedCandidates: CandidateMedication[],
    structuredQuery: StructuredMedicationQuery,
    policyProfile: MedicationPolicyProfile,
  ): Promise<string> {
    let response: Response;

    try {
      response = await this.withProviderTimeout(
        fetch("https://api.together.xyz/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: provider.model,
            temperature: 0.2,
            messages: [
              {
                role: "system",
                content:
                  "Tu es un assistant medicaments. Tu reponds uniquement avec un JSON valide conforme au schema demande.",
              },
              {
                role: "user",
                content: this.buildAnswerPrompt({
                  intent,
                  messages,
                  shortlistedCandidates,
                  structuredQuery,
                  policyProfile,
                }),
              },
            ],
            response_format: {
              type: "json_object",
            },
          }),
        }),
      );
    } catch (error) {
      throw this.mapAiProviderError(provider.name, error);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw this.mapAiProviderHttpError(provider.name, response.status, errorText);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    return payload.choices?.[0]?.message?.content?.trim() ?? "";
  }

  private async generateWithMistral(
    provider: AIProviderConfig,
    intent: MedicationAssistantIntent,
    messages: ChatMessage[],
    shortlistedCandidates: CandidateMedication[],
    structuredQuery: StructuredMedicationQuery,
    policyProfile: MedicationPolicyProfile,
  ): Promise<string> {
    let response: Response;

    try {
      response = await this.withProviderTimeout(
        fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: provider.model,
            temperature: 0.2,
            messages: [
              {
                role: "system",
                content:
                  "Tu es un assistant medicaments. Tu reponds uniquement avec un JSON valide conforme au schema demande.",
              },
              {
                role: "user",
                content: this.buildAnswerPrompt({
                  intent,
                  messages,
                  shortlistedCandidates,
                  structuredQuery,
                  policyProfile,
                }),
              },
            ],
          }),
        }),
      );
    } catch (error) {
      throw this.mapAiProviderError(provider.name, error);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw this.mapAiProviderHttpError(provider.name, response.status, errorText);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    return payload.choices?.[0]?.message?.content?.trim() ?? "";
  }

  private mapAiProviderHttpError(
    provider: AIProviderName,
    status: number,
    errorText: string,
  ): TRPCError {
    const providerLabel = this.providerLabel(provider);
    const normalizedText = errorText.toLowerCase();

    if (
      status === 429 ||
      normalizedText.includes("quota") ||
      normalizedText.includes("rate") ||
      normalizedText.includes("resource_exhausted")
    ) {
      return new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Le quota ${providerLabel} est epuise pour cette cle API. Verifie le plan gratuit, les limites d'usage ou la facturation du provider.`,
      });
    }

    if (
      status === 401 ||
      status === 403 ||
      normalizedText.includes("api key") ||
      normalizedText.includes("permission") ||
      normalizedText.includes("unauthorized") ||
      normalizedText.includes("forbidden")
    ) {
      return new TRPCError({
        code: "UNAUTHORIZED",
        message: `La cle ${providerLabel} est invalide ou n'a pas les droits necessaires pour cette requete.`,
      });
    }

    if (status === 400 && normalizedText.includes("model")) {
      return new TRPCError({
        code: "BAD_REQUEST",
        message: `Le modele ${providerLabel} configure est introuvable ou invalide. Verifie la variable de modele dans apps/server/.env.`,
      });
    }

    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Echec de l'appel au provider AI ${providerLabel}.`,
    });
  }

  private mapAiProviderError(
    provider: AIProviderName,
    error: unknown,
  ): TRPCError {
    if (error instanceof TRPCError) {
      return error;
    }

    if (error instanceof Error) {
      const message = error.message;
      const providerLabel = this.providerLabel(provider);

      if (
        message.includes("RESOURCE_EXHAUSTED") ||
        message.includes("\"code\":429") ||
        message.includes("rate-limits") ||
        message.includes("quota")
      ) {
        return new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Le quota ${providerLabel} est epuise pour cette cle API. Verifie le plan gratuit, les limites d'usage ou la facturation du provider.`,
        });
      }

      if (
        message.includes("API key not valid") ||
        message.includes("API_KEY_INVALID") ||
        message.includes("PERMISSION_DENIED") ||
        message.includes("Unauthorized") ||
        message.includes("Forbidden")
      ) {
        return new TRPCError({
          code: "UNAUTHORIZED",
          message: `La cle ${providerLabel} est invalide ou n'a pas les droits necessaires pour cette requete.`,
        });
      }
    }

    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Echec de l'appel au provider AI ${this.providerLabel(provider)}.`,
    });
  }

  private providerLabel(provider: AIProviderName): string {
    if (provider === "openrouter") {
      return "OpenRouter";
    }
    if (provider === "together") {
      return "Together AI";
    }
    if (provider === "mistral") {
      return "Mistral";
    }
    return "Gemini";
  }

  private withProviderTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(
            new TRPCError({
              code: "TIMEOUT",
              message:
                "Le provider AI a mis trop de temps a repondre. Reessaie avec une requete plus simple ou un autre provider.",
            }),
          );
        }, providerTimeoutMs);
      }),
    ]);
  }

  private buildPromptCandidateCountHint(intent: MedicationAssistantIntent): string {
    if (intent === "compare") {
      return "Favorise 2 a 4 medicaments maximum pour la comparaison.";
    }

    if (intent === "explain" || intent === "safety") {
      return "Reference 1 a 3 medicaments maximum, en priorite les plus pertinents.";
    }

    return "Reference jusqu'a 5 medicaments maximum.";
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private normalizeStringArray(value: unknown, maxItems: number): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.toNullableString(item))
      .filter((item): item is string => Boolean(item))
      .slice(0, maxItems);
  }

  private toNullableString(value: unknown): string | null {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      const candidateTextKeys = ["text", "value", "label", "content", "answer"];
      for (const key of candidateTextKeys) {
        if (typeof record[key] === "string" && record[key].trim()) {
          return record[key].trim();
        }
      }
    }

    return null;
  }

  private normalizeText(value: string | null | undefined): string {
    return (value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}

export const medicationAssistantService = new MedicationAssistantService();
