import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";

import type { SessionUtilisateur } from "../../../trpc/context";
import { aiService } from "../qna/service";
import { toSimpleFrenchAiMessage } from "../shared/errors";
import { parseModelJson } from "../shared/json";
import { generateGeminiText, resolveGeminiProvider } from "../shared/provider";
import { medicationAssistantService } from "../medication-assistant/service";
import {
  type AssistantChatResult,
  assistantIntentClassificationSchema,
  type AssistantChatInput,
  type AssistantChatMessage,
  type AssistantResolvedIntent,
} from "./schema";

type DatabaseClient = typeof databaseClient;
type AssistantSession = Exclude<SessionUtilisateur, null>;

type IntentGuess = "patient" | "medication" | "mixed" | "unknown";

interface ResolvedRoute {
  route: AssistantResolvedIntent;
  intentGuess: IntentGuess;
}

const patientSignals = [
  "ce patient",
  "cette patiente",
  "mon patient",
  "ma patiente",
  "son dossier",
  "ses antecedents",
  "ses antécédents",
  "son traitement",
  "ses traitements",
  "son historique",
  "ce cas",
  "pour lui",
  "pour elle",
  "chez lui",
  "chez elle",
  "dans son dossier",
  "dans le dossier",
  "du patient",
  "de la patiente",
  "ce malade",
  "sa consultation",
  "ses examens",
  "ses analyses",
  "ses allergies",
];

const patientPronounSignals = [
  "ses ",
  "son ",
  "sa ",
  "lui ",
  "elle ",
  "il ",
];

