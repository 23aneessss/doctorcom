import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";
import { z } from "zod";

import { logAiError, toSimpleFrenchAiMessage } from "../shared/errors";
import { parseModelJson as parseSharedModelJson } from "../shared/json";
import {
  generateGeminiEmbedding,
  generateGeminiText,
  resolveTextProvider,
} from "../shared/provider";
import type { SessionUtilisateur } from "../../../trpc/context";
import {
  medicamentsService,
  type MedicamentAggregate,
} from "../../medicaments/service";
import type { MedicamentRecord } from "../../medicaments/repo";
import {
  ordonnanceRecommendationRepository,
  type AntecedentFamilialRecord,
  type AntecedentPersonnelRecord,
  type AntecedentRecord,
  type ExamenConsultationRecord,
  type PatientFemmeRecord,
  type PatientRecord,
  type SuiviRecord,
  type TreatmentRecord,
  type UtilisateurRecord,
} from "./repo";
import {
  aiResponseSchema,
  aiVerificationPayloadSchema,
  ordonnanceAiGenerationStatusSchema,
  recommendationSchema,
  type MedicationRecommendationSuggestion,
  type OrdonnanceAiGenerationStatus,
  type RecommendationResponseMode,
} from "./schema";
import { ordonnanceVectorRepository } from "./vector-repo";

const aiEnrichmentPayloadSchema = z.object({
  rationale: z.string().trim().min(1).max(2400),
  remarques: z.string().max(800).default(""),
  medicaments: z
    .array(
      z.object({
        medicament_externe_id: z.string().trim().min(1),
        posologie: z.string().trim().min(1).max(600),
        duree_traitement: z.string().max(180).default(""),
        instructions: z.string().max(600).default(""),
        justification: z.string().trim().min(1).max(800),
      }),
    )
    .min(1)
    .max(6),
});

type DatabaseClient = typeof databaseClient;
type OrdonnanceRecommendationSession = Exclude<SessionUtilisateur, null>;
type AIProviderName = "google-ai-studio" | "ollama";

interface AIProviderConfig {
  name: AIProviderName;
  model: string;
  apiKey?: string;
}

interface GenerateOrdonnanceRecommendationInput {
  suivi_id: string;
  examen_id?: string;
  include_historical_context?: boolean;
  max_historical_suivis?: number;
  max_historical_treatments?: number;
  clinical_problem_override?: string | null;
  response_mode?: RecommendationResponseMode;
}

interface HistoricalConsultationSummary {
  suivi_id: string;
  date_ouverture: string;
  motif: string;
  hypothese_diagnostic: string | null;
  historique: string | null;
  examen_conclusion: string | null;
  examen_description: string | null;
  traitement_prescrit: string | null;
}

interface ClinicalContext {
  patient: {
    id: string;
    age: number | null;
    sexe: string | null;
    profession: string | null;
    groupe_sanguin: string | null;
    habitudes_saines: string | null;
    habitudes_toxiques: string | null;
    environnement_animal: string | null;
    female_context: {
      menopause: boolean | null;
      contraception: string | null;
      nb_grossesses: number | null;
      symptomes_menopause: string | null;
    } | null;
  };
  current_consultation: {
    suivi_id: string;
    date_ouverture: string;
    motif: string;
    hypothese_diagnostic: string | null;
    historique: string | null;
    examen_id: string | null;
    examen: {
      date: string | null;
      description_consultation: string | null;
      conclusion: string | null;
      traitement_prescrit: string | null;
      poids: string | null;
      taille: string | null;
    } | null;
  };
  antecedents: {
    active_personal: string[];
    family: string[];
    allergy_signals: string[];
  };
  treatments: {
    active_records: TreatmentRecord[];
    recent_records: TreatmentRecord[];
    active_labels: string[];
    recent_labels: string[];
  };
  historical_consultations: HistoricalConsultationSummary[];
  deterministic_red_flags: string[];
}

interface ClinicalProblemBasis {
  source: "override" | "suivi" | "fallback";
  chief_problem: string;
  hypotheses: string[];
}

interface CandidateMedication {
  aggregate: MedicamentAggregate;
  similarity: number;
  is_active_treatment: boolean;
}

export interface OrdonnanceRecommendationResult {
  provider: AIProviderName;
  model: string;
  generated_at: string;
  response_mode: RecommendationResponseMode;
  status: "ready" | "blocked";
  source: {
    patient_id: string;
    suivi_id: string;
    examen_id: string | null;
  };
  clinical_problem_basis: ClinicalProblemBasis;
  candidate_summary: {
    retrieved_count: number;
    safe_count: number;
    excluded_count: number;
  };
  recommandations_count: number;
  recommendations: Array<z.infer<typeof recommendationSchema> | MedicationRecommendationSuggestion>;
  ordonnance_draft: z.infer<typeof recommendationSchema>["ordonnance_draft"] | null;
  medicament_suggestions: MedicationRecommendationSuggestion[];
  merged_candidates: MedicationRecommendationSuggestion[];
  excluded_candidates: Array<{
    medicament_externe_id: string;
    nom_medicament: string;
    reason: string;
  }>;
  global_warnings: string[];
  verification_justification?: string | null;
  disclaimer: string;
}

export interface OrdonnanceAsyncGenerationEnvelope {
  generation_id: string;
  verification_status: OrdonnanceAiGenerationStatus;
  verification_error: string | null;
  verification_justification: string | null;
  poll_after_ms: number;
  result: OrdonnanceRecommendationResult;
  draft_result: OrdonnanceRecommendationResult;
  verified_result: OrdonnanceRecommendationResult | null;
  updated_at: string;
}

const recommendationDisclaimer =
  "Aide au brouillon d'ordonnance uniquement. La decision finale, la validation clinique et la prescription appartiennent toujours au medecin.";

export class OrdonnanceRecommendationService {
  async generate(data: {
    db: DatabaseClient;
    session: OrdonnanceRecommendationSession;
    input: GenerateOrdonnanceRecommendationInput;
  }): Promise<OrdonnanceRecommendationResult> {
    const provider = this.resolveProviderMetadata();
    const responseMode = data.input.response_mode ?? "ordonnance";
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const currentSuivi = await ordonnanceRecommendationRepository.getSuiviById(
      data.db,
      data.input.suivi_id,
    );

    if (!currentSuivi) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Suivi introuvable." });
    }

