import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";
import { z } from "zod";

import { toSimpleFrenchAiMessage } from "../shared/errors";
import { parseModelJson as parseSharedModelJson } from "../shared/json";
import { generateGeminiText, resolveGeminiProvider } from "../shared/provider";
import type { SessionUtilisateur } from "../../../trpc/context";
import { hypotheseDiagnosticService } from "../hypothese-diagnostic/service";
import {
  aiResponseSchema,
  recommendationSchema,
  type MedicationRecommendationSuggestion,
  type RecommendationResponseMode,
} from "./schema";
import {
  medicamentsService,
  type MedicamentAggregate,
} from "../../medicaments/service";
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
  type VaccinationRecord,
  type VoyageRecentRecord,
} from "./repo";

type DatabaseClient = typeof databaseClient;
type OrdonnanceRecommendationSession = Exclude<SessionUtilisateur, null>;
type AIProviderName = "google-ai-studio";

interface AIProviderConfig {
  name: AIProviderName;
  model: string;
  apiKey: string;
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

interface ClinicalProblemBasis {
  source: "override" | "suivi" | "hypothese-diagnostic" | "fallback";
  chief_problem: string;
  hypotheses: string[];
}

interface CandidateMedication {
  aggregate: MedicamentAggregate;
  retrieval_score: number;
  final_score: number;
  matched_terms: string[];
  warnings: string[];
  exclusion_reason: string | null;
}

type RecommendationPolicyProfile =
  | "generic"
  | "antipyretic_simple"
  | "analgesic_simple"
  | "bronchodilator_inhaled"
  | "antibiotic_general";

interface RecommendationCandidateFeatures {
  active_substance_count: number;
  is_monotherapy: boolean;
  is_combination: boolean;
  is_suppressed: boolean;
  is_paracetamol_like: boolean;
  is_aspirin_like: boolean;
  is_nsaid_like: boolean;
  has_fever_indication: boolean;
  has_pain_indication: boolean;
  is_bronchodilator_like: boolean;
  is_inhaled_like: boolean;
  is_antibiotic_like: boolean;
}

const recommendationDisclaimer =
  "Aide au brouillon d'ordonnance uniquement. La decision finale, la validation clinique et la prescription appartiennent toujours au medecin.";
const providerTimeoutMs = 25000;

const stopWords = new Set([
  "avec",
  "sans",
  "pour",
  "dans",
  "chez",
  "mais",
  "plus",
  "moins",
  "tres",
  "trop",
  "entre",
  "depuis",
  "apres",
  "avant",
  "patient",
  "patiente",
  "date",
  "jours",
  "jour",
  "actif",
  "inactive",
  "inactif",
  "diagnostic",
  "probable",
  "possible",
  "documentee",
  "documente",
  "allergie",
  "allergique",
  "hypersensibilite",
  "medicamenteuse",
  "reaction",
  "terrain",
  "historique",
  "rapportee",
  "rapporté",
  "rapporté",
  "moderee",
  "modere",
  "legere",
  "leger",
  "aigue",
  "aigu",
  "chronique",
  "syndrome",
  "infection",
  "infectieux",
  "infectieuse",
  "douleur",
  "toux",
  "fievre",
  "consultation",
  "medicale",
]);

export interface OrdonnanceRecommendationResult {
  provider: AIProviderName;
  model: string;
  generated_at: string;
  response_mode: RecommendationResponseMode;
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
  recommendations: Array<z.infer<typeof recommendationSchema> | MedicationRecommendationSuggestion>;
  excluded_candidates: Array<{
    medicament_externe_id: string;
    nom_medicament: string;
    reason: string;
  }>;
  global_warnings: string[];
  disclaimer: string;
}

export class OrdonnanceRecommendationService {
  async generate(data: {
    db: DatabaseClient;
    session: OrdonnanceRecommendationSession;
    input: GenerateOrdonnanceRecommendationInput;
  }): Promise<OrdonnanceRecommendationResult> {
    const provider = this.resolveAiProvider();
    const responseMode = data.input.response_mode ?? "ordonnance";
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const currentSuivi = await ordonnanceRecommendationRepository.getSuiviById(
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

    const clinicalProblemBasis = await this.resolveClinicalProblemBasis({
      db: data.db,
      session: data.session,
      input: data.input,
      currentSuivi,
      currentExamen,
    });

    const candidates = await this.retrieveMedicationCandidates(
      clinicalProblemBasis,
      clinicalContext,
    );
    const policyProfile = this.deriveRecommendationPolicyProfile(
      clinicalProblemBasis,
    );

    const { safeCandidates, excludedCandidates } = this.filterAndScoreCandidates(
      candidates,
      clinicalContext,
      clinicalProblemBasis,
      policyProfile,
    );

    const globalWarnings = [...clinicalContext.deterministic_red_flags];
    if (safeCandidates.length === 0) {
      globalWarnings.push(
        "Aucun candidat medicamenteux suffisamment sur n'a ete trouve dans la base locale pour ce contexte.",
      );

      return {
        provider: provider.name,
        model: provider.model,
        generated_at: new Date().toISOString(),
        response_mode: responseMode,
        source: {
          patient_id: patient.id,
          suivi_id: currentSuivi.id,
          examen_id: currentExamen?.id ?? null,
        },
        clinical_problem_basis: clinicalProblemBasis,
        candidate_summary: {
          retrieved_count: candidates.length,
          safe_count: 0,
          excluded_count: excludedCandidates.length,
        },
        recommendations: [],
        excluded_candidates: excludedCandidates,
        global_warnings: [...new Set(globalWarnings)],
        disclaimer: recommendationDisclaimer,
      };
    }

    let aiDraft: z.infer<typeof aiResponseSchema> | null = null;
    try {
      aiDraft = await this.generateAiRecommendation(
        provider,
        clinicalProblemBasis,
        clinicalContext,
        safeCandidates,
      );
    } catch (error) {
      globalWarnings.push(
        this.buildProviderFallbackWarning(
          error,
          "brouillon d'ordonnance",
        ),
      );
    }

    const normalizedRecommendations = aiDraft
      ? this.postValidateRecommendations(aiDraft.recommendations, safeCandidates)
      : [];
    const fallbackRecommendations =
      normalizedRecommendations.length > 0
        ? []
        : this.buildDeterministicFallbackRecommendations(
            safeCandidates,
            clinicalProblemBasis,
            policyProfile,
          );
    const finalRecommendations =
      normalizedRecommendations.length > 0
        ? normalizedRecommendations
        : fallbackRecommendations;
    const responseRecommendations = this.shapeRecommendationsForMode(
      responseMode,
      finalRecommendations,
    );

    if (normalizedRecommendations.length === 0 && fallbackRecommendations.length > 0) {
      globalWarnings.push(
        "Le brouillon ci-dessous a ete construit par la logique backend locale car le modele n'a pas fourni de recommandation exploitable.",
      );
    }

    return {
      provider: provider.name,
      model: provider.model,
      generated_at: new Date().toISOString(),
      response_mode: responseMode,
      source: {
        patient_id: patient.id,
        suivi_id: currentSuivi.id,
        examen_id: currentExamen?.id ?? null,
      },
      clinical_problem_basis: clinicalProblemBasis,
      candidate_summary: {
        retrieved_count: candidates.length,
        safe_count: safeCandidates.length,
        excluded_count: excludedCandidates.length,
      },
      recommendations: responseRecommendations,
      excluded_candidates: excludedCandidates,
      global_warnings: [
        ...new Set([
          ...globalWarnings,
          ...(aiDraft?.global_warnings ?? []),
        ]),
      ],
      disclaimer: recommendationDisclaimer,
    };
  }

  private resolveAiProvider(): AIProviderConfig {
    return resolveGeminiProvider();
  }

  private async resolveUtilisateur(
    db: DatabaseClient,
    session: OrdonnanceRecommendationSession,
  ): Promise<UtilisateurRecord> {
    const email = session.user.email;
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "La session a expiré. Reconnectez-vous.",
      });
    }