const medicationSignals = [
  "medicament",
  "médicament",
  "medicaments",
  "médicaments",
  "molecule",
  "molécule",
  "molecules",
  "molécules",
  "posologie",
  "dosage",
  "dose",
  "interaction",
  "interactions",
  "contre indication",
  "contre-indication",
  "contre indications",
  "contre-indications",
  "allergie",
  "allergies",
  "compatibilite",
  "compatibilité",
  "compatible",
  "incompatible",
  "classe therapeutique",
  "classe thérapeutique",
  "famille pharmacologique",
  "substance active",
  "dci",
  "prescrire",
  "prescription",
  "ordonnance",
  "ordonnances",
  "traitement",
  "traitements",
  "paracetamol",
  "paracétamol",
  "ibuprofene",
  "ibuprofène",
  "amoxicilline",
  "augmentin",
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class AssistantOrchestratorService {
  async chat(data: {
    db: DatabaseClient;
    session: AssistantSession;
    input: AssistantChatInput;
  }): Promise<AssistantChatResult> {
    const maxHistoryMessages = this.clamp(
      data.input.max_history_messages ?? 8,
      1,
      12,
    );
    const normalizedMessages = this.normalizeMessages(
      data.input.messages,
      maxHistoryMessages,
    );
    const latestUserQuestion = this.getLatestUserQuestion(normalizedMessages);

    if (!latestUserQuestion) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "La question du medecin est requise.",
      });
    }

    const routing = await this.resolveRoute({
      messages: normalizedMessages,
      latestUserQuestion,
      patientId: data.input.patient_id ?? null,
    });

    if (routing.route === "patient_context_required") {
      return {
        resolved_intent: "patient_context_required",
        answer:
          "Pour répondre à cette question sur un patient précis, ouvrez d’abord sa fiche patient puis renvoyez votre demande.",
        warnings: [],
        follow_up_suggestions: [
          "Ouvrir la fiche du patient concerné",
          "Reformuler la question avec le contexte clinique du patient",
        ],
      };
    }

    if (routing.route === "patient_qna") {
      try {
        const result = await aiService.ask({
          db: data.db,
          session: data.session,
          patient_id: data.input.patient_id!,
          question: latestUserQuestion,
        });

        return {
          resolved_intent: "patient_qna",
          answer: result.answer,
          warnings: [],
          follow_up_suggestions: [],
        };
      } catch (error) {
        return {
          resolved_intent: "patient_qna",
          answer: toSimpleFrenchAiMessage(error),
          warnings: [],
          follow_up_suggestions: [],
        };
      }
    }

    try {
      const result = await medicationAssistantService.chat({
        db: data.db,
        session: data.session,
        input: {
          messages: normalizedMessages,
          max_history_messages: maxHistoryMessages,
        },
      });

      if (result.requires_patient_context) {
        return {
          resolved_intent: "patient_context_required",
          answer:
            "Cette question nécessite le contexte d’un patient précis. Ouvrez sa fiche patient puis reposez la question.",
          warnings: result.warnings,
          follow_up_suggestions: result.follow_up_suggestions,
        };
      }

      return {
        resolved_intent: "medication_qna",
        answer: result.answer,
        warnings: result.warnings,
        follow_up_suggestions: result.follow_up_suggestions,
        referenced_medicaments: result.referenced_medicaments,
      };
    } catch (error) {
      return {
        resolved_intent: "medication_qna",
        answer: toSimpleFrenchAiMessage(error),
        warnings: [],
        follow_up_suggestions: [],
      };
    }
  }

  private resolveRouteFromGuess(
    guess: IntentGuess,
    patientId: string | null,
  ): ResolvedRoute {
    if (guess === "patient") {
      return patientId
        ? { route: "patient_qna", intentGuess: guess }
        : { route: "patient_context_required", intentGuess: guess };
    }

    if (guess === "mixed") {
      return patientId
        ? { route: "patient_qna", intentGuess: guess }
        : { route: "patient_context_required", intentGuess: guess };
    }

    if (guess === "medication") {
      return { route: "medication_qna", intentGuess: guess };
    }

    return patientId
      ? { route: "patient_qna", intentGuess: guess }
      : { route: "medication_qna", intentGuess: guess };
  }

  private detectIntentHeuristically(question: string): IntentGuess {
    const normalized = normalizeText(question);
    const hasPatientSignal = this.containsAny(normalized, patientSignals);
    const hasMedicationSignal = this.containsAny(normalized, medicationSignals);
    const hasPatientPronounSignal =
      !hasPatientSignal &&
      this.containsAny(normalized, patientPronounSignals) &&
      !hasMedicationSignal;

    if ((hasPatientSignal || hasPatientPronounSignal) && hasMedicationSignal) {
      return "mixed";
    }

    if (hasPatientSignal || hasPatientPronounSignal) {
      return "patient";
    }

    if (hasMedicationSignal) {
      return "medication";
    }

    return "unknown";
  }

  private async detectIntentWithModel(data: {
    messages: AssistantChatMessage[];
    latestUserQuestion: string;
  }): Promise<IntentGuess> {
    try {
      const provider = resolveGeminiProvider();
      const history = data.messages
        .slice(-6)
        .map((message) => `${message.role}: ${message.content}`)
        .join("\n");

      const result = await generateGeminiText({
        provider,
        system:
          "Tu classes une question medicale dans une seule categorie pour router vers le bon outil backend. Reponds uniquement en JSON valide.",
        prompt: `Classe la derniere demande du medecin dans une seule categorie.

Categories:
- patient: question sur le dossier d'un patient precis, ses antecedents, son traitement, sa consultation, ses examens ou sa compatibilite therapeutique dans son contexte.
- medication: question generale sur un medicament, une molecule, une comparaison, une posologie, une interaction ou une classe therapeutique, sans avoir besoin d'un patient precis.
- mixed: question qui combine explicitement un medicament et un patient precis.
- unknown: impossible a trancher.

Historique recent:
${history}

Derniere question:
${data.latestUserQuestion}

Reponds avec ce schema JSON:
{
  "intent": "patient" | "medication" | "mixed" | "unknown",
  "confidence": 0.0,
  "reason": "courte raison"
}`,
        temperature: 0,
        timeoutMs: 8000,
      });

      const parsed = parseModelJson(result.text);
      const classification = assistantIntentClassificationSchema.parse(parsed);
      return classification.intent;
    } catch {
      return "unknown";
    }
  }

  private async resolveRoute(data: {
    messages: AssistantChatMessage[];
    latestUserQuestion: string;
    patientId: string | null;
  }): Promise<ResolvedRoute> {
    const heuristicGuess = this.detectIntentHeuristically(data.latestUserQuestion);
    if (heuristicGuess !== "unknown") {
      return this.resolveRouteFromGuess(heuristicGuess, data.patientId);
    }

    const modelGuess = await this.detectIntentWithModel(data);
    return this.resolveRouteFromGuess(modelGuess, data.patientId);
  }

  private normalizeMessages(
    messages: AssistantChatMessage[],
    maxHistoryMessages: number,
  ): AssistantChatMessage[] {
    return messages
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }))
      .filter((message) => message.content.length > 0)
      .slice(-maxHistoryMessages);
  }

  private getLatestUserQuestion(messages: AssistantChatMessage[]): string | null {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const candidate = messages[index];
      if (candidate?.role === "user") {
        return candidate.content.trim();
      }
    }

    return null;
  }

  private containsAny(haystack: string, needles: string[]): boolean {
    return needles.some((needle) => haystack.includes(needle));
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}

export const assistantOrchestratorService = new AssistantOrchestratorService();
