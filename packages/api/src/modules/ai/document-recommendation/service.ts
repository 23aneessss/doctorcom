import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";

import { parseModelJson as parseSharedModelJson } from "../shared/json";
import { generateGeminiText, resolveGeminiProvider } from "../shared/provider";
import type { SessionUtilisateur } from "../../../trpc/context";
import {
  orientationLetterOutputSchema,
  certificatOutputSchema,
  type GenerateOrientationLetterInput,
  type GenerateCertificatInput,
  type OrientationLetterOutput,
  type CertificatOutput,
} from "./schema";
import {
  documentRecommendationRepository,
  type AntecedentFamilialRecord,
  type AntecedentPersonnelRecord,
  type AntecedentRecord,
  type PatientFemmeRecord,
  type PatientRecord,
  type SuiviRecord,
  type TreatmentRecord,
  type UtilisateurRecord,
  type VaccinationRecord,
  type VoyageRecentRecord,
} from "./repo";

type DatabaseClient = typeof databaseClient;
type DocumentRecommendationSession = Exclude<SessionUtilisateur, null>;

const providerTimeoutMs = 25000;

const orientationDisclaimer =
  "Brouillon de lettre d'orientation genere par IA. Le medecin doit relire et valider avant signature.";
const certificatDisclaimer =
  "Brouillon de certificat medical genere par IA. Le medecin doit relire et valider avant emission.";

// ---------------------------------------------------------------------------
// Clinical context (shared between both generation methods)
// ---------------------------------------------------------------------------

