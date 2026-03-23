import { TRPCError } from "@trpc/server";
import { GoogleGenAI } from "@google/genai";
import type { db as databaseClient } from "@doctor.com/db";
import { env } from "@doctor.com/env/server";
import { z } from "zod";

import type { SessionUtilisateur } from "../../../trpc/context";
import {
  hypotheseDiagnosticRepository,
  type AntecedentFamilialRecord,
  type AntecedentPersonnelRecord,
  type AntecedentRecord,
  type ExamenConsultationRecord,
  type PatientFemmeRecord,
  type PatientRecord,
  type SuiviRecord,
  type TreatmentRecord,
  type UtilisateurRecord,
  type VaccinationRecord,
  type VoyageRecentRecord,
} from "./repo";

type DatabaseClient = typeof databaseClient;
type HypotheseDiagnosticSession = Exclude<SessionUtilisateur, null>;
type AIProviderName =
  | "openrouter"
  | "together"
  | "mistral"
  | "google-ai-studio";

interface AIProviderConfig {
  name: AIProviderName;
  model: string;
  apiKey: string;
}

const aiHypothesisSchema = z.object({
  label: z.string().trim().min(1).max(180),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().trim().min(1).max(1200),
  evidence_for: z.array(z.string().trim().min(1).max(280)).max(8),
  evidence_against: z.array(z.string().trim().min(1).max(280)).max(8),
  missing_information: z.array(z.string().trim().min(1).max(280)).max(8),
  recommended_next_questions: z.array(z.string().trim().min(1).max(280)).max(8),
  recommended_next_checks: z.array(z.string().trim().min(1).max(280)).max(8),
});

const aiResponseSchema = z.object({
  recommendation_readiness: z.enum([
    "ready_for_recommendation",
    "needs_more_information",
    "urgent_medical_review",
  ]),
  chief_problem: z.string().trim().min(1).max(280),
  diagnostic_summary: z.string().trim().min(1).max(1600),
  hypotheses: z.array(aiHypothesisSchema).min(1).max(5),
  red_flags: z.array(z.string().trim().min(1).max(280)).max(8),
  caution_notes: z.array(z.string().trim().min(1).max(280)).max(8),
  global_missing_information: z.array(z.string().trim().min(1).max(280)).max(10),
});

interface GenerateHypothesesInput {
  suivi_id: string;
  examen_id?: string;
  include_historical_context?: boolean;
  max_historical_suivis?: number;
  max_historical_treatments?: number;
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
      aspect_general: string | null;
      examen_respiratoire: string | null;
      examen_cardiovasculaire: string | null;
      examen_orl: string | null;
      examen_digestif: string | null;
      examen_neurologique: string | null;
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
    active: string[];
    recent: string[];
  };
  historical_consultations: HistoricalConsultationSummary[];
  recent_travels: string[];
  recent_vaccinations: string[];
  deterministic_red_flags: string[];
}

export interface HypotheseDiagnosticResult {
  provider: AIProviderName;
  model: string;
  generated_at: string;
  source: {
    patient_id: string;
    suivi_id: string;
    examen_id: string | null;
  };
  context_summary: {
    patient_age: number | null;
    patient_sex: string | null;
    active_treatment_count: number;
    recent_treatment_count: number;
    historical_consultation_count: number;
    active_personal_antecedent_count: number;
    family_antecedent_count: number;
    allergy_signal_count: number;
    travel_count: number;
    vaccination_count: number;
    current_motif: string;
    current_hypothese_diagnostic: string | null;
    current_conclusion: string | null;
  };
  analysis: z.infer<typeof aiResponseSchema>;
  disclaimer: string;
}

