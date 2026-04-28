import { TRPCError } from "@trpc/server";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import type { db as databaseClient } from "@doctor.com/db";
import { env } from "@doctor.com/env/server";
import { utilisateurs } from "@doctor.com/db/schema";
import { eq } from "drizzle-orm";

import type { SessionUtilisateur } from "../../../trpc/context";
import {
  anomalyFlagRepository,
  type CorePatientData,
  type FullPatientData,
  type MedicationWithDetails,
  type ActiveTreatment,
  type PatientAntecedentData,
  type PatientFemaleData,
} from "./repo";

const ANOMALY_FLAG_LOG_SCOPE = "ai/anomaly-flag";
const SLOW_STEP_THRESHOLD_MS = 2000;
const BRANCH_TIMEOUT_MS = 8000;
const ACTIVE_TREATMENTS_TIMEOUT_MS = 2000;

type LogMeta = Record<string, unknown>;

class BranchTimeoutError extends Error {
  constructor(
    public readonly branch: string,
    public readonly timeoutMs: number,
  ) {
    super(`Branch ${branch} timed out after ${timeoutMs}ms`);
    this.name = "BranchTimeoutError";
  }
}

function logInfo(message: string, meta?: LogMeta): void {
  if (meta) {
    console.info(`[${ANOMALY_FLAG_LOG_SCOPE}] ${message}`, meta);
    return;
  }
  console.info(`[${ANOMALY_FLAG_LOG_SCOPE}] ${message}`);
}

function logWarn(message: string, meta?: LogMeta): void {
  if (meta) {
    console.warn(`[${ANOMALY_FLAG_LOG_SCOPE}] ${message}`, meta);
    return;
  }
  console.warn(`[${ANOMALY_FLAG_LOG_SCOPE}] ${message}`);
}

function logError(message: string, meta?: LogMeta): void {
  if (meta) {
    console.error(`[${ANOMALY_FLAG_LOG_SCOPE}] ${message}`, meta);
    return;
  }
  console.error(`[${ANOMALY_FLAG_LOG_SCOPE}] ${message}`);
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  branch: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new BranchTimeoutError(branch, timeoutMs));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutHandle);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DatabaseClient = typeof databaseClient;
type AiSession = Exclude<SessionUtilisateur, null>;

type AnomalySeverity = "error" | "warning" | "info";

export interface MedicationAnomaly {
  medicament_externe_id: string;
  nom_medicament: string;
  code: string;
  severity: AnomalySeverity;
  message: string;
  details?: string;
}

export interface GlobalAnomaly {
  code: string;
  severity: AnomalySeverity;
  message: string;
  medicaments_concernes: string[];
  details?: string;
}

export interface PrescriptionCheckResult {
  anomalies_par_medicament: MedicationAnomaly[];
  anomalies_globales: GlobalAnomaly[];
  ai_summary: string | null;
  ai_available: boolean;
}

interface PrescribedMedication {
  medicament_externe_id: string;
  dosage?: string;
  posologie: string;
  duree_traitement?: string;
}

interface PatientContext {
  age: number;
  sexe: string | null;
  pregnancyRisk: boolean;
  habitudes_toxiques: string | null;
  antecedentsPersonnels: string[];
}

function buildFullPatientData(
  patient: CorePatientData,
  donnees_femme: PatientFemaleData | null,
  antecedents: PatientAntecedentData[],
): FullPatientData {
  return {
    patient,
    donnees_femme,
    antecedents,
  };
}

const ORDONNANCE_CONTRADICTION_CODES = new Set<string>([
  "PREGNANCY_CONTRAINDICATION",
  "CONTRE_INDICATION_MATCH",
  "DRUG_INTERACTION",
  "EXISTING_TREATMENT_INTERACTION",
]);

// ---------------------------------------------------------------------------
// Zod schema for AI structured output
// ---------------------------------------------------------------------------

const aiAnomalyResultSchema = z.object({
  anomalies_supplementaires: z
    .array(
      z.object({
        medicament_concerne: z
          .string()
          .describe("Nom du medicament concerne"),
        code: z
          .enum([
            "AI_DOSAGE_CONCERN",
            "AI_COHERENCE_CONCERN",
            "AI_ADDITIONAL_FLAG",
          ])
          .describe("Code de l'anomalie"),
        severity: z
          .enum(["error", "warning", "info"])
          .describe("Severite: error, warning ou info"),
        message: z
          .string()
          .describe("Description de l'anomalie en francais"),
        details: z
          .string()
          .optional()
          .describe("Details supplementaires"),
      }),
    )
    .describe(
      "Anomalies supplementaires detectees par l'IA, au-dela des regles automatiques",
    ),
  resume: z
    .string()
    .describe(
      "Resume global en francais de l'evaluation de securite de l'ordonnance",
    ),
});

type AiAnomalyResult = z.infer<typeof aiAnomalyResultSchema>;

// ---------------------------------------------------------------------------
// AI system prompt
// ---------------------------------------------------------------------------