    const utilisateur = await ordonnanceRecommendationRepository.findUtilisateurByEmail(
      db,
      email,
    );

    if (!utilisateur) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Le compte associé à cette session est introuvable.",
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
      const examen = await ordonnanceRecommendationRepository.getExamenById(
        db,
        examenId,
      );
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

    return ordonnanceRecommendationRepository.getLatestExamenBySuivi(
      db,
      currentSuivi.id,
    );
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
      ordonnanceRecommendationRepository.getFemalePatientInfo(
        data.db,
        data.patient.id,
      ),
      ordonnanceRecommendationRepository.getAntecedentsByPatient(
        data.db,
        data.patient.id,
      ),
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
      ordonnanceRecommendationRepository.getRecentVoyagesByPatient(
        data.db,
        data.patient.id,
        5,
      ),
      ordonnanceRecommendationRepository.getRecentVaccinationsByPatient(
        data.db,
        data.patient.id,
        5,
      ),
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
    const historicalExamens =
      await ordonnanceRecommendationRepository.getLatestExamensBySuiviIds(
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
        hypothese_diagnostic: this.nullableText(
          data.currentSuivi.hypothese_diagnostic,
        ),
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

  private async resolveClinicalProblemBasis(data: {
    db: DatabaseClient;
    session: OrdonnanceRecommendationSession;
    input: GenerateOrdonnanceRecommendationInput;
    currentSuivi: SuiviRecord;
    currentExamen: ExamenConsultationRecord | null;
  }): Promise<ClinicalProblemBasis> {
    const override = this.nullableText(data.input.clinical_problem_override);
    if (override) {
      return {
        source: "override",
        chief_problem: override,
        hypotheses: [override],
      };
    }

    const suiviHypothesis = this.nullableText(data.currentSuivi.hypothese_diagnostic);
    if (suiviHypothesis) {
      return {
        source: "suivi",
        chief_problem: suiviHypothesis,
        hypotheses: [suiviHypothesis],
      };
    }

    try {
      const analysis = await hypotheseDiagnosticService.generate({
        db: data.db,
        session: data.session,
        input: {
          suivi_id: data.currentSuivi.id,
          examen_id: data.currentExamen?.id,
          include_historical_context: data.input.include_historical_context,
          max_historical_suivis: data.input.max_historical_suivis,
          max_historical_treatments: data.input.max_historical_treatments,
        },
      });

      const hypotheses = [
        analysis.analysis.chief_problem,
        ...analysis.analysis.hypotheses.map((item: { label: string }) => item.label),
      ]
        .map((value) => this.nullableText(value))
        .filter((value): value is string => Boolean(value));

      const chiefHypothesis = hypotheses[0];
      if (chiefHypothesis) {
        return {
          source: "hypothese-diagnostic",
          chief_problem: chiefHypothesis,
          hypotheses: [...new Set(hypotheses)].slice(0, 5),
        };
      }
    } catch {
      // Fallback below when hypothesis generation is unavailable or insufficient.
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
      "Contexte clinique insuffisant pour proposer une recommandation therapeutique fiable.";

    return {
      source: "fallback",
      chief_problem: chiefProblem,
      hypotheses: [...new Set(fallbackHypotheses)].slice(0, 5),
    };
  }

  private async retrieveMedicationCandidates(
    clinicalProblemBasis: ClinicalProblemBasis,
    context: ClinicalContext,
  ): Promise<CandidateMedication[]> {
    const terms = this.buildRetrievalTerms(clinicalProblemBasis, context);
    const candidateMap = new Map<
      number,
      {
        retrieval_score: number;
        matched_terms: Set<string>;
      }
    >();

    for (const term of terms) {
      const searchStrategies = [
        {
          filters: { query: term, page: 1, page_size: 8 },
          weight: 3,
        },
        {
          filters: { indication: term, page: 1, page_size: 8 },
          weight: 5,
        },
        {
          filters: { nom_substance: term, page: 1, page_size: 6 },
          weight: 4,
        },
      ];

      const results = await Promise.all(
        searchStrategies.map(({ filters }) =>
          medicamentsService.rechercherMedicaments(filters),
        ),
      );

      for (const [index, result] of results.entries()) {
        const weight = searchStrategies[index]?.weight ?? 1;
        for (const item of result.items) {
          const current = candidateMap.get(item.id) ?? {
            retrieval_score: 0,
            matched_terms: new Set<string>(),
          };

          current.retrieval_score += weight;
          current.matched_terms.add(term);
          candidateMap.set(item.id, current);
        }
      }
    }

    const topCandidateIds = [...candidateMap.entries()]
      .sort((a, b) => b[1].retrieval_score - a[1].retrieval_score)
      .slice(0, 30)
      .map(([id]) => id);

    const aggregates = await Promise.all(
      topCandidateIds.map(async (medicamentId) => {
        try {
          return await medicamentsService.getMedicamentById(medicamentId);
        } catch {
          return null;
        }
      }),
    );

    return aggregates.reduce<CandidateMedication[]>((accumulator, aggregate, index) => {
      if (!aggregate) {
        return accumulator;
      }

      const candidateId = topCandidateIds[index];
      if (candidateId === undefined) {
        return accumulator;
      }

      const metadata = candidateMap.get(candidateId);
      if (!metadata) {
        return accumulator;
      }

      accumulator.push({
        aggregate,
        retrieval_score: metadata.retrieval_score,
        final_score: metadata.retrieval_score,
        matched_terms: [...metadata.matched_terms],
        warnings: [] as string[],
        exclusion_reason: null,
      });

      return accumulator;
    }, []);
  }

  private filterAndScoreCandidates(
    candidates: CandidateMedication[],
    context: ClinicalContext,
    clinicalProblemBasis: ClinicalProblemBasis,
    policyProfile: RecommendationPolicyProfile,
  ): {
    safeCandidates: CandidateMedication[];
    excludedCandidates: Array<{
      medicament_externe_id: string;
      nom_medicament: string;
      reason: string;
    }>;
  } {
    const allergyTokens = this.extractMeaningfulTokens(context.antecedents.allergy_signals);
    const activeTreatmentTokens = this.extractMeaningfulTokens(context.treatments.active);
    const antecedentTokens = this.extractMeaningfulTokens([
      ...context.antecedents.active_personal,
      ...context.antecedents.family,
    ]);
    const basisTokens = this.extractMeaningfulTokens([
      clinicalProblemBasis.chief_problem,
      ...clinicalProblemBasis.hypotheses,
    ]);

    const safeCandidates: CandidateMedication[] = [];
    const excludedCandidates: Array<{
      medicament_externe_id: string;
      nom_medicament: string;
      reason: string;
    }> = [];

    for (const candidate of candidates) {
      const medicament = candidate.aggregate.medicament;
      const corpus = this.normalizeText([
        medicament.nom_medicament,
        medicament.nom_generique,
        medicament.classe_therapeutique,
        medicament.famille_pharmacologique,
        medicament.posologie_adulte,
        ...candidate.aggregate.substances_actives.map((item) => item.nom_substance),
        ...candidate.aggregate.indications.map((item) => item.indication),
        ...candidate.aggregate.contre_indications.map((item) => item.description),
        ...candidate.aggregate.precautions.map((item) => item.description),
        ...candidate.aggregate.interactions.map((item) => item.medicament_interaction),
        ...candidate.aggregate.presentations.map((item) =>
          [item.forme, item.dosage].filter(Boolean).join(" "),
        ),
      ].join(" "));
      const features = this.computeRecommendationCandidateFeatures(
        candidate.aggregate,
        corpus,
      );
      const nameCorpus = this.normalizeText([
        medicament.nom_medicament,
        medicament.nom_generique,
        ...candidate.aggregate.substances_actives.map((item) => item.nom_substance),
      ].join(" "));
      const safetyCorpus = this.normalizeText([
        ...candidate.aggregate.contre_indications.map((item) => item.description),
        ...candidate.aggregate.precautions.map((item) => item.description),
        ...candidate.aggregate.interactions.map((item) => item.medicament_interaction),
      ].join(" "));
      const interactionCorpus = this.normalizeText(
        candidate.aggregate.interactions
          .map((item) => item.medicament_interaction)
          .join(" "),
      );

      if (
        allergyTokens.some((token) => nameCorpus.includes(token) || safetyCorpus.includes(token))
      ) {
        candidate.exclusion_reason =
          "Exclu automatiquement: correspondance avec un signal d'allergie ou d'hypersensibilite du patient.";
      } else if (
        activeTreatmentTokens.some((token) => interactionCorpus.includes(token))
      ) {
        candidate.exclusion_reason =
          "Exclu automatiquement: interaction textuelle detectee avec un traitement actif du patient.";
      }

      if (candidate.exclusion_reason) {
        excludedCandidates.push({
          medicament_externe_id: String(medicament.id),
          nom_medicament: medicament.nom_medicament,
          reason: candidate.exclusion_reason,
        });
        continue;
      }

      const warnings = new Set<string>();
      const precautionCorpus = this.normalizeText([
        ...candidate.aggregate.contre_indications.map((item) => item.description),
        ...candidate.aggregate.precautions.map((item) => item.description),
      ].join(" "));
      if (antecedentTokens.some((token) => precautionCorpus.includes(token))) {
        warnings.add(
          "Antecedents patient a confronter avec les contre-indications et precautions du medicament.",
        );
      }

      if (!candidate.aggregate.medicament.posologie_adulte?.trim()) {
        warnings.add("Posologie adulte absente ou peu exploitable dans la base medicaments.");
      }

      if (candidate.aggregate.presentations.length === 0) {
        warnings.add("Aucune presentation exploitable referencee dans la base medicaments.");
      }

      const indicationCorpus = this.normalizeText(
        candidate.aggregate.indications.map((item) => item.indication).join(" "),
      );
      let score = candidate.retrieval_score;

      if (basisTokens.some((token) => indicationCorpus.includes(token))) {
        score += 4;
      }

      if (candidate.aggregate.medicament.posologie_adulte?.trim()) {
        score += 1;
      }

      if (candidate.aggregate.presentations.length > 0) {
        score += 1;
      }

      score += this.applyRecommendationPolicyScoring(features, policyProfile);
      score -= warnings.size * 2;

      if (features.is_suppressed) {
        warnings.add("Produit marque comme supprime dans les donnees medicaments.");
        score -= 8;
      }

      if (!this.passesRecommendationClinicalGate(features, policyProfile)) {
        candidate.exclusion_reason =
          "Exclu automatiquement: hors profil clinique principal retenu pour cette recommandation.";
        excludedCandidates.push({
          medicament_externe_id: String(medicament.id),
          nom_medicament: medicament.nom_medicament,
          reason: candidate.exclusion_reason,
        });
        continue;
      }

      candidate.warnings = [...warnings];
      candidate.final_score = score;
      safeCandidates.push(candidate);
    }

    safeCandidates.sort((left, right) => right.final_score - left.final_score);

    return {
      safeCandidates: safeCandidates.slice(0, 6),
      excludedCandidates,
    };
  }

  private async generateAiRecommendation(
    provider: AIProviderConfig,
    clinicalProblemBasis: ClinicalProblemBasis,
    context: ClinicalContext,
    safeCandidates: CandidateMedication[],
  ): Promise<z.infer<typeof aiResponseSchema>> {
    const rawText = await this.generateWithGemini(
      provider,
      clinicalProblemBasis,
      context,
      safeCandidates,
    );

    if (!rawText) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Réponse vide du modèle AI.",
      });
    }

