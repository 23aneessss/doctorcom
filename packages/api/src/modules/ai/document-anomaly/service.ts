import { TRPCError } from "@trpc/server";
import { generateObject } from "ai";
import { createMistral } from "@ai-sdk/mistral";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { db as databaseClient } from "@doctor.com/db";
import { env } from "@doctor.com/env/server";
import { updatePatientSchema } from "@doctor.com/shared/schemas";
import { utilisateurs } from "@doctor.com/db/schema";
import { eq } from "drizzle-orm";

import type { SessionUtilisateur } from "../../../trpc/context";
import { minioClient, storageConfig } from "../../../infrastructure/storage";
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
const analysisCache = new Map<
  string,
  { expiresAt: number; value: DocumentAnalysisResult }
>();

type DocumentPart =
  | { type: "image"; image: string; mimeType: string }
  | { type: "file"; data: string; mimeType: string }
  | { type: "text"; text: string };

type VerificationResult = z.infer<typeof verificationResultSchema>;
type SuggestionsResult = z.infer<typeof suggestionsResultSchema>;

const patientDirectFieldKinds = {
  nom: "string",
  prenom: "string",
  telephone: "stringOrNull",
  email: "stringOrNull",
  matricule: "string",
  date_naissance: "string",
  nss: "numberOrNull",
  lieu_naissance: "stringOrNull",
  sexe: "stringOrNull",
  nationalite: "stringOrNull",
  groupe_sanguin: "stringOrNull",
  adresse: "stringOrNull",
  profession: "stringOrNull",
  habitudes_saines: "stringOrNull",
  habitudes_toxiques: "stringOrNull",
  nb_enfants: "numberOrNull",
  situation_familiale: "stringOrNull",
  age_circoncision: "numberOrNull",
  date_admission: "stringOrNull",
  environnement_animal: "stringOrNull",
  revenu_mensuel: "stringOrNull",
  taille_menage: "numberOrNull",
  nb_pieces: "numberOrNull",
  niveau_intellectuel: "stringOrNull",
  activite_sexuelle: "boolean",
  relations_environnement: "stringOrNull",
} as const;

const patientFemaleFieldKinds = {
  menarche: "numberOrNull",
  regularite_cycles: "stringOrNull",
  contraception: "stringOrNull",
  nb_grossesses: "numberOrNull",
  nb_cesariennes: "numberOrNull",
  menopause: "booleanOrNull",
  age_menopause: "numberOrNull",
  symptomes_menopause: "stringOrNull",
} as const;