const AI_SYSTEM_PROMPT = `Vous etes un expert pharmaceutique charge de verifier la securite d'une ordonnance medicale.

Votre role:
1. Analyser les medicaments prescrits en tenant compte du profil du patient (age, sexe, antecedents, traitements en cours).
2. Identifier des anomalies que les regles automatiques n'auraient pas detectees:
   - Dosages inappropries pour le profil du patient (age, poids estime, fonction renale presumee)
   - Incoherences therapeutiques (medicaments redondants, associations illogiques)
   - Tout autre probleme de securite pertinent
3. Ne PAS repeter les anomalies deja detectees par les regles automatiques (elles vous sont fournies).
4. Si l'ordonnance vous semble correcte et sans anomalie supplementaire, retournez un tableau vide pour anomalies_supplementaires.
5. Le resume doit etre concis (2-4 phrases) et donner un avis global sur la securite de l'ordonnance.

Codes disponibles:
- AI_DOSAGE_CONCERN: probleme de dosage ou posologie
- AI_COHERENCE_CONCERN: incoherence therapeutique, redondance ou association illogique
- AI_ADDITIONAL_FLAG: tout autre probleme de securite

Repondez en francais.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes the patient's age in full years from date_naissance.
 */
function computePatientAge(dateNaissance: string): number {
  const birth = new Date(dateNaissance);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
}

/**
 * Heuristic: infers pregnancy risk for the patient.
 *
 * The patients_femmes table has NO "currently pregnant" boolean.
 * We can only flag a *risk* when the patient is a woman of reproductive age
 * who has a history of pregnancies, is not menopausal, and is not using
 * contraception. The AI second pass can provide a more nuanced assessment.
 */
function inferPregnancyRisk(
  donneesFemme: FullPatientData["donnees_femme"],
  sexe: string | null,
): boolean {
  if (!sexe || sexe.toLowerCase() !== "feminin") return false;
  if (!donneesFemme) return false;
  if (donneesFemme.menopause === true) return false;
  if (
    donneesFemme.contraception &&
    donneesFemme.contraception.trim().length > 0
  ) {
    return false;
  }
  if (donneesFemme.nb_grossesses != null && donneesFemme.nb_grossesses > 0) {
    return true;
  }
  return false;
}

/**
 * Normalizes a string for keyword matching: lowercase, remove accents,
 * trim whitespace.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Checks if any significant word (>3 chars) from `source` appears in `target`.
 */
function keywordMatch(source: string, target: string): boolean {
  const normalizedSource = normalizeText(source);
  const normalizedTarget = normalizeText(target);
  const words = normalizedSource.split(/\s+/).filter((w) => w.length > 3);
  return words.some((word) => normalizedTarget.includes(word));
}

/**
 * Checks if a text field contains warning/contra-indication keywords.
 */
function containsWarningKeywords(text: string | null): boolean {
  if (!text) return false;
  const normalized = normalizeText(text);
  const keywords = [
    "contre-indique",
    "contre indique",
    "deconseille",
    "interdit",
    "risque",
    "danger",
    "eviter",
    "ne pas utiliser",
    "ne pas administrer",
    "toxique",
    "nocif",
  ];
  return keywords.some((kw) => normalized.includes(kw));
}

/**
 * Checks if a text mentions pregnancy-related terms.
 */
function containsPregnancyKeywords(text: string): boolean {
  const normalized = normalizeText(text);
  const keywords = ["grossesse", "enceinte", "femme enceinte", "gestation"];
  return keywords.some((kw) => normalized.includes(kw));
}

/**
 * Checks if medication name A matches an interaction description text.
 * Normalizes both and does partial matching.
 */
function medicationNameMatches(
  interactionText: string,
  medicationName: string,
  medicationGenericName: string | null,
): boolean {
  const normalizedInteraction = normalizeText(interactionText);
  const normalizedName = normalizeText(medicationName);

  if (
    normalizedName.length > 3 &&
    normalizedInteraction.includes(normalizedName)
  ) {
    return true;
  }

  if (medicationGenericName) {
    const normalizedGeneric = normalizeText(medicationGenericName);
    if (
      normalizedGeneric.length > 3 &&
      normalizedInteraction.includes(normalizedGeneric)
    ) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AnomalyFlagService {
  // ---------------------------------------------------------------------------
  // Public method
  // ---------------------------------------------------------------------------

  async checkPrescription(data: {
    db: DatabaseClient;
    session: AiSession;
    patient_id: string;
    medicaments: PrescribedMedication[];
  }): Promise<PrescriptionCheckResult> {
    const requestStartedAt = Date.now();
    let lastCheckpointAt = requestStartedAt;
    let stepIndex = 0;

    const checkpoint = (step: string, meta?: LogMeta): void => {
      stepIndex += 1;
      const now = Date.now();
      const stepDurationMs = now - lastCheckpointAt;
      const totalDurationMs = now - requestStartedAt;
      const payload: LogMeta = {
        step,
        step_index: stepIndex,
        step_duration_ms: stepDurationMs,
        total_duration_ms: totalDurationMs,
        ...meta,
      };

      logInfo("step completed", payload);

      if (stepDurationMs >= SLOW_STEP_THRESHOLD_MS) {
        logWarn("slow step detected", payload);
      }

      lastCheckpointAt = now;
    };

    const branchErrorMessage = (reason: unknown): string => {
      if (reason instanceof BranchTimeoutError) {
        return `${reason.branch} timed out after ${reason.timeoutMs}ms`;
      }
      return reason instanceof Error ? reason.message : String(reason);
    };

    checkpoint("start", {
      patient_id: data.patient_id,
      medicaments_count: data.medicaments.length,
    });

    // 1. Resolve authenticated user
    await this.resolveUtilisateur(data.db, data.session);
    checkpoint("auth_resolved");

    // 2. Parse medicament_externe_id strings to integers
    const medicamentIds = data.medicaments.map((m) =>
      parseInt(m.medicament_externe_id, 10),
    );
    const validMedicamentIds = medicamentIds.filter((id) => !isNaN(id));
    checkpoint("medication_ids_parsed", {
      parsed_ids_count: validMedicamentIds.length,
      invalid_ids_count: medicamentIds.length - validMedicamentIds.length,
    });

    // 3. Fetch patient data, medication details, and active treatments in parallel
    checkpoint("parallel_fetch_started", {
      patient_id: data.patient_id,
      valid_medicament_ids_count: validMedicamentIds.length,
    });

    const patientCorePromise = (async () => {
      const startedAt = Date.now();
      try {
        const result = await withTimeout(
          anomalyFlagRepository.getCorePatientData(data.db, data.patient_id),
          BRANCH_TIMEOUT_MS,
          "getCorePatientData",
        );

        logInfo("branch fetch completed", {
          branch: "getCorePatientData",
          branch_duration_ms: Date.now() - startedAt,
          patient_found: Boolean(result),
        });

        return result;
      } catch (error) {
        logError("branch fetch failed", {
          branch: "getCorePatientData",
          branch_duration_ms: Date.now() - startedAt,
          error: branchErrorMessage(error),
        });
        throw error;
      }
    })();

    const femaleDataPromise = (async () => {
      const startedAt = Date.now();
      try {
        const result = await withTimeout(
          anomalyFlagRepository.getPatientFemaleData(data.db, data.patient_id),
          BRANCH_TIMEOUT_MS,
          "getPatientFemaleData",
        );

        logInfo("branch fetch completed", {
          branch: "getPatientFemaleData",
          branch_duration_ms: Date.now() - startedAt,
          female_data_found: Boolean(result),
        });

        return result;
      } catch (error) {
        logError("branch fetch failed", {
          branch: "getPatientFemaleData",
          branch_duration_ms: Date.now() - startedAt,
          error: branchErrorMessage(error),
        });
        throw error;
      }
    })();

    const antecedentsPromise = (async () => {
      const startedAt = Date.now();
      try {
        const result = await withTimeout(
          anomalyFlagRepository.getPatientAntecedents(data.db, data.patient_id),
          BRANCH_TIMEOUT_MS,
          "getPatientAntecedents",
        );

        logInfo("branch fetch completed", {
          branch: "getPatientAntecedents",
          branch_duration_ms: Date.now() - startedAt,
          antecedents_count: result.length,
        });

        return result;
      } catch (error) {
        logError("branch fetch failed", {
          branch: "getPatientAntecedents",
          branch_duration_ms: Date.now() - startedAt,
          error: branchErrorMessage(error),
        });
        throw error;
      }
    })();

    const medicationDetailsPromise = (async () => {
      const startedAt = Date.now();
      try {
        const result = await withTimeout(
          anomalyFlagRepository.getMedicationsByIds(validMedicamentIds),
          BRANCH_TIMEOUT_MS,
          "getMedicationsByIds",
        );

        logInfo("branch fetch completed", {
          branch: "getMedicationsByIds",
          branch_duration_ms: Date.now() - startedAt,
          requested_ids_count: validMedicamentIds.length,
          resolved_medications_count: result.length,
        });

        return result;
      } catch (error) {
        logError("branch fetch failed", {
          branch: "getMedicationsByIds",
          branch_duration_ms: Date.now() - startedAt,
          error: branchErrorMessage(error),
        });
        throw error;
      }
    })();

    const activeTreatmentsPromise = (async () => {
      const startedAt = Date.now();
      try {
        const result = await withTimeout(
          anomalyFlagRepository.getActivePatientTreatments(data.db, data.patient_id),
          ACTIVE_TREATMENTS_TIMEOUT_MS,
          "getActivePatientTreatments",
        );

        logInfo("branch fetch completed", {
          branch: "getActivePatientTreatments",
          branch_duration_ms: Date.now() - startedAt,
          active_treatments_count: result.length,
        });

        return result;
      } catch (error) {
        logError("branch fetch failed", {
          branch: "getActivePatientTreatments",
          branch_duration_ms: Date.now() - startedAt,
          error: branchErrorMessage(error),
        });
        throw error;
      }
    })();

    const [
      patientCoreResult,
      femaleDataResult,
      antecedentsResult,
      medicationDetailsResult,
      activeTreatmentsResult,
    ] =
      await Promise.allSettled([
        patientCorePromise,
        femaleDataPromise,
        antecedentsPromise,
        medicationDetailsPromise,
        activeTreatmentsPromise,
      ]);

    if (patientCoreResult.status === "rejected") {
      checkpoint("parallel_fetch_failed", {
        failed_branch: "getCorePatientData",
      });
      logError("patient data branch failed", {
        branch: "getCorePatientData",
        error: branchErrorMessage(patientCoreResult.reason),
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Impossible de charger les donnees patient pour la verification de l'ordonnance.",
      });
    }

    const patientCore = patientCoreResult.value;
    const medicationDetails =
      medicationDetailsResult.status === "fulfilled"
        ? medicationDetailsResult.value
        : [];
    const activeTreatments =
      activeTreatmentsResult.status === "fulfilled"
        ? activeTreatmentsResult.value
        : [];
    const femaleData =
      femaleDataResult.status === "fulfilled" ? femaleDataResult.value : null;
    const antecedents =
      antecedentsResult.status === "fulfilled" ? antecedentsResult.value : [];

    const fetchDegradedAnomalies: GlobalAnomaly[] = [];

    if (femaleDataResult.status === "rejected") {
      fetchDegradedAnomalies.push({
        code: "PATIENT_CONTEXT_DEGRADED",
        severity: "info",
        message:
          "Certaines donnees patient n'ont pas pu etre chargees completement. Analyse effectuee avec un contexte partiel.",
        medicaments_concernes: [],
      });
      logWarn("patient female data branch degraded", {
        branch: "getPatientFemaleData",
        error: branchErrorMessage(femaleDataResult.reason),
      });
    }

    if (antecedentsResult.status === "rejected") {
      const alreadyAdded = fetchDegradedAnomalies.some(
        (anomaly) => anomaly.code === "PATIENT_CONTEXT_DEGRADED",
      );
      if (!alreadyAdded) {
        fetchDegradedAnomalies.push({
          code: "PATIENT_CONTEXT_DEGRADED",
          severity: "info",
          message:
            "Certaines donnees patient n'ont pas pu etre chargees completement. Analyse effectuee avec un contexte partiel.",
          medicaments_concernes: [],
        });
      }
      logWarn("patient antecedents branch degraded", {
        branch: "getPatientAntecedents",
        error: branchErrorMessage(antecedentsResult.reason),
      });
    }

    if (medicationDetailsResult.status === "rejected") {
      fetchDegradedAnomalies.push({
        code: "MEDICATION_DATA_DEGRADED",
        severity: "info",
        message:
          "Les details medicaments n'ont pas pu etre charges completement. Analyse partielle appliquee.",
        medicaments_concernes: [],
      });
      logWarn("medication details branch degraded", {
        branch: "getMedicationsByIds",
        error: branchErrorMessage(medicationDetailsResult.reason),
      });
    }

    if (activeTreatmentsResult.status === "rejected") {
      const isTimeout = activeTreatmentsResult.reason instanceof BranchTimeoutError;
      fetchDegradedAnomalies.push({
        code: isTimeout
          ? "ACTIVE_TREATMENTS_TIMEOUT"
          : "ACTIVE_TREATMENTS_UNAVAILABLE",
        severity: "info",
        message: isTimeout
          ? "La verification des traitements actifs a depasse le delai autorise. Analyse effectuee sans comparaison avec les traitements en cours."
          : "Les traitements actifs n'ont pas pu etre verifies. Analyse effectuee sans comparaison avec les traitements en cours.",
        medicaments_concernes: [],
      });
      logWarn("active treatments branch degraded", {
        branch: "getActivePatientTreatments",
        timeout: isTimeout,
        error: branchErrorMessage(activeTreatmentsResult.reason),
      });
    }

    checkpoint("parallel_fetch_completed", {
      patient_found: Boolean(patientCore),
      medication_details_count: medicationDetails.length,
      active_treatments_count: activeTreatments.length,
      medication_fetch_degraded: medicationDetailsResult.status === "rejected",
      active_treatments_fetch_degraded:
        activeTreatmentsResult.status === "rejected",
    });

    // 4. Validate patient exists
    if (!patientCore) {
      checkpoint("patient_validated_not_found", { patient_id: data.patient_id });
      logWarn("patient not found", {
        patient_id: data.patient_id,
        total_duration_ms: Date.now() - requestStartedAt,
      });
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Patient introuvable.",
      });
    }
    checkpoint("patient_validated");

    const patientData = buildFullPatientData(
      patientCore,
      femaleData,
      antecedents,
    );

    // 5. Build patient context
    const age = computePatientAge(patientData.patient.date_naissance);
    const patientContext: PatientContext = {
      age,
      sexe: patientData.patient.sexe,
      pregnancyRisk: inferPregnancyRisk(
        patientData.donnees_femme,
        patientData.patient.sexe,
      ),
      habitudes_toxiques: patientData.patient.habitudes_toxiques,
      antecedentsPersonnels: this.extractAntecedentDescriptions(patientData),
    };
    checkpoint("patient_context_built", {
      age: patientContext.age,
      pregnancy_risk: patientContext.pregnancyRisk,
      antecedents_count: patientContext.antecedentsPersonnels.length,
    });

    // 6. Build a lookup map: medicament_externe_id -> MedicationWithDetails
    const medicationMap = new Map<string, MedicationWithDetails>();
    for (const med of medicationDetails) {
      medicationMap.set(String(med.id), med);
    }
    checkpoint("medication_map_built", {
      medication_map_size: medicationMap.size,
    });

    // 7. Phase 1: Rule-based checks
    const anomaliesParMedicament: MedicationAnomaly[] = [];
    const anomaliesGlobales: GlobalAnomaly[] = [...fetchDegradedAnomalies];

    // Per-medication rules
    for (const prescribed of data.medicaments) {
      const medDetails = medicationMap.get(prescribed.medicament_externe_id);

      if (!medDetails) {
        // Medication not found in external DB — info anomaly
        anomaliesParMedicament.push({
          medicament_externe_id: prescribed.medicament_externe_id,
          nom_medicament: `Medicament #${prescribed.medicament_externe_id}`,
          code: "MEDICATION_NOT_FOUND",
          severity: "info",
          message:
            "Medicament introuvable dans la base de donnees pharmaceutique. Verification automatique impossible.",
        });
        continue;
      }

      // Rule 1: Pregnancy contraindication
      this.checkPregnancyContraindication(
        prescribed,
        medDetails,
        patientContext,
        anomaliesParMedicament,
      );

      // Rule 2: Breastfeeding risk
      this.checkBreastfeedingRisk(
        prescribed,
        medDetails,
        patientContext,
        patientData,
        anomaliesParMedicament,
      );

      // Rule 3: Child without pediatric dosage
      this.checkChildDosage(
        prescribed,
        medDetails,
        patientContext,
        anomaliesParMedicament,
      );

      // Rule 4: Contre-indication match
      this.checkContreIndications(
        prescribed,
        medDetails,
        patientContext,
        anomaliesParMedicament,
      );

      // Rule 5: Precaution match
      this.checkPrecautions(
        prescribed,
        medDetails,
        patientContext,
        anomaliesParMedicament,
      );
    }

    // Rule 6: Drug interactions within the prescription
    this.checkDrugInteractions(
      data.medicaments,
      medicationMap,
      anomaliesGlobales,
    );

    // Rule 7: Interactions with existing active treatments
    this.checkExistingTreatmentInteractions(
      data.medicaments,
      medicationMap,
      activeTreatments,
      anomaliesGlobales,
    );

    checkpoint("rule_based_checks_completed", {
      anomalies_par_medicament_count: anomaliesParMedicament.length,
      anomalies_globales_count: anomaliesGlobales.length,
    });

    // 8. Phase 2: AI second pass (if available)
    let aiAvailable = false;

    if (env.GEMINI_API_KEY) {
      try {
        checkpoint("ai_started", {
          patient_id: data.patient_id,
          medicaments_count: data.medicaments.length,
        });

        const aiResult = await this.runAiAnalysis(
          patientData,
          patientContext,
          data.medicaments,
          medicationMap,
          activeTreatments,
          anomaliesParMedicament,
          anomaliesGlobales,
        );

        aiAvailable = true;
        // Merge AI anomalies into per-medication list
        let aiMergeMatchedCount = 0;
        let aiMergeUnknownCount = 0;

        for (const aiAnomaly of aiResult.anomalies_supplementaires) {
          // Try to find the matching prescribed medication
          const matchingPrescribed = data.medicaments.find((m) => {
            const med = medicationMap.get(m.medicament_externe_id);
            return (
              med &&
              normalizeText(med.nom_medicament) ===
                normalizeText(aiAnomaly.medicament_concerne)
            );
          });

          if (matchingPrescribed) {
            aiMergeMatchedCount += 1;
          } else {
            aiMergeUnknownCount += 1;
          }

          anomaliesParMedicament.push({
            medicament_externe_id:
              matchingPrescribed?.medicament_externe_id ?? "unknown",
            nom_medicament: aiAnomaly.medicament_concerne,
            code: aiAnomaly.code,
            severity: aiAnomaly.severity,
            message: aiAnomaly.message,
            details: aiAnomaly.details,
          });
        }

        checkpoint("ai_completed", {
          ai_anomalies_count: aiResult.anomalies_supplementaires.length,
          ai_merge_matched_count: aiMergeMatchedCount,
          ai_merge_unknown_count: aiMergeUnknownCount,
        });
      } catch (error) {
        logError("ai analysis failed, using rule-based results", {
          patient_id: data.patient_id,
          error: error instanceof Error ? error.message : String(error),
          total_duration_ms: Date.now() - requestStartedAt,
        });

        // AI failed — return rule-based results only
        aiAvailable = false;
        anomaliesGlobales.push({
          code: "AI_UNAVAILABLE",
          severity: "info",
          message:
            "L'analyse IA n'a pas pu etre effectuee. Resultats bases sur les regles automatiques uniquement.",
          medicaments_concernes: [],
        });

        checkpoint("ai_failed_fallback", {
          anomalies_globales_count: anomaliesGlobales.length,
        });
      }
    } else {
      logWarn("ai analysis skipped: GEMINI_API_KEY missing");
      checkpoint("ai_skipped_no_key");
    }

    checkpoint("response_ready", {
      anomalies_par_medicament_count: anomaliesParMedicament.length,
      anomalies_globales_count: anomaliesGlobales.length,
      ai_available: aiAvailable,
    });

    const filteredMedicationAnomalies = anomaliesParMedicament.filter((anomaly) =>
      ORDONNANCE_CONTRADICTION_CODES.has(anomaly.code),
    );
    const filteredGlobalAnomalies = anomaliesGlobales.filter(
      (anomaly) =>
        anomaly.code === "AI_UNAVAILABLE" ||
        anomaly.code === "ACTIVE_TREATMENTS_TIMEOUT" ||
        anomaly.code === "ACTIVE_TREATMENTS_UNAVAILABLE" ||
        anomaly.code === "PATIENT_CONTEXT_DEGRADED" ||
        anomaly.code === "MEDICATION_DATA_DEGRADED" ||
        anomaly.code === "MEDICATION_NOT_FOUND" ||
        ORDONNANCE_CONTRADICTION_CODES.has(anomaly.code),
    );

    return {
      anomalies_par_medicament: filteredMedicationAnomalies,
      anomalies_globales: filteredGlobalAnomalies,
      ai_summary: null,
      ai_available: aiAvailable,
    };
  }

  // ---------------------------------------------------------------------------
  // Rule 1: Pregnancy contraindication
  // ---------------------------------------------------------------------------

  private checkPregnancyContraindication(
    prescribed: PrescribedMedication,
    medDetails: MedicationWithDetails,
    ctx: PatientContext,
    anomalies: MedicationAnomaly[],
  ): void {
    if (!ctx.pregnancyRisk) return;

    // Check the grossesse field on the medication
    const grossesseWarning =
      medDetails.grossesse && containsWarningKeywords(medDetails.grossesse);

    // Check contre-indications for pregnancy keywords
    const contreIndicationPregnancy = medDetails.contre_indications.some(
      (ci) => containsPregnancyKeywords(ci.description),
    );

    if (grossesseWarning || contreIndicationPregnancy) {
      anomalies.push({
        medicament_externe_id: prescribed.medicament_externe_id,
        nom_medicament: medDetails.nom_medicament,
        code: "PREGNANCY_CONTRAINDICATION",
        severity: "error",
        message: `Ce medicament est contre-indique ou deconseille pendant la grossesse.`,
        details: medDetails.grossesse
          ? `Information grossesse: ${medDetails.grossesse}`
          : undefined,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 2: Breastfeeding risk
  // ---------------------------------------------------------------------------

  private checkBreastfeedingRisk(
    prescribed: PrescribedMedication,
    medDetails: MedicationWithDetails,
    ctx: PatientContext,
    patientData: FullPatientData,
    anomalies: MedicationAnomaly[],
  ): void {
    // Only check for women who are not menopausal
    if (!ctx.sexe || ctx.sexe.toLowerCase() !== "feminin") return;
    if (patientData.donnees_femme?.menopause === true) return;

    if (containsWarningKeywords(medDetails.allaitement)) {
      anomalies.push({
        medicament_externe_id: prescribed.medicament_externe_id,
        nom_medicament: medDetails.nom_medicament,
        code: "BREASTFEEDING_RISK",
        severity: "warning",
        message: `Ce medicament presente un risque pendant l'allaitement.`,
        details: medDetails.allaitement
          ? `Information allaitement: ${medDetails.allaitement}`
          : undefined,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 3: Child without pediatric dosage
  // ---------------------------------------------------------------------------

  private checkChildDosage(
    prescribed: PrescribedMedication,
    medDetails: MedicationWithDetails,
    ctx: PatientContext,
    anomalies: MedicationAnomaly[],
  ): void {
    if (ctx.age >= 18) return;

    if (!medDetails.posologie_enfant || medDetails.posologie_enfant.trim() === "") {
      anomalies.push({
        medicament_externe_id: prescribed.medicament_externe_id,
        nom_medicament: medDetails.nom_medicament,
        code: "CHILD_NO_PEDIATRIC_DOSAGE",
        severity: "warning",
        message: `Aucune posologie pediatrique disponible pour ce medicament. Le patient a ${ctx.age} ans.`,
        details: medDetails.posologie_adulte
          ? `Posologie adulte connue: ${medDetails.posologie_adulte}`
          : undefined,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 4: Contre-indication match against patient history
  // ---------------------------------------------------------------------------

  private checkContreIndications(
    prescribed: PrescribedMedication,
    medDetails: MedicationWithDetails,
    ctx: PatientContext,
    anomalies: MedicationAnomaly[],
  ): void {
    // Combine patient's antecedents and habitudes toxiques into searchable text
    const patientHistory = [
      ...ctx.antecedentsPersonnels,
      ctx.habitudes_toxiques ?? "",
    ]
      .filter((s) => s.length > 0)
      .join(" ");

    if (patientHistory.length === 0) return;

    for (const ci of medDetails.contre_indications) {
      // Skip pregnancy-related CIs (already handled by rule 1)
      if (containsPregnancyKeywords(ci.description)) continue;

      if (keywordMatch(ci.description, patientHistory)) {
        anomalies.push({
          medicament_externe_id: prescribed.medicament_externe_id,
          nom_medicament: medDetails.nom_medicament,
          code: "CONTRE_INDICATION_MATCH",
          severity: "error",
          message: `Contre-indication detectee en lien avec les antecedents du patient.`,
          details: `Contre-indication: ${ci.description}`,
        });
        // Only flag once per medication — the most specific CI is enough
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 5: Precaution match against patient history
  // ---------------------------------------------------------------------------

  private checkPrecautions(
    prescribed: PrescribedMedication,
    medDetails: MedicationWithDetails,
    ctx: PatientContext,
    anomalies: MedicationAnomaly[],
  ): void {
    const patientHistory = [
      ...ctx.antecedentsPersonnels,
      ctx.habitudes_toxiques ?? "",
    ]
      .filter((s) => s.length > 0)
      .join(" ");

    if (patientHistory.length === 0) return;

    for (const prec of medDetails.precautions) {
      if (keywordMatch(prec.description, patientHistory)) {
        anomalies.push({
          medicament_externe_id: prescribed.medicament_externe_id,
          nom_medicament: medDetails.nom_medicament,
          code: "PRECAUTION_MATCH",
          severity: "warning",
          message: `Precaution d'emploi en lien avec les antecedents du patient.`,
          details: `Precaution: ${prec.description}`,
        });
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 6: Drug interactions within the prescription
  // ---------------------------------------------------------------------------

  private checkDrugInteractions(
    prescribedMeds: PrescribedMedication[],
    medicationMap: Map<string, MedicationWithDetails>,
    anomalies: GlobalAnomaly[],
  ): void {
    const checkedPairs = new Set<string>();

    for (let i = 0; i < prescribedMeds.length; i++) {
      const medA = medicationMap.get(
        prescribedMeds[i]!.medicament_externe_id,
      );
      if (!medA) continue;

      for (let j = i + 1; j < prescribedMeds.length; j++) {
        const medB = medicationMap.get(
          prescribedMeds[j]!.medicament_externe_id,
        );
        if (!medB) continue;

        const pairKey = [medA.id, medB.id].sort().join("-");
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        // Check if A's interactions mention B
        const aInteractsWithB = medA.interactions.some((inter) =>
          medicationNameMatches(
            inter.medicament_interaction,
            medB.nom_medicament,
            medB.nom_generique,
          ),
        );

        // Check if B's interactions mention A
        const bInteractsWithA = medB.interactions.some((inter) =>
          medicationNameMatches(
            inter.medicament_interaction,
            medA.nom_medicament,
            medA.nom_generique,
          ),
        );

        if (aInteractsWithB || bInteractsWithA) {
          // Find the specific interaction text for details
          const interactionDetail =
            medA.interactions.find((inter) =>
              medicationNameMatches(
                inter.medicament_interaction,
                medB.nom_medicament,
                medB.nom_generique,
              ),
            )?.medicament_interaction ??
            medB.interactions.find((inter) =>
              medicationNameMatches(
                inter.medicament_interaction,
                medA.nom_medicament,
                medA.nom_generique,
              ),
            )?.medicament_interaction;

          anomalies.push({
            code: "DRUG_INTERACTION",
            severity: "error",
            message: `Interaction detectee entre ${medA.nom_medicament} et ${medB.nom_medicament}.`,
            medicaments_concernes: [
              medA.nom_medicament,
              medB.nom_medicament,
            ],
            details: interactionDetail,
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 7: Interactions with existing active treatments
  // ---------------------------------------------------------------------------

  private checkExistingTreatmentInteractions(
    prescribedMeds: PrescribedMedication[],
    medicationMap: Map<string, MedicationWithDetails>,
    activeTreatments: ActiveTreatment[],
    anomalies: GlobalAnomaly[],
  ): void {
    if (activeTreatments.length === 0) return;

    for (const prescribed of prescribedMeds) {
      const medDetails = medicationMap.get(prescribed.medicament_externe_id);
      if (!medDetails) continue;

      for (const treatment of activeTreatments) {
        // Skip if the existing treatment is the same medication
        if (treatment.medicament_externe_id === prescribed.medicament_externe_id) {
          continue;
        }

        // Check if the prescribed medication's interactions mention the active treatment
        const interacts = medDetails.interactions.some((inter) =>
          medicationNameMatches(
            inter.medicament_interaction,
            treatment.nom_medicament,
            null, // no generic name available for active treatments
          ),
        );

        if (interacts) {
          const interactionDetail = medDetails.interactions.find((inter) =>
            medicationNameMatches(
              inter.medicament_interaction,
              treatment.nom_medicament,
              null,
            ),
          )?.medicament_interaction;

          anomalies.push({
            code: "EXISTING_TREATMENT_INTERACTION",
            severity: "error",
            message: `Interaction detectee entre ${medDetails.nom_medicament} (prescrit) et ${treatment.nom_medicament} (traitement actif en cours).`,
            medicaments_concernes: [
              medDetails.nom_medicament,
              treatment.nom_medicament,
            ],
            details: interactionDetail,
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // AI second pass
  // ---------------------------------------------------------------------------

  private async runAiAnalysis(
    patientData: FullPatientData,
    ctx: PatientContext,
    prescribedMeds: PrescribedMedication[],
    medicationMap: Map<string, MedicationWithDetails>,
    activeTreatments: ActiveTreatment[],
    existingMedAnomalies: MedicationAnomaly[],
    existingGlobalAnomalies: GlobalAnomaly[],
  ): Promise<AiAnomalyResult> {
    const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY! });

    // Build the user prompt
    const userPrompt = this.buildAiUserPrompt(
      patientData,
      ctx,
      prescribedMeds,
      medicationMap,
      activeTreatments,
      existingMedAnomalies,
      existingGlobalAnomalies,
    );

    const result = await generateObject({
      model: google(env.GEMINI_MODEL),
      schema: aiAnomalyResultSchema,
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    return result.object as AiAnomalyResult;
  }

  private buildAiUserPrompt(
    patientData: FullPatientData,
    ctx: PatientContext,
    prescribedMeds: PrescribedMedication[],
    medicationMap: Map<string, MedicationWithDetails>,
    activeTreatments: ActiveTreatment[],
    existingMedAnomalies: MedicationAnomaly[],
    existingGlobalAnomalies: GlobalAnomaly[],
  ): string {
    const sections: string[] = [];

    // Patient profile
    const p = patientData.patient;
    const profileLines = [
      `Age: ${ctx.age} ans`,
      `Sexe: ${ctx.sexe ?? "Non renseigne"}`,
      `Risque grossesse: ${ctx.pregnancyRisk ? "Oui (patiente en age de procreer avec antecedent de grossesse, sans contraception)" : "Non"}`,
    ];
    if (p.habitudes_toxiques) {
      profileLines.push(`Habitudes toxiques: ${p.habitudes_toxiques}`);
    }
    if (ctx.antecedentsPersonnels.length > 0) {
      profileLines.push(
        `Antecedents personnels: ${ctx.antecedentsPersonnels.join(", ")}`,
      );
    }

    // Add gynecological data if available
    if (patientData.donnees_femme) {
      const f = patientData.donnees_femme;
      if (f.nb_grossesses != null) {
        profileLines.push(`Nombre de grossesses: ${f.nb_grossesses}`);
      }
      if (f.menopause != null) {
        profileLines.push(`Menopause: ${f.menopause ? "Oui" : "Non"}`);
      }
      if (f.contraception) {
        profileLines.push(`Contraception: ${f.contraception}`);
      }
    }

    sections.push(`## Profil du patient\n${profileLines.join("\n")}`);

    // Prescribed medications
    const medLines = prescribedMeds.map((m) => {
      const details = medicationMap.get(m.medicament_externe_id);
      const name = details?.nom_medicament ?? `Medicament #${m.medicament_externe_id}`;
      let line = `- ${name}: ${m.posologie}`;
      if (m.dosage) line += ` (dosage: ${m.dosage})`;
      if (m.duree_traitement) line += ` — duree: ${m.duree_traitement}`;
      if (details?.dose_maximale) line += ` [dose max: ${details.dose_maximale}]`;
      if (details?.classe_therapeutique)
        line += ` [classe: ${details.classe_therapeutique}]`;
      return line;
    });
    sections.push(`## Medicaments prescrits\n${medLines.join("\n")}`);

    // Active treatments
    if (activeTreatments.length > 0) {
      const treatLines = activeTreatments.map(
        (t) =>
          `- ${t.nom_medicament}: ${t.posologie}${t.dosage ? ` (${t.dosage})` : ""}`,
      );
      sections.push(`## Traitements actifs en cours\n${treatLines.join("\n")}`);
    }

    // Already detected anomalies (so AI doesn't duplicate)
    const allExisting = [
      ...existingMedAnomalies.map(
        (a) => `- [${a.severity.toUpperCase()}] ${a.nom_medicament}: ${a.message}`,
      ),
      ...existingGlobalAnomalies.map(
        (a) => `- [${a.severity.toUpperCase()}] ${a.message}`,
      ),
    ];
    if (allExisting.length > 0) {
      sections.push(
        `## Anomalies deja detectees par les regles automatiques\n${allExisting.join("\n")}\n\nNe repetez PAS ces anomalies. Cherchez des problemes supplementaires.`,
      );
    } else {
      sections.push(
        `## Anomalies deja detectees\nAucune anomalie detectee par les regles automatiques.`,
      );
    }

    return sections.join("\n\n");
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Extracts all antecedent descriptions (personnels) for keyword matching.
   */
  private extractAntecedentDescriptions(data: FullPatientData): string[] {
    const descriptions: string[] = [];
    for (const ant of data.antecedents) {
      if (ant.description) descriptions.push(ant.description);
      for (const ap of ant.personnels) {
        if (ap.details) descriptions.push(ap.details);
      }
    }
    return descriptions;
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

export const anomalyFlagService = new AnomalyFlagService();