    if (currentSuivi.utilisateur_id !== utilisateur.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Ce suivi n'appartient pas a l'utilisateur connecte.",
      });
    }

    const currentExamen = await this.resolveCurrentExamen(
      data.db,
      currentSuivi,
      data.input.examen_id,
    );
    const patient = await ordonnanceRecommendationRepository.getPatientById(
      data.db,
      currentSuivi.patient_id,
    );

    if (!patient) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Patient introuvable." });
    }

    const clinicalContext = await this.buildClinicalContext({
      db: data.db,
      patient,
      currentSuivi,
      currentExamen,
      includeHistoricalContext: data.input.include_historical_context ?? true,
      maxHistoricalSuivis: data.input.max_historical_suivis ?? 3,
      maxHistoricalTreatments: data.input.max_historical_treatments ?? 6,
    });

    const clinicalProblemBasis = this.resolveClinicalProblemBasis({
      input: data.input,
      currentSuivi,
      currentExamen,
    });

    const globalWarnings = [...clinicalContext.deterministic_red_flags];
    const candidates = await this.retrieveMedicationCandidates(
      clinicalProblemBasis,
      clinicalContext,
      globalWarnings,
    );
    const medicamentSuggestions = this.buildMedicationSuggestions(candidates);
    const draftRecommendations = this.buildOrdonnanceRecommendations(
      candidates,
      clinicalProblemBasis,
    );
    const ordonnanceRecommendations =
      draftRecommendations.length > 0
        ? await this.enrichOrdonnanceWithAI(
            draftRecommendations,
            clinicalContext,
            clinicalProblemBasis,
          )
        : draftRecommendations;

    const selectedRecommendations =
      responseMode === "medicaments"
        ? medicamentSuggestions
        : ordonnanceRecommendations;
    const ordonnanceDraft = ordonnanceRecommendations[0]?.ordonnance_draft ?? null;
    const status = ordonnanceDraft || medicamentSuggestions.length > 0 ? "ready" : "blocked";

    if (status === "blocked") {
      globalWarnings.push(
        "Aucun candidat medicamenteux n'a pu etre retrouve pour ce contexte clinique.",
      );
    }

    return {
      provider: provider.name,
      model: provider.model,
      generated_at: new Date().toISOString(),
      response_mode: responseMode,
      status,
      source: {
        patient_id: patient.id,
        suivi_id: currentSuivi.id,
        examen_id: currentExamen?.id ?? null,
      },
      clinical_problem_basis: clinicalProblemBasis,
      candidate_summary: {
        retrieved_count: candidates.length,
        safe_count: candidates.length,
        excluded_count: 0,
      },
      recommandations_count: Array.isArray(selectedRecommendations)
        ? selectedRecommendations.length
        : 0,
      recommendations: selectedRecommendations,
      ordonnance_draft: responseMode === "ordonnance" ? ordonnanceDraft : null,
      medicament_suggestions: medicamentSuggestions,
      merged_candidates: medicamentSuggestions,
      excluded_candidates: [],
      global_warnings: [...new Set(globalWarnings)],
      verification_justification: null,
      disclaimer: recommendationDisclaimer,
    };
  }

  async startAsyncOrdonnance(data: {
    db: DatabaseClient;
    session: OrdonnanceRecommendationSession;
    input: GenerateOrdonnanceRecommendationInput;
  }): Promise<OrdonnanceAsyncGenerationEnvelope> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const draftResult = await this.generate({
      db: data.db,
      session: data.session,
      input: {
        ...data.input,
        response_mode: "ordonnance",
      },
    });

    const generation = await ordonnanceRecommendationRepository.createAiGeneration(data.db, {
      utilisateur_id: utilisateur.id,
      patient_id: draftResult.source.patient_id,
      suivi_id: draftResult.source.suivi_id,
      examen_id: draftResult.source.examen_id,
      response_mode: "ordonnance",
      status: "draft_ready",
      draft_result: draftResult,
      verified_result: null,
      verification_error: null,
    });

    void this.processPendingVerifications(data.db, 1);

    return this.buildAsyncEnvelope({
      generation_id: generation.id,
      verification_status: "draft_ready",
      verification_error: null,
      verification_justification: null,
      updated_at: this.toIsoString(generation.updated_at) ?? new Date().toISOString(),
      draft_result: draftResult,
      verified_result: null,
    });
  }

  async getGenerationStatus(data: {
    db: DatabaseClient;
    session: OrdonnanceRecommendationSession;
    generation_id: string;
  }): Promise<OrdonnanceAsyncGenerationEnvelope> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const generation = await ordonnanceRecommendationRepository.getAiGenerationById(
      data.db,
      data.generation_id,
    );

    if (!generation) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Generation IA introuvable." });
    }

    if (generation.utilisateur_id !== utilisateur.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acces refuse a cette generation IA." });
    }

    const verificationStatus = ordonnanceAiGenerationStatusSchema.parse(generation.status);
    const draftResult = generation.draft_result as OrdonnanceRecommendationResult;
    const verifiedResult = (generation.verified_result as OrdonnanceRecommendationResult | null) ?? null;

    return this.buildAsyncEnvelope({
      generation_id: generation.id,
      verification_status: verificationStatus,
      verification_error: generation.verification_error,
      verification_justification: this.extractVerificationJustification(verifiedResult),
      updated_at: this.toIsoString(generation.updated_at) ?? new Date().toISOString(),
      draft_result: draftResult,
      verified_result: verifiedResult,
    });
  }

  private buildAsyncEnvelope(data: {
    generation_id: string;
    verification_status: OrdonnanceAiGenerationStatus;
    verification_error: string | null;
    verification_justification: string | null;
    updated_at: string;
    draft_result: OrdonnanceRecommendationResult;
    verified_result: OrdonnanceRecommendationResult | null;
  }): OrdonnanceAsyncGenerationEnvelope {
    return {
      generation_id: data.generation_id,
      verification_status: data.verification_status,
      verification_error: data.verification_error,
      verification_justification:
        data.verification_justification ??
        this.extractVerificationJustification(data.verified_result),
      poll_after_ms: 2000,
      result: data.verified_result ?? data.draft_result,
      draft_result: data.draft_result,
      verified_result: data.verified_result,
      updated_at: data.updated_at,
    };
  }

  async processPendingVerifications(
    db: DatabaseClient,
    limit = 1,
  ): Promise<void> {
    for (let index = 0; index < limit; index += 1) {
      const generation = await ordonnanceRecommendationRepository.claimNextPendingAiGeneration(db);
      if (!generation) {
        return;
      }

      try {
        const draftResult = generation.draft_result as OrdonnanceRecommendationResult;
        const verifiedResult = await this.runGeminiVerification(draftResult);
        await ordonnanceRecommendationRepository.markAiGenerationVerified(
          db,
          generation.id,
          verifiedResult,
        );
      } catch (error) {
        logAiError("ordonnance-recommendation.verification", error);
        await ordonnanceRecommendationRepository.markAiGenerationFailed(
          db,
          generation.id,
          toSimpleFrenchAiMessage(error),
        );
      }
    }
  }

  private async runGeminiVerification(
    draftResult: OrdonnanceRecommendationResult,
  ): Promise<OrdonnanceRecommendationResult> {
    if (!draftResult.ordonnance_draft) {
      return draftResult;
    }

    const provider = this.resolveAiProvider();
    const response = await generateGeminiText({
      provider,
      system:
        [
          "Tu verifies un brouillon d'ordonnance.",
          "Tu reponds uniquement avec un objet JSON valide, sans markdown.",
          "La sortie doit avoir exactement les champs: medicaments, remarques, warnings, global_warnings, verification_justification.",
          "medicaments doit etre un tableau d'objets medicament complets, jamais un tableau de noms de champs.",
          "Tu peux conserver les medicaments proposes, ajuster remarques, avertissements, posologie ou instructions.",
          "Si tu n'es pas sur, conserve le brouillon fourni dans le format JSON demande.",
        ].join(" "),
      prompt: this.buildVerificationPrompt(draftResult),
      temperature: 0.1,
      timeoutMs: 20000,
    });

    const payload = aiVerificationPayloadSchema.parse(
      parseSharedModelJson(response.text.trim()),
    );
    const verified = aiResponseSchema.parse(
      this.buildVerifiedResponseFromPayload(draftResult, payload),
    );
    const recommendation = verified.recommendations[0];
    if (!recommendation) {
      throw new Error("Gemini verification returned no recommendation.");
    }

    return {
      ...draftResult,
      generated_at: new Date().toISOString(),
      status: recommendation.ordonnance_draft.medicaments.length > 0 ? "ready" : "blocked",
      recommendations: verified.recommendations,
      ordonnance_draft: recommendation.ordonnance_draft,
      global_warnings: verified.global_warnings,
      verification_justification: verified.verification_justification,
    };
  }

  private extractVerificationJustification(
    result: OrdonnanceRecommendationResult | null,
  ): string | null {
    return this.nullableText(result?.verification_justification);
  }

  private buildVerifiedResponseFromPayload(
    draftResult: OrdonnanceRecommendationResult,
    response: z.infer<typeof aiVerificationPayloadSchema>,
  ): z.infer<typeof aiResponseSchema> {
    const draftRecommendation = draftResult.recommendations.find(
      (item): item is z.infer<typeof recommendationSchema> =>
        "ordonnance_draft" in item,
    );

    return {
      recommendations: [
        {
          rank: draftRecommendation?.rank ?? 1,
          label: draftRecommendation?.label ?? draftResult.clinical_problem_basis.chief_problem,
          rationale:
            draftRecommendation?.rationale ??
            "Ordonnance verifiee par le service d'aide medicale.",
          warnings: response.warnings,
          ordonnance_draft: {
            remarques: this.emptyStringToNull(response.remarques),
            medicaments: response.medicaments.map((medicament) => ({
              ...medicament,
              dci: this.emptyStringToNull(medicament.dci),
              dosage: this.emptyStringToNull(medicament.dosage),
              duree_traitement: this.emptyStringToNull(medicament.duree_traitement),
              instructions: this.emptyStringToNull(medicament.instructions),
            })),
          },
        },
      ],
      global_warnings: response.global_warnings,
      verification_justification: response.verification_justification,
    };
  }

  private buildVerificationJsonExample(draftResult: OrdonnanceRecommendationResult): string {
    const firstMedication = draftResult.ordonnance_draft?.medicaments[0];

    return JSON.stringify({
      medicaments: [
        {
          medicament_externe_id: firstMedication?.medicament_externe_id ?? "id",
          nom_medicament: firstMedication?.nom_medicament ?? "NOM",
          dci: firstMedication?.dci ?? "",
          dosage: firstMedication?.dosage ?? "",
          posologie: firstMedication?.posologie ?? "Posologie a verifier",
          duree_traitement: firstMedication?.duree_traitement ?? "",
          instructions: firstMedication?.instructions ?? "",
          justification:
            firstMedication?.justification ??
            "Justification clinique courte pour ce medicament.",
          is_active_treatment: firstMedication?.is_active_treatment ?? false,
        },
      ],
      remarques: draftResult.ordonnance_draft?.remarques ?? "",
      warnings: [],
      global_warnings: draftResult.global_warnings,
      verification_justification:
        "Controle des doublons, de la coherence de la posologie et des avertissements.",
    });
  }

  private emptyStringToNull(value: string): string | null {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private buildEnrichmentPrompt(
    draft: Array<z.infer<typeof recommendationSchema>>,
    clinicalContext: ClinicalContext,
    clinicalProblemBasis: ClinicalProblemBasis,
  ): string {
    const patientParts = [
      clinicalContext.patient.age !== null ? `age: ${clinicalContext.patient.age} ans` : null,
      clinicalContext.patient.sexe ? `sexe: ${clinicalContext.patient.sexe}` : null,
      clinicalContext.current_consultation.examen?.poids
        ? `poids: ${clinicalContext.current_consultation.examen.poids} kg`
        : null,
      clinicalContext.antecedents.allergy_signals.length > 0
        ? `allergies connues: ${clinicalContext.antecedents.allergy_signals.join(", ")}`
        : null,
      clinicalContext.treatments.active_labels.length > 0
        ? `traitements actifs: ${clinicalContext.treatments.active_labels.slice(0, 5).join("; ")}`
        : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(", ");

    const exampleMed = draft[0]?.ordonnance_draft.medicaments[0];
    const jsonExample = JSON.stringify({
      rationale: "Traitement adapte au contexte clinique du patient.",
      remarques: "",
      medicaments: [
        {
          medicament_externe_id: exampleMed?.medicament_externe_id ?? "id",
          posologie: "1 comprime matin et soir pendant les repas",
          duree_traitement: "7 jours",
          instructions: "Prendre avec un grand verre d'eau.",
          justification: "Indique en premiere intention selon le contexte clinique.",
        },
      ],
    });

    return [
      "Tu es un assistant medical specialise en prescription medicale pour medecins.",
      "Adapte ce brouillon d'ordonnance au contexte clinique specifique du patient.",
      "Reponds uniquement avec un objet JSON valide, sans markdown ni texte supplementaire.",
      "Format JSON attendu (respecte exactement ces champs):",
      jsonExample,
      "Regles:",
      "- Conserve tous les medicament_externe_id du brouillon sans les modifier.",
      "- Adapte la posologie a l'age, au poids et au sexe du patient.",
      "- Indique systematiquement une duree_traitement si elle peut etre estimee.",
      "- Ajoute des instructions utiles (prise alimentaire, conduite a tenir, etc.).",
      "- Redige une justification clinique concise pour chaque medicament.",
      "- Ecris la rationale globale en 1-2 phrases expliquant le choix therapeutique.",
      "- Pour les champs vides (remarques, duree_traitement, instructions), utilise une chaine vide.",
      `Probleme clinique: ${clinicalProblemBasis.chief_problem}`,
      patientParts ? `Patient: ${patientParts}` : null,
      clinicalContext.current_consultation.motif
        ? `Motif: ${this.truncateText(clinicalContext.current_consultation.motif, 300)}`
        : null,
      clinicalContext.current_consultation.examen?.conclusion
        ? `Conclusion examen: ${this.truncateText(clinicalContext.current_consultation.examen.conclusion, 300)}`
        : null,
      "Brouillon a enrichir:",
      JSON.stringify(
        draft.map((rec) => ({
          label: rec.label,
          medicaments: rec.ordonnance_draft.medicaments.map((med) => ({
            medicament_externe_id: med.medicament_externe_id,
            nom_medicament: med.nom_medicament,
            dci: med.dci,
            posologie_brute: med.posologie,
          })),
        })),
      ),
    ]
      .filter((value): value is string => Boolean(value))
      .join("\n");
  }

  private async enrichOrdonnanceWithAI(
    draft: Array<z.infer<typeof recommendationSchema>>,
    clinicalContext: ClinicalContext,
    clinicalProblemBasis: ClinicalProblemBasis,
  ): Promise<Array<z.infer<typeof recommendationSchema>>> {
    if (draft.length === 0 || draft[0]?.ordonnance_draft.medicaments.length === 0) {
      return draft;
    }

    try {
      const provider = this.resolveAiProvider();
      const response = await generateGeminiText({
        provider,
        system: [
          "Tu es un assistant medical specialise en prescription.",
          "Tu reponds uniquement avec un objet JSON valide, sans markdown.",
          "La sortie doit avoir exactement les champs: rationale, remarques, medicaments.",
          "medicaments doit etre un tableau avec exactement les memes medicament_externe_id que le brouillon fourni.",
        ].join(" "),
        prompt: this.buildEnrichmentPrompt(draft, clinicalContext, clinicalProblemBasis),
        temperature: 0.2,
        timeoutMs: 18000,
      });

      const payload = aiEnrichmentPayloadSchema.parse(
        parseSharedModelJson(response.text.trim()),
      );

      const enrichedById = new Map(
        payload.medicaments.map((med) => [med.medicament_externe_id, med]),
      );

      return draft.map((rec) => ({
        ...rec,
        rationale: payload.rationale,
        ordonnance_draft: {
          remarques: this.emptyStringToNull(payload.remarques),
          medicaments: rec.ordonnance_draft.medicaments.map((med) => {
            const enriched = enrichedById.get(med.medicament_externe_id);
            if (!enriched) {
              return med;
            }

            return {
              ...med,
              posologie: enriched.posologie || med.posologie,
              duree_traitement: this.emptyStringToNull(enriched.duree_traitement),
              instructions: this.emptyStringToNull(enriched.instructions),
              justification: enriched.justification || med.justification,
            };
          }),
        },
      }));
    } catch (error) {
      logAiError("ordonnance-recommendation.enrichment", error);
      return draft;
    }
  }

  private buildVerificationPrompt(draftResult: OrdonnanceRecommendationResult): string {
    return [
      "Verifie ce brouillon d'ordonnance clinique.",
      "Reponds uniquement avec un objet JSON valide, sans texte avant ou apres.",
      "La sortie racine doit avoir exactement ces champs: medicaments, remarques, warnings, global_warnings, verification_justification.",
      "Le champ medicaments doit etre un tableau d'objets medicament complets, jamais un tableau de noms de champs.",
      "Chaque medicament doit contenir exactement: medicament_externe_id, nom_medicament, dci, dosage, posologie, duree_traitement, instructions, justification, is_active_treatment.",
      "La verification_justification doit expliquer brievement les controles faits et les changements retenus.",
      "Conserve les medicaments si le contexte ne justifie pas de changement.",
      "Retire les doublons: ne conserve qu'une seule specialite par substance active ou famille therapeutique equivalente.",
      "Pour les champs dci, dosage, duree_traitement, instructions et remarques, utilise une chaine vide si l'information n'est pas disponible.",
      "N'utilise pas les cles recommendations, recommandations, ordonnance_finale ou ordonnance_draft dans la sortie.",
      "Exemple de format attendu:",
      this.buildVerificationJsonExample(draftResult),
      "Le JSON suivant est uniquement l'entree a verifier, pas le format de sortie:",
      JSON.stringify({
        clinical_problem_basis: draftResult.clinical_problem_basis,
        ordonnance_draft: draftResult.ordonnance_draft,
        global_warnings: draftResult.global_warnings,
      }),
    ].join("\n");
  }

  private resolveAiProvider(): AIProviderConfig {
    return resolveTextProvider();
  }

  private resolveProviderMetadata(): AIProviderConfig {
    try {
      return this.resolveAiProvider();
    } catch (error) {
      logAiError("ordonnance-recommendation.provider-metadata", error);
      return {
        name: "google-ai-studio",
        model: "local-medication-fallback",
      };
    }
  }

  private async resolveUtilisateur(
    db: DatabaseClient,
    session: OrdonnanceRecommendationSession,
  ): Promise<UtilisateurRecord> {
    const email = session.user.email;
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "La session a expire. Reconnectez-vous.",
      });
    }

    const utilisateur = await ordonnanceRecommendationRepository.findUtilisateurByEmail(db, email);
    if (!utilisateur) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Le compte associe a cette session est introuvable.",
      });
    }

    return utilisateur;
  }

  private async resolveCurrentExamen(
    db: DatabaseClient,
    currentSuivi: SuiviRecord,
    examenId?: string,
  ): Promise<ExamenConsultationRecord | null> {
    if (examenId) {
      const examen = await ordonnanceRecommendationRepository.getExamenById(db, examenId);
      if (!examen) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Examen de consultation introuvable.",
        });
      }

      if (examen.suivi_id !== currentSuivi.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "L'examen fourni ne correspond pas au suivi demande.",
        });
      }

      return examen;
    }

    return ordonnanceRecommendationRepository.getLatestExamenBySuivi(db, currentSuivi.id);
  }

  private async buildClinicalContext(data: {
    db: DatabaseClient;
    patient: PatientRecord;
    currentSuivi: SuiviRecord;
    currentExamen: ExamenConsultationRecord | null;
    includeHistoricalContext: boolean;
    maxHistoricalSuivis: number;
    maxHistoricalTreatments: number;
  }): Promise<ClinicalContext> {
    const [femaleInfo, antecedentRecords, activeTreatments, recentTreatments, historicalSuivis] =
      await Promise.all([
        ordonnanceRecommendationRepository.getFemalePatientInfo(data.db, data.patient.id),
        ordonnanceRecommendationRepository.getAntecedentsByPatient(data.db, data.patient.id),
        ordonnanceRecommendationRepository.getActiveTreatmentsByPatient(
          data.db,
          data.patient.id,
          data.maxHistoricalTreatments,
        ),
        ordonnanceRecommendationRepository.getRecentTreatmentsByPatient(
          data.db,
          data.patient.id,
          data.maxHistoricalTreatments,
        ),
        data.includeHistoricalContext
          ? ordonnanceRecommendationRepository.getRecentSuivisByPatient(
              data.db,
              data.patient.id,
              data.currentSuivi.id,
              data.maxHistoricalSuivis,
            )
          : Promise.resolve([]),
      ]);

    const antecedentIds = antecedentRecords.map((record) => record.id);
    const [personalAntecedents, familyAntecedents] = await Promise.all([
      ordonnanceRecommendationRepository.getPersonalAntecedentsByAntecedentIds(
        data.db,
        antecedentIds,
      ),
      ordonnanceRecommendationRepository.getFamilyAntecedentsByAntecedentIds(
        data.db,
        antecedentIds,
      ),
    ]);

    const historicalSuiviIds = historicalSuivis.map((record) => record.id);
    const historicalExamens = await ordonnanceRecommendationRepository.getLatestExamensBySuiviIds(
      data.db,
      historicalSuiviIds,
    );

    const latestHistoricalExamensBySuivi = new Map<string, ExamenConsultationRecord>();
    for (const examen of historicalExamens) {
      if (!latestHistoricalExamensBySuivi.has(examen.suivi_id)) {
        latestHistoricalExamensBySuivi.set(examen.suivi_id, examen);
      }
    }

    const antecedentById = new Map<string, AntecedentRecord>(
      antecedentRecords.map((record) => [record.id, record]),
    );
    const activePersonalAntecedentLabels = this.buildActivePersonalAntecedentLabels(
      antecedentById,
      personalAntecedents,
    );
    const familyAntecedentLabels = this.buildFamilyAntecedentLabels(
      antecedentById,
      familyAntecedents,
    );

    return {
      patient: {
        id: data.patient.id,
        age: this.computeAge(data.patient.date_naissance),
        sexe: this.nullableText(data.patient.sexe),
        profession: this.nullableText(data.patient.profession),
        groupe_sanguin: this.nullableText(data.patient.groupe_sanguin),
        habitudes_saines: this.nullableText(data.patient.habitudes_saines),
        habitudes_toxiques: this.nullableText(data.patient.habitudes_toxiques),
        environnement_animal: this.nullableText(data.patient.environnement_animal),
        female_context: this.buildFemaleContext(femaleInfo),
      },
      current_consultation: {
        suivi_id: data.currentSuivi.id,
        date_ouverture: data.currentSuivi.date_ouverture,
        motif: data.currentSuivi.motif,
        hypothese_diagnostic: this.nullableText(data.currentSuivi.hypothese_diagnostic),
        historique: this.nullableText(data.currentSuivi.historique),
        examen_id: data.currentExamen?.id ?? null,
        examen: data.currentExamen
          ? {
              date: data.currentExamen.date,
              description_consultation: this.nullableText(
                data.currentExamen.description_consultation,
              ),
              conclusion: this.nullableText(data.currentExamen.conclusion),
              traitement_prescrit: this.nullableText(data.currentExamen.traitement_prescrit),
              poids: this.toNullableString(data.currentExamen.poids),
              taille: this.toNullableString(data.currentExamen.taille),
            }
          : null,
      },
      antecedents: {
        active_personal: activePersonalAntecedentLabels,
        family: familyAntecedentLabels,
        allergy_signals: this.extractAllergySignals([
          ...activePersonalAntecedentLabels,
          ...familyAntecedentLabels,
        ]),
      },
      treatments: {
        active_records: activeTreatments,
        recent_records: recentTreatments,
        active_labels: this.buildTreatmentLabels(activeTreatments),
        recent_labels: this.buildTreatmentLabels(recentTreatments),
      },
      historical_consultations: historicalSuivis.map((record) => {
        const latestExamen = latestHistoricalExamensBySuivi.get(record.id);
        return {
          suivi_id: record.id,
          date_ouverture: record.date_ouverture,
          motif: record.motif,
          hypothese_diagnostic: this.nullableText(record.hypothese_diagnostic),
          historique: this.nullableText(record.historique),
          examen_conclusion: this.nullableText(latestExamen?.conclusion),
          examen_description: this.nullableText(latestExamen?.description_consultation),
          traitement_prescrit: this.nullableText(latestExamen?.traitement_prescrit),
        };
      }),
      deterministic_red_flags: this.extractDeterministicRedFlags(
        data.currentSuivi,
        data.currentExamen,
      ),
    };
  }

  private resolveClinicalProblemBasis(data: {
    input: GenerateOrdonnanceRecommendationInput;
    currentSuivi: SuiviRecord;
    currentExamen: ExamenConsultationRecord | null;
  }): ClinicalProblemBasis {
    const override = this.nullableText(data.input.clinical_problem_override);
    if (override) {
      return { source: "override", chief_problem: override, hypotheses: [override] };
    }

    const suiviHypothesis = this.nullableText(data.currentSuivi.hypothese_diagnostic);
    if (suiviHypothesis) {
      return { source: "suivi", chief_problem: suiviHypothesis, hypotheses: [suiviHypothesis] };
    }

    const fallbackHypotheses = [
      data.currentSuivi.motif,
      data.currentExamen?.conclusion,
      data.currentExamen?.description_consultation,
    ]
      .map((value) => this.nullableText(value))
      .filter((value): value is string => Boolean(value));

    const chiefProblem =
      fallbackHypotheses[0] ??
      "Contexte clinique insuffisant pour proposer une recommandation therapeutique.";

    return {
      source: "fallback",
      chief_problem: chiefProblem,
      hypotheses: [...new Set(fallbackHypotheses)].slice(0, 5),
    };
  }

  private async retrieveMedicationCandidatesViaVector(
    clinicalProblemBasis: ClinicalProblemBasis,
    clinicalContext: ClinicalContext,
    warnings: string[],
  ): Promise<CandidateMedication[]> {
    const queryText = this.buildEmbeddingQueryText(clinicalProblemBasis, clinicalContext);
    const queryEmbedding = await generateGeminiEmbedding(queryText);
    const hits = await ordonnanceVectorRepository.getTopVectorMatches({
      queryEmbedding,
      limit: 24,
    });

    if (hits.length === 0) {
      return [];
    }

    const hitMap = new Map(hits.map((hit) => [hit.medicament_id, hit.similarity]));
    const aggregates = await medicamentsService.getMedicamentsAggregatesByIds(
      hits.map((hit) => hit.medicament_id),
    );

    const activeTreatmentIds = new Set(
      clinicalContext.treatments.active_records
        .map((record) => record.medicament_externe_id)
        .filter((id): id is string => Boolean(id)),
    );
    const activeTreatmentNames = new Set(
      clinicalContext.treatments.active_records
        .map((record) => this.nullableText(record.nom_medicament)?.toLowerCase())
        .filter((value): value is string => Boolean(value)),
    );

    const candidates = aggregates
      .map((aggregate) => {
        const similarity = hitMap.get(aggregate.medicament.id);
        if (similarity === undefined) {
          return null;
        }

        return {
          aggregate,
          similarity,
          is_active_treatment: this.isActiveTreatmentMedication(
            aggregate,
            activeTreatmentIds,
            activeTreatmentNames,
          ),
        } satisfies CandidateMedication;
      })
      .filter((value): value is CandidateMedication => Boolean(value))
      .sort((left, right) => right.similarity - left.similarity);

    if (candidates.length === 0) {
      warnings.push("La recherche vectorielle n'a retourne aucun medicament exploitable.");
    }

    return candidates;
  }

  private async retrieveMedicationCandidates(
    clinicalProblemBasis: ClinicalProblemBasis,
    clinicalContext: ClinicalContext,
    warnings: string[],
  ): Promise<CandidateMedication[]> {
    try {
      const candidates = await this.retrieveMedicationCandidatesViaVector(
        clinicalProblemBasis,
        clinicalContext,
        warnings,
      );

      if (candidates.length > 0) {
        return candidates;
      }

      warnings.push(
        "Aucun medicament pertinent n'a ete retrouve via la recherche vectorielle. Une recherche locale de secours a ete utilisee.",
      );
    } catch (error) {
      logAiError("ordonnance-recommendation.vector-search", error);
      warnings.push(
        "La recherche IA des medicaments est indisponible. Une recherche locale de secours a ete utilisee.",
      );
    }

    return this.retrieveMedicationCandidatesViaLocalFallback(
      clinicalProblemBasis,
      clinicalContext,
      warnings,
    );
  }

  private buildMinimalAggregate(record: MedicamentRecord): MedicamentAggregate {
    return {
      medicament: record,
      substances_actives: [],
      indications: [],
      contre_indications: [],
      precautions: [],
      interactions: [],
      effets_indesirables: [],
      presentations: [],
    };
  }

  private async retrieveMedicationCandidatesViaLocalFallback(
    clinicalProblemBasis: ClinicalProblemBasis,
    clinicalContext: ClinicalContext,
    warnings: string[],
  ): Promise<CandidateMedication[]> {
    const contextTokens = this.extractClinicalSearchTokens(
      clinicalProblemBasis,
      clinicalContext,
    );
    const queries = this.buildFallbackMedicationQueries(contextTokens);

    // Collect MedicamentRecord directly from keyword search results.
    // This bypasses the heavy getMedicamentsAggregatesByIds call as the primary
    // source of candidates, which can silently return empty under pool pressure.
    const foundRecords = new Map<number, MedicamentRecord>();

    for (const query of queries) {
      try {
        const results = await medicamentsService.rechercherMedicaments({
          query,
          page: 1,
          page_size: 4,
        });

        for (const item of results.items) {
          if (!foundRecords.has(item.id)) {
            foundRecords.set(item.id, item);
          }
        }
      } catch {
        // ignore individual query failures
      }
    }

    if (foundRecords.size === 0 && contextTokens.length > 0) {
      try {
        const catalogFallback = await medicamentsService.listAllMedicaments();
        const rankedIds = this.rankCatalogMedicamentsByContext(catalogFallback, contextTokens);
        // Only seed fallback medications when ranking actually matched the clinical context.
        // Returning arbitrary "first 6 medications" would suggest unrelated drugs.
        if (rankedIds.length > 0) {
          const topIds = new Set(rankedIds.slice(0, 6));
          const topRecords = catalogFallback.filter((m) => topIds.has(m.id)).slice(0, 6);
          for (const item of topRecords) {
            foundRecords.set(item.id, item);
          }
        }
      } catch {
        // catalog fallback unavailable
      }
    }

    if (foundRecords.size === 0) {
      warnings.push(
        "La recherche locale de secours n'a retourne aucun medicament exploitable.",
      );
      return [];
    }

    const activeTreatmentIds = new Set(
      clinicalContext.treatments.active_records
        .map((record) => record.medicament_externe_id)
        .filter((id): id is string => Boolean(id)),
    );
    const activeTreatmentNames = new Set(
      clinicalContext.treatments.active_records
        .map((record) => this.nullableText(record.nom_medicament)?.toLowerCase())
        .filter((value): value is string => Boolean(value)),
    );

    const records = [...foundRecords.values()].slice(0, 6);

    // Attempt to enrich with full aggregates (relational data); degrade gracefully on failure.
    const aggregateMap = new Map<number, MedicamentAggregate>();
    try {
      const aggregates = await medicamentsService.getMedicamentsAggregatesByIds(
        records.map((r) => r.id),
      );
      for (const agg of aggregates) {
        aggregateMap.set(agg.medicament.id, agg);
      }
    } catch {
      // aggregate enrichment unavailable; minimal records used
    }

    return records.map((record, index) => {
      const aggregate = aggregateMap.get(record.id) ?? this.buildMinimalAggregate(record);
      const isActive =
        activeTreatmentIds.has(String(record.id)) ||
        activeTreatmentNames.has(record.nom_medicament.toLowerCase()) ||
        Boolean(record.nom_generique && activeTreatmentNames.has(record.nom_generique.toLowerCase()));

      return {
        aggregate,
        similarity: 0.7 - index * 0.05,
        is_active_treatment: isActive,
      };
    });
  }

  private extractClinicalSearchTokens(
    clinicalProblemBasis: ClinicalProblemBasis,
    clinicalContext: ClinicalContext,
  ): string[] {
    const corpus = [
      clinicalProblemBasis.chief_problem,
      ...clinicalProblemBasis.hypotheses,
      clinicalContext.current_consultation.motif,
      clinicalContext.current_consultation.historique,
      clinicalContext.current_consultation.examen?.description_consultation,
      clinicalContext.current_consultation.examen?.conclusion,
      clinicalContext.current_consultation.examen?.traitement_prescrit,
      ...clinicalContext.historical_consultations.flatMap((item) => [
        item.motif,
        item.hypothese_diagnostic,
        item.examen_conclusion,
        item.examen_description,
        item.traitement_prescrit,
      ]),
      ...clinicalContext.antecedents.allergy_signals,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ");

    return this.tokenizeSearchText(corpus).slice(0, 24);
  }

  private buildFallbackMedicationQueries(contextTokens: string[]): string[] {
    const queries = new Set<string>();

    for (const token of contextTokens) {
      queries.add(token);
    }

    for (let index = 0; index < contextTokens.length - 1; index += 1) {
      queries.add(`${contextTokens[index]} ${contextTokens[index + 1]}`);
    }

    return [...queries].slice(0, 14);
  }

  private rankCatalogMedicamentsByContext(
    medicaments: Array<{
      id: number;
      nom_medicament: string;
      nom_generique: string | null;
      classe_therapeutique: string | null;
      famille_pharmacologique: string | null;
      posologie_adulte: string | null;
      posologie_enfant: string | null;
      dose_maximale: string | null;
      frequence_administration: string | null;
      grossesse: string | null;
      allaitement: string | null;
    }>,
    contextTokens: string[],
  ): number[] {
    const contextTokenSet = new Set(contextTokens);

    return medicaments
      .map((medicament, index) => {
        const haystackTokens = this.tokenizeSearchText(
          [
            medicament.nom_medicament,
            medicament.nom_generique,
            medicament.classe_therapeutique,
            medicament.famille_pharmacologique,
            medicament.posologie_adulte,
            medicament.posologie_enfant,
            medicament.dose_maximale,
            medicament.frequence_administration,
            medicament.grossesse,
            medicament.allaitement,
          ]
            .filter((value): value is string => Boolean(value))
            .join(" "),
        );

        const exactScore = haystackTokens.reduce(
          (score, token) => score + (contextTokenSet.has(token) ? 3 : 0),
          0,
        );
        const partialScore = contextTokens.reduce((score, contextToken) => {
          if (
            haystackTokens.some(
              (token) =>
                token.length >= 4 &&
                (token.includes(contextToken) || contextToken.includes(token)),
            )
          ) {
            return score + 1;
          }

          return score;
        }, 0);

        return {
          id: medicament.id,
          index,
          score: exactScore + partialScore,
        };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .map((item) => item.id);
  }

  private tokenizeSearchText(value: string | null | undefined): string[] {
    if (!value) {
      return [];
    }

    const stopWords = new Set([
      "avec",
      "chez",
      "dans",
      "debut",
      "depuis",
      "des",
      "deux",
      "elle",
      "est",
      "leur",
      "leurs",
      "mais",
      "non",
      "pas",
      "patient",
      "patiente",
      "pour",
      "sans",
      "son",
      "sont",
      "sur",
      "une",
      "vers",
      "voir",
    ]);

    const expanded = this.expandMedicalAcronyms(value);

    return this.normalizeSearchText(expanded)
      .split(" ")
      .filter(
        (token, index, allTokens) =>
          token.length >= 4 &&
          !stopWords.has(token) &&
          !/^\d+$/.test(token) &&
          allTokens.indexOf(token) === index,
      );
  }

  private expandMedicalAcronyms(value: string): string {
    const acronyms: Array<[RegExp, string]> = [
      [/\bHTA\b/gi, "HTA hypertension"],
      [/\bRGO\b/gi, "RGO reflux gastro oesophagien"],
      [/\bDT2\b/gi, "DT2 diabete type 2"],
      [/\bDT1\b/gi, "DT1 diabete type 1"],
      [/\bBPCO\b/gi, "BPCO bronchopneumopathie chronique obstructive"],
      [/\bIRC\b/gi, "IRC insuffisance renale chronique"],
      [/\bIRA\b/gi, "IRA insuffisance renale aigue"],
      [/\bIDM\b/gi, "IDM infarctus myocarde"],
      [/\bAVC\b/gi, "AVC accident vasculaire cerebral"],
      [/\bAIT\b/gi, "AIT accident ischemique transitoire"],
      [/\bIPP\b/gi, "IPP inhibiteur pompe protons"],
      [/\bIEC\b/gi, "IEC inhibiteur enzyme conversion"],
      [/\bARA2?\b/gi, "ARA2 sartan antagoniste angiotensine"],
      [/\bAINS\b/gi, "AINS anti inflammatoire non steroidien"],
      [/\bMTX\b/gi, "MTX methotrexate"],
      [/\bSEP\b/gi, "SEP sclerose en plaques"],
      [/\bMICI\b/gi, "MICI maladie inflammatoire intestin"],
      [/\bIVRS\b/gi, "IVRS infection voies respiratoires superieures"],
      [/\bIST\b/gi, "IST infection sexuellement transmissible"],
      [/\bITU\b/gi, "ITU infection urinaire"],
    ];

    let output = value;
    for (const [regex, replacement] of acronyms) {
      output = output.replace(regex, replacement);
    }
    return output;
  }

  private normalizeSearchText(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  private buildEmbeddingQueryText(
    clinicalProblemBasis: ClinicalProblemBasis,
    context: ClinicalContext,
  ): string {
    const parts = [
      `probleme: ${clinicalProblemBasis.chief_problem}`,
      context.patient.age !== null ? `age: ${context.patient.age}` : null,
      context.patient.sexe ? `sexe: ${context.patient.sexe}` : null,
      context.current_consultation.motif
        ? `motif: ${this.truncateText(context.current_consultation.motif, 220)}`
        : null,
      context.current_consultation.historique
        ? `historique: ${this.truncateText(context.current_consultation.historique, 260)}`
        : null,
      context.current_consultation.examen?.conclusion
        ? `conclusion_examen: ${this.truncateText(context.current_consultation.examen.conclusion, 220)}`
        : null,
      context.current_consultation.examen?.description_consultation
        ? `description_examen: ${this.truncateText(context.current_consultation.examen.description_consultation, 220)}`
        : null,
      context.treatments.active_labels.length > 0
        ? `traitements_actifs: ${context.treatments.active_labels.slice(0, 6).join(" ; ")}`
        : null,
      context.historical_consultations.length > 0
        ? `historique_recent: ${context.historical_consultations
            .slice(0, 3)
            .map((item) =>
              [item.motif, item.hypothese_diagnostic, item.examen_conclusion]
                .filter(Boolean)
                .join(" | "),
            )
            .filter(Boolean)
            .join(" ; ")}`
        : null,
      context.antecedents.allergy_signals.length > 0
        ? `allergies: ${context.antecedents.allergy_signals.slice(0, 6).join(" ; ")}`
        : null,
    ].filter((value): value is string => Boolean(value));

    return parts.join("\n");
  }

  private buildMedicationSuggestions(
    candidates: CandidateMedication[],
  ): MedicationRecommendationSuggestion[] {
    return candidates.slice(0, 6).map((candidate, index) => ({
      rank: index + 1,
      medicament_externe_id: String(candidate.aggregate.medicament.id),
      nom_medicament: candidate.aggregate.medicament.nom_medicament,
      dci: candidate.aggregate.medicament.nom_generique ?? null,
      dosage: this.extractPrimaryDosage(candidate.aggregate),
      posologie:
        this.truncateText(candidate.aggregate.medicament.posologie_adulte, 600) ??
        "A definir par le medecin",
      duree_traitement: null,
      instructions: null,
      justification:
        this.truncateText(candidate.aggregate.indications[0]?.indication, 800) ??
        "Selectionne via recherche vectorielle sur le contexte clinique.",
      warnings: candidate.is_active_treatment
        ? ["Ce medicament correspond deja a un traitement actif du patient."]
        : [],
      is_active_treatment: candidate.is_active_treatment,
    }));
  }

  private buildOrdonnanceRecommendations(
    candidates: CandidateMedication[],
    clinicalProblemBasis: ClinicalProblemBasis,
  ): Array<z.infer<typeof recommendationSchema>> {
    const medicaments = this.buildMedicationSuggestions(candidates).slice(0, 4).map((item) => ({
      medicament_externe_id: item.medicament_externe_id,
      nom_medicament: item.nom_medicament,
      dci: item.dci,
      dosage: item.dosage,
      posologie: item.posologie,
      duree_traitement: item.duree_traitement,
      instructions: item.instructions,
      justification: item.justification,
      is_active_treatment: item.is_active_treatment ?? false,
    }));

    if (medicaments.length === 0) {
      return [];
    }

    return [
      {
        rank: 1,
        label: clinicalProblemBasis.chief_problem,
        rationale:
          "Brouillon construit a partir des meilleurs resultats vectoriels pour le contexte clinique du patient.",
        warnings: medicaments
          .filter((item) => item.is_active_treatment)
          .map((item) => `${item.nom_medicament} est deja un traitement actif.`),
        ordonnance_draft: {
          remarques: null,
          medicaments,
        },
      },
    ];
  }

  private isActiveTreatmentMedication(
    aggregate: MedicamentAggregate,
    activeTreatmentIds: Set<string>,
    activeTreatmentNames: Set<string>,
  ): boolean {
    const medicamentId = String(aggregate.medicament.id);
    if (activeTreatmentIds.has(medicamentId)) {
      return true;
    }

    const candidateNames = [
      this.nullableText(aggregate.medicament.nom_medicament)?.toLowerCase() ?? null,
      this.nullableText(aggregate.medicament.nom_generique)?.toLowerCase() ?? null,
      ...aggregate.substances_actives.map((item) =>
        this.nullableText(item.nom_substance)?.toLowerCase() ?? null,
      ),
    ].filter((value): value is string => Boolean(value));

    return candidateNames.some((name) => {
      for (const activeName of activeTreatmentNames) {
        if (name === activeName || name.includes(activeName) || activeName.includes(name)) {
          return true;
        }
      }

      return false;
    });
  }

  private buildFemaleContext(
    femaleInfo: PatientFemmeRecord | null,
  ): ClinicalContext["patient"]["female_context"] {
    if (!femaleInfo) {
      return null;
    }

    return {
      menopause: femaleInfo.menopause ?? null,
      contraception: this.nullableText(femaleInfo.contraception),
      nb_grossesses: femaleInfo.nb_grossesses ?? null,
      symptomes_menopause: this.nullableText(femaleInfo.symptomes_menopause),
    };
  }

  private buildActivePersonalAntecedentLabels(
    antecedentById: Map<string, AntecedentRecord>,
    personalAntecedents: AntecedentPersonnelRecord[],
  ): string[] {
    return personalAntecedents
      .filter((record) => record.est_actif)
      .map((record) => {
        const baseAntecedent = antecedentById.get(record.antecedent_id);
        return this.joinLabelParts([
          baseAntecedent?.description ?? null,
          record.type,
          record.details,
        ]);
      })
      .filter((value): value is string => Boolean(value));
  }

  private buildFamilyAntecedentLabels(
    antecedentById: Map<string, AntecedentRecord>,
    familyAntecedents: AntecedentFamilialRecord[],
  ): string[] {
    return familyAntecedents
      .map((record) => {
        const baseAntecedent = antecedentById.get(record.antecedent_id);
        return this.joinLabelParts([
          baseAntecedent?.description ?? null,
          record.lien_parente ? `Lien: ${record.lien_parente}` : null,
          record.details,
        ]);
      })
      .filter((value): value is string => Boolean(value));
  }

  private buildTreatmentLabels(treatments: TreatmentRecord[]): string[] {
    return treatments
      .map((record) =>
        this.joinLabelParts([
          record.nom_medicament,
          record.dosage,
          record.posologie,
          record.est_actif ? "Actif" : "Inactif",
        ]),
      )
      .filter((value): value is string => Boolean(value));
  }

  private extractAllergySignals(values: string[]): string[] {
    const allergyPattern = /(allerg|hypersensibil|anaphylax|intoleran)/i;
    return [...new Set(values.filter((value) => allergyPattern.test(value)))];
  }

  private extractDeterministicRedFlags(
    currentSuivi: SuiviRecord,
    currentExamen: ExamenConsultationRecord | null,
  ): string[] {
    const redFlagPatterns: Array<[RegExp, string]> = [
      [/douleur thorac/i, "Douleur thoracique rapportee."],
      [/dyspn|detresse respiratoire|essoufflement/i, "Gene respiratoire potentiellement significative."],
      [/syncope|perte de connaissance/i, "Syncope ou perte de connaissance mentionnee."],
      [/convulsion|crise/i, "Convulsion ou crise mentionnee."],
      [/hemopty|crachat de sang|sang/i, "Saignement ou hemoptysie potentielle mentionnee."],
      [/confusion|alteration de conscience/i, "Alteration de l'etat neurologique mentionnee."],
    ];

    const textCorpus = [
      currentSuivi.motif,
      currentSuivi.historique,
      currentSuivi.hypothese_diagnostic,
      currentExamen?.description_consultation,
      currentExamen?.conclusion,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" \n ");

    return redFlagPatterns
      .filter(([pattern]) => pattern.test(textCorpus))
      .map(([, label]) => label);
  }

  private extractPrimaryDosage(aggregate: MedicamentAggregate): string | null {
    return (
      this.truncateText(aggregate.presentations.find((item) => item.dosage)?.dosage, 180) ??
      this.truncateText(aggregate.medicament.dose_maximale, 180)
    );
  }

  private computeAge(dateNaissance: string | null): number | null {
    if (!dateNaissance) {
      return null;
    }

    const birthDate = new Date(`${dateNaissance}T00:00:00.000Z`);
    if (Number.isNaN(birthDate.getTime())) {
      return null;
    }

    const today = new Date();
    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
    const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
    const dayDiff = today.getUTCDate() - birthDate.getUTCDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age -= 1;
    }

    return age;
  }

  private nullableText(value: string | null | undefined): string | null {
    const normalizedValue = value?.trim();
    return normalizedValue ? normalizedValue : null;
  }

  private toNullableString(value: string | number | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalizedValue = String(value).trim();
    return normalizedValue ? normalizedValue : null;
  }

  private joinLabelParts(parts: Array<string | null | undefined>): string | null {
    const normalizedParts = parts
      .map((part) => this.nullableText(part))
      .filter((part): part is string => Boolean(part));

    if (normalizedParts.length === 0) {
      return null;
    }

    return normalizedParts.join(" | ");
  }

  private truncateText(value: string | null | undefined, maxLength: number): string | null {
    const normalized = this.nullableText(value);
    if (!normalized) {
      return null;
    }

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
  }

  private toIsoString(value: string | Date | null | undefined): string | null {
    if (!value) {
      return null;
    }

    if (typeof value === "string") {
      return value;
    }

    return value.toISOString();
  }
}

export const ordonnanceRecommendationService = new OrdonnanceRecommendationService();
