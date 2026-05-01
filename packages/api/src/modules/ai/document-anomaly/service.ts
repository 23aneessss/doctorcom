import { TRPCError } from "@trpc/server";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { db as databaseClient } from "@doctor.com/db";
import { utilisateurs } from "@doctor.com/db/schema";
import { eq } from "drizzle-orm";

import type { SessionUtilisateur } from "../../../trpc/context";
import {
  getObjectNameFromUrl,
  minioClient,
  storageConfig,
} from "../../../infrastructure/storage";
import {
  GEMINI_PROVIDER_NAME,
  resolveTextProvider,
} from "../shared/provider";
import { documentAnomalyRepository, type FullPatientData } from "./repo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DatabaseClient = typeof databaseClient;
type AiSession = Exclude<SessionUtilisateur, null>;

interface DocumentContent {
  key: string;
  mimeType: string;
  base64: string;
}

type DocumentModality =
  | "lab_result"
  | "radiology_report"
  | "xray"
  | "ct_mri"
  | "ecg"
  | "clinical_note"
  | "generic_image"
  | "generic_pdf"
  | "unknown";

interface ClassifiedDocument {
  key: string;
  mimeType: string;
  modality: DocumentModality;
}

const ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1000;
const ANALYSIS_CACHE_VERSION = 3;
const analysisCache = new Map<
  string,
  { expiresAt: number; value: DocumentAnalysisResult }
>();

type DocumentPart =
  | { type: "image"; image: string; mimeType: string }
  | { type: "file"; data: string; mimeType: string }
  | { type: "text"; text: string };

interface VerificationResult {
  verifiable: boolean;
  patient_match: boolean;
  confidence: number;
  details: string;
  matched_fields: string[];
  mismatched_fields: { field: string; expected: string; found: string }[];
}

type SuggestionsResult = z.infer<typeof suggestionsResultSchema>;

interface ProcessedSuggestionsResult {
  suggestions: NonNullable<DocumentAnalysisResult["suggestions"]>;
}

interface DocumentSummaryResult {
  document_summaries: DocumentAnalysisResult["document_summaries"];
}

export interface DocumentAnalysisResult {
  validated: boolean;
  confidence: number;
  document_summaries: {
    document_key: string;
    title: string;
    description: string;
    anomalies: {
      label: string;
      severity: "info" | "warning" | "critical";
      details: string;
    }[];
  }[];
  identity: {
    verifiable: boolean;
    patient_match: boolean;
    confidence: number;
    details: string;
    matched_fields: string[];
    mismatched_fields: { field: string; expected: string; found: string }[];
    risk_level: "low" | "medium" | "high";
  };
  identity_flag: "match" | "mismatch" | "uncertain";
  suggestions?: {
    suggestion_id: string;
    table: string;
    field: string;
    category: "demographic" | "lab_value" | "antecedent" | "treatment" | "vaccination" | "other";
    current_value: string | null;
    suggested_value: string;
    reason: string;
    confidence: number;
    severity?: "normal" | "abnormal" | "critical";
    source?: {
      document_key: string;
      modality: DocumentModality;
      snippet?: string;
    };
    validation_flags?: string[];
  }[];
  proposed_actions: {
    action_id: string;
    mutation: string;
    input: Record<string, unknown>;
    description: string;
    suggestion_ids: string[];
  }[];
  extraction_stats: {
    documents_total: number;
    documents_processed: number;
    low_confidence_fields: number;
    processing_time_ms: number;
    cache_hit: boolean;
  };
}

// ---------------------------------------------------------------------------
// Zod schemas for AI output reference (not used for strict validation)
// ---------------------------------------------------------------------------

const suggestionsResultSchema = z.object({
  suggestions: z
    .array(
      z.object({
        table: z
          .string()
          .describe("Table cible: patients, patients_femmes, examen_consultation, antecedents, historique_traitements, vaccinations_patient"),
        field: z
          .string()
          .describe("Nom du champ ou element concerne"),
        category: z
          .enum(["demographic", "lab_value", "antecedent", "treatment", "vaccination", "other"])
          .describe("Categorie de la suggestion"),
        current_value: z
          .string()
          .nullable()
          .describe("Valeur actuelle dans la base de donnees, null si absent"),
        suggested_value: z
          .string()
          .describe("Valeur suggeree d'apres le document"),
        reason: z
          .string()
          .describe("Raison de la suggestion en francais"),
        confidence: z
          .number()
          .min(0)
          .max(1)
          .describe("Score de confiance pour cette suggestion"),
        severity: z
          .enum(["normal", "abnormal", "critical"])
          .optional()
          .describe("Niveau de severite pour les valeurs cliniques"),
        source: z
          .object({
            document_key: z.string().describe("Cle du document source"),
            modality: z
              .enum([
                "lab_result",
                "radiology_report",
                "xray",
                "ct_mri",
                "ecg",
                "clinical_note",
                "generic_image",
                "generic_pdf",
                "unknown",
              ])
              .describe("Type de document medical source"),
            snippet: z
              .string()
              .optional()
              .describe("Extrait de texte ayant motive la suggestion"),
          })
          .optional(),
      }),
    )
    .describe("Liste des suggestions de mise a jour"),
});

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const VERIFICATION_SYSTEM_PROMPT = `Vous etes un assistant specialise dans la verification d'identite de documents medicaux.

Votre tache: comparer les informations d'identite d'un patient (base de donnees) avec les informations visibles dans les documents fournis.

Reponse attendue (JSON):
- verifiable: true si le document contient au moins un element d'identite (nom, prenom, NSS, matricule, date de naissance). false si le document ne contient aucune information d'identite.
- patient_match: true si les informations correspondent, false si elles different. Si verifiable=false, mettre false.
- confidence: score 0-1 refletant la certitude de la correspondance.
- details: 1-2 phrases max, en francais.
- matched_fields: liste des champs qui correspondent.
- mismatched_fields: liste des champs qui different ({field, expected, found}).

Regles:
1. Comparez nom, prenom, date de naissance, NSS, matricule, sexe, lieu de naissance.
2. Tolerez variations mineures, accents, casse.
3. Si le document ne contient AUCUNE information d'identite, mettez verifiable: false avec un details court expliquant l'absence d'information.
4. Repondez en JSON uniquement.`;