const aiResponseJsonSchema = {
  type: "object",
  required: [
    "recommendation_readiness",
    "chief_problem",
    "diagnostic_summary",
    "hypotheses",
    "red_flags",
    "caution_notes",
    "global_missing_information",
  ],
  propertyOrdering: [
    "recommendation_readiness",
    "chief_problem",
    "diagnostic_summary",
    "hypotheses",
    "red_flags",
    "caution_notes",
    "global_missing_information",
  ],
  properties: {
    recommendation_readiness: {
      type: "string",
      enum: [
        "ready_for_recommendation",
        "needs_more_information",
        "urgent_medical_review",
      ],
    },
    chief_problem: { type: "string" },
    diagnostic_summary: { type: "string" },
    hypotheses: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        required: [
          "label",
          "confidence",
          "reasoning",
          "evidence_for",
          "evidence_against",
          "missing_information",
          "recommended_next_questions",
          "recommended_next_checks",
        ],
        propertyOrdering: [
          "label",
          "confidence",
          "reasoning",
          "evidence_for",
          "evidence_against",
          "missing_information",
          "recommended_next_questions",
          "recommended_next_checks",
        ],
        properties: {
          label: { type: "string" },
          confidence: { type: "number" },
          reasoning: { type: "string" },
          evidence_for: {
            type: "array",
            items: { type: "string" },
          },
          evidence_against: {
            type: "array",
            items: { type: "string" },
          },
          missing_information: {
            type: "array",
            items: { type: "string" },
          },
          recommended_next_questions: {
            type: "array",
            items: { type: "string" },
          },
          recommended_next_checks: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    red_flags: {
      type: "array",
      items: { type: "string" },
    },
    caution_notes: {
      type: "array",
      items: { type: "string" },
    },
    global_missing_information: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

const openRouterResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "recommendation_readiness",
    "chief_problem",
    "diagnostic_summary",
    "hypotheses",
    "red_flags",
    "caution_notes",
    "global_missing_information",
  ],
  properties: {
    recommendation_readiness: {
      type: "string",
      enum: [
        "ready_for_recommendation",
        "needs_more_information",
        "urgent_medical_review",
      ],
    },
    chief_problem: { type: "string" },
    diagnostic_summary: { type: "string" },
    hypotheses: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "label",
          "confidence",
          "reasoning",
          "evidence_for",
          "evidence_against",
          "missing_information",
          "recommended_next_questions",
          "recommended_next_checks",
        ],
        properties: {
          label: { type: "string" },
          confidence: { type: "number" },
          reasoning: { type: "string" },
          evidence_for: {
            type: "array",
            items: { type: "string" },
          },
          evidence_against: {
            type: "array",
            items: { type: "string" },
          },
          missing_information: {
            type: "array",
            items: { type: "string" },
          },
          recommended_next_questions: {
            type: "array",
            items: { type: "string" },
          },
          recommended_next_checks: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    red_flags: {
      type: "array",
      items: { type: "string" },
    },
    caution_notes: {
      type: "array",
      items: { type: "string" },
    },
    global_missing_information: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

const diagnosisDisclaimer =
  "Aide au raisonnement clinique uniquement. Ne remplace pas le jugement du medecin ni un diagnostic final.";

export class HypotheseDiagnosticService {
  async generate(data: {
    db: DatabaseClient;
    session: HypotheseDiagnosticSession;
    input: GenerateHypothesesInput;
  }): Promise<HypotheseDiagnosticResult> {
    const aiProvider = this.resolveAiProvider();

    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const currentSuivi = await hypotheseDiagnosticRepository.getSuiviById(
      data.db,
      data.input.suivi_id,
    );

    if (!currentSuivi) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Suivi introuvable.",
      });
    }

    if (currentSuivi.utilisateur_id !== utilisateur.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Ce suivi n'appartient pas a l'utilisateur connecte.",
      });
    }

    const currentExamen = await this.resolveCurrentExamen(data.db, currentSuivi, data.input.examen_id);
    const patient = await hypotheseDiagnosticRepository.getPatientById(
      data.db,
      currentSuivi.patient_id,
    );

    if (!patient) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Patient introuvable.",
      });
    }

    const clinicalContext = await this.buildClinicalContext({
      db: data.db,
      patient,
      currentSuivi,
      currentExamen,
      includeHistoricalContext: data.input.include_historical_context ?? true,
      maxHistoricalSuivis: data.input.max_historical_suivis ?? 5,
      maxHistoricalTreatments: data.input.max_historical_treatments ?? 8,
    });

    const aiAnalysis = await this.generateAiAnalysis(aiProvider, clinicalContext);

    return {
      provider: aiProvider.name,
      model: aiProvider.model,
      generated_at: new Date().toISOString(),
      source: {
        patient_id: patient.id,
        suivi_id: currentSuivi.id,
        examen_id: currentExamen?.id ?? null,
      },
      context_summary: {
        patient_age: clinicalContext.patient.age,
        patient_sex: clinicalContext.patient.sexe,
        active_treatment_count: clinicalContext.treatments.active.length,
        recent_treatment_count: clinicalContext.treatments.recent.length,
        historical_consultation_count: clinicalContext.historical_consultations.length,
        active_personal_antecedent_count:
          clinicalContext.antecedents.active_personal.length,
        family_antecedent_count: clinicalContext.antecedents.family.length,
        allergy_signal_count: clinicalContext.antecedents.allergy_signals.length,
        travel_count: clinicalContext.recent_travels.length,
        vaccination_count: clinicalContext.recent_vaccinations.length,
        current_motif: clinicalContext.current_consultation.motif,
        current_hypothese_diagnostic:
          clinicalContext.current_consultation.hypothese_diagnostic,
        current_conclusion:
          clinicalContext.current_consultation.examen?.conclusion ?? null,
      },
      analysis: aiAnalysis,
      disclaimer: diagnosisDisclaimer,
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
    session: HypotheseDiagnosticSession,
  ): Promise<UtilisateurRecord> {
    const email = session.user.email;
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Session invalide: email utilisateur manquant.",
      });
    }

    const utilisateur = await hypotheseDiagnosticRepository.findUtilisateurByEmail(
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

  private async resolveCurrentExamen(
    db: DatabaseClient,
    currentSuivi: SuiviRecord,
    examenId?: string,
  ): Promise<ExamenConsultationRecord | null> {
    if (examenId) {
      const examen = await hypotheseDiagnosticRepository.getExamenById(db, examenId);
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

    return hypotheseDiagnosticRepository.getLatestExamenBySuivi(db, currentSuivi.id);
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
    const [
      femaleInfo,
      antecedentRecords,
      activeTreatments,
      recentTreatments,
      historicalSuivis,
      recentTravels,
      recentVaccinations,
    ] = await Promise.all([
      hypotheseDiagnosticRepository.getFemalePatientInfo(data.db, data.patient.id),
      hypotheseDiagnosticRepository.getAntecedentsByPatient(data.db, data.patient.id),
      hypotheseDiagnosticRepository.getActiveTreatmentsByPatient(
        data.db,
        data.patient.id,
        data.maxHistoricalTreatments,
      ),
      hypotheseDiagnosticRepository.getRecentTreatmentsByPatient(
        data.db,
        data.patient.id,
        data.maxHistoricalTreatments,
      ),
      data.includeHistoricalContext
        ? hypotheseDiagnosticRepository.getRecentSuivisByPatient(
            data.db,
            data.patient.id,
            data.currentSuivi.id,
            data.maxHistoricalSuivis,
          )
        : Promise.resolve([]),
      hypotheseDiagnosticRepository.getRecentVoyagesByPatient(
        data.db,
        data.patient.id,
        5,
      ),
      hypotheseDiagnosticRepository.getRecentVaccinationsByPatient(
        data.db,
        data.patient.id,
        5,
      ),
    ]);

    const antecedentIds = antecedentRecords.map((record) => record.id);
    const [personalAntecedents, familyAntecedents] = await Promise.all([
      hypotheseDiagnosticRepository.getPersonalAntecedentsByAntecedentIds(
        data.db,
        antecedentIds,
      ),
      hypotheseDiagnosticRepository.getFamilyAntecedentsByAntecedentIds(
        data.db,
        antecedentIds,
      ),
    ]);

    const historicalSuiviIds = historicalSuivis.map((record) => record.id);
    const historicalExamens = await hypotheseDiagnosticRepository.getLatestExamensBySuiviIds(
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
              aspect_general: this.nullableText(data.currentExamen.aspect_general),
              examen_respiratoire: this.nullableText(
                data.currentExamen.examen_respiratoire,
              ),
              examen_cardiovasculaire: this.nullableText(
                data.currentExamen.examen_cardiovasculaire,
              ),
              examen_orl: this.nullableText(data.currentExamen.examen_orl),
              examen_digestif: this.nullableText(data.currentExamen.examen_digestif),
              examen_neurologique: this.nullableText(
                data.currentExamen.examen_neurologique,
              ),
              conclusion: this.nullableText(data.currentExamen.conclusion),
              traitement_prescrit: this.nullableText(
                data.currentExamen.traitement_prescrit,
              ),
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
        active: this.buildTreatmentLabels(activeTreatments),
        recent: this.buildTreatmentLabels(recentTreatments),
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
          examen_description: this.nullableText(
            latestExamen?.description_consultation,
          ),
          traitement_prescrit: this.nullableText(latestExamen?.traitement_prescrit),
        };
      }),
      recent_travels: this.buildTravelLabels(recentTravels),
      recent_vaccinations: this.buildVaccinationLabels(recentVaccinations),
      deterministic_red_flags: this.extractDeterministicRedFlags(
        data.currentSuivi,
        data.currentExamen,
      ),
    };
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
          record.date_prescription ? `Date: ${record.date_prescription}` : null,
        ]),
      )
      .filter((value): value is string => Boolean(value));
  }

  private buildTravelLabels(travels: VoyageRecentRecord[]): string[] {
    return travels
      .map((record) =>
        this.joinLabelParts([
          record.destination,
          record.date ? `Date: ${record.date}` : null,
          record.duree_jours !== null && record.duree_jours !== undefined
            ? `Duree: ${record.duree_jours} jours`
            : null,
          record.epidemies_destination,
        ]),
      )
      .filter((value): value is string => Boolean(value));
  }

  private buildVaccinationLabels(vaccinations: VaccinationRecord[]): string[] {
    return vaccinations
      .map((record) =>
        this.joinLabelParts([
          record.vaccin,
          record.date_vaccination ? `Date: ${record.date_vaccination}` : null,
          record.notes,
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
      currentExamen?.aspect_general,
      currentExamen?.examen_respiratoire,
      currentExamen?.examen_cardiovasculaire,
      currentExamen?.conclusion,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" \n ");

    return redFlagPatterns
      .filter(([pattern]) => pattern.test(textCorpus))
      .map(([, label]) => label);
  }

  private async generateAiAnalysis(
    provider: AIProviderConfig,
    context: ClinicalContext,
  ): Promise<z.infer<typeof aiResponseSchema>> {
    const rawText =
      provider.name === "openrouter"
        ? await this.generateWithOpenRouter(provider, context)
        : provider.name === "together"
          ? await this.generateWithTogether(provider, context)
        : provider.name === "mistral"
          ? await this.generateWithMistral(provider, context)
          : await this.generateWithGemini(provider, context);

    if (!rawText) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Reponse vide du modele AI.",
      });
    }

    const parsedResponse = this.parseModelJson(rawText);
    if (!parsedResponse) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "La reponse du modele AI n'est pas un JSON valide.",
      });
    }

    const normalizedResponse = this.normalizeAiAnalysisResponse(parsedResponse);
    const validation = aiResponseSchema.safeParse(normalizedResponse);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: firstIssue
          ? `La reponse du modele AI ne respecte pas le schema attendu: ${firstIssue.path.join(".") || "racine"} - ${firstIssue.message}.`
          : "La reponse du modele AI ne respecte pas le schema attendu.",
      });
    }

    return validation.data;
  }

  private parseModelJson(rawText: string): unknown | null {
    const normalized = rawText.trim();
    if (!normalized) {
      return null;
    }

    const candidates = [
      normalized,
      normalized
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim(),
    ];

    const firstBraceIndex = normalized.indexOf("{");
    const lastBraceIndex = normalized.lastIndexOf("}");
    if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
      candidates.push(normalized.slice(firstBraceIndex, lastBraceIndex + 1).trim());
    }

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      try {
        return JSON.parse(candidate);
      } catch {
        continue;
      }
    }

    return null;
  }

  private normalizeAiAnalysisResponse(raw: unknown): unknown {
    if (!raw || typeof raw !== "object") {
      return raw;
    }

    const payload = raw as Record<string, unknown>;
    const chiefProblem =
      this.toNullableString(payload.chief_problem, 280) ??
      "Hypothese clinique a preciser";
    const diagnosticSummary =
      this.toNullableString(payload.diagnostic_summary, 1600) ??
      "Analyse clinique preliminaire fournie par le modele.";

    const redFlags = this.normalizeStringArray(payload.red_flags, 8);
    const hypotheses = this.normalizeHypotheses(payload.hypotheses, diagnosticSummary);

    return {
      recommendation_readiness: this.normalizeRecommendationReadiness(
        payload.recommendation_readiness,
        redFlags.length > 0,
      ),
      chief_problem: chiefProblem,
      diagnostic_summary: diagnosticSummary,
      hypotheses:
        hypotheses.length > 0
          ? hypotheses
          : [
              {
                label: chiefProblem,
                confidence: 0.5,
                reasoning: this.truncateText(diagnosticSummary, 1200),
                evidence_for: [],
                evidence_against: [],
                missing_information: this.normalizeStringArray(
                  payload.global_missing_information,
                  8,
                ),
                recommended_next_questions: [],
                recommended_next_checks: [],
              },
            ],
      red_flags: redFlags,
      caution_notes: this.normalizeStringArray(payload.caution_notes, 8),
      global_missing_information: this.normalizeStringArray(
        payload.global_missing_information,
        10,
      ),
    };
  }

  private normalizeHypotheses(
    rawValue: unknown,
    fallbackReasoning: string,
  ): Array<z.infer<typeof aiHypothesisSchema>> {
    const items = Array.isArray(rawValue)
      ? rawValue
      : rawValue && typeof rawValue === "object"
        ? [rawValue]
        : [];

    return items
      .map((item, index) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const hypothesis = item as Record<string, unknown>;
        const label =
          this.toNullableString(hypothesis.label, 180) ??
          `Hypothese ${index + 1}`;
        const reasoning =
          this.toNullableString(hypothesis.reasoning, 1200) ??
          this.truncateText(fallbackReasoning, 1200);

        return {
          label,
          confidence: this.normalizeConfidence(hypothesis.confidence),
          reasoning,
          evidence_for: this.normalizeStringArray(hypothesis.evidence_for, 8),
          evidence_against: this.normalizeStringArray(
            hypothesis.evidence_against,
            8,
          ),
          missing_information: this.normalizeStringArray(
            hypothesis.missing_information,
            8,
          ),
          recommended_next_questions: this.normalizeStringArray(
            hypothesis.recommended_next_questions,
            8,
          ),
          recommended_next_checks: this.normalizeStringArray(
            hypothesis.recommended_next_checks,
            8,
          ),
        };
      })
      .filter(
        (
          value,
        ): value is z.infer<typeof aiHypothesisSchema> => value !== null,
      )
      .slice(0, 5);
  }

  private normalizeRecommendationReadiness(
    rawValue: unknown,
    hasRedFlags: boolean,
  ): z.infer<typeof aiResponseSchema>["recommendation_readiness"] {
    const normalized = this.toNullableString(rawValue)?.toLowerCase();

    if (normalized) {
      if (
        normalized === "ready_for_recommendation" ||
        normalized.includes("ready")
      ) {
        return "ready_for_recommendation";
      }

      if (
        normalized === "urgent_medical_review" ||
        normalized.includes("urgent") ||
        normalized.includes("red flag")
      ) {
        return "urgent_medical_review";
      }

      if (
        normalized === "needs_more_information" ||
        normalized.includes("need") ||
        normalized.includes("insuff") ||
        normalized.includes("more_information")
      ) {
        return "needs_more_information";
      }
    }

    return hasRedFlags
      ? "urgent_medical_review"
      : "needs_more_information";
  }

  private normalizeConfidence(rawValue: unknown): number {
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      return Math.min(1, Math.max(0, rawValue));
    }

    if (typeof rawValue === "string") {
      const parsed = Number.parseFloat(rawValue.replace(",", "."));
      if (Number.isFinite(parsed)) {
        if (parsed > 1) {
          return Math.min(1, Math.max(0, parsed / 100));
        }

        return Math.min(1, Math.max(0, parsed));
      }
    }

    return 0.5;
  }

  private normalizeStringArray(rawValue: unknown, maxItems: number): string[] {
    const values = Array.isArray(rawValue)
      ? rawValue
      : rawValue === null || rawValue === undefined
        ? []
        : [rawValue];

    return values
      .map((value) => this.toNullableString(value, 280))
      .filter((value): value is string => Boolean(value))
      .slice(0, maxItems);
  }

  private async generateWithOpenRouter(
    provider: AIProviderConfig,
    context: ClinicalContext,
  ): Promise<string> {
    let response: Response;

    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
                "Tu es un assistant de raisonnement clinique. Tu reponds uniquement avec un JSON valide correspondant au schema demande.",
            },
            {
              role: "user",
              content: this.buildProviderPrompt(context),
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "hypothese_diagnostic",
              strict: true,
              schema: openRouterResponseJsonSchema,
            },
          },
        }),
      });
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

  private buildProviderPrompt(context: ClinicalContext): string {
    return [
      "Tu es un assistant de raisonnement clinique pour un cabinet medical.",
      "Ta mission est de proposer des hypotheses diagnostiques plausibles et structurees.",
      "Contraintes absolues:",
      "- Tu ne poses jamais un diagnostic final.",
      "- Tu ne proposes jamais de medicaments ni d'ordonnance.",
      "- Tu ne dois utiliser que les informations cliniques fournies.",
      "- Si l'information est insuffisante, tu dois le dire clairement.",
      "- Si un risque serieux apparait, tu dois le remonter dans red_flags et recommendation_readiness.",
      "- confidence est un score relatif entre 0 et 1.",
      "- reasoning doit etre concis, clinique, et justifie uniquement par les donnees disponibles.",
      "- Retourne exclusivement un JSON valide, sans markdown ni texte additionnel.",
      "",
      "Contexte clinique JSON:",
      JSON.stringify(context, null, 2),
    ].join("\n");
  }

  private async generateWithGemini(
    provider: AIProviderConfig,
    context: ClinicalContext,
  ): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: provider.apiKey });

    let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
    try {
      response = await ai.models.generateContent({
        model: provider.model,
        contents: this.buildProviderPrompt(context),
        config: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseJsonSchema: aiResponseJsonSchema,
        },
      });
    } catch (error) {
      throw this.mapAiProviderError(provider.name, error);
    }

    return response.text?.trim() ?? "";
  }

  private async generateWithTogether(
    provider: AIProviderConfig,
    context: ClinicalContext,
  ): Promise<string> {
    let response: Response;

    try {
      response = await fetch("https://api.together.xyz/v1/chat/completions", {
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
                "Tu es un assistant de raisonnement clinique. Tu reponds uniquement avec un JSON valide correspondant au schema demande.",
            },
            {
              role: "user",
              content: this.buildProviderPrompt(context),
            },
          ],
          response_format: {
            type: "json_object",
          },
        }),
      });
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

  private async generateWithMistral(
    provider: AIProviderConfig,
    context: ClinicalContext,
  ): Promise<string> {
    let response: Response;

    try {
      response = await fetch("https://api.mistral.ai/v1/chat/completions", {
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
                "Tu es un assistant de raisonnement clinique. Tu reponds uniquement avec un JSON valide correspondant au schema demande.",
            },
            {
              role: "user",
              content: this.buildProviderPrompt(context),
            },
          ],
        }),
      });
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

    if (
      status === 400 &&
      normalizedText.includes("model")
    ) {
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
          message:
            `Le quota ${providerLabel} est epuise pour cette cle API. Verifie le plan gratuit, les limites d'usage ou la facturation du provider.`,
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
          message:
            `La cle ${providerLabel} est invalide ou n'a pas les droits necessaires pour cette requete.`,
        });
      }

      if (message.includes("model") && message.includes("not found")) {
        return new TRPCError({
          code: "BAD_REQUEST",
          message:
            `Le modele ${providerLabel} configure est introuvable. Verifie la variable de modele dans apps/server/.env.`,
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

  private truncateText(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    if (maxLength <= 1) {
      return value.slice(0, maxLength);
    }

    return `${value.slice(0, maxLength - 1).trimEnd()}…`;
  }

  private toNullableString(value: unknown, maxLength?: number): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "object") {
      const objectValue = value as Record<string, unknown>;
      const preferredKeys = ["text", "label", "name", "reason", "message"];

      for (const key of preferredKeys) {
        const nestedValue = this.toNullableString(objectValue[key], maxLength);
        if (nestedValue) {
          return nestedValue;
        }
      }

      return null;
    }

    const normalizedValue = String(value).trim();
    if (!normalizedValue) {
      return null;
    }

    return typeof maxLength === "number"
      ? this.truncateText(normalizedValue, maxLength)
      : normalizedValue;
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
}

export const hypotheseDiagnosticService = new HypotheseDiagnosticService();