const femalePatientInfoSchema = z
  .object({
    menarche: z.number().int().min(0).nullable().optional(),
    regularite_cycles: z.string().trim().min(1).max(255).nullable().optional(),
    contraception: z.string().trim().min(1).nullable().optional(),
    nb_grossesses: z.number().int().min(0).nullable().optional(),
    nb_cesariennes: z.number().int().min(0).nullable().optional(),
    menopause: z.boolean().nullable().optional(),
    age_menopause: z.number().int().min(0).nullable().optional(),
    symptomes_menopause: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

const updatePatientDataSchema = updatePatientSchema
  .omit({ id: true, cree_par_utilisateur: true })
  .extend({
    female_data: femalePatientInfoSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ doit etre fourni pour mettre a jour le patient.",
  });

type UpdatePatientData = z.infer<typeof updatePatientDataSchema>;

interface PatientUpdateAction {
  action_id: string;
  mode: "single" | "batch";
  mutation: "patient.updatePatient";
  merge_key: string;
  input: {
    id: string;
    data: UpdatePatientData;
  };
  suggestion_ids: string[];
}

interface ProcessedSuggestionsResult {
  suggestions: NonNullable<DocumentAnalysisResult["suggestions"]>;
  proposed_actions: PatientUpdateAction[];
}

export interface DocumentAnalysisResult {
  validated: boolean;
  confidence: number;
  identity: {
    patient_match: boolean;
    confidence: number;
    details: string;
    matched_fields: string[];
    mismatched_fields: { field: string; expected: string; found: string }[];
    risk_level: "low" | "medium" | "high";
  };
  verification: {
    patient_match: boolean;
    details: string;
    matched_fields: string[];
    mismatched_fields: { field: string; expected: string; found: string }[];
  };
  suggestions?: {
    suggestion_id: string;
    table: string;
    field: string;
    target_path?: string;
    current_value: string | null;
    suggested_value: string;
    reason: string;
    confidence: number;
    source?: {
      document_key: string;
      modality: DocumentModality;
      snippet?: string;
    };
    validation_flags?: string[];
    action?: {
      mutation: "patient.updatePatient";
      input: {
        id: string;
        data: UpdatePatientData;
      };
      merge_key: string;
    };
  }[];
  proposed_actions: PatientUpdateAction[];
  extraction_stats: {
    documents_total: number;
    documents_processed: number;
    low_confidence_fields: number;
    processing_time_ms: number;
    cache_hit: boolean;
  };
}

// ---------------------------------------------------------------------------
// Zod schemas for structured AI output (used with generateObject)
// ---------------------------------------------------------------------------

const verificationResultSchema = z.object({
  patient_match: z
    .boolean()
    .describe("true si les documents correspondent au patient, false sinon"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Score de confiance entre 0 et 1"),
  details: z
    .string()
    .describe("Explication detaillee en francais de la verification"),
  matched_fields: z
    .array(z.string())
    .describe(
      "Liste des champs d'identite qui correspondent (ex: nom, prenom, date_naissance, nss)",
    ),
  mismatched_fields: z
    .array(
      z.object({
        field: z.string().describe("Nom du champ"),
        expected: z.string().describe("Valeur attendue (base de donnees)"),
        found: z.string().describe("Valeur trouvee dans le document"),
      }),
    )
    .describe("Liste des champs qui ne correspondent pas"),
});

const suggestionsResultSchema = z.object({
  suggestions: z
    .array(
      z.object({
        table: z
          .enum(["patients", "patients_femmes"])
          .describe("Table cible: patients ou patients_femmes"),
        field: z
          .string()
          .describe("Nom du champ a mettre a jour autorise par patient.updatePatient"),
        current_value: z
          .string()
          .nullable()
          .describe(
            "Valeur actuelle dans la base de donnees, null si absent",
          ),
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

Votre tache: comparer les informations d'identite d'un patient (provenant de la base de donnees) avec les informations visibles dans les documents medicaux scannes fournis.

Regles strictes:
1. Comparez UNIQUEMENT les champs d'identite: nom, prenom, date de naissance, numero de securite sociale (NSS), matricule, sexe, lieu de naissance.
2. Si un champ n'est pas visible ou lisible dans le document, ne le comptez PAS comme un echec — ignorez-le.
3. Tolerez les variations mineures d'orthographe, les accents manquants, et les differences de casse (majuscules/minuscules).
4. Pour les dates, acceptez tous les formats courants (JJ/MM/AAAA, AAAA-MM-JJ, etc.).
5. Le score de confiance doit refleter votre certitude globale:
   - 0.9-1.0: correspondance claire et certaine
   - 0.7-0.89: correspondance probable avec quelques elements non verifiables
   - 0.5-0.69: incertain, peu d'elements de comparaison
   - 0.0-0.49: divergence constatee
6. Repondez en francais.
7. Si les documents sont illisibles ou ne contiennent aucune information d'identite, indiquez patient_match: false avec une explication.`;

const SUGGESTIONS_SYSTEM_PROMPT = `Vous etes un assistant medical specialise dans l'analyse de documents medicaux scannes.

Votre tache: comparer le contenu des documents medicaux fournis avec les donnees existantes du patient dans la base de donnees, et identifier les mises a jour potentielles directement applicables via la mutation patient.updatePatient.

Regles strictes:
1. Analysez TOUT le contenu medical des documents, MAIS ne retournez que les suggestions qui peuvent etre appliquees a patient.updatePatient.
2. Comparez avec les donnees existantes du patient fournies ci-dessous.
3. Generez des suggestions UNIQUEMENT pour:
   - Des informations presentes dans les documents mais ABSENTES de la base de donnees
   - Des informations dans les documents qui DIFFERENT des donnees existantes
   - Des informations plus recentes qui pourraient remplacer des donnees obsoletes
4. Pour chaque suggestion, indiquez:
   - table: UNIQUEMENT "patients" ou "patients_femmes"
   - field: un champ exact autorise dans patient.updatePatient
   - current_value: la valeur actuelle (null si absente)
   - suggested_value: la nouvelle valeur suggeree
   - reason: pourquoi cette mise a jour est suggeree
   - confidence: score de confiance (0-1) pour cette suggestion specifique
5. Ne suggerez PAS de modifications sur les champs d'identite (nom, prenom, date_naissance, nss, matricule) — ceux-ci ont deja ete verifies.
6. Ne suggerez PAS de modifications si vous n'etes pas raisonnablement certain (confiance < 0.5).
7. Si aucune mise a jour n'est necessaire, retournez un tableau vide.
8. Repondez en francais pour tous les champs textuels.
9. N'incluez JAMAIS des tables non prises en charge par patient.updatePatient (antecedents, vaccinations_patient, historique_traitements, suivi, voyages_recents, etc.).

Champs autorises:
- patients: nom, prenom, telephone, email, matricule, date_naissance, nss, lieu_naissance, sexe, nationalite, groupe_sanguin, adresse, profession, habitudes_saines, habitudes_toxiques, nb_enfants, situation_familiale, age_circoncision, date_admission, environnement_animal, revenu_mensuel, taille_menage, nb_pieces, niveau_intellectuel, activite_sexuelle, relations_environnement
- patients_femmes: menarche, regularite_cycles, contraception, nb_grossesses, nb_cesariennes, menopause, age_menopause, symptomes_menopause`;

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

    // 1. Check AI provider API key
    if (env.AI_PROVIDER === "google-ai-studio" && !env.GOOGLE_AI_API_KEY) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "GOOGLE_AI_API_KEY n'est pas configuree. Veuillez ajouter la cle API dans les variables d'environnement.",
      });
    }
    if (env.AI_PROVIDER === "mistral-ai-studio" && !env.MISTRAL_API_KEY) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "MISTRAL_API_KEY n'est pas configuree. Veuillez ajouter la cle API dans les variables d'environnement.",
      });
    }

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

    // 5. Initialize AI model
    const aiModel = this.createAiModel();

    // 6. Run identity verification + suggestions generation in parallel
    const [verification, suggestionsResult] = await Promise.all([
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
      ),
    ]);

    const processedSuggestions = this.postProcessSuggestions(
      suggestionsResult.suggestions,
      classifiedDocuments,
      data.patient_id,
    );

    const lowConfidenceFields = processedSuggestions.suggestions.filter(
      (suggestion) => suggestion.confidence < 0.6,
    ).length;

    const result: DocumentAnalysisResult = {
      validated: true,
      confidence: verification.confidence,
      identity: {
        patient_match: verification.patient_match,
        confidence: verification.confidence,
        details: verification.details,
        matched_fields: verification.matched_fields,
        mismatched_fields: verification.mismatched_fields,
        risk_level: this.deriveIdentityRisk(verification),
      },
      verification: {
        patient_match: verification.patient_match,
        details: verification.details,
        matched_fields: verification.matched_fields,
        mismatched_fields: verification.mismatched_fields,
      },
      suggestions: processedSuggestions.suggestions,
      proposed_actions: processedSuggestions.proposed_actions,
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

  private createAiModel(): LanguageModel {
    if (env.AI_PROVIDER === "google-ai-studio") {
      if (!env.GOOGLE_AI_API_KEY) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "GOOGLE_AI_API_KEY n'est pas configuree. Veuillez ajouter la cle API dans les variables d'environnement.",
        });
      }
      const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_AI_API_KEY });
      return google("gemini-2.5-flash");
    }

    if (!env.MISTRAL_API_KEY) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "MISTRAL_API_KEY n'est pas configuree. Veuillez ajouter la cle API dans les variables d'environnement.",
      });
    }
    const mistral = createMistral({ apiKey: env.MISTRAL_API_KEY });
    return mistral("pixtral-large-latest");
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
      const result = await generateObject({
        model: model,
        schema: verificationResultSchema,
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
                text: `## Identite du patient dans la base de donnees\n\n${identityText}\n\n## Documents medicaux a verifier\n\nAnalysez les documents suivants et verifiez s'ils correspondent au patient ci-dessus.`,
              },
              ...documentParts,
            ],
          },
        ],
      });

      return result.object as VerificationResult;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("[document-anomaly] verifyPatientIdentity failed:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? `Verification d'identite impossible: ${error.message}`
            : "Erreur lors de la verification d'identite des documents. Veuillez reessayer.",
        cause: error,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 2 — Data suggestions
  // ---------------------------------------------------------------------------

  private async generateSuggestions(
    model: LanguageModel,
    patientData: FullPatientData,
    documentParts: DocumentPart[],
    classifiedDocuments: ClassifiedDocument[],
  ): Promise<SuggestionsResult> {
    const patientContext = this.buildPatientPrompt(patientData);
    const modalityContext = this.buildDocumentClassificationPrompt(classifiedDocuments);

    try {
      const result = await generateObject({
        model: model,
        schema: suggestionsResultSchema,
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
                text: `## Donnees actuelles du patient dans la base de donnees\n\n${patientContext}\n\n## Classification preliminaire des documents\n\n${modalityContext}\n\n## Documents medicaux a analyser\n\nComparez le contenu des documents suivants avec les donnees du patient ci-dessus. Identifiez toute information dans les documents qui differe des donnees existantes ou qui est absente de la base de donnees. Fournissez une source lorsque possible (document_key + modality + snippet).`,
              },
              ...documentParts,
            ],
          },
        ],
      });

      return result.object as SuggestionsResult;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("[document-anomaly] generateSuggestions failed:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? `Analyse des documents impossible: ${error.message}`
            : "Erreur lors de l'analyse des documents pour suggestions. Veuillez reessayer.",
        cause: error,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // MinIO document fetching
  // ---------------------------------------------------------------------------

  private async fetchDocumentsFromMinio(
    documentKeys: string[],
  ): Promise<DocumentContent[]> {
    const results = await Promise.all(
      documentKeys.map(async (key) => {
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
            message: `Document introuvable dans le stockage: ${key}`,
          });
        }
      }),
    );

    return results;
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

  private deriveIdentityRisk(
    verification: VerificationResult,
  ): "low" | "medium" | "high" {
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
    patientId: string,
  ): ProcessedSuggestionsResult {
    const deduped = new Map<string, NonNullable<DocumentAnalysisResult["suggestions"]>[number]>();
    const actionableByPath = new Map<
      string,
      NonNullable<DocumentAnalysisResult["suggestions"]>[number]
    >();

    suggestions.forEach((suggestion, index) => {
      const suggestionId = `sug_${index + 1}`;
      const validationFlags: string[] = [];
      if (suggestion.confidence < 0.6) {
        validationFlags.push("low_confidence");
      }
      if (!suggestion.suggested_value.trim()) {
        validationFlags.push("empty_suggested_value");
      }

      const mapping = this.resolveSuggestionTarget(suggestion.table, suggestion.field);
      if (!mapping) {
        validationFlags.push("unsupported_field");
      }

      const parsedValue = mapping
        ? this.parseSuggestedValue(suggestion.suggested_value, mapping.kind)
        : { ok: false as const, reason: "unsupported_field" as const };

      if (!parsedValue.ok) {
        validationFlags.push("invalid_value_for_field");
      }

      const selectedSource =
        suggestion.source ??
        this.selectBestSourceForSuggestion(classifiedDocuments, suggestion.table);

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
        target_path: mapping?.targetPath,
        current_value: suggestion.current_value,
        suggested_value: suggestion.suggested_value,
        reason: suggestion.reason,
        confidence: suggestion.confidence,
        source: selectedSource,
        validation_flags: validationFlags,
      };

      if (mapping && parsedValue.ok) {
        const updateData = this.buildUpdatePatientData(
          mapping,
          parsedValue.value,
        );
        const validated = updatePatientDataSchema.safeParse(updateData);
        if (validated.success) {
          candidate.action = {
            mutation: "patient.updatePatient",
            input: {
              id: patientId,
              data: validated.data,
            },
            merge_key: `patient.updatePatient:${patientId}`,
          };
        } else {
          candidate.validation_flags = [
            ...(candidate.validation_flags ?? []),
            "schema_validation_failed",
          ];
        }
      }

      const existing = deduped.get(dedupeKey);
      if (!existing || existing.confidence < candidate.confidence) {
        deduped.set(dedupeKey, candidate);
      }
    });

    const finalSuggestions = Array.from(deduped.values());

    for (const suggestion of finalSuggestions) {
      if (!suggestion.action || !suggestion.target_path) continue;
      const existing = actionableByPath.get(suggestion.target_path);
      if (!existing || existing.confidence < suggestion.confidence) {
        actionableByPath.set(suggestion.target_path, suggestion);
      }
    }

    const proposedActions: PatientUpdateAction[] = [];
    for (const suggestion of finalSuggestions) {
      if (!suggestion.action) continue;
      proposedActions.push({
        action_id: `act_${suggestion.suggestion_id}`,
        mode: "single",
        mutation: "patient.updatePatient",
        merge_key: suggestion.action.merge_key,
        input: suggestion.action.input,
        suggestion_ids: [suggestion.suggestion_id],
      });
    }

    const mergeKey = `patient.updatePatient:${patientId}`;
    const batchData: UpdatePatientData = {};
    const batchSuggestionIds: string[] = [];

    for (const suggestion of actionableByPath.values()) {
      if (!suggestion.action) continue;
      this.mergeUpdatePatientData(batchData, suggestion.action.input.data);
      batchSuggestionIds.push(suggestion.suggestion_id);
    }

    const batchValidated = updatePatientDataSchema.safeParse(batchData);
    if (batchValidated.success && batchSuggestionIds.length > 0) {
      proposedActions.push({
        action_id: "act_batch",
        mode: "batch",
        mutation: "patient.updatePatient",
        merge_key: mergeKey,
        input: {
          id: patientId,
          data: batchValidated.data,
        },
        suggestion_ids: batchSuggestionIds,
      });
    }

    return {
      suggestions: finalSuggestions,
      proposed_actions: proposedActions,
    };
  }

  private resolveSuggestionTarget(
    table: string,
    field: string,
  ):
    | {
        kind:
          | "string"
          | "stringOrNull"
          | "numberOrNull"
          | "boolean"
          | "booleanOrNull";
        targetPath: string;
      }
    | null {
    if (table === "patients") {
      const kind = patientDirectFieldKinds[field as keyof typeof patientDirectFieldKinds];
      if (!kind) return null;
      return { kind, targetPath: `data.${field}` };
    }

    if (table === "patients_femmes") {
      const kind = patientFemaleFieldKinds[field as keyof typeof patientFemaleFieldKinds];
      if (!kind) return null;
      return { kind, targetPath: `data.female_data.${field}` };
    }

    return null;
  }

  private parseSuggestedValue(
    raw: string,
    kind:
      | "string"
      | "stringOrNull"
      | "numberOrNull"
      | "boolean"
      | "booleanOrNull",
  ):
    | { ok: true; value: string | number | boolean | null }
    | { ok: false; reason: string } {
    const value = raw.trim();
    const nullLike = ["null", "aucun", "aucune", "non renseigne", "none", "n/a"];
    const isNullLike = value.length === 0 || nullLike.includes(value.toLowerCase());

    if (kind === "string") {
      if (isNullLike) return { ok: false, reason: "empty_string" };
      return { ok: true, value };
    }

    if (kind === "stringOrNull") {
      return isNullLike ? { ok: true, value: null } : { ok: true, value };
    }

    if (kind === "numberOrNull") {
      if (isNullLike) return { ok: true, value: null };
      const normalized = value.replace(",", ".");
      const numberValue = Number(normalized);
      if (!Number.isFinite(numberValue) || !Number.isInteger(numberValue)) {
        return { ok: false, reason: "invalid_number" };
      }
      return { ok: true, value: numberValue };
    }

    if (kind === "boolean" || kind === "booleanOrNull") {
      if (kind === "booleanOrNull" && isNullLike) {
        return { ok: true, value: null };
      }

      const truthy = ["true", "oui", "yes", "1", "actif"];
      const falsy = ["false", "non", "no", "0", "inactif"];
      const lowered = value.toLowerCase();

      if (truthy.includes(lowered)) return { ok: true, value: true };
      if (falsy.includes(lowered)) return { ok: true, value: false };
      return { ok: false, reason: "invalid_boolean" };
    }

    return { ok: false, reason: "unsupported_kind" };
  }

  private buildUpdatePatientData(
    mapping: { targetPath: string },
    value: string | number | boolean | null,
  ): UpdatePatientData {
    if (mapping.targetPath.startsWith("data.female_data.")) {
      const field = mapping.targetPath.replace("data.female_data.", "");
      return {
        female_data: {
          [field]: value,
        },
      };
    }

    const field = mapping.targetPath.replace("data.", "");
    return {
      [field]: value,
    };
  }

  private mergeUpdatePatientData(
    target: UpdatePatientData,
    patch: UpdatePatientData,
  ): void {
    for (const [key, value] of Object.entries(patch)) {
      if (key === "female_data") {
        const femalePatch = value ?? {};
        target.female_data = {
          ...(target.female_data ?? {}),
          ...(femalePatch as NonNullable<UpdatePatientData["female_data"]>),
        };
        continue;
      }
      (target as Record<string, unknown>)[key] = value;
    }
  }

  private selectBestSourceForSuggestion(
    classifiedDocuments: ClassifiedDocument[],
    table: string,
  ): { document_key: string; modality: DocumentModality; snippet?: string } {
    const tableLower = table.toLowerCase();
    const preferredOrder: DocumentModality[] =
      tableLower.includes("vaccin")
        ? ["lab_result", "clinical_note", "generic_pdf", "generic_image", "unknown"]
        : tableLower.includes("historique_traitements") ||
            tableLower.includes("ordonnance")
          ? ["clinical_note", "lab_result", "generic_pdf", "generic_image", "unknown"]
          : [
              "lab_result",
              "radiology_report",
              "xray",
              "ct_mri",
              "ecg",
              "clinical_note",
              "generic_pdf",
              "generic_image",
              "unknown",
            ];

    const selected =
      preferredOrder
        .map((modality) =>
          classifiedDocuments.find((document) => document.modality === modality),
        )
        .find((document) => document != null) ??
      classifiedDocuments[0] ?? {
        key: "unknown",
        mimeType: "application/octet-stream",
        modality: "unknown" as const,
      };

    return {
      document_key: selected.key,
      modality: selected.modality,
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
      .update(JSON.stringify({ patientId, signature }))
      .digest("hex");
  }

  private getCachedResult(cacheKey: string): DocumentAnalysisResult | null {
    const entry = analysisCache.get(cacheKey);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      analysisCache.delete(cacheKey);
      return null;
    }
    return entry.value;
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
        let line = `- Motif: ${s.motif} (${status}, ouvert le ${s.date_ouverture})`;
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
        if (e.conclusion) examLines.push(`Conclusion: ${e.conclusion}`);
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
        message: "Session invalide: email utilisateur manquant.",
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
        message: "Utilisateur connecte introuvable.",
      });
    }

    return utilisateur;
  }
}

export const documentAnomalyService = new DocumentAnomalyService();
