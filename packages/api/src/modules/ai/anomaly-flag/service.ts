import { TRPCError } from "@trpc/server";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import type { db as databaseClient } from "@doctor.com/db";
import { utilisateurs } from "@doctor.com/db/schema";
import { eq } from "drizzle-orm";

import type { SessionUtilisateur } from "../../../trpc/context";
import {
  GEMINI_PROVIDER_NAME,
  generateGeminiText,
  resolveTextProvider,
  type AITextProviderConfig,
} from "../shared/provider";
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
  related_medicaments?: string[];
  source?: "rules" | "ai";
}

export interface GlobalAnomaly {
  code: string;
  severity: AnomalySeverity;
  message: string;
  medicaments_concernes: string[];
  details?: string;
}

export interface MedicationAnomalyAssessment {
  medicament_externe_id: string;
  nom_medicament: string;
  anomaly: MedicationAnomaly | null;
  anomalies: MedicationAnomaly[];
}

export interface PrescriptionCheckResult {
  medicaments: MedicationAnomalyAssessment[];
  anomalies_par_medicament: MedicationAnomaly[];
  anomalies_globales: GlobalAnomaly[];
  ai_summary: string | null;
  ai_available: boolean;
  ai_provider: {
    name: AITextProviderConfig["name"];
    model: string;
  } | null;
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

function getMedicationLookupKey(medicamentExterneId: string): string {
  const parsed = parseInt(medicamentExterneId, 10);
  return Number.isNaN(parsed) ? medicamentExterneId.trim() : String(parsed);
}

function getMedicationDetails(
  prescribed: PrescribedMedication,
  medicationMap: Map<string, MedicationWithDetails>,
): MedicationWithDetails | undefined {
  return medicationMap.get(getMedicationLookupKey(prescribed.medicament_externe_id));
}

function getTreatmentMedicationDetails(
  treatment: ActiveTreatment,
  medicationMap: Map<string, MedicationWithDetails>,
): MedicationWithDetails | undefined {
  return medicationMap.get(getMedicationLookupKey(treatment.medicament_externe_id));
}

function severityWeight(severity: AnomalySeverity): number {
  switch (severity) {
    case "error":
      return 3;
    case "warning":
      return 2;
    case "info":
    default:
      return 1;
  }
}

function selectPrimaryAnomaly(
  anomalies: MedicationAnomaly[],
): MedicationAnomaly | null {
  if (anomalies.length === 0) return null;

  return [...anomalies].sort((a, b) => {
    const severityDiff = severityWeight(b.severity) - severityWeight(a.severity);
    if (severityDiff !== 0) return severityDiff;
    return a.code.localeCompare(b.code);
  })[0]!;
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

// ---------------------------------------------------------------------------
// Zod schema for AI structured output
// ---------------------------------------------------------------------------

const AI_ANOMALY_CODES = [
  "AI_DOSAGE_CONCERN",
  "AI_COHERENCE_CONCERN",
  "AI_INTERACTION_CONCERN",
  "AI_ADDITIONAL_FLAG",
] as const;

type AiAnomalyCode = (typeof AI_ANOMALY_CODES)[number];

const aiMedicationAnomalySchema = z.object({
  code: z.string().optional().describe("Code de l'anomalie"),
  severity: z
    .string()
    .optional()
    .describe("Severite: error, warning ou info"),
  message: z.string().optional().describe("Description de l'anomalie en francais"),
  details: z
    .union([z.string(), z.null()])
    .optional()
    .describe("Details supplementaires"),
  related_medicaments: z
    .union([z.array(z.string()), z.string(), z.null()])
    .optional()
    .describe("Autres medicaments impliques, si applicable"),
}).passthrough();

const aiMedicationAnalysisSchema = z
  .object({
    medicament_externe_id: z
      .string()
      .optional()
      .describe("Identifiant medicament_externe_id fourni en entree"),
    nom_medicament: z.string().optional().describe("Nom du medicament concerne"),
    medicament_concerne: z
      .string()
      .optional()
      .describe("Nom du medicament concerne, format legacy tolere"),
    anomaly: aiMedicationAnomalySchema
      .nullable()
      .optional()
      .describe("Anomalie optionnelle pour ce medicament, ou null"),
    anomalies: z
      .array(aiMedicationAnomalySchema)
      .optional()
      .describe("Liste d'anomalies, format alternatif tolere"),
    code: z.string().optional(),
    severity: z.string().optional(),
    message: z.string().optional(),
    details: z.union([z.string(), z.null()]).optional(),
    related_medicaments: z
      .union([z.array(z.string()), z.string(), z.null()])
      .optional(),
  })
  .passthrough();

const aiMedicationAnalysisEntrySchema = z.union([
  aiMedicationAnalysisSchema,
  z.string(),
]);

const aiAnomalyResultSchema = z.object({
  analyses_par_medicament: z
    .array(aiMedicationAnalysisEntrySchema)
    .optional()
    .describe(
      "Une entree par medicament prescrit, dans le meme perimetre que l'entree utilisateur",
    ),
  anomalies_supplementaires: z
    .array(aiMedicationAnalysisEntrySchema)
    .optional()
    .describe("Ancien format tolere pour compatibilite"),
  resume: z
    .string()
    .optional()
    .describe(
      "Resume global en francais de l'evaluation de securite de l'ordonnance",
    ),
}).passthrough();

type AiRawAnomalyResult = z.infer<typeof aiAnomalyResultSchema>;
type AiRawMedicationAnalysis = NonNullable<
  AiRawAnomalyResult["analyses_par_medicament"]
>[number];
type AiRawMedicationAnomaly = z.infer<typeof aiMedicationAnomalySchema>;

interface AiMedicationAnalysis {
  medicament_externe_id: string;
  nom_medicament: string;
  anomaly: {
    code: AiAnomalyCode;
    severity: AnomalySeverity;
    message: string;
    details?: string;
    related_medicaments?: string[];
  } | null;
}

interface AiAnomalyResult {
  analyses_par_medicament: AiMedicationAnalysis[];
  resume: string;
}

// ---------------------------------------------------------------------------
// AI system prompt
// ---------------------------------------------------------------------------

const AI_SYSTEM_PROMPT = `Vous etes un expert pharmaceutique charge de verifier la securite d'une ordonnance medicale.

Votre role:
1. Analyser tous les medicaments prescrits ensemble en tenant compte du profil du patient (age, sexe, antecedents, traitements en cours).
2. Identifier des anomalies que les regles automatiques n'auraient pas detectees:
   - Dosages inappropries pour le profil du patient (age, poids estime, fonction renale presumee)
   - Incoherences therapeutiques (medicaments redondants, associations illogiques)
   - Interactions potentielles entre medicaments prescrits dans la meme entree
   - Interactions potentielles avec les traitements actifs deja suivis par le patient
   - Tout autre probleme de securite pertinent
3. Ne PAS repeter les anomalies deja detectees par les regles automatiques (elles vous sont fournies).
4. Retourner exactement une entree dans analyses_par_medicament pour chaque medicament prescrit fourni en entree. Utiliser anomaly: null si aucun probleme supplementaire n'est detecte pour ce medicament.
5. Le resume doit etre concis (2-4 phrases) et donner un avis global sur la securite de l'ordonnance.
6. analyses_par_medicament doit etre un tableau d'objets JSON, jamais un tableau de chaines.
7. Si une interaction concerne deux medicaments prescrits dans l'entree, mettez une anomaly sur les deux medicaments avec code AI_INTERACTION_CONCERN et indiquez l'autre medicament dans related_medicaments.

Codes disponibles:
- AI_DOSAGE_CONCERN: probleme de dosage ou posologie
- AI_COHERENCE_CONCERN: incoherence therapeutique, redondance ou association illogique
- AI_INTERACTION_CONCERN: interaction potentielle non deja couverte par les regles automatiques
- AI_ADDITIONAL_FLAG: tout autre probleme de securite

Exemple de forme attendue:
{
  "resume": "Avis global...",
  "analyses_par_medicament": [
    {
      "medicament_externe_id": "6838",
      "nom_medicament": "TRAMADOL ARROW",
      "anomaly": null
    }
  ]
}

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

function findMatchingInteraction(
  medDetails: MedicationWithDetails,
  targetName: string,
  targetGenericName: string | null,
): string | undefined {
  return medDetails.interactions.find((inter) =>
    medicationNameMatches(
      inter.medicament_interaction,
      targetName,
      targetGenericName,
    ),
  )?.medicament_interaction;
}

function normalizeAiSeverity(value: string | undefined): AnomalySeverity {
  const normalized = normalizeText(value ?? "");
  if (normalized === "error" || normalized === "erreur") return "error";
  if (normalized === "info" || normalized === "information") return "info";
  return "warning";
}

function normalizeAiCode(value: string | undefined): AiAnomalyCode {
  const raw = (value ?? "").trim().toUpperCase();
  if ((AI_ANOMALY_CODES as readonly string[]).includes(raw)) {
    return raw as AiAnomalyCode;
  }

  const normalized = normalizeText(raw);
  if (normalized.includes("dosage") || normalized.includes("posologie")) {
    return "AI_DOSAGE_CONCERN";
  }
  if (normalized.includes("interaction")) {
    return "AI_INTERACTION_CONCERN";
  }
  if (
    normalized.includes("coherence") ||
    normalized.includes("redond") ||
    normalized.includes("association")
  ) {
    return "AI_COHERENCE_CONCERN";
  }
  return "AI_ADDITIONAL_FLAG";
}

function normalizeAiRelatedMedicaments(
  value: string | string[] | null | undefined,
): string[] | undefined {
  if (!value) return undefined;

  const related = Array.isArray(value)
    ? value
    : value.split(/[,;]/g).map((item) => item.trim());

  const normalized = related.filter((item) => item.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function medicationMatchesAnyName(
  prescribed: PrescribedMedication,
  medDetails: MedicationWithDetails | undefined,
  normalizedNames: string[],
): boolean {
  const candidateNames = [
    prescribed.medicament_externe_id,
    getMedicationLookupKey(prescribed.medicament_externe_id),
    medDetails?.nom_medicament,
    medDetails?.nom_generique,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeText(value))
    .filter((value) => value.length > 0);

  return normalizedNames.some((name) =>
    candidateNames.some(
      (candidateName) =>
        candidateName === name ||
        (name.length > 3 && candidateName.includes(name)) ||
        (candidateName.length > 3 && name.includes(candidateName)),
    ),
  );
}

function medicationAnomalyKey(anomaly: MedicationAnomaly): string {
  return [
    getMedicationLookupKey(anomaly.medicament_externe_id),
    anomaly.code,
    anomaly.message,
    anomaly.details ?? "",
    [...(anomaly.related_medicaments ?? [])].sort().join("|"),
  ].join("::");
}

function pushMedicationAnomalyOnce(
  anomalies: MedicationAnomaly[],
  anomaly: MedicationAnomaly,
): boolean {
  const key = medicationAnomalyKey(anomaly);
  const exists = anomalies.some((candidate) => medicationAnomalyKey(candidate) === key);

  if (exists) {
    return false;
  }

  anomalies.push(anomaly);
  return true;
}

function rawAiAnalysisMatchesMedication(params: {
  analysis: AiRawMedicationAnalysis;
  prescribed: PrescribedMedication;
  medDetails: MedicationWithDetails | undefined;
}): boolean {
  if (typeof params.analysis === "string") {
    const normalized = normalizeText(params.analysis);
    return (
      normalized.includes(
        normalizeText(getMedicationLookupKey(params.prescribed.medicament_externe_id)),
      ) ||
      normalized.includes(normalizeText(params.medDetails?.nom_medicament ?? ""))
    );
  }

  const rawId = params.analysis.medicament_externe_id;
  if (
    rawId &&
    getMedicationLookupKey(rawId) ===
      getMedicationLookupKey(params.prescribed.medicament_externe_id)
  ) {
    return true;
  }

  const rawName =
    params.analysis.nom_medicament ?? params.analysis.medicament_concerne;
  if (!rawName) return false;

  const normalizedRawName = normalizeText(rawName);
  return (
    normalizeText(params.medDetails?.nom_medicament ?? "") === normalizedRawName ||
    normalizeText(params.prescribed.medicament_externe_id) === normalizedRawName
  );
}

function normalizeRawAiAnomaly(
  anomaly: AiRawMedicationAnomaly | AiRawMedicationAnalysis,
): AiMedicationAnalysis["anomaly"] {
  if (!anomaly || typeof anomaly === "string") return null;

  const message = anomaly.message?.trim();
  if (!message) return null;

  const details =
    typeof anomaly.details === "string" && anomaly.details.trim().length > 0
      ? anomaly.details.trim()
      : undefined;
  const related_medicaments = normalizeAiRelatedMedicaments(
    anomaly.related_medicaments,
  );

  return {
    code: normalizeAiCode(anomaly.code),
    severity: normalizeAiSeverity(anomaly.severity),
    message,
    ...(details ? { details } : {}),
    ...(related_medicaments ? { related_medicaments } : {}),
  };
}

function normalizeAiResult(
  rawResult: AiRawAnomalyResult,
  prescribedMeds: PrescribedMedication[],
  medicationMap: Map<string, MedicationWithDetails>,
): AiAnomalyResult {
  const rawAnalyses =
    rawResult.analyses_par_medicament ??
    rawResult.anomalies_supplementaires ??
    [];

  return {
    resume:
      rawResult.resume?.trim() ??
      "Analyse IA effectuee. Aucun resume supplementaire fourni.",
    analyses_par_medicament: prescribedMeds.map((prescribed) => {
      const medDetails = getMedicationDetails(prescribed, medicationMap);
      const matchingRawAnalysis = rawAnalyses.find((analysis) =>
        rawAiAnalysisMatchesMedication({
          analysis,
          prescribed,
          medDetails,
        }),
      );

      const rawAnomaly =
        typeof matchingRawAnalysis === "object"
          ? (matchingRawAnalysis.anomaly ??
            matchingRawAnalysis.anomalies?.[0] ??
            (matchingRawAnalysis.message || matchingRawAnalysis.code
              ? matchingRawAnalysis
              : null))
          : null;

      const rawName =
        typeof matchingRawAnalysis === "object"
          ? (matchingRawAnalysis.nom_medicament ??
            matchingRawAnalysis.medicament_concerne)
          : undefined;

      return {
        medicament_externe_id: prescribed.medicament_externe_id,
        nom_medicament:
          medDetails?.nom_medicament ??
          rawName ??
          `Medicament #${prescribed.medicament_externe_id}`,
        anomaly: rawAnomaly ? normalizeRawAiAnomaly(rawAnomaly) : null,
      };
    }),
  };
}

function parseJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.search(/[\[{]/);
    const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error("AI response did not contain valid JSON.");
  }
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
    let activeTreatmentMedicationDetails: MedicationWithDetails[] = [];
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

    const activeTreatmentMedicamentIds = activeTreatments
      .map((treatment) => parseInt(treatment.medicament_externe_id, 10))
      .filter((id) => !Number.isNaN(id));
    const activeTreatmentIdsToFetch = activeTreatmentMedicamentIds.filter(
      (id) => !medicationMap.has(String(id)),
    );

    if (activeTreatmentIdsToFetch.length > 0) {
      try {
        activeTreatmentMedicationDetails = await withTimeout(
          anomalyFlagRepository.getMedicationsByIds(activeTreatmentIdsToFetch),
          BRANCH_TIMEOUT_MS,
          "getActiveTreatmentMedicationDetails",
        );

        for (const med of activeTreatmentMedicationDetails) {
          medicationMap.set(String(med.id), med);
        }

        checkpoint("active_treatment_medication_details_loaded", {
          requested_ids_count: activeTreatmentIdsToFetch.length,
          resolved_medications_count: activeTreatmentMedicationDetails.length,
        });
      } catch (error) {
        logWarn("active treatment medication details degraded", {
          branch: "getActiveTreatmentMedicationDetails",
          error: branchErrorMessage(error),
        });
        checkpoint("active_treatment_medication_details_degraded", {
          requested_ids_count: activeTreatmentIdsToFetch.length,
        });
      }
    }

    // 7. Phase 1: Rule-based checks
    const anomaliesParMedicament: MedicationAnomaly[] = [];
    const anomaliesGlobales: GlobalAnomaly[] = [...fetchDegradedAnomalies];

    // Per-medication rules
    for (const prescribed of data.medicaments) {
      const medDetails = getMedicationDetails(prescribed, medicationMap);

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
      anomaliesParMedicament,
      anomaliesGlobales,
    );

    // Rule 7: Interactions with existing active treatments
    this.checkExistingTreatmentInteractions(
      data.medicaments,
      medicationMap,
      activeTreatments,
      anomaliesParMedicament,
      anomaliesGlobales,
    );

    checkpoint("rule_based_checks_completed", {
      anomalies_par_medicament_count: anomaliesParMedicament.length,
      anomalies_globales_count: anomaliesGlobales.length,
    });

    // 8. Phase 2: AI second pass (if available)
    let aiAvailable = false;
    let aiSummary: string | null = null;
    let aiProvider: PrescriptionCheckResult["ai_provider"] = null;

    try {
      const provider = resolveTextProvider();
      aiProvider = { name: provider.name, model: provider.model };
        checkpoint("ai_started", {
          patient_id: data.patient_id,
          medicaments_count: data.medicaments.length,
          provider: provider.name,
          model: provider.model,
        });

        const aiResult = await this.runAiAnalysis(
          patientData,
          patientContext,
          data.medicaments,
          medicationMap,
          activeTreatments,
          anomaliesParMedicament,
          anomaliesGlobales,
          provider,
        );

        aiAvailable = true;
        aiSummary = aiResult.resume;
        // Merge AI anomalies into per-medication list
        let aiMergeMatchedCount = 0;
        let aiMergeUnknownCount = 0;

        for (const aiAnalysis of aiResult.analyses_par_medicament) {
          if (!aiAnalysis.anomaly) {
            continue;
          }

          // Try to find the matching prescribed medication
          const matchingPrescribed = data.medicaments.find((m) => {
            const med = getMedicationDetails(m, medicationMap);
            return (
              getMedicationLookupKey(m.medicament_externe_id) ===
                getMedicationLookupKey(aiAnalysis.medicament_externe_id) ||
              (med &&
                normalizeText(med.nom_medicament) ===
                  normalizeText(aiAnalysis.nom_medicament))
            );
          });

          if (matchingPrescribed) {
            aiMergeMatchedCount += 1;
          } else {
            aiMergeUnknownCount += 1;
            continue;
          }

          const medDetails = getMedicationDetails(matchingPrescribed, medicationMap);
          const aiMedicationAnomaly: MedicationAnomaly = {
            medicament_externe_id: matchingPrescribed.medicament_externe_id,
            nom_medicament:
              medDetails?.nom_medicament ?? aiAnalysis.nom_medicament,
            code: aiAnalysis.anomaly.code,
            severity: aiAnalysis.anomaly.severity,
            message: aiAnalysis.anomaly.message,
            details: aiAnalysis.anomaly.details,
            related_medicaments: aiAnalysis.anomaly.related_medicaments,
            source: "ai",
          };

          pushMedicationAnomalyOnce(anomaliesParMedicament, aiMedicationAnomaly);

          if (
            aiAnalysis.anomaly.code === "AI_INTERACTION_CONCERN"
          ) {
            const relatedNames = [
              ...(aiAnalysis.anomaly.related_medicaments ?? []),
              aiAnalysis.anomaly.message,
              aiAnalysis.anomaly.details ?? "",
            ]
              .map((name) => normalizeText(name))
              .filter((name) => name.length > 0);

            for (const candidate of data.medicaments) {
              if (
                getMedicationLookupKey(candidate.medicament_externe_id) ===
                getMedicationLookupKey(matchingPrescribed.medicament_externe_id)
              ) {
                continue;
              }

              const candidateDetails = getMedicationDetails(candidate, medicationMap);
              const isRelated = medicationMatchesAnyName(
                candidate,
                candidateDetails,
                relatedNames,
              );

              if (!isRelated) continue;

              const sourceName =
                medDetails?.nom_medicament ?? aiAnalysis.nom_medicament;
              pushMedicationAnomalyOnce(anomaliesParMedicament, {
                ...aiMedicationAnomaly,
                medicament_externe_id: candidate.medicament_externe_id,
                nom_medicament:
                  candidateDetails?.nom_medicament ??
                  `Medicament #${candidate.medicament_externe_id}`,
                related_medicaments: [sourceName],
              });
            }
          }
        }

        checkpoint("ai_completed", {
          ai_analyses_count: aiResult.analyses_par_medicament.length,
          ai_merge_matched_count: aiMergeMatchedCount,
          ai_merge_unknown_count: aiMergeUnknownCount,
          provider: provider.name,
          model: provider.model,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        logError("ai analysis failed", {
          patient_id: data.patient_id,
          provider: aiProvider?.name,
          model: aiProvider?.model,
          error: errorMessage,
          total_duration_ms: Date.now() - requestStartedAt,
        });
        checkpoint("ai_failed", {
          anomalies_globales_count: anomaliesGlobales.length,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "L'analyse IA de l'ordonnance a echoue. Aucun resultat de fallback par regles n'a ete retourne.",
          cause: error,
        });
      }

    checkpoint("response_ready", {
      anomalies_par_medicament_count: anomaliesParMedicament.length,
      anomalies_globales_count: anomaliesGlobales.length,
      ai_available: aiAvailable,
      provider: aiProvider?.name,
      model: aiProvider?.model,
    });

    const medicationAssessments = this.buildMedicationAssessments(
      data.medicaments,
      medicationMap,
      anomaliesParMedicament,
    );

    return {
      medicaments: medicationAssessments,
      anomalies_par_medicament: anomaliesParMedicament,
      anomalies_globales: anomaliesGlobales,
      ai_summary: aiSummary,
      ai_available: aiAvailable,
      ai_provider: aiProvider,
    };
  }

  private buildMedicationAssessments(
    prescribedMeds: PrescribedMedication[],
    medicationMap: Map<string, MedicationWithDetails>,
    anomalies: MedicationAnomaly[],
  ): MedicationAnomalyAssessment[] {
    return prescribedMeds.map((prescribed) => {
      const medDetails = getMedicationDetails(prescribed, medicationMap);
      const medicationAnomalies = anomalies.filter(
        (anomaly) =>
          getMedicationLookupKey(anomaly.medicament_externe_id) ===
          getMedicationLookupKey(prescribed.medicament_externe_id),
      );

      return {
        medicament_externe_id: prescribed.medicament_externe_id,
        nom_medicament:
          medDetails?.nom_medicament ??
          medicationAnomalies[0]?.nom_medicament ??
          `Medicament #${prescribed.medicament_externe_id}`,
        anomaly: selectPrimaryAnomaly(medicationAnomalies),
        anomalies: medicationAnomalies,
      };
    });
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
    medicationAnomalies: MedicationAnomaly[],
    globalAnomalies: GlobalAnomaly[],
  ): void {
    const checkedPairs = new Set<string>();

    for (let i = 0; i < prescribedMeds.length; i++) {
      const prescribedA = prescribedMeds[i]!;
      const medA = getMedicationDetails(prescribedA, medicationMap);
      if (!medA) continue;

      for (let j = i + 1; j < prescribedMeds.length; j++) {
        const prescribedB = prescribedMeds[j]!;
        const medB = getMedicationDetails(prescribedB, medicationMap);
        if (!medB) continue;

        const pairKey = [medA.id, medB.id].sort().join("-");
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        const interactionFromA = findMatchingInteraction(
          medA,
          medB.nom_medicament,
          medB.nom_generique,
        );
        const interactionFromB = findMatchingInteraction(
          medB,
          medA.nom_medicament,
          medA.nom_generique,
        );

        if (interactionFromA || interactionFromB) {
          const interactionDetail = interactionFromA ?? interactionFromB;
          const message = `Interaction detectee entre ${medA.nom_medicament} et ${medB.nom_medicament}.`;

          globalAnomalies.push({
            code: "DRUG_INTERACTION",
            severity: "error",
            message,
            medicaments_concernes: [
              medA.nom_medicament,
              medB.nom_medicament,
            ],
            details: interactionDetail,
          });

          pushMedicationAnomalyOnce(
            medicationAnomalies,
            {
              medicament_externe_id: prescribedA.medicament_externe_id,
              nom_medicament: medA.nom_medicament,
              code: "DRUG_INTERACTION",
              severity: "error",
              message,
              details: interactionDetail,
              related_medicaments: [medB.nom_medicament],
              source: "rules",
            },
          );
          pushMedicationAnomalyOnce(
            medicationAnomalies,
            {
              medicament_externe_id: prescribedB.medicament_externe_id,
              nom_medicament: medB.nom_medicament,
              code: "DRUG_INTERACTION",
              severity: "error",
              message,
              details: interactionDetail,
              related_medicaments: [medA.nom_medicament],
              source: "rules",
            },
          );
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
    medicationAnomalies: MedicationAnomaly[],
    globalAnomalies: GlobalAnomaly[],
  ): void {
    if (activeTreatments.length === 0) return;

    for (const prescribed of prescribedMeds) {
      const medDetails = getMedicationDetails(prescribed, medicationMap);
      if (!medDetails) continue;

      for (const treatment of activeTreatments) {
        // Skip if the existing treatment is the same medication
        if (
          getMedicationLookupKey(treatment.medicament_externe_id) ===
          getMedicationLookupKey(prescribed.medicament_externe_id)
        ) {
          continue;
        }

        const treatmentDetails = getTreatmentMedicationDetails(
          treatment,
          medicationMap,
        );
        const interactionFromPrescription = findMatchingInteraction(
          medDetails,
          treatment.nom_medicament,
          treatmentDetails?.nom_generique ?? null,
        );
        const interactionFromTreatment = treatmentDetails
          ? findMatchingInteraction(
              treatmentDetails,
              medDetails.nom_medicament,
              medDetails.nom_generique,
            )
          : undefined;

        if (interactionFromPrescription || interactionFromTreatment) {
          const interactionDetail =
            interactionFromPrescription ?? interactionFromTreatment;
          const message = `Interaction detectee entre ${medDetails.nom_medicament} (prescrit) et ${treatment.nom_medicament} (traitement actif en cours).`;

          globalAnomalies.push({
            code: "EXISTING_TREATMENT_INTERACTION",
            severity: "error",
            message,
            medicaments_concernes: [
              medDetails.nom_medicament,
              treatment.nom_medicament,
            ],
            details: interactionDetail,
          });

          pushMedicationAnomalyOnce(medicationAnomalies, {
            medicament_externe_id: prescribed.medicament_externe_id,
            nom_medicament: medDetails.nom_medicament,
            code: "EXISTING_TREATMENT_INTERACTION",
            severity: "error",
            message,
            details: interactionDetail,
            related_medicaments: [treatment.nom_medicament],
            source: "rules",
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
    provider: AITextProviderConfig,
  ): Promise<AiAnomalyResult> {
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

    let rawResult: AiRawAnomalyResult;
    if (provider.name === GEMINI_PROVIDER_NAME) {
      const google = createGoogleGenerativeAI({ apiKey: provider.apiKey! });
      const result = await generateObject({
        model: google(provider.model),
        schema: aiAnomalyResultSchema,
        messages: [
          { role: "system", content: AI_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });
      rawResult = result.object as AiRawAnomalyResult;
    } else {
      const result = await generateGeminiText({
        provider,
        system: `${AI_SYSTEM_PROMPT}\n\nRepondez uniquement avec un objet JSON valide.`,
        prompt: userPrompt,
        timeoutMs: provider.timeoutMs,
        temperature: 0.1,
      });
      rawResult = aiAnomalyResultSchema.parse(parseJsonFromText(result.text));
    }

    return normalizeAiResult(
      rawResult,
      prescribedMeds,
      medicationMap,
    );
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
      const details = getMedicationDetails(m, medicationMap);
      const name = details?.nom_medicament ?? `Medicament #${m.medicament_externe_id}`;
      let line = `- id=${m.medicament_externe_id}; nom=${name}; posologie=${m.posologie}`;
      if (m.dosage) line += ` (dosage: ${m.dosage})`;
      if (m.duree_traitement) line += ` — duree: ${m.duree_traitement}`;
      if (details?.dose_maximale) line += ` [dose max: ${details.dose_maximale}]`;
      if (details?.classe_therapeutique)
        line += ` [classe: ${details.classe_therapeutique}]`;
      if (details?.interactions.length) {
        const knownInteractions = details.interactions
          .slice(0, 8)
          .map((interaction) => interaction.medicament_interaction)
          .join("; ");
        line += ` [interactions connues: ${knownInteractions}]`;
      }
      return line;
    });
    sections.push(`## Medicaments prescrits\n${medLines.join("\n")}`);

    // Active treatments
    if (activeTreatments.length > 0) {
      const treatLines = activeTreatments.map(
        (t) => {
          const treatmentDetails = getTreatmentMedicationDetails(t, medicationMap);
          let line = `- id=${t.medicament_externe_id}; nom=${t.nom_medicament}; posologie=${t.posologie}${t.dosage ? ` (${t.dosage})` : ""}`;
          if (treatmentDetails?.nom_generique) {
            line += ` [generique: ${treatmentDetails.nom_generique}]`;
          }
          if (treatmentDetails?.interactions.length) {
            const knownInteractions = treatmentDetails.interactions
              .slice(0, 8)
              .map((interaction) => interaction.medicament_interaction)
              .join("; ");
            line += ` [interactions connues: ${knownInteractions}]`;
          }
          return line;
        },
      );
      sections.push(`## Traitements actifs en cours\n${treatLines.join("\n")}`);
    }

    sections.push(
      `## Format attendu\nRetournez analyses_par_medicament avec exactement ${prescribedMeds.length} entree(s), une pour chaque id de medicament prescrit ci-dessus. Pour un medicament sans anomalie supplementaire, utilisez anomaly: null.`,
    );

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