const SUGGESTIONS_SYSTEM_PROMPT = `Vous etes un assistant medical specialise dans l'analyse de documents medicaux.

Votre tache: analyser uniquement les documents fournis et identifier des actions a proposer pour mettre a jour les donnees du patient.

Regle fondamentale: chaque suggestion doit provenir explicitement du contenu visible dans un document fourni. Les donnees patient existantes servent seulement de reference de comparaison; elles ne doivent jamais etre transformees en suggestion si l'information n'est pas presente dans le document.

Tables concernees (actionnables):
- patients / patients_femmes: donnees demographiques
- antecedents: antecedents medicaux personnels ou familiaux
- historique_traitements: medicaments et traitements
- vaccinations_patient: vaccinations

Tables NON actionnables: suivi, examen_consultation, rendez_vous, certificats_medicaux, lettres_orientation.

Pour chaque suggestion, indiquez:
- table: la table concernee
- field: le champ ou element concerne
- category: "demographic" | "lab_value" (valeur anormale → antecedent) | "antecedent" | "treatment" | "vaccination" | "other"
- current_value: valeur actuelle dans les donnees patient, sinon null
- suggested_value: la valeur a ajouter ou mettre a jour
- reason: explication courte en francais
- confidence: score 0-1
- severity: "normal" | "abnormal" | "critical"
- source: obligatoire, avec document_key correspondant a un document fourni et snippet contenant l'extrait ou la valeur observee dans le document

Types de suggestions:
1. DONNEES DEMOGRAPHIQUES differentes ou absentes (groupe sanguin, adresse, profession, etc.) → table: patients
2. ANTECEDENTS mentions dans les documents mais absents de la base → table: antecedents
3. VALEURS DE LABORATOIRE anormales significatives (cholesterol bas/haut, diabete, etc.) → table: antecedents, category: lab_value
4. TRAITEMENTS mentionnes dans les documents → table: historique_traitements
5. VACCINATIONS mentionnees mais absentes → table: vaccinations_patient

Contraintes de sortie:
1. Ne suggerez PAS de modifications si confiance < 0.5.
2. Ne suggerez PAS une information uniquement parce qu'elle existe deja dans la base patient.
3. Ne suggerez PAS de donnees generales, de contexte, ou de resume de document comme modification du dossier patient.
4. suggested_value, current_value, field et reason doivent etre des chaines de caracteres simples, jamais des objets JSON.
5. Si aucune suggestion documentee par une source du document n'existe, retournez un tableau vide.
6. Repondez en JSON uniquement.`;