interface ClinicalContext {
  patient: {
    nom: string;
    prenom: string;
    age: number | null;
    sexe: string | null;
    date_naissance: string;
    profession: string | null;
    groupe_sanguin: string | null;
    adresse: string | null;
    habitudes_saines: string | null;
    habitudes_toxiques: string | null;
    female_context: {
      menopause: boolean | null;
      contraception: string | null;
      nb_grossesses: number | null;
      symptomes_menopause: string | null;
    } | null;
  };
  current_consultation: {
    motif: string;
    hypothese_diagnostic: string | null;
    historique: string | null;
    examens: Array<{
      date: string;
      description_consultation: string | null;
      aspect_general: string | null;
      conclusion: string | null;
      traitement_prescrit: string | null;
      poids: string | null;
      taille: string | null;
    }>;
  };
  antecedents: {
    active_personal: string[];
    family: string[];
  };
  treatments_active: string[];
  recent_travels: string[];
  recent_vaccinations: string[];
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface OrientationLetterResult {
  provider: string;
  model: string;
  generated_at: string;
  source: { patient_id: string; suivi_id: string };
  output: OrientationLetterOutput;
  disclaimer: string;
}

export interface CertificatResult {
  provider: string;
  model: string;
  generated_at: string;
  source: { patient_id: string; suivi_id: string };
  output: CertificatOutput;
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class DocumentRecommendationService {
  // ---- Orientation letter ------------------------------------------------

  async generateOrientationLetter(data: {
    db: DatabaseClient;
    session: DocumentRecommendationSession;
    input: GenerateOrientationLetterInput;
    doctorUserId?: string | null;
  }): Promise<OrientationLetterResult> {
    const provider = resolveGeminiProvider();
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const currentSuivi = await this.resolveAndValidateSuivi(
      data.db,
      data.input.suivi_id,
      utilisateur,
    );
    const patient = await this.resolvePatient(data.db, data.input.patient_id);
    const context = await this.buildClinicalContext(data.db, patient, currentSuivi);

    // Fetch doctor profile to inject exact author information
    const doctor =
      (data.doctorUserId && (await documentRecommendationRepository.getDoctorProfile(data.db, data.doctorUserId))) ||
      {
        nom: utilisateur.nom || "",
        prenom: utilisateur.prenom || "",
        specialite: null,
        adresse: null,
        telephone: null,
      };

    const today = new Date().toLocaleDateString("fr-DZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const doctorContext = [
      "Médecin rédacteur :",
      `- Nom complet : Dr. ${doctor.prenom} ${doctor.nom}`,
      `- Spécialité : ${doctor.specialite ?? "Non spécifiée"}`,
      `- Adresse : ${doctor.adresse ?? "Non spécifiée"}`,
      `- Téléphone : ${doctor.telephone ?? "Non spécifié"}`,
      `- Date du jour : ${today}`,
    ].join("\n");

    const urgenceLabel = this.formatUrgence(data.input.urgence);

    const systemPrompt = [
      "Vous etes un assistant medical specialise dans la redaction de lettres d'orientation medicale en francais.",
      "Vous redigez des lettres professionnelles, precises et conformes aux standards medicaux francais.",
      "Basez-vous UNIQUEMENT sur les donnees cliniques fournies. Ne jamais inventer des informations.",
      "Repondez UNIQUEMENT en JSON valide sans backticks ni markdown.",
      "Le JSON doit contenir: contenu_lettre, raison, examen_demande, urgence.",
      "Utilise exactement les informations du médecin fournies ci-dessus. Ne laisse aucun placeholder comme [Votre Nom] ou [Date du jour] dans le document final.",
    ].join("\n");

    const userPrompt = [doctorContext, "", "Redigez une lettre d'orientation medicale avec les informations suivantes:", "", `Type d'exploration: ${data.input.type_exploration}`, `Examen demande: ${data.input.examen_demande}`, `Destinataire: ${data.input.destinataire}`, `Urgence: ${urgenceLabel}`, data.input.user_instructions ? `Instructions supplementaires du medecin: ${data.input.user_instructions}` : "", "", "Contexte clinique du patient:", JSON.stringify(context)]
      .filter(Boolean)
      .join("\n");

    const response = await generateGeminiText({
      provider,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.2,
      timeoutMs: providerTimeoutMs,
    });

    const parsed = this.parseAndValidateJson(
      response.text,
      orientationLetterOutputSchema,
      "lettre d'orientation",
    );

    return {
      provider: provider.name,
      model: provider.model,
      generated_at: new Date().toISOString(),
      source: { patient_id: patient.id, suivi_id: currentSuivi.id },
      output: parsed,
      disclaimer: orientationDisclaimer,
    };
  }

  // ---- Certificat medical ------------------------------------------------

  async generateCertificat(data: {
    db: DatabaseClient;
    session: DocumentRecommendationSession;
    input: GenerateCertificatInput;
    doctorUserId?: string | null;
  }): Promise<CertificatResult> {
    const provider = resolveGeminiProvider();
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const currentSuivi = await this.resolveAndValidateSuivi(
      data.db,
      data.input.suivi_id,
      utilisateur,
    );
    const patient = await this.resolvePatient(data.db, data.input.patient_id);
    const context = await this.buildClinicalContext(data.db, patient, currentSuivi);

    // Fetch doctor profile to inject exact author information
    const doctor =
      (data.doctorUserId && (await documentRecommendationRepository.getDoctorProfile(data.db, data.doctorUserId))) ||
      {
        nom: utilisateur.nom || "",
        prenom: utilisateur.prenom || "",
        specialite: null,
        adresse: null,
        telephone: null,
      };

    const today = new Date().toLocaleDateString("fr-DZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const doctorContext = [
      "Médecin rédacteur :",
      `- Nom complet : Dr. ${doctor.prenom} ${doctor.nom}`,
      `- Spécialité : ${doctor.specialite ?? "Non spécifiée"}`,
      `- Adresse : ${doctor.adresse ?? "Non spécifiée"}`,
      `- Téléphone : ${doctor.telephone ?? "Non spécifié"}`,
      `- Date du jour : ${today}`,
    ].join("\n");

    const typeLabel = this.formatCertificatType(data.input.type_certificat);

    const systemPrompt = [
      "Vous etes un assistant medical specialise dans la redaction de certificats medicaux en francais.",
      `Redigez un certificat medical professionnel de type: ${typeLabel}.`,
      "Le contenu doit etre factuel, concis et juridiquement approprie selon le droit medical francais.",
      "Basez-vous UNIQUEMENT sur les donnees cliniques fournies. Ne jamais inventer des informations.",
      "Repondez UNIQUEMENT en JSON valide sans backticks ni markdown.",
      "Le JSON doit contenir: contenu_certificat, diagnostic, notes.",
      "Utilise exactement les informations du médecin fournies ci-dessus. Ne laisse aucun placeholder comme [Votre Nom] ou [Date du jour] dans le document final.",
    ].join("\n");

    const userPromptParts = [
      `Redigez un certificat medical de type: ${typeLabel}`,
      "",
    ];

    if (data.input.date_debut) {
      userPromptParts.push(`Date de debut: ${data.input.date_debut}`);
    }
    if (data.input.date_fin) {
      userPromptParts.push(`Date de fin: ${data.input.date_fin}`);
    }
    if (data.input.destinataire) {
      userPromptParts.push(`Destinataire: ${data.input.destinataire}`);
    }
    if (data.input.user_instructions) {
      userPromptParts.push(
        `Instructions supplementaires du medecin: ${data.input.user_instructions}`,
      );
    }

    userPromptParts.push("", "Contexte clinique du patient:", JSON.stringify(context));

    // Prepend the doctor context to the user prompt
    const fullPrompt = [doctorContext, "", ...userPromptParts, "", "Contexte clinique du patient:", JSON.stringify(context)].join("\n");

    const response = await generateGeminiText({
      provider,
      system: systemPrompt,
      prompt: fullPrompt,
      temperature: 0.2,
      timeoutMs: providerTimeoutMs,
    });

    const parsed = this.parseAndValidateJson(
      response.text,
      certificatOutputSchema,
      "certificat medical",
    );

    return {
      provider: provider.name,
      model: provider.model,
      generated_at: new Date().toISOString(),
      source: { patient_id: patient.id, suivi_id: currentSuivi.id },
      output: parsed,
      disclaimer: certificatDisclaimer,
    };
  }

  // ---- Auth & validation helpers -----------------------------------------

  private async resolveUtilisateur(
    db: DatabaseClient,
    session: DocumentRecommendationSession,
  ): Promise<UtilisateurRecord> {
    const email = session.user.email;
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "La session a expiré. Reconnectez-vous.",
      });
    }