    const parsedResponse = this.parseModelJson(rawText);
    if (!parsedResponse) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "La réponse du service d’aide médicale n’a pas pu être exploitée.",
      });
    }

    const normalizedResponse = this.normalizeAiRecommendationResponse(parsedResponse);
    const validation = aiResponseSchema.safeParse(normalizedResponse);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: firstIssue
          ? `La réponse du modèle AI ne respecte pas le format attendu : ${firstIssue.path.join(".") || "racine"} - ${firstIssue.message}.`
          : "La réponse du modèle AI ne respecte pas le format attendu.",
      });
    }

    return validation.data;
  }

  private parseModelJson(rawText: string): unknown | null {
    return parseSharedModelJson(rawText);
  }

  private postValidateRecommendations(
    recommendations: z.infer<typeof recommendationSchema>[],
    safeCandidates: CandidateMedication[],
  ): z.infer<typeof recommendationSchema>[] {
    const candidateById = new Map(
      safeCandidates.map((candidate) => [
        String(candidate.aggregate.medicament.id),
        candidate,
      ]),
    );

    return recommendations
      .slice()
      .sort((left, right) => left.rank - right.rank)
      .map((recommendation) => {
        const seenIds = new Set<string>();
        const medicaments = recommendation.ordonnance_draft.medicaments.map((item) => {
          const candidate = candidateById.get(item.medicament_externe_id);
          if (!candidate) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                "La réponse du service d’aide médicale n’a pas pu être validée correctement.",
            });
          }

          if (seenIds.has(item.medicament_externe_id)) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                "La réponse du service d’aide médicale contient des doublons incohérents.",
            });
          }

          seenIds.add(item.medicament_externe_id);

          return {
            medicament_externe_id: item.medicament_externe_id,
            nom_medicament: candidate.aggregate.medicament.nom_medicament,
            dci: candidate.aggregate.medicament.nom_generique ?? null,
            dosage: item.dosage,
            posologie: item.posologie.trim(),
            duree_traitement: item.duree_traitement,
            instructions: item.instructions,
            justification: item.justification.trim(),
          };
        });

        return {
          ...recommendation,
          warnings: [...new Set(recommendation.warnings)],
          ordonnance_draft: {
            remarques: recommendation.ordonnance_draft.remarques,
            medicaments,
          },
        };
      });
  }

  private shapeRecommendationsForMode(
    responseMode: RecommendationResponseMode,
    recommendations: z.infer<typeof recommendationSchema>[],
  ): Array<z.infer<typeof recommendationSchema> | MedicationRecommendationSuggestion> {
    if (responseMode === "medicaments") {
      return this.buildMedicationSuggestions(recommendations);
    }

    return recommendations;
  }

  private buildMedicationSuggestions(
    recommendations: z.infer<typeof recommendationSchema>[],
  ): MedicationRecommendationSuggestion[] {
    const suggestions: MedicationRecommendationSuggestion[] = [];
    const seenIds = new Set<string>();

    for (const recommendation of recommendations.slice().sort((a, b) => a.rank - b.rank)) {
      for (const medicament of recommendation.ordonnance_draft.medicaments) {
        if (seenIds.has(medicament.medicament_externe_id)) {
          continue;
        }

        seenIds.add(medicament.medicament_externe_id);
        suggestions.push({
          rank: suggestions.length + 1,
          medicament_externe_id: medicament.medicament_externe_id,
          nom_medicament: medicament.nom_medicament,
          dci: medicament.dci,
          dosage: medicament.dosage,
          posologie: medicament.posologie,
          duree_traitement: medicament.duree_traitement,
          instructions: medicament.instructions,
          justification: medicament.justification,
          warnings: [...new Set(recommendation.warnings)].slice(0, 6),
        });
      }
    }

    return suggestions;
  }

  private buildDeterministicFallbackRecommendations(
    safeCandidates: CandidateMedication[],
    clinicalProblemBasis: ClinicalProblemBasis,
    policyProfile: RecommendationPolicyProfile,
  ): z.infer<typeof recommendationSchema>[] {
    const preferredCandidates = this.selectDeterministicRecommendationCandidates(
      safeCandidates,
      policyProfile,
    );
    const genericCandidates = safeCandidates.filter((candidate) =>
      Boolean(candidate.aggregate.medicament.posologie_adulte?.trim()),
    );
    const fallbackPolicyProfile =
      preferredCandidates.length > 0 ? policyProfile : "generic";
    const candidatesPool =
      preferredCandidates.length > 0 ? preferredCandidates : genericCandidates;

    if (candidatesPool.length === 0) {
      return [];
    }

    const primary = candidatesPool[0];
    if (!primary) {
      return [];
    }
    const posologie =
      this.truncateText(primary.aggregate.medicament.posologie_adulte, 600) ?? null;

    if (!posologie) {
      return [];
    }

    const dosage = this.extractPrimaryDosage(primary.aggregate);
    const instructions = this.buildDeterministicInstructions(
      primary,
      fallbackPolicyProfile,
    );
    const warnings = [...new Set(primary.warnings)].slice(0, 6);

    return [
      {
        rank: 1,
        label: this.buildDeterministicLabel(fallbackPolicyProfile),
        rationale: this.buildDeterministicRationale(
          primary,
          clinicalProblemBasis,
          fallbackPolicyProfile,
        ),
        warnings,
        ordonnance_draft: {
          remarques: this.buildDeterministicRemarks(fallbackPolicyProfile),
          medicaments: [
            {
              medicament_externe_id: String(primary.aggregate.medicament.id),
              nom_medicament: primary.aggregate.medicament.nom_medicament,
              dci: primary.aggregate.medicament.nom_generique ?? null,
              dosage,
              posologie,
              duree_traitement: null,
              instructions,
              justification: this.buildDeterministicJustification(
                primary,
                fallbackPolicyProfile,
              ),
            },
          ],
        },
      },
    ];
  }

  private selectDeterministicRecommendationCandidates(
    safeCandidates: CandidateMedication[],
    policyProfile: RecommendationPolicyProfile,
  ): CandidateMedication[] {
    switch (policyProfile) {
      case "antipyretic_simple":
        return safeCandidates.filter((candidate) => {
          const corpus = this.normalizeText([
            candidate.aggregate.medicament.nom_medicament,
            candidate.aggregate.medicament.nom_generique,
            candidate.aggregate.medicament.classe_therapeutique,
            ...candidate.aggregate.substances_actives.map((item) => item.nom_substance),
            ...candidate.aggregate.indications.map((item) => item.indication),
          ].join(" "));

          return (
            corpus.includes("paracetamol") ||
            corpus.includes("antipyret") ||
            corpus.includes("fievre")
          );
        });
      case "analgesic_simple":
        return safeCandidates.filter((candidate) => {
          const corpus = this.normalizeText([
            candidate.aggregate.medicament.nom_medicament,
            candidate.aggregate.medicament.nom_generique,
            candidate.aggregate.medicament.classe_therapeutique,
            ...candidate.aggregate.substances_actives.map((item) => item.nom_substance),
            ...candidate.aggregate.indications.map((item) => item.indication),
          ].join(" "));

          return (
            corpus.includes("paracetamol") ||
            corpus.includes("antalg") ||
            corpus.includes("douleur")
          );
        });
      case "bronchodilator_inhaled":
        return safeCandidates.filter((candidate) => {
          const corpus = this.normalizeText([
            candidate.aggregate.medicament.nom_medicament,
            candidate.aggregate.medicament.nom_generique,
            candidate.aggregate.medicament.classe_therapeutique,
            ...candidate.aggregate.substances_actives.map((item) => item.nom_substance),
            ...candidate.aggregate.presentations.map((item) =>
              [item.forme, item.dosage].filter(Boolean).join(" "),
            ),
          ].join(" "));

          return (
            (corpus.includes("bronchodilat") || corpus.includes("salbutamol")) &&
            (corpus.includes("inhal") || corpus.includes("aerosol"))
          );
        });
      case "antibiotic_general":
        return safeCandidates.filter((candidate) => {
          const corpus = this.normalizeText([
            candidate.aggregate.medicament.nom_medicament,
            candidate.aggregate.medicament.nom_generique,
            candidate.aggregate.medicament.classe_therapeutique,
            ...candidate.aggregate.substances_actives.map((item) => item.nom_substance),
          ].join(" "));

          return corpus.includes("antibioti") || corpus.includes("macrolide");
        });
      case "generic":
      default:
        return safeCandidates.filter((candidate) =>
          Boolean(candidate.aggregate.medicament.posologie_adulte?.trim()),
        );
    }
  }

  private buildDeterministicLabel(
    policyProfile: RecommendationPolicyProfile,
  ): string {
    switch (policyProfile) {
      case "antipyretic_simple":
        return "Option antalgique / antipyretique simple";
      case "analgesic_simple":
        return "Option antalgique simple";
      case "bronchodilator_inhaled":
        return "Option bronchodilatatrice inalee";
      case "antibiotic_general":
        return "Option antibiotique de reference";
      case "generic":
      default:
        return "Option therapeutique locale";
    }
  }

  private buildDeterministicRationale(
    candidate: CandidateMedication,
    clinicalProblemBasis: ClinicalProblemBasis,
    policyProfile: RecommendationPolicyProfile,
  ): string {
    const candidateName = candidate.aggregate.medicament.nom_medicament;

    switch (policyProfile) {
      case "antipyretic_simple":
        return `${candidateName} a ete retenu comme option simple de premiere intention pour un besoin antalgique / antipyretique, avec une posologie adulte exploitable dans la base locale.`;
      case "analgesic_simple":
        return `${candidateName} a ete retenu comme option antalgique simple, avec une fiche suffisamment exploitable dans la base locale pour ${clinicalProblemBasis.chief_problem}.`;
      case "bronchodilator_inhaled":
        return `${candidateName} a ete retenu comme candidat bronchodilatateur inhale coherent avec le probleme clinique retenu et les informations disponibles dans la base locale.`;
      case "antibiotic_general":
        return `${candidateName} a ete retenu comme candidat antibiotique compatible avec le probleme clinique retenu, sous reserve de validation medicale finale.`;
      case "generic":
      default:
        return `${candidateName} a ete retenu comme meilleur candidat exploitable de la shortlist locale pour ${clinicalProblemBasis.chief_problem}.`;
    }
  }

  private buildDeterministicJustification(
    candidate: CandidateMedication,
    policyProfile: RecommendationPolicyProfile,
  ): string {
    switch (policyProfile) {
      case "antipyretic_simple":
        return "Option simple et usuelle privilegiee par la logique backend locale.";
      case "analgesic_simple":
        return "Option antalgique simple privilegiee par la logique backend locale.";
      case "bronchodilator_inhaled":
        return "Option inalee coherentement priorisee par la logique backend locale.";
      case "antibiotic_general":
        return "Option antibiotique priorisee par la logique backend locale.";
      case "generic":
      default:
        return `Candidat priorise localement parmi ${candidate.matched_terms.length || 1} signal(s) de pertinence.`;
    }
  }

  private buildDeterministicRemarks(
    policyProfile: RecommendationPolicyProfile,
  ): string | null {
    switch (policyProfile) {
      case "antipyretic_simple":
        return "Verifier l'age, le poids, la grossesse, le terrain hepatique et les autres medicaments en cours avant validation.";
      case "analgesic_simple":
        return "Verifier les contre-indications, le contexte digestif/renal et les autres medicaments en cours avant validation.";
      case "bronchodilator_inhaled":
        return "Verifier la technique d'inhalation, le contexte respiratoire et la tolerance clinique avant validation.";
      case "antibiotic_general":
        return "Verifier l'indication infectieuse, les allergies et les interactions avant validation.";
      case "generic":
      default:
        return null;
    }
  }

  private buildDeterministicInstructions(
    candidate: CandidateMedication,
    policyProfile: RecommendationPolicyProfile,
  ): string | null {
    const presentation = candidate.aggregate.presentations[0];
    const presentationLabel = presentation
      ? [presentation.forme, presentation.dosage].filter(Boolean).join(" | ")
      : null;

    switch (policyProfile) {
      case "antipyretic_simple":
      case "analgesic_simple":
        return presentationLabel
          ? `Presentation locale reperee: ${presentationLabel}.`
          : "Verifier la presentation la plus adaptee avant validation.";
      case "bronchodilator_inhaled":
        return presentationLabel
          ? `Presentation inalee reperee: ${presentationLabel}.`
          : "Verifier la forme inalee disponible avant validation.";
      case "antibiotic_general":
        return presentationLabel
          ? `Presentation locale reperee: ${presentationLabel}.`
          : null;
      case "generic":
      default:
        return presentationLabel
          ? `Presentation locale reperee: ${presentationLabel}.`
          : null;
    }
  }

  private extractPrimaryDosage(
    aggregate: MedicamentAggregate,
  ): string | null {
    const presentation = aggregate.presentations.find(
      (item) => Boolean(item.dosage?.trim()),
    );

    return this.truncateText(presentation?.dosage ?? null, 180);
  }

  private buildProviderFallbackWarning(error: unknown, stage: string): string {
    return `Le service d’aide médicale n’a pas pu finaliser ${stage}. Une logique locale de secours a été utilisée. ${toSimpleFrenchAiMessage(error)}`.trim();
  }

  private buildProviderPrompt(
    clinicalProblemBasis: ClinicalProblemBasis,
    context: ClinicalContext,
    safeCandidates: CandidateMedication[],
  ): string {
    const compactContext = {
      patient: {
        age: context.patient.age,
        sexe: context.patient.sexe,
        habitudes_toxiques: context.patient.habitudes_toxiques,
        female_context: context.patient.female_context
          ? {
              menopause: context.patient.female_context.menopause,
              contraception: context.patient.female_context.contraception,
              nb_grossesses: context.patient.female_context.nb_grossesses,
            }
          : null,
      },
      current_consultation: {
        motif: context.current_consultation.motif,
        hypothese_diagnostic: context.current_consultation.hypothese_diagnostic,
        historique: context.current_consultation.historique
          ? this.truncateText(context.current_consultation.historique, 240)
          : null,
        examen: context.current_consultation.examen
          ? {
              description_consultation:
                context.current_consultation.examen.description_consultation
                  ? this.truncateText(
                      context.current_consultation.examen
                        .description_consultation,
                      220,
                    )
                  : null,
              aspect_general: context.current_consultation.examen.aspect_general
                ? this.truncateText(
                    context.current_consultation.examen.aspect_general,
                    120,
                  )
                : null,
              examen_respiratoire:
                context.current_consultation.examen.examen_respiratoire
                  ? this.truncateText(
                      context.current_consultation.examen.examen_respiratoire,
                      180,
                    )
                  : null,
              examen_cardiovasculaire:
                context.current_consultation.examen.examen_cardiovasculaire
                  ? this.truncateText(
                      context.current_consultation.examen
                        .examen_cardiovasculaire,
                      180,
                    )
                  : null,
              examen_orl: context.current_consultation.examen.examen_orl
                ? this.truncateText(
                    context.current_consultation.examen.examen_orl,
                    160,
                  )
                : null,
              conclusion: context.current_consultation.examen.conclusion,
              poids: context.current_consultation.examen.poids,
              taille: context.current_consultation.examen.taille,
            }
          : null,
      },
      antecedents: {
        active_personal: context.antecedents.active_personal.slice(0, 8),
        family: context.antecedents.family.slice(0, 6),
        allergy_signals: context.antecedents.allergy_signals.slice(0, 6),
      },
      treatments: {
        active: context.treatments.active.slice(0, 8),
        recent: context.treatments.recent.slice(0, 6),
      },
      historical_consultations: context.historical_consultations
        .slice(0, 2)
        .map((consultation) => ({
          date_ouverture: consultation.date_ouverture,
          motif: this.truncateText(consultation.motif, 120),
          hypothese_diagnostic: consultation.hypothese_diagnostic
            ? this.truncateText(consultation.hypothese_diagnostic, 120)
            : null,
          examen_conclusion: consultation.examen_conclusion
            ? this.truncateText(consultation.examen_conclusion, 120)
            : null,
        })),
      recent_travels: context.recent_travels.slice(0, 3),
      recent_vaccinations: context.recent_vaccinations.slice(0, 3),
      deterministic_red_flags: context.deterministic_red_flags.slice(0, 6),
    };

    const candidatePayload = safeCandidates.slice(0, 6).map((candidate) => ({
      medicament_externe_id: String(candidate.aggregate.medicament.id),
      nom_medicament: candidate.aggregate.medicament.nom_medicament,
      dci: candidate.aggregate.medicament.nom_generique ?? null,
      classe_therapeutique:
        candidate.aggregate.medicament.classe_therapeutique
          ? this.truncateText(
              candidate.aggregate.medicament.classe_therapeutique,
              200,
            )
          : null,
      posologie_adulte: candidate.aggregate.medicament.posologie_adulte
        ? this.truncateText(candidate.aggregate.medicament.posologie_adulte, 180)
        : null,
      grossesse: candidate.aggregate.medicament.grossesse
        ? this.truncateText(candidate.aggregate.medicament.grossesse, 140)
        : null,
      allaitement: candidate.aggregate.medicament.allaitement
        ? this.truncateText(candidate.aggregate.medicament.allaitement, 140)
        : null,
      indications: candidate.aggregate.indications
        .slice(0, 3)
        .map((item) => this.truncateText(item.indication, 220)),
      contre_indications: candidate.aggregate.contre_indications
        .slice(0, 3)
        .map((item) => this.truncateText(item.description, 220)),
      precautions: candidate.aggregate.precautions
        .slice(0, 3)
        .map((item) => this.truncateText(item.description, 220)),
      interactions: candidate.aggregate.interactions
        .slice(0, 4)
        .map((item) => this.truncateText(item.medicament_interaction, 180)),
      presentations: candidate.aggregate.presentations
        .slice(0, 3)
        .map((item) =>
          this.truncateText(
            [item.forme, item.dosage].filter(Boolean).join(" | "),
            120,
          ),
        ),
      backend_warnings: candidate.warnings
        .slice(0, 5)
        .map((item) => this.truncateText(item, 160)),
    }));

    return [
      "Tu es un assistant de brouillon d'ordonnance pour un cabinet medical.",
      "Tu dois proposer des recommandations therapeutiques structurees uniquement a partir des candidats fournis.",
      "Contraintes absolues:",
      "- Tu ne dois utiliser que les medicaments presents dans la shortlist candidate.",
      "- Tu n'inventes jamais de medicament, d'identifiant, de dosage ou de justification hors contexte.",
      "- Si l'information est insuffisante, tu peux retourner zero recommandation et l'expliquer dans global_warnings.",
      "- Tu proposes au maximum 3 recommandations classees.",
      "- Chaque recommandation doit etre compatible avec un brouillon d'ordonnance: remarques + liste de medicaments.",
      "- posologie est obligatoire pour chaque medicament recommande.",
      "- justification doit etre clinique, concise, et basee sur les donnees fournies.",
      "- Retourne exclusivement un JSON valide, sans markdown ni texte additionnel.",
      "",
      "Probleme clinique retenu:",
      JSON.stringify(clinicalProblemBasis),
      "",
      "Contexte clinique:",
      JSON.stringify(compactContext),
      "",
      "Shortlist candidate validee:",
      JSON.stringify(candidatePayload),
    ].join("\n");
  }

  private async generateWithGemini(
    provider: AIProviderConfig,
    clinicalProblemBasis: ClinicalProblemBasis,
    context: ClinicalContext,
    safeCandidates: CandidateMedication[],
  ): Promise<string> {
    try {
      const response = await generateGeminiText({
        provider,
        prompt: this.buildProviderPrompt(
          clinicalProblemBasis,
          context,
          safeCandidates,
        ),
        system:
          "Tu es un assistant de brouillon d'ordonnance. Tu réponds uniquement avec un JSON valide correspondant au format demandé.",
        temperature: 0.2,
        timeoutMs: providerTimeoutMs,
      });

      return response.text.trim();
    } catch (error) {
      throw this.mapAiProviderError(error);
    }
  }

  private mapAiProviderError(error: unknown): TRPCError {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: toSimpleFrenchAiMessage(error),
      cause: error,
    });
  }

  private buildRetrievalTerms(
    clinicalProblemBasis: ClinicalProblemBasis,
    context: ClinicalContext,
  ): string[] {
    const policyProfile = this.deriveRecommendationPolicyProfile(
      clinicalProblemBasis,
    );
    const rawParts = [
      clinicalProblemBasis.chief_problem,
      ...clinicalProblemBasis.hypotheses,
      context.current_consultation.motif,
      context.current_consultation.hypothese_diagnostic,
      context.current_consultation.examen?.conclusion,
      context.current_consultation.examen?.description_consultation,
      ...this.getRecommendationPolicyExpansionTerms(policyProfile),
    ]
      .map((value) => this.nullableText(value))
      .filter((value): value is string => Boolean(value));

    const phrases = new Set<string>();
    const tokens = new Set<string>();

    for (const value of rawParts) {
      const segments = value
        .split(/[.,;:|\n]/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 4);

      for (const segment of segments.slice(0, 3)) {
        phrases.add(segment);
      }

      for (const token of this.extractMeaningfulTokens([value])) {
        tokens.add(token);
      }
    }

    return [...phrases, ...tokens]
      .map((value) => value.trim())
      .filter((value, index, items) => items.indexOf(value) === index)
      .slice(0, 12);
  }

  private deriveRecommendationPolicyProfile(
    clinicalProblemBasis: ClinicalProblemBasis,
  ): RecommendationPolicyProfile {
    const normalized = this.normalizeText(
      [
        clinicalProblemBasis.chief_problem,
        ...clinicalProblemBasis.hypotheses,
      ].join(" "),
    );

    if (/antipyret|fievre/.test(normalized)) {
      return "antipyretic_simple";
    }

    if (/antalg|douleur|cephale|mal de tete/.test(normalized)) {
      return "analgesic_simple";
    }

    if (/bronchodilat|asthme|inhal/.test(normalized)) {
      return "bronchodilator_inhaled";
    }

    if (/antibioti|infection bacter|macrolide|beta lactam|beta-lactam/.test(normalized)) {
      return "antibiotic_general";
    }

    return "generic";
  }

  private getRecommendationPolicyExpansionTerms(
    policyProfile: RecommendationPolicyProfile,
  ): string[] {
    switch (policyProfile) {
      case "antipyretic_simple":
        return [
          "antipyretique",
          "antipyrétique",
          "fievre",
          "fièvre",
          "paracetamol",
          "paracétamol",
          "doliprane",
          "dafalgan",
        ];
      case "analgesic_simple":
        return [
          "antalgique",
          "douleur",
          "paracetamol",
          "paracétamol",
          "doliprane",
          "dafalgan",
        ];
      case "bronchodilator_inhaled":
        return [
          "bronchodilatateur",
          "inhalation",
          "inhalé",
          "aerosol",
          "salbutamol",
          "ventoline",
        ];
      case "antibiotic_general":
        return [
          "antibiotique",
          "anti infectieux",
          "amoxicilline",
          "azithromycine",
          "clarithromycine",
        ];
      case "generic":
      default:
        return [];
    }
  }

  private computeRecommendationCandidateFeatures(
    aggregate: MedicamentAggregate,
    corpus: string,
  ): RecommendationCandidateFeatures {
    const substanceNames = aggregate.substances_actives.map((item) =>
      this.normalizeText(item.nom_substance),
    );

    const aspirinLike =
      corpus.includes("acide acetylsalicylique") ||
      corpus.includes("aspirine");
    const paracetamolLike = corpus.includes("paracetamol");
    const nsaidLike =
      aspirinLike ||
      corpus.includes("ibuprofene") ||
      corpus.includes("ketoprofene") ||
      corpus.includes("diclofenac") ||
      corpus.includes("naproxene");

    return {
      active_substance_count: substanceNames.length,
      is_monotherapy: substanceNames.length <= 1,
      is_combination: substanceNames.length > 1,
      is_suppressed: /statut[: ]+supprim|supprime\b/.test(corpus),
      is_paracetamol_like: paracetamolLike,
      is_aspirin_like: aspirinLike,
      is_nsaid_like: nsaidLike,
      has_fever_indication:
        corpus.includes("antipyret") || corpus.includes("fievre"),
      has_pain_indication:
        corpus.includes("antalg") ||
        corpus.includes("douleur") ||
        corpus.includes("cephale") ||
        corpus.includes("migraine"),
      is_bronchodilator_like:
        corpus.includes("bronchodilat") ||
        corpus.includes("salbutamol") ||
        corpus.includes("terbutaline"),
      is_inhaled_like:
        corpus.includes("inhal") ||
        corpus.includes("aerosol") ||
        corpus.includes("spray") ||
        corpus.includes("poudre pour inhalation"),
      is_antibiotic_like:
        corpus.includes("antibioti") ||
        corpus.includes("anti infectieux") ||
        corpus.includes("macrolide") ||
        corpus.includes("amoxicilline") ||
        corpus.includes("azithromycine"),
    };
  }

  private applyRecommendationPolicyScoring(
    features: RecommendationCandidateFeatures,
    policyProfile: RecommendationPolicyProfile,
  ): number {
    let score = 0;

    if (features.is_combination) {
      score -= 4;
    }

    switch (policyProfile) {
      case "antipyretic_simple":
        if (features.is_paracetamol_like) score += 30;
        if (features.has_fever_indication) score += 18;
        if (features.is_monotherapy) score += 10;
        if (features.is_aspirin_like) score -= 16;
        if (features.is_nsaid_like && !features.is_paracetamol_like) score -= 8;
        break;
      case "analgesic_simple":
        if (features.is_paracetamol_like) score += 22;
        if (features.has_pain_indication) score += 14;
        if (features.is_monotherapy) score += 8;
        if (features.is_aspirin_like) score -= 10;
        break;
      case "bronchodilator_inhaled":
        if (features.is_bronchodilator_like) score += 22;
        if (features.is_inhaled_like) score += 18;
        else score -= 12;
        break;
      case "antibiotic_general":
        if (features.is_antibiotic_like) score += 20;
        else score -= 12;
        break;
      case "generic":
      default:
        if (features.is_monotherapy) score += 3;
        break;
    }

    return score;
  }

  private passesRecommendationClinicalGate(
    features: RecommendationCandidateFeatures,
    policyProfile: RecommendationPolicyProfile,
  ): boolean {
    switch (policyProfile) {
      case "antipyretic_simple":
        return features.is_paracetamol_like || features.has_fever_indication;
      case "analgesic_simple":
        return (
          features.is_paracetamol_like ||
          features.has_pain_indication ||
          features.has_fever_indication
        );
      case "bronchodilator_inhaled":
        return features.is_bronchodilator_like && features.is_inhaled_like;
      case "antibiotic_general":
        return features.is_antibiotic_like;
      case "generic":
      default:
        return true;
    }
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
      [
        /dyspn|detresse respiratoire|essoufflement/i,
        "Gene respiratoire potentiellement significative.",
      ],
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

  private normalizeText(value: string): string {
    return value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  }

  private extractMeaningfulTokens(values: string[]): string[] {
    const tokens = new Set<string>();

    for (const value of values) {
      const normalized = this.normalizeText(value);
      const words = normalized.match(/[a-z0-9]+/g) ?? [];

      for (const word of words) {
        if (word.length < 5) {
          continue;
        }

        if (stopWords.has(word)) {
          continue;
        }

        tokens.add(word);
      }
    }

    return [...tokens];
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

    return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
  }


  private normalizeAiRecommendationResponse(raw: unknown): unknown {
    if (!raw || typeof raw !== "object") {
      return raw;
    }

    const source = raw as Record<string, unknown>;
    const recommendationsSource = Array.isArray(source.recommendations)
      ? source.recommendations
      : [];
    const normalizedRecommendations = recommendationsSource
      .map((recommendation, index) =>
        this.normalizeAiRecommendationItem(recommendation, index),
      )
      .filter((recommendation) => recommendation.ordonnance_draft.medicaments.length > 0);
    const normalizedWarnings = this.normalizeStringArray(source.global_warnings);

    if (normalizedRecommendations.length === 0) {
      normalizedWarnings.push(
        "Le modele n'a pas fourni de brouillon medicamenteux exploitable pour ce contexte.",
      );
    }

    return {
      recommendations: normalizedRecommendations,
      global_warnings: [...new Set(normalizedWarnings)],
    };
  }

  private normalizeAiRecommendationItem(
    raw: unknown,
    index: number,
  ): {
    rank: number;
    label: string;
    rationale: string;
    warnings: string[];
    ordonnance_draft: {
      remarques: string | null;
      medicaments: Array<Record<string, unknown>>;
    };
  } {
    const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const draft =
      source.ordonnance_draft && typeof source.ordonnance_draft === "object"
        ? (source.ordonnance_draft as Record<string, unknown>)
        : {};
    const medicamentsSource = Array.isArray(draft.medicaments) ? draft.medicaments : [];

    return {
      rank:
        typeof source.rank === "number" && Number.isFinite(source.rank)
          ? Math.trunc(source.rank)
          : index + 1,
      label: this.toRequiredString(source.label, `Option ${index + 1}`),
      rationale: this.toRequiredString(
        source.rationale,
        "Rationale non fournie par le modele.",
      ),
      warnings: this.normalizeStringArray(source.warnings),
      ordonnance_draft: {
        remarques: this.toNullableLooseString(draft.remarques),
        medicaments: medicamentsSource.map((item) =>
          this.normalizeAiRecommendationMedicament(item),
        ),
      },
    };
  }

  private normalizeAiRecommendationMedicament(raw: unknown): Record<string, unknown> {
    const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

    return {
      medicament_externe_id: this.toRequiredString(source.medicament_externe_id, ""),
      nom_medicament: this.toRequiredString(source.nom_medicament, ""),
      dci: this.toNullableLooseString(source.dci),
      dosage: this.toNullableLooseString(source.dosage),
      posologie: this.toRequiredString(source.posologie, ""),
      duree_traitement: this.toNullableLooseString(source.duree_traitement),
      instructions: this.toNullableLooseString(source.instructions),
      justification: this.toRequiredString(source.justification, ""),
    };
  }

  private normalizeStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.toNullableLooseString(item))
        .filter((item): item is string => Boolean(item));
    }

    const singleValue = this.toNullableLooseString(value);
    return singleValue ? [singleValue] : [];
  }

  private toRequiredString(value: unknown, fallback: string): string {
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (typeof value === "string") {
      const normalized = value.trim();
      return normalized || fallback;
    }

    return fallback;
  }

  private toNullableLooseString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (typeof value === "string") {
      const normalized = value.trim();
      return normalized || null;
    }

    return null;
  }

}

export const ordonnanceRecommendationService =
  new OrdonnanceRecommendationService();