const DOCUMENT_DESCRIPTION_SYSTEM_PROMPT = `Vous etes un assistant medical specialise dans la lecture de documents cliniques.

Votre tache: decrire chaque document fourni, puis relever les anomalies visibles dans le document lui-meme.

Reponse attendue (JSON):
{
  "document_summaries": [
    {
      "document_key": "cle du document",
      "title": "titre court du document",
      "description": "description clinique concise en francais",
      "anomalies": [
        {
          "label": "nom court de l'anomalie",
          "severity": "info" | "warning" | "critical",
          "details": "explication courte"
        }
      ]
    }
  ]
}

Regles:
1. Generez une entree par document analyse.
2. La description doit resumer le type de document, la date visible si presente, et les informations medicales principales.
3. Les anomalies sont des valeurs, incoherences, alertes cliniques ou informations administratives suspectes visibles dans le document.
4. Si aucune anomalie n'est visible, retournez anomalies: [].
5. Repondez en JSON uniquement.`;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class DocumentAnomalyService {
  // ---------------------------------------------------------------------------
  // Public method
  // ---------------------------------------------------------------------------

  async analyzeDocuments(data: {
    db: DatabaseClient;
    session: AiSession;
    patient_id: string;
    document_keys: string[];
  }): Promise<DocumentAnalysisResult> {
    const startedAt = Date.now();

    // 1. Resolve AI provider (validates API keys)
    const aiModel = this.resolveAiProvider();

    // 2. Resolve authenticated user
    await this.resolveUtilisateur(data.db, data.session);

    // 3. Fetch patient data + MinIO documents in parallel
    const [patientData, documents] = await Promise.all([
      documentAnomalyRepository.getFullPatientData(data.db, data.patient_id),
      this.fetchDocumentsFromMinio(data.document_keys),
    ]);

    if (!patientData) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Patient introuvable.",
      });
    }

    const classifiedDocuments = this.classifyDocuments(documents);
    const cacheKey = this.buildCacheKey(data.patient_id, documents);
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return {
        ...cached,
        extraction_stats: {
          ...cached.extraction_stats,
          processing_time_ms: Date.now() - startedAt,
          cache_hit: true,
        },
      };
    }

    // 4. Validate that we have processable documents
    const documentParts = this.buildDocumentParts(documents);
    const processableParts = documentParts.filter((p) => p.type !== "text");
    if (processableParts.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Aucun document dans un format exploitable (PDF, JPEG, PNG). Formats acceptes: PDF, JPEG, PNG, WebP.",
      });
    }

    // 5. Describe documents, then run identity verification + suggestions.
    const documentSummaryResult = await this.generateDocumentSummaries(
      aiModel,
      documentParts,
      classifiedDocuments,
    );

    const [verification, suggestionsResult] =
      await Promise.all([
        this.verifyPatientIdentity(
          aiModel,
          {
            nom: patientData.patient.nom,
            prenom: patientData.patient.prenom,
            date_naissance: patientData.patient.date_naissance,
            nss: patientData.patient.nss,
            matricule: patientData.patient.matricule,
            sexe: patientData.patient.sexe,
            lieu_naissance: patientData.patient.lieu_naissance,
          },
          documentParts,
        ),
        this.generateSuggestions(
          aiModel,
          patientData,
          documentParts,
          classifiedDocuments,
          documentSummaryResult.document_summaries,
        ),
      ]);

    const processedSuggestions = this.postProcessSuggestions(
      suggestionsResult.suggestions,
      classifiedDocuments,
    );

    const proposedActions = this.buildProposedActions(
      processedSuggestions.suggestions,
      data.patient_id,
    );

    const lowConfidenceFields = processedSuggestions.suggestions.filter(
      (suggestion) => suggestion.confidence < 0.6,
    ).length;

    const identityFlag: "match" | "mismatch" | "uncertain" =
      verification.verifiable && verification.patient_match && verification.confidence >= 0.7
        ? "match"
        : verification.verifiable && !verification.patient_match
          ? "mismatch"
          : "uncertain";

    const result: DocumentAnalysisResult = {
      validated: true,
      confidence: verification.confidence,
      document_summaries: documentSummaryResult.document_summaries,
      identity: {
        verifiable: verification.verifiable,
        patient_match: verification.patient_match,
        confidence: verification.confidence,
        details: verification.details,
        matched_fields: verification.matched_fields,
        mismatched_fields: verification.mismatched_fields,
        risk_level: this.deriveIdentityRisk(verification),
      },
      identity_flag: identityFlag,
      suggestions: processedSuggestions.suggestions,
      proposed_actions: proposedActions,
      extraction_stats: {
        documents_total: documents.length,
        documents_processed: processableParts.length,
        low_confidence_fields: lowConfidenceFields,
        processing_time_ms: Date.now() - startedAt,
        cache_hit: false,
      },
    };

    this.setCachedResult(cacheKey, result);

    return result;
  }

  // ---------------------------------------------------------------------------
  // AI provider
  // ---------------------------------------------------------------------------

  private resolveAiProvider(): LanguageModel {
    const provider = resolveTextProvider();
    if (provider.name !== GEMINI_PROVIDER_NAME) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "L'analyse IA des documents PDF/images necessite Gemini pour le moment. Repassez AI_PROVIDER=gemini pour cette fonctionnalite.",
      });
    }

    if (!provider.apiKey) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "La clé Gemini est absente. Ajoute GEMINI_API_KEY dans apps/server/.env.",
      });
    }

    const google = createGoogleGenerativeAI({
      apiKey: provider.apiKey,
    });

    return google(provider.model);
  }

  // ---------------------------------------------------------------------------
  // Phase 1 — Identity verification
  // ---------------------------------------------------------------------------

  private async verifyPatientIdentity(
    model: LanguageModel,
    patientIdentity: {
      nom: string;
      prenom: string;
      date_naissance: string;
      nss: number | null;
      matricule: string;
      sexe: string | null;
      lieu_naissance: string | null;
    },
    documentParts: DocumentPart[],
  ): Promise<VerificationResult> {
    const identityText = [
      `Nom: ${patientIdentity.nom}`,
      `Prenom: ${patientIdentity.prenom}`,
      `Date de naissance: ${patientIdentity.date_naissance}`,
      `NSS: ${patientIdentity.nss ?? "Non renseigne"}`,
      `Matricule: ${patientIdentity.matricule}`,
      `Sexe: ${patientIdentity.sexe ?? "Non renseigne"}`,
      `Lieu de naissance: ${patientIdentity.lieu_naissance ?? "Non renseigne"}`,
    ].join("\n");

    try {
      const result = await generateText({
        model: model,
        messages: [
          {
            role: "system",
            content: VERIFICATION_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "text" as const,
                text: `## Identite du patient dans la base de donnees\n\n${identityText}\n\n## Documents medicaux a verifier\n\nAnalysez les documents suivants et verifiez s'ils correspondent au patient ci-dessus.\n\nRepondez UNIQUEMENT avec un objet JSON valide (pas de texte avant ou apres).`,
              },
              ...documentParts,
            ],
          },
        ],
      });

      const parsed = this.parseJsonFromText(result.text);
      return this.normalizeVerificationResult(parsed);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error(
        "[document-anomaly] verifyPatientIdentity failed (non-blocking):",
        error,
      );
      return this.fallbackVerification();
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 2 — Document descriptions
  // ---------------------------------------------------------------------------

  private async generateDocumentSummaries(
    model: LanguageModel,
    documentParts: DocumentPart[],
    classifiedDocuments: ClassifiedDocument[],
  ): Promise<DocumentSummaryResult> {
    const modalityContext = this.buildDocumentClassificationPrompt(classifiedDocuments);

    try {
      const result = await generateText({
        model,
        messages: [
          {
            role: "system",
            content: DOCUMENT_DESCRIPTION_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "text" as const,
                text: `## Documents a decrire\n\n${modalityContext}\n\nGenerez d'abord une description pour chaque document, puis listez les anomalies visibles dans chaque document.\n\nRepondez uniquement avec le JSON demande.`,
              },
              ...documentParts,
            ],
          },
        ],
      });

      const parsed = this.parseJsonFromText(result.text);
      return this.normalizeDocumentSummaryResult(parsed, classifiedDocuments);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("[document-anomaly] generateDocumentSummaries failed:", error);
      return {
        document_summaries: classifiedDocuments.map((document) => ({
          document_key: document.key,
          title: this.fallbackDocumentTitle(document.key),
          description: "Description indisponible pour ce document.",
          anomalies: [],
        })),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 3 — Data suggestions
  // ---------------------------------------------------------------------------

  private async generateSuggestions(
    model: LanguageModel,
    patientData: FullPatientData,
    documentParts: DocumentPart[],
    classifiedDocuments: ClassifiedDocument[],
    documentSummaries: DocumentAnalysisResult["document_summaries"],
  ): Promise<SuggestionsResult> {
    const patientContext = this.buildPatientPrompt(patientData);
    const modalityContext = this.buildDocumentClassificationPrompt(classifiedDocuments);
    const summaryContext = this.buildDocumentSummaryPrompt(documentSummaries);

    try {
      const result = await generateText({
        model: model,
        messages: [
          {
            role: "system",
            content: SUGGESTIONS_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "text" as const,
                text: `## Donnees actuelles du patient dans la base de donnees\n\n${patientContext}\n\n## Classification preliminaire des documents\n\n${modalityContext}\n\n## Descriptions et anomalies deja identifiees dans les documents\n\n${summaryContext}\n\n## Documents medicaux a analyser\n\nA partir du contenu des documents fournis uniquement, proposez les modifications utiles au dossier patient. Les donnees patient ci-dessus servent seulement a verifier si l'information du document est nouvelle ou differente.\n\nPour chaque suggestion, source est obligatoire et doit contenir un document_key existant ci-dessus ainsi qu'un snippet extrait du document. Rejetez toute suggestion qui n'est pas directement justifiee par le document.\n\nRepondez UNIQUEMENT avec un objet JSON contenant une cle "suggestions" (tableau). Pas de texte avant ou apres le JSON.`,
              },
              ...documentParts,
            ],
          },
        ],
      });

      const parsed = this.parseJsonFromText(result.text);
      return this.normalizeSuggestionsResult(parsed);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("[document-anomaly] generateSuggestions failed:", error);
      return { suggestions: [] };
    }
  }

  // ---------------------------------------------------------------------------
  // JSON parsing helpers
  // ---------------------------------------------------------------------------

  private parseJsonFromText(text: string): unknown {
    const trimmed = text.trim();
    // Strip markdown code fences
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenced?.[1]?.trim() ?? trimmed;
    try {
      return JSON.parse(raw);
    } catch {
      // Try to find first { or [ and last } or ]
      const start = raw.search(/[\[{]/);
      const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(raw.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private normalizeVerificationResult(
    parsed: unknown,
  ): VerificationResult {
    if (!parsed || typeof parsed !== "object") {
      return this.fallbackVerification();
    }
    const obj = parsed as Record<string, unknown>;
    return {
      verifiable:
        typeof obj.verifiable === "boolean" ? obj.verifiable : true,
      patient_match:
        typeof obj.patient_match === "boolean" ? obj.patient_match : false,
      confidence:
        typeof obj.confidence === "number"
          ? obj.confidence
          : typeof obj.confidence_score === "number"
            ? obj.confidence_score
            : 0,
      details:
        typeof obj.details === "string"
          ? obj.details
          : typeof obj.explanation === "string"
            ? obj.explanation
            : "Verification d'identite impossible.",
      matched_fields: Array.isArray(obj.matched_fields)
        ? (obj.matched_fields as string[])
        : [],
      mismatched_fields: Array.isArray(obj.mismatched_fields)
        ? (obj.mismatched_fields as { field: string; expected: string; found: string }[])
        : [],
    };
  }

  private normalizeDocumentSummaryResult(
    parsed: unknown,
    classifiedDocuments: ClassifiedDocument[],
  ): DocumentSummaryResult {
    const fallback = classifiedDocuments.map((document) => ({
      document_key: document.key,
      title: this.fallbackDocumentTitle(document.key),
      description: "Document medical importe.",
      anomalies: [],
    }));

    if (!parsed || typeof parsed !== "object") {
      return { document_summaries: fallback };
    }

    const obj = parsed as Record<string, unknown>;
    const raw = Array.isArray(obj)
      ? obj
      : Array.isArray(obj.document_summaries)
        ? obj.document_summaries
        : [];

    const normalized = raw
      .filter((item: unknown) => item && typeof item === "object")
      .map((item: unknown) => {
        const summary = item as Record<string, unknown>;
        const documentKey = String(summary.document_key ?? "");
        const anomaliesRaw = Array.isArray(summary.anomalies)
          ? summary.anomalies
          : [];

        return {
          document_key: documentKey,
          title:
            typeof summary.title === "string" && summary.title.trim()
              ? summary.title.trim()
              : this.fallbackDocumentTitle(documentKey),
          description:
            typeof summary.description === "string" &&
            summary.description.trim()
              ? summary.description.trim()
              : "Document medical importe.",
          anomalies: anomaliesRaw
            .filter((anomaly: unknown) => anomaly && typeof anomaly === "object")
            .map((anomaly: unknown) => {
              const item = anomaly as Record<string, unknown>;
              const severity = String(item.severity ?? "info");
              const normalizedSeverity: "info" | "warning" | "critical" =
                severity === "critical"
                  ? "critical"
                  : severity === "warning"
                    ? "warning"
                    : "info";
              return {
                label: String(item.label ?? "Anomalie"),
                severity: normalizedSeverity,
                details: String(item.details ?? ""),
              };
            }),
        };
      })
      .filter((summary) => summary.document_key);

    const summariesByKey = new Map(
      normalized.map((summary) => [summary.document_key, summary]),
    );

    return {
      document_summaries: classifiedDocuments.map(
        (document) =>
          summariesByKey.get(document.key) ?? {
            document_key: document.key,
            title: this.fallbackDocumentTitle(document.key),
            description: "Document medical importe.",
            anomalies: [],
          },
      ),
    };
  }

  private fallbackVerification(): VerificationResult {
    return {
      verifiable: false,
      patient_match: false,
      confidence: 0,
      details: "Verification impossible (modele incompatible).",
      matched_fields: [],
      mismatched_fields: [],
    };
  }

  private normalizeSuggestionsResult(parsed: unknown): SuggestionsResult {
    if (!parsed || typeof parsed !== "object") {
      return { suggestions: [] };
    }
    const obj = parsed as Record<string, unknown>;
    const raw = Array.isArray(obj) ? obj : Array.isArray(obj.suggestions) ? obj.suggestions : [];
    const suggestions = raw
      .filter(
        (s: unknown) =>
          s && typeof s === "object" && "table" in (s as Record<string, unknown>) && "field" in (s as Record<string, unknown>),
      )
      .map((s: unknown) => {
        const item = s as Record<string, unknown>;
        return {
          table: this.stringifyAiValue(item.table, "patients"),
          field: this.stringifyAiValue(item.field),
          category: this.stringifyAiValue(item.category, "other") as "demographic" | "lab_value" | "antecedent" | "treatment" | "vaccination" | "other",
          current_value: item.current_value != null ? this.stringifyAiValue(item.current_value) : null,
          suggested_value: this.stringifyAiValue(item.suggested_value),
          reason: this.stringifyAiValue(item.reason),
          confidence: typeof item.confidence === "number" ? item.confidence : 0.5,
          severity: item.severity != null ? this.stringifyAiValue(item.severity) as "normal" | "abnormal" | "critical" : undefined,
          source: item.source && typeof item.source === "object"
            ? {
                document_key: this.stringifyAiValue((item.source as Record<string, unknown>).document_key, "unknown"),
                modality: this.stringifyAiValue((item.source as Record<string, unknown>).modality, "unknown") as DocumentModality,
                snippet: (item.source as Record<string, unknown>).snippet != null
                  ? this.stringifyAiValue((item.source as Record<string, unknown>).snippet)
                  : undefined,
              }
            : undefined,
        };
      });
    return { suggestions };
  }

  private stringifyAiValue(value: unknown, fallback = ""): string {
    if (value == null) return fallback;
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => this.stringifyAiValue(item))
        .filter(Boolean)
        .join(", ");
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      for (const key of ["description", "value", "valeur", "name", "nom", "label", "type"]) {
        const nested = this.stringifyAiValue(record[key]);
        if (nested) return nested;
      }

      return Object.entries(record)
        .map(([key, nestedValue]) => {
          const normalized = this.stringifyAiValue(nestedValue);
          return normalized ? `${key}: ${normalized}` : "";
        })
        .filter(Boolean)
        .join(", ");
    }

    return fallback;
  }

  // ---------------------------------------------------------------------------
  // Proposed actions builder
  // ---------------------------------------------------------------------------

  private buildProposedActions(
    suggestions: NonNullable<DocumentAnalysisResult["suggestions"]>,
    patientId: string,
  ): DocumentAnalysisResult["proposed_actions"] {
    const actions: DocumentAnalysisResult["proposed_actions"] = [];

    for (const suggestion of suggestions) {
      const actionId = `act_${suggestion.suggestion_id}`;

      if (suggestion.table === "patients" || suggestion.table === "patients_femmes") {
        const updateData: Record<string, unknown> = {};
        if (suggestion.table === "patients_femmes") {
          updateData.female_data = { [suggestion.field]: suggestion.suggested_value };
        } else {
          updateData[suggestion.field] = suggestion.suggested_value;
        }
        actions.push({
          action_id: actionId,
          mutation: "patient.updatePatient",
          input: { id: patientId, data: updateData },
          description: `Mettre a jour ${suggestion.field} du patient`,
          suggestion_ids: [suggestion.suggestion_id],
        });
      } else if (suggestion.table === "antecedents") {
        actions.push({
          action_id: actionId,
          mutation: "medicalHistory.ajouterAntecedent",
          input: {
            patient_id: patientId,
            type: "personnel",
            description: suggestion.suggested_value,
            personnel: { type: suggestion.field, est_actif: true },
          },
          description: `Ajouter un antecedent: ${suggestion.suggested_value}`,
          suggestion_ids: [suggestion.suggestion_id],
        });
      } else if (
        suggestion.table === "historique_traitements" &&
        this.isPositiveIntegerString(suggestion.field)
      ) {
        actions.push({
          action_id: actionId,
          mutation: "treatment.startTreatment",
          input: {
            patient_id: patientId,
            medicament_externe_id: suggestion.field,
            posologie: suggestion.suggested_value,
            date_prescription: new Date().toISOString().split("T")[0],
          },
          description: `Demarrer un traitement: ${suggestion.suggested_value}`,
          suggestion_ids: [suggestion.suggestion_id],
        });
      } else if (suggestion.table === "vaccinations_patient") {
        actions.push({
          action_id: actionId,
          mutation: "vaccination.recordVaccination",
          input: {
            patient_id: patientId,
            vaccin: suggestion.suggested_value,
            date_vaccination: new Date().toISOString().split("T")[0],
          },
          description: `Enregistrer une vaccination: ${suggestion.suggested_value}`,
          suggestion_ids: [suggestion.suggestion_id],
        });
      }
    }

    return actions;
  }

  private isPositiveIntegerString(value: string): boolean {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0;
  }

  // ---------------------------------------------------------------------------
  // MinIO document fetching
  // ---------------------------------------------------------------------------

  private async fetchDocumentsFromMinio(
    documentKeys: string[],
  ): Promise<DocumentContent[]> {
    const results = await Promise.all(
      documentKeys.map(async (inputKey) => {
        const key = this.normalizeStorageObjectName(inputKey);
        try {
          const stream = await minioClient.getObject(
            storageConfig.bucket,
            key,
          );

          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(
              Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array),
            );
          }
          const buffer = Buffer.concat(chunks);

          const mimeType = this.inferMimeType(key);
          const base64 = buffer.toString("base64");

          return { key, mimeType, base64 };
        } catch {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Document introuvable dans le stockage: ${inputKey}`,
          });
        }
      }),
    );

    return results;
  }

  private normalizeStorageObjectName(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;

    try {
      return getObjectNameFromUrl(trimmed);
    } catch {
      return trimmed;
    }
  }

  private inferMimeType(key: string): string {
    const ext = key.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      tiff: "image/tiff",
      tif: "image/tiff",
      bmp: "image/bmp",
    };
    return mimeMap[ext ?? ""] ?? "application/octet-stream";
  }

  private classifyDocuments(documents: DocumentContent[]): ClassifiedDocument[] {
    return documents.map((document) => ({
      key: document.key,
      mimeType: document.mimeType,
      modality: this.inferDocumentModality(document.key, document.mimeType),
    }));
  }

  private inferDocumentModality(
    key: string,
    mimeType: string,
  ): DocumentModality {
    const normalizedKey = key.toLowerCase();

    if (
      normalizedKey.includes("lab") ||
      normalizedKey.includes("analyse") ||
      normalizedKey.includes("biologie") ||
      normalizedKey.includes("bilan")
    ) {
      return "lab_result";
    }

    if (
      normalizedKey.includes("radio") ||
      normalizedKey.includes("radiology") ||
      normalizedKey.includes("compte-rendu") ||
      normalizedKey.includes("compterendu")
    ) {
      return "radiology_report";
    }

    if (
      normalizedKey.includes("xray") ||
      normalizedKey.includes("x-ray") ||
      normalizedKey.includes("rx")
    ) {
      return "xray";
    }

    if (
      normalizedKey.includes("ct") ||
      normalizedKey.includes("scanner") ||
      normalizedKey.includes("irm") ||
      normalizedKey.includes("mri")
    ) {
      return "ct_mri";
    }

    if (normalizedKey.includes("ecg") || normalizedKey.includes("ekg")) {
      return "ecg";
    }

    if (
      normalizedKey.includes("consultation") ||
      normalizedKey.includes("lettre") ||
      normalizedKey.includes("ordonnance")
    ) {
      return "clinical_note";
    }

    if (mimeType.startsWith("image/")) return "generic_image";
    if (mimeType === "application/pdf") return "generic_pdf";
    return "unknown";
  }

  private buildDocumentClassificationPrompt(
    classifiedDocuments: ClassifiedDocument[],
  ): string {
    if (classifiedDocuments.length === 0) {
      return "Aucun document classe.";
    }

    return classifiedDocuments
      .map(
        (document) =>
          `- ${document.key} | mime: ${document.mimeType} | modality: ${document.modality}`,
      )
      .join("\n");
  }

  private buildDocumentSummaryPrompt(
    summaries: DocumentAnalysisResult["document_summaries"],
  ): string {
    if (summaries.length === 0) {
      return "Aucune description de document disponible.";
    }

    return summaries
      .map((summary) => {
        const anomalies =
          summary.anomalies.length > 0
            ? summary.anomalies
                .map(
                  (anomaly) =>
                    `  - ${anomaly.label} (${anomaly.severity}): ${anomaly.details}`,
                )
                .join("\n")
            : "  - Aucune anomalie visible.";

        return [
          `- ${summary.document_key}`,
          `  Titre: ${summary.title}`,
          `  Description: ${summary.description}`,
          `  Anomalies:`,
          anomalies,
        ].join("\n");
      })
      .join("\n\n");
  }

  private fallbackDocumentTitle(key: string): string {
    const lastSegment = key.split("/").pop() ?? key;
    return lastSegment.replace(/^[0-9a-f-]+-/i, "") || "Document medical";
  }

  private deriveIdentityRisk(
    verification: VerificationResult,
  ): "low" | "medium" | "high" {
    if (!verification.verifiable) return "medium";
    if (!verification.patient_match && verification.confidence < 0.5) {
      return "high";
    }
    if (!verification.patient_match || verification.confidence < 0.75) {
      return "medium";
    }
    return "low";
  }

  private postProcessSuggestions(
    suggestions: SuggestionsResult["suggestions"],
    classifiedDocuments: ClassifiedDocument[],
  ): ProcessedSuggestionsResult {
    const deduped = new Map<string, NonNullable<DocumentAnalysisResult["suggestions"]>[number]>();
    const validDocumentKeys = new Set(classifiedDocuments.map((document) => document.key));

    suggestions.forEach((suggestion, index) => {
      const suggestionId = `sug_${index + 1}`;
      const validationFlags: string[] = [];
      if (suggestion.confidence < 0.6) {
        validationFlags.push("low_confidence");
      }
      if (!suggestion.suggested_value.trim()) {
        return;
      }

      const selectedSource = suggestion.source;
      if (!selectedSource || !validDocumentKeys.has(selectedSource.document_key)) {
        return;
      }
      if (!selectedSource.snippet?.trim()) {
        return;
      }

      const category =
        suggestion.category as NonNullable<DocumentAnalysisResult["suggestions"]>[number]["category"];

      const dedupeKey = [
        suggestion.table,
        suggestion.field,
        suggestion.suggested_value.trim().toLowerCase(),
        selectedSource.document_key,
      ].join("|");

      const candidate: NonNullable<DocumentAnalysisResult["suggestions"]>[number] = {
        suggestion_id: suggestionId,
        table: suggestion.table,
        field: suggestion.field,
        category: category ?? "other",
        current_value: suggestion.current_value,
        suggested_value: suggestion.suggested_value,
        reason: suggestion.reason,
        confidence: suggestion.confidence,
        severity: suggestion.severity as NonNullable<DocumentAnalysisResult["suggestions"]>[number]["severity"],
        source: selectedSource,
        validation_flags: validationFlags,
      };

      const existing = deduped.get(dedupeKey);
      if (!existing || existing.confidence < candidate.confidence) {
        deduped.set(dedupeKey, candidate);
      }
    });

    return {
      suggestions: Array.from(deduped.values()),
    };
  }

  private buildCacheKey(patientId: string, documents: DocumentContent[]): string {
    const signature = documents
      .map((document) => ({
        key: document.key,
        mimeType: document.mimeType,
        size: document.base64.length,
        prefix: document.base64.slice(0, 48),
      }))
      .sort((a, b) => a.key.localeCompare(b.key));

    return createHash("sha256")
      .update(JSON.stringify({ version: ANALYSIS_CACHE_VERSION, patientId, signature }))
      .digest("hex");
  }

  private getCachedResult(cacheKey: string): DocumentAnalysisResult | null {
    const entry = analysisCache.get(cacheKey);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      analysisCache.delete(cacheKey);
      return null;
    }
    const value = entry.value as DocumentAnalysisResult & {
      document_summaries?: DocumentAnalysisResult["document_summaries"];
      proposed_actions?: DocumentAnalysisResult["proposed_actions"];
      suggestions?: DocumentAnalysisResult["suggestions"];
    };

    return {
      ...value,
      document_summaries: value.document_summaries ?? [],
      suggestions: value.suggestions ?? [],
      proposed_actions: value.proposed_actions ?? [],
    };
  }

  private setCachedResult(cacheKey: string, result: DocumentAnalysisResult): void {
    analysisCache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + ANALYSIS_CACHE_TTL_MS,
    });
  }

  // ---------------------------------------------------------------------------
  // Document part building for AI messages
  // ---------------------------------------------------------------------------

  private buildDocumentParts(
    documents: DocumentContent[],
  ): DocumentPart[] {
    const parts: DocumentPart[] = [];

    for (const doc of documents) {
      if (doc.mimeType.startsWith("image/")) {
        parts.push({
          type: "image" as const,
          image: doc.base64,
          mimeType: doc.mimeType,
        });
      } else if (doc.mimeType === "application/pdf") {
        parts.push({
          type: "file" as const,
          data: doc.base64,
          mimeType: doc.mimeType,
        });
      } else {
        parts.push({
          type: "text" as const,
          text: `[Document "${doc.key}" ignore: format non supporte (${doc.mimeType})]`,
        });
      }
    }

    return parts;
  }

  // ---------------------------------------------------------------------------
  // Patient prompt builder (formats full patient data for LLM context)
  // ---------------------------------------------------------------------------

  private buildPatientPrompt(data: FullPatientData): string {
    const sections: string[] = [];

    // --- Informations du patient ---
    const p = data.patient;
    const infoLines = [
      `Nom: ${p.nom} ${p.prenom}`,
      `Date de naissance: ${p.date_naissance}`,
      `Sexe: ${p.sexe ?? "Non renseigne"}`,
      `Groupe sanguin: ${p.groupe_sanguin ?? "Non renseigne"}`,
      `Profession: ${p.profession ?? "Non renseignee"}`,
      `Situation familiale: ${p.situation_familiale ?? "Non renseignee"}`,
      `Nombre d'enfants: ${p.nb_enfants ?? "Non renseigne"}`,
    ];

    if (p.habitudes_saines) {
      infoLines.push(`Habitudes saines: ${p.habitudes_saines}`);
    }
    if (p.habitudes_toxiques) {
      infoLines.push(`Habitudes toxiques: ${p.habitudes_toxiques}`);
    }
    if (p.environnement_animal) {
      infoLines.push(`Environnement animal: ${p.environnement_animal}`);
    }

    sections.push(`## Informations du patient\n${infoLines.join("\n")}`);

    // --- Donnees specifiques femme ---
    if (data.donnees_femme) {
      const f = data.donnees_femme;
      const femmeLines: string[] = [];
      if (f.menarche) femmeLines.push(`Menarche: ${f.menarche} ans`);
      if (f.regularite_cycles)
        femmeLines.push(`Cycles: ${f.regularite_cycles}`);
      if (f.contraception) femmeLines.push(`Contraception: ${f.contraception}`);
      if (f.nb_grossesses != null)
        femmeLines.push(`Grossesses: ${f.nb_grossesses}`);
      if (f.nb_cesariennes != null)
        femmeLines.push(`Cesariennes: ${f.nb_cesariennes}`);
      if (f.menopause != null)
        femmeLines.push(`Menopause: ${f.menopause ? "Oui" : "Non"}`);
      if (f.age_menopause)
        femmeLines.push(`Age menopause: ${f.age_menopause} ans`);
      if (f.symptomes_menopause)
        femmeLines.push(`Symptomes menopause: ${f.symptomes_menopause}`);

      if (femmeLines.length > 0) {
        sections.push(`## Donnees gynecologiques\n${femmeLines.join("\n")}`);
      }
    }

    // --- Voyages recents ---
    if (data.voyages.length > 0) {
      const voyageLines = data.voyages.map((v) => {
        let line = `- ${v.destination}, ${v.date}`;
        if (v.duree_jours) line += `, ${v.duree_jours} jours`;
        if (v.epidemies_destination) line += ` (${v.epidemies_destination})`;
        return line;
      });
      sections.push(`## Voyages recents\n${voyageLines.join("\n")}`);
    }

    // --- Antecedents personnels ---
    const antPersonnels = data.antecedents.filter(
      (a) => a.type === "personnel",
    );
    if (antPersonnels.length > 0) {
      const lines: string[] = [];
      for (const ant of antPersonnels) {
        lines.push(`- ${ant.description}`);
        for (const ap of ant.personnels) {
          lines.push(
            `  Type: ${ap.type}, Actif: ${ap.est_actif ? "Oui" : "Non"}${ap.details ? `, Details: ${ap.details}` : ""}`,
          );
        }
      }
      sections.push(`## Antecedents personnels\n${lines.join("\n")}`);
    }

    // --- Antecedents familiaux ---
    const antFamiliaux = data.antecedents.filter(
      (a) => a.type === "familial",
    );
    if (antFamiliaux.length > 0) {
      const lines: string[] = [];
      for (const ant of antFamiliaux) {
        lines.push(`- ${ant.description}`);
        for (const af of ant.familiaux) {
          lines.push(
            `  Lien: ${af.lien_parente ?? "Non precise"}${af.details ? `, ${af.details}` : ""}`,
          );
        }
      }
      sections.push(`## Antecedents familiaux\n${lines.join("\n")}`);
    }

    // --- Suivi medical ---
    if (data.suivis.length > 0) {
      const suiviLines = data.suivis.map((s) => {
        const status = s.est_actif
          ? "Actif"
          : `Cloture le ${s.date_fermeture ?? "N/A"}`;
        const symptoms =
          s.symptoms.length > 0 ? s.symptoms.join(", ") : s.motif;
        let line = `- Symptoms: ${symptoms} (${status}, ouvert le ${s.date_ouverture})`;
        if (s.hypothese_diagnostic)
          line += `\n  Hypothese: ${s.hypothese_diagnostic}`;
        if (s.historique) line += `\n  Historique: ${s.historique}`;
        return line;
      });
      sections.push(`## Suivi medical\n${suiviLines.join("\n")}`);
    }

    // --- Rendez-vous ---
    if (data.rendez_vous.length > 0) {
      const rdvLines = data.rendez_vous.map(
        (r) =>
          `- ${r.date} a ${r.heure}, Statut: ${r.statut}${r.important ? " (IMPORTANT)" : ""}`,
      );
      sections.push(`## Rendez-vous\n${rdvLines.join("\n")}`);
    }

    // --- Consultations (examens) ---
    if (data.examens.length > 0) {
      const examLines: string[] = [];
      for (const e of data.examens) {
        examLines.push(`### Consultation du ${e.date}`);
        if (e.taille) examLines.push(`Taille: ${e.taille} cm`);
        if (e.poids) examLines.push(`Poids: ${e.poids} kg`);
        if (e.description_consultation)
          examLines.push(`Description: ${e.description_consultation}`);
        if (e.aspect_general)
          examLines.push(`Aspect general: ${e.aspect_general}`);
        if (e.examen_respiratoire)
          examLines.push(`Examen respiratoire: ${e.examen_respiratoire}`);
        if (e.examen_cardiovasculaire)
          examLines.push(
            `Examen cardiovasculaire: ${e.examen_cardiovasculaire}`,
          );
        if (e.examen_cutane_muqueux)
          examLines.push(`Examen cutane-muqueux: ${e.examen_cutane_muqueux}`);
        if (e.examen_orl) examLines.push(`Examen ORL: ${e.examen_orl}`);
        if (e.examen_digestif)
          examLines.push(`Examen digestif: ${e.examen_digestif}`);
        if (e.examen_neurologique)
          examLines.push(`Examen neurologique: ${e.examen_neurologique}`);
        if (e.examen_locomoteur)
          examLines.push(`Examen locomoteur: ${e.examen_locomoteur}`);
        if (e.examen_genital)
          examLines.push(`Examen genital: ${e.examen_genital}`);
        if (e.examen_urinaire)
          examLines.push(`Examen urinaire: ${e.examen_urinaire}`);
        if (e.examen_ganglionnaire)
          examLines.push(`Examen ganglionnaire: ${e.examen_ganglionnaire}`);
        if (e.examen_endocrinien)
          examLines.push(`Examen endocrinien: ${e.examen_endocrinien}`);
        if (e.traitement_prescrit)
          examLines.push(`Traitement prescrit: ${e.traitement_prescrit}`);
        if (e.conclusion) examLines.push(`Diagnostique: ${e.conclusion}`);
      }
      sections.push(`## Consultations\n${examLines.join("\n")}`);
    }

    // --- Traitements en cours ---
    if (data.traitements.length > 0) {
      const traitLines = data.traitements.map((t) => {
        const medName = t.nom_medicament ?? "Medicament inconnu";
        const status = t.est_actif ? "En cours" : "Termine";
        return `- ${medName}: ${t.posologie} (${status}, prescrit le ${t.date_prescription})`;
      });
      sections.push(`## Traitements\n${traitLines.join("\n")}`);
    }

    // --- Ordonnances ---
    if (data.ordonnances.length > 0) {
      const ordLines: string[] = [];
      for (const ord of data.ordonnances) {
        ordLines.push(`### Ordonnance du ${ord.date_prescription}`);
        if (ord.remarques) ordLines.push(`Remarques: ${ord.remarques}`);
        for (const om of ord.medicaments) {
          const medName = om.dci ?? om.nom_medicament ?? "Medicament inconnu";
          ordLines.push(`- ${medName}: ${om.posologie}`);
          if (om.duree_traitement)
            ordLines.push(`  Duree: ${om.duree_traitement}`);
          if (om.instructions)
            ordLines.push(`  Instructions: ${om.instructions}`);
        }
      }
      sections.push(`## Ordonnances\n${ordLines.join("\n")}`);
    }

    // --- Vaccinations ---
    if (data.vaccinations.length > 0) {
      const vaccLines = data.vaccinations.map((v) => {
        let line = `- ${v.vaccin}, ${v.date_vaccination}`;
        if (v.notes) line += ` (${v.notes})`;
        return line;
      });
      sections.push(`## Vaccinations\n${vaccLines.join("\n")}`);
    }

    // --- Certificats medicaux ---
    if (data.certificats.length > 0) {
      const certLines = data.certificats.map((c) => {
        let line = `- Type: ${c.type_certificat}, Statut: ${c.statut}, Emis le ${c.date_emission}`;
        if (c.diagnostic) line += `\n  Diagnostic: ${c.diagnostic}`;
        if (c.destinataire) line += `\n  Destinataire: ${c.destinataire}`;
        return line;
      });
      sections.push(`## Certificats medicaux\n${certLines.join("\n")}`);
    }

    // --- Lettres d'orientation ---
    if (data.lettres_orientation.length > 0) {
      const lettreLines = data.lettres_orientation.map((l) => {
        const linesArr = [
          `- Urgence: ${l.urgence}, Destinataire: ${l.destinataire ?? "Non precise"}`,
        ];
        if (l.raison) linesArr.push(`  Raison: ${l.raison}`);
        if (l.examen_demande)
          linesArr.push(`  Examen demande: ${l.examen_demande}`);
        return linesArr.join("\n");
      });
      sections.push(`## Lettres d'orientation\n${lettreLines.join("\n")}`);
    }

    return sections.join("\n\n");
  }

  // ---------------------------------------------------------------------------
  // Auth helpers
  // ---------------------------------------------------------------------------

  private resolveSessionEmail(session: AiSession): string {
    const email = session.user.email.trim().toLowerCase();
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "La session a expiré. Reconnectez-vous.",
      });
    }
    return email;
  }

  private async resolveUtilisateur(
    database: DatabaseClient,
    session: AiSession,
  ) {
    const email = this.resolveSessionEmail(session);
    const [utilisateur] = await database
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.email, email))
      .limit(1);

    if (!utilisateur) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Le compte associé à cette session est introuvable.",
      });
    }

    return utilisateur;
  }
}

export const documentAnomalyService = new DocumentAnomalyService();