    const utilisateur =
      await documentRecommendationRepository.findUtilisateurByEmail(db, email);

    if (!utilisateur) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Le compte associé à cette session est introuvable.",
      });
    }

    return utilisateur;
  }

  private async resolveAndValidateSuivi(
    db: DatabaseClient,
    suiviId: string,
    utilisateur: UtilisateurRecord,
  ): Promise<SuiviRecord> {
    const currentSuivi = await documentRecommendationRepository.getSuiviById(
      db,
      suiviId,
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

    return currentSuivi;
  }

  private async resolvePatient(
    db: DatabaseClient,
    patientId: string,
  ): Promise<PatientRecord> {
    const patient = await documentRecommendationRepository.getPatientById(
      db,
      patientId,
    );

    if (!patient) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Patient introuvable." });
    }

    return patient;
  }

  // ---- Clinical context builder ------------------------------------------

  private async buildClinicalContext(
    db: DatabaseClient,
    patient: PatientRecord,
    currentSuivi: SuiviRecord,
  ): Promise<ClinicalContext> {
    const [
      femaleInfo,
      antecedentRecords,
      activeTreatments,
      examens,
      recentTravels,
      recentVaccinations,
    ] = await Promise.all([
      documentRecommendationRepository.getFemalePatientInfo(db, patient.id),
      documentRecommendationRepository.getAntecedentsByPatient(db, patient.id),
      documentRecommendationRepository.getActiveTreatmentsByPatient(db, patient.id, 10),
      documentRecommendationRepository.getAllExamensBySuivi(db, currentSuivi.id),
      documentRecommendationRepository.getRecentVoyagesByPatient(db, patient.id, 5),
      documentRecommendationRepository.getRecentVaccinationsByPatient(db, patient.id, 5),
    ]);

    const antecedentIds = antecedentRecords.map((r) => r.id);
    const [personalAntecedents, familyAntecedents] = await Promise.all([
      documentRecommendationRepository.getPersonalAntecedentsByAntecedentIds(
        db,
        antecedentIds,
      ),
      documentRecommendationRepository.getFamilyAntecedentsByAntecedentIds(
        db,
        antecedentIds,
      ),
    ]);

    const antecedentById = new Map<string, AntecedentRecord>(
      antecedentRecords.map((r) => [r.id, r]),
    );

    return {
      patient: {
        nom: patient.nom,
        prenom: patient.prenom,
        age: this.computeAge(patient.date_naissance),
        sexe: this.nt(patient.sexe),
        date_naissance: patient.date_naissance,
        profession: this.nt(patient.profession),
        groupe_sanguin: this.nt(patient.groupe_sanguin),
        adresse: this.nt(patient.adresse),
        habitudes_saines: this.nt(patient.habitudes_saines),
        habitudes_toxiques: this.nt(patient.habitudes_toxiques),
        female_context: this.buildFemaleContext(femaleInfo),
      },
      current_consultation: {
        motif: currentSuivi.motif,
        hypothese_diagnostic: this.nt(currentSuivi.hypothese_diagnostic),
        historique: this.nt(currentSuivi.historique),
        examens: examens.map((e) => ({
          date: e.date,
          description_consultation: this.nt(e.description_consultation),
          aspect_general: this.nt(e.aspect_general),
          conclusion: this.nt(e.conclusion),
          traitement_prescrit: this.nt(e.traitement_prescrit),
          poids: e.poids ? String(e.poids) : null,
          taille: e.taille ? String(e.taille) : null,
        })),
      },
      antecedents: {
        active_personal: this.buildActivePersonalLabels(
          antecedentById,
          personalAntecedents,
        ),
        family: this.buildFamilyLabels(antecedentById, familyAntecedents),
      },
      treatments_active: this.buildTreatmentLabels(activeTreatments),
      recent_travels: this.buildTravelLabels(recentTravels),
      recent_vaccinations: this.buildVaccinationLabels(recentVaccinations),
    };
  }

  // ---- Label builders (same pattern as hypothese-diagnostic) -------------

  private buildFemaleContext(
    info: PatientFemmeRecord | null,
  ): ClinicalContext["patient"]["female_context"] {
    if (!info) return null;
    return {
      menopause: info.menopause ?? null,
      contraception: this.nt(info.contraception),
      nb_grossesses: info.nb_grossesses ?? null,
      symptomes_menopause: this.nt(info.symptomes_menopause),
    };
  }

  private buildActivePersonalLabels(
    byId: Map<string, AntecedentRecord>,
    records: AntecedentPersonnelRecord[],
  ): string[] {
    return records
      .filter((r) => r.est_actif)
      .map((r) => {
        const base = byId.get(r.antecedent_id);
        return [base?.description, r.type, r.details]
          .map((v) => this.nt(v))
          .filter(Boolean)
          .join(" | ");
      })
      .filter(Boolean);
  }

  private buildFamilyLabels(
    byId: Map<string, AntecedentRecord>,
    records: AntecedentFamilialRecord[],
  ): string[] {
    return records
      .map((r) => {
        const base = byId.get(r.antecedent_id);
        return [
          base?.description,
          r.lien_parente ? `Lien: ${r.lien_parente}` : null,
          r.details,
        ]
          .map((v) => this.nt(v))
          .filter(Boolean)
          .join(" | ");
      })
      .filter(Boolean);
  }

  private buildTreatmentLabels(treatments: TreatmentRecord[]): string[] {
    return treatments
      .map((r) =>
        [r.nom_medicament, r.dosage, r.posologie, r.est_actif ? "Actif" : "Inactif"]
          .map((v) => this.nt(v))
          .filter(Boolean)
          .join(" | "),
      )
      .filter(Boolean);
  }

  private buildTravelLabels(travels: VoyageRecentRecord[]): string[] {
    return travels
      .map((r) =>
        [
          r.destination,
          r.date ? `Date: ${r.date}` : null,
          r.duree_jours != null ? `Duree: ${r.duree_jours} jours` : null,
          r.epidemies_destination,
        ]
          .map((v) => this.nt(v))
          .filter(Boolean)
          .join(" | "),
      )
      .filter(Boolean);
  }

  private buildVaccinationLabels(vaccinations: VaccinationRecord[]): string[] {
    return vaccinations
      .map((r) =>
        [r.vaccin, r.date_vaccination ? `Date: ${r.date_vaccination}` : null, r.notes]
          .map((v) => this.nt(v))
          .filter(Boolean)
          .join(" | "),
      )
      .filter(Boolean);
  }

  // ---- JSON parsing with safety wrapper ----------------------------------

  private parseAndValidateJson<T>(
    rawText: string,
    schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
    documentLabel: string,
  ): T {
    const parsed = parseSharedModelJson(rawText.trim());

    if (!parsed) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `La reponse du modele pour le ${documentLabel} n'a pas pu etre interpretee comme JSON.`,
      });
    }

    const validation = schema.safeParse(parsed);

    if (!validation.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `La reponse du modele pour le ${documentLabel} est incomplete ou incoherente.`,
      });
    }

    return validation.data;
  }

  // ---- Formatting helpers ------------------------------------------------

  private formatUrgence(value: string): string {
    const map: Record<string, string> = {
      normale: "Normale",
      urgente: "Urgente",
      tres_urgente: "Très urgente",
    };
    return map[value] ?? value;
  }

  private formatCertificatType(value: string): string {
    const map: Record<string, string> = {
      arret_travail: "Arrêt de travail",
      aptitude: "Certificat d'aptitude",
      scolaire: "Certificat scolaire",
      grossesse: "Certificat de grossesse",
      deces: "Certificat de décès",
    };
    return map[value] ?? value;
  }

  // ---- Utility methods ---------------------------------------------------

  private computeAge(dateNaissance: string | null): number | null {
    if (!dateNaissance) return null;
    const birthDate = new Date(`${dateNaissance}T00:00:00.000Z`);
    if (Number.isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
    const mDiff = today.getUTCMonth() - birthDate.getUTCMonth();
    const dDiff = today.getUTCDate() - birthDate.getUTCDate();
    if (mDiff < 0 || (mDiff === 0 && dDiff < 0)) age -= 1;
    return age;
  }

  /** Nullable-text shorthand used throughout the class. */
  private nt(value: string | null | undefined): string | null {
    const v = value?.trim();
    return v ? v : null;
  }
}

export const documentRecommendationService = new DocumentRecommendationService();
