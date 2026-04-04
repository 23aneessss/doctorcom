import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";

import type { SessionUtilisateur } from "../../trpc/context";
import {
  patientRepository,
  type CreateFemalePatientInfoInput,
  type CreatePatientInput,
  type ExamenConsultationRecord,
  type PatientFemmeRecord,
  type PatientRecord,
  type SearchPatientsCriteria,
  type UpdateFemalePatientInfoInput,
  type UpdatePatientInput,
  type UtilisateurRecord,
} from "./repo";

type DatabaseClient = typeof databaseClient;
type PatientSession = Exclude<SessionUtilisateur, null>;

type CreatePatientData = Omit<CreatePatientInput, "cree_par_utilisateur" | "revenu_mensuel"> & {
  revenu_mensuel?: string | number | null;
};

export interface FemalePatientInfoInput {
  menarche?: number | null;
  regularite_cycles?: string | null;
  contraception?: string | null;
  nb_grossesses?: number | null;
  nb_cesariennes?: number | null;
  menopause?: boolean | null;
  age_menopause?: number | null;
  symptomes_menopause?: string | null;
}

export interface CreatePatientServiceInput {
  patient: CreatePatientData;
  female_data?: FemalePatientInfoInput;
}

export interface UpdatePatientServiceInput {
  id: string;
  data: Partial<CreatePatientData> & {
    female_data?: FemalePatientInfoInput;
  };
}

export interface SearchPatientsServiceInput {
  nom?: string;
  prenom?: string;
  matricule?: string;
  nss?: number;
  telephone?: string;
  sexe?: string;
}

export class PatientService {
  async createPatient(data: {
    db: DatabaseClient;
    session: PatientSession;
    input: CreatePatientServiceInput;
  }): Promise<PatientRecord & { female_info: PatientFemmeRecord | null }> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);

    await this.ensureNoMatriculeConflict(data.db, data.input.patient.matricule);
    await this.ensureNoNssConflict(data.db, data.input.patient.nss);

    this.ensureAgeCirconcisionRule(data.input.patient.sexe, data.input.patient.age_circoncision);

    const patientPayload: CreatePatientInput = {
      ...data.input.patient,
      revenu_mensuel: this.normalizeNumericValue(data.input.patient.revenu_mensuel),
      cree_par_utilisateur: utilisateur.id,
    };

    const patient = await patientRepository.createPatient(data.db, patientPayload);
    const femaleInfo = await this.handleFemaleInfoForCreate(data.db, patient, data.input.female_data);

    return {
      ...patient,
      female_info: femaleInfo,
    };
  }

  async updatePatient(data: {
    db: DatabaseClient;
    session: PatientSession;
    input: UpdatePatientServiceInput;
  }): Promise<PatientRecord & { female_info: PatientFemmeRecord | null }> {
    await this.resolveUtilisateur(data.db, data.session);

    const existingPatient = await patientRepository.getPatientById(data.db, data.input.id);
    if (!existingPatient) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Patient introuvable.",
      });
    }

    const { female_data, ...patientData } = data.input.data;
    const effectiveSexe = patientData.sexe ?? existingPatient.sexe;

    this.ensureAgeCirconcisionRule(effectiveSexe, patientData.age_circoncision);

    if (
      patientData.matricule !== undefined &&
      patientData.matricule !== existingPatient.matricule
    ) {
      await this.ensureNoMatriculeConflict(data.db, patientData.matricule, existingPatient.id);
    }

    if (patientData.nss !== undefined && patientData.nss !== existingPatient.nss) {
      await this.ensureNoNssConflict(data.db, patientData.nss, existingPatient.id);
    }

    const normalizedPatientData = this.normalizePatientUpdatePayload(patientData);
    const updatedPatient = await patientRepository.updatePatient(
      data.db,
      existingPatient.id,
      normalizedPatientData,
    );

    if (!updatedPatient) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de mise a jour du patient.",
      });
    }

    const femaleInfo = await this.handleFemaleInfoForUpdate(
      data.db,
      updatedPatient,
      effectiveSexe,
      female_data,
    );

    return {
      ...updatedPatient,
      female_info: femaleInfo,
    };
  }

  async deletePatient(data: {
    db: DatabaseClient;
    session: PatientSession;
    id: string;
  }): Promise<{ success: boolean }> {
    await this.resolveUtilisateur(data.db, data.session);

    const existingPatient = await patientRepository.getPatientById(data.db, data.id);
    if (!existingPatient) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Patient introuvable.",
      });
    }

    try {
      const deleted = await data.db.transaction(async (tx) => {
        await patientRepository.deleteFemalePatientInfo(tx, data.id);
        return patientRepository.deletePatient(tx, data.id);
      });

      if (!deleted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Echec de suppression du patient.",
        });
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Impossible de supprimer ce patient: des donnees liees existent encore dans le systeme.",
      });
    }

    return { success: true };
  }

  async getPatientById(data: {
    db: DatabaseClient;
    session: PatientSession;
    id: string;
  }): Promise<PatientRecord & { female_info: PatientFemmeRecord | null }> {
    await this.resolveUtilisateur(data.db, data.session);

    const patient = await patientRepository.getPatientById(data.db, data.id);
    if (!patient) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Patient introuvable.",
      });
    }

    const femaleInfo = this.isFemaleSexe(patient.sexe)
      ? await patientRepository.getFemalePatientInfo(data.db, patient.id)
      : null;

    return {
      ...patient,
      female_info: femaleInfo,
    };
  }

  async getPatientByMatricule(data: {
    db: DatabaseClient;
    session: PatientSession;
    matricule: string;
  }): Promise<PatientRecord> {
    await this.resolveUtilisateur(data.db, data.session);

    const patient = await patientRepository.getPatientByMatricule(data.db, data.matricule);
    if (!patient) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Patient introuvable.",
      });
    }

    return patient;
  }

  async searchPatients(data: {
    db: DatabaseClient;
    session: PatientSession;
    criteres: SearchPatientsServiceInput;
  }): Promise<PatientRecord[]> {
    await this.resolveUtilisateur(data.db, data.session);

    const criteres: SearchPatientsCriteria = {
      nom: this.normalizeOptionalText(data.criteres.nom) ?? undefined,
      prenom: this.normalizeOptionalText(data.criteres.prenom) ?? undefined,
      matricule: this.normalizeOptionalText(data.criteres.matricule) ?? undefined,
      nss: data.criteres.nss,
      telephone: this.normalizeOptionalText(data.criteres.telephone) ?? undefined,
      sexe: this.normalizeOptionalText(data.criteres.sexe) ?? undefined,
    };

    return patientRepository.searchPatients(data.db, criteres);
  }

  async getPatientFullRecord(data: {
    db: DatabaseClient;
    session: PatientSession;
    id: string;
  }): Promise<{
    patient: PatientRecord & { female_info: PatientFemmeRecord | null };
    antecedents: Awaited<ReturnType<typeof patientRepository.getPatientAntecedents>>;
    vaccinations: Awaited<ReturnType<typeof patientRepository.getPatientVaccinations>>;
    rendez_vous: Awaited<ReturnType<typeof patientRepository.getPatientRendezVous>>;
    suivi: Awaited<ReturnType<typeof patientRepository.getPatientSuivis>>;
    ordonnances: Awaited<ReturnType<typeof patientRepository.getPatientOrdonnances>>;
    documents: Awaited<ReturnType<typeof patientRepository.getPatientDocuments>>;
    voyages: Awaited<ReturnType<typeof patientRepository.getPatientVoyages>>;
  }> {
    const patient = await this.getPatientById({
      db: data.db,
      session: data.session,
      id: data.id,
    });

    const [antecedents, vaccinations, rendezVous, suivis, ordonnances, documents, voyages] =
      await Promise.all([
        patientRepository.getPatientAntecedents(data.db, data.id),
        patientRepository.getPatientVaccinations(data.db, data.id),
        patientRepository.getPatientRendezVous(data.db, data.id),
        patientRepository.getPatientSuivis(data.db, data.id),
        patientRepository.getPatientOrdonnances(data.db, data.id),
        patientRepository.getPatientDocuments(data.db, data.id),
        patientRepository.getPatientVoyages(data.db, data.id),
      ]);

    return {
      patient,
      antecedents,
      vaccinations,
      rendez_vous: rendezVous,
      suivi: suivis,
      ordonnances,
      documents,
      voyages,
    };
  }

  async getPatientAge(data: {
    db: DatabaseClient;
    session: PatientSession;
    id: string;
  }): Promise<{ age: number }> {
    const patient = await this.getPatientById({
      db: data.db,
      session: data.session,
      id: data.id,
    });

    return { age: this.calculateAge(patient.date_naissance) };
  }

  async getPatientIMC(data: {
    db: DatabaseClient;
    session: PatientSession;
    id: string;
  }): Promise<{ imc: number; taille_m: number; poids_kg: number; examen: ExamenConsultationRecord }> {
    await this.getPatientById({
      db: data.db,
      session: data.session,
      id: data.id,
    });

    const examen = await patientRepository.getPatientLastExamen(data.db, data.id);
    if (!examen || examen.taille === null || examen.poids === null) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Aucun examen avec taille et poids n'a ete trouve pour ce patient.",
      });
    }

    const taille = this.parseNumeric(examen.taille);
    const poids = this.parseNumeric(examen.poids);

    if (taille <= 0 || poids <= 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Les valeurs de taille et de poids de l'examen sont invalides.",
      });
    }

    const tailleM = taille > 3 ? taille / 100 : taille;
    const imc = poids / (tailleM * tailleM);

    return {
      imc: Number(imc.toFixed(2)),
      taille_m: Number(tailleM.toFixed(3)),
      poids_kg: Number(poids.toFixed(2)),
      examen,
    };
  }

  async getPatientUpcomingAppointments(data: {
    db: DatabaseClient;
    session: PatientSession;
    id: string;
  }): Promise<Awaited<ReturnType<typeof patientRepository.getPatientRendezVous>>> {
    await this.getPatientById({
      db: data.db,
      session: data.session,
      id: data.id,
    });

    const rendezVous = await patientRepository.getPatientRendezVous(data.db, data.id);
    const today = new Date().toISOString().slice(0, 10);

    return rendezVous
      .filter(
        (item) =>
          (item.statut === "planifie" || item.statut === "confirme") && item.date >= today,
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getPatientClinicalProfile(data: {
    db: DatabaseClient;
    session: PatientSession;
    id: string;
  }): Promise<{
    patient: PatientRecord & { female_info: PatientFemmeRecord | null };
    age: number;
    imc: number | null;
    antecedents: Awaited<ReturnType<typeof patientRepository.getPatientAntecedents>>;
    last_examen: ExamenConsultationRecord | null;
    upcoming_appointments: Awaited<ReturnType<typeof patientRepository.getPatientRendezVous>>;
  }> {
    const patient = await this.getPatientById({
      db: data.db,
      session: data.session,
      id: data.id,
    });

    const [ageResult, antecedents, lastExamen, upcomingAppointments] = await Promise.all([
      this.getPatientAge({
        db: data.db,
        session: data.session,
        id: data.id,
      }),
      patientRepository.getPatientAntecedents(data.db, data.id),
      patientRepository.getPatientLastExamen(data.db, data.id),
      this.getPatientUpcomingAppointments({
        db: data.db,
        session: data.session,
        id: data.id,
      }),
    ]);

    let imc: number | null = null;
    if (lastExamen && lastExamen.taille !== null && lastExamen.poids !== null) {
      const taille = this.parseNumeric(lastExamen.taille);
      const poids = this.parseNumeric(lastExamen.poids);
      if (taille > 0 && poids > 0) {
        const tailleM = taille > 3 ? taille / 100 : taille;
        imc = Number((poids / (tailleM * tailleM)).toFixed(2));
      }
    }

    return {
      patient,
      age: ageResult.age,
      imc,
      antecedents,
      last_examen: lastExamen,
      upcoming_appointments: upcomingAppointments,
    };
  }

  private async resolveUtilisateur(
    database: DatabaseClient,
    session: PatientSession,
  ): Promise<UtilisateurRecord> {
    const email = session.user.email.trim();
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Session invalide.",
      });
    }

    const utilisateur = await patientRepository.findUtilisateurByEmail(database, email);
    if (!utilisateur) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Utilisateur introuvable pour la session active.",
      });
    }

    return utilisateur;
  }

  private async ensureNoMatriculeConflict(
    database: DatabaseClient,
    matricule: string,
    excludedPatientId?: string,
  ): Promise<void> {
    const existingPatient = await patientRepository.getPatientByMatricule(database, matricule);
    if (existingPatient && existingPatient.id !== excludedPatientId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Un patient avec ce matricule existe deja.",
      });
    }
  }

  private async ensureNoNssConflict(
    database: DatabaseClient,
    nss: number | null | undefined,
    excludedPatientId?: string,
  ): Promise<void> {
    if (nss === undefined || nss === null) {
      return;
    }

    const hasConflict = await patientRepository.hasNssConflict(database, nss, excludedPatientId);
    if (hasConflict) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Un patient avec ce NSS existe deja.",
      });
    }
  }

  private ensureAgeCirconcisionRule(
    sexe: string | null | undefined,
    ageCirconcision: number | null | undefined,
  ): void {
    if (ageCirconcision === undefined || ageCirconcision === null) {
      return;
    }

    if (this.isFemaleSexe(sexe)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Le champ age_circoncision est reserve aux patients masculins.",
      });
    }
  }

  private async handleFemaleInfoForCreate(
    database: DatabaseClient,
    patient: PatientRecord,
    femaleData: FemalePatientInfoInput | undefined,
  ): Promise<PatientFemmeRecord | null> {
    if (!this.isFemaleSexe(patient.sexe) || !femaleData) {
      return null;
    }

    const payload: CreateFemalePatientInfoInput = {
      patient_id: patient.id,
      ...this.normalizeFemaleData(femaleData),
    };

    return patientRepository.createFemalePatientInfo(database, payload);
  }

  private async handleFemaleInfoForUpdate(
    database: DatabaseClient,
    patient: PatientRecord,
    effectiveSexe: string | null | undefined,
    femaleData: FemalePatientInfoInput | undefined,
  ): Promise<PatientFemmeRecord | null> {
    if (!this.isFemaleSexe(effectiveSexe)) {
      return null;
    }

    const existingFemaleInfo = await patientRepository.getFemalePatientInfo(database, patient.id);
    if (!femaleData) {
      return existingFemaleInfo;
    }

    const normalizedFemaleData = this.normalizeFemaleData(femaleData);

    if (existingFemaleInfo) {
      const updated = await patientRepository.updateFemalePatientInfo(
        database,
        patient.id,
        normalizedFemaleData,
      );
      return updated ?? existingFemaleInfo;
    }

    const payload: CreateFemalePatientInfoInput = {
      patient_id: patient.id,
      ...normalizedFemaleData,
    };

    return patientRepository.createFemalePatientInfo(database, payload);
  }

  private normalizeFemaleData(data: FemalePatientInfoInput): UpdateFemalePatientInfoInput {
    const payload: UpdateFemalePatientInfoInput = {};

    if (data.menarche !== undefined) {
      payload.menarche = data.menarche;
    }
    if (data.regularite_cycles !== undefined) {
      payload.regularite_cycles = this.normalizeOptionalText(data.regularite_cycles);
    }
    if (data.contraception !== undefined) {
      payload.contraception = this.normalizeOptionalText(data.contraception);
    }
    if (data.nb_grossesses !== undefined) {
      payload.nb_grossesses = data.nb_grossesses;
    }
    if (data.nb_cesariennes !== undefined) {
      payload.nb_cesariennes = data.nb_cesariennes;
    }
    if (data.menopause !== undefined) {
      payload.menopause = data.menopause;
    }
    if (data.age_menopause !== undefined) {
      payload.age_menopause = data.age_menopause;
    }
    if (data.symptomes_menopause !== undefined) {
      payload.symptomes_menopause = this.normalizeOptionalText(data.symptomes_menopause);
    }

    return payload;
  }

  private normalizePatientUpdatePayload(
    data: Partial<CreatePatientData>,
  ): UpdatePatientInput {
    const payload: UpdatePatientInput = {};

    if (data.nom !== undefined) {
      payload.nom = data.nom;
    }
    if (data.prenom !== undefined) {
      payload.prenom = data.prenom;
    }
    if (data.telephone !== undefined) {
      payload.telephone = data.telephone;
    }
    if (data.email !== undefined) {
      payload.email = data.email;
    }
    if (data.matricule !== undefined) {
      payload.matricule = data.matricule;
    }
    if (data.date_naissance !== undefined) {
      payload.date_naissance = data.date_naissance;
    }
    if (data.nss !== undefined) {
      payload.nss = data.nss;
    }
    if (data.lieu_naissance !== undefined) {
      payload.lieu_naissance = data.lieu_naissance;
    }
    if (data.sexe !== undefined) {
      payload.sexe = data.sexe;
    }
    if (data.nationalite !== undefined) {
      payload.nationalite = data.nationalite;
    }
    if (data.groupe_sanguin !== undefined) {
      payload.groupe_sanguin = data.groupe_sanguin;
    }
    if (data.adresse !== undefined) {
      payload.adresse = data.adresse;
    }
    if (data.profession !== undefined) {
      payload.profession = data.profession;
    }
    if (data.habitudes_saines !== undefined) {
      payload.habitudes_saines = data.habitudes_saines;
    }
    if (data.habitudes_toxiques !== undefined) {
      payload.habitudes_toxiques = data.habitudes_toxiques;
    }
    if (data.nb_enfants !== undefined) {
      payload.nb_enfants = data.nb_enfants;
    }
    if (data.situation_familiale !== undefined) {
      payload.situation_familiale = data.situation_familiale;
    }
    if (data.age_circoncision !== undefined) {
      payload.age_circoncision = data.age_circoncision;
    }
    if (data.date_admission !== undefined) {
      payload.date_admission = data.date_admission;
    }
    if (data.environnement_animal !== undefined) {
      payload.environnement_animal = data.environnement_animal;
    }
    if (data.revenu_mensuel !== undefined) {
      payload.revenu_mensuel = this.normalizeNumericValue(data.revenu_mensuel);
    }
    if (data.taille_menage !== undefined) {
      payload.taille_menage = data.taille_menage;
    }
    if (data.nb_pieces !== undefined) {
      payload.nb_pieces = data.nb_pieces;
    }
    if (data.niveau_intellectuel !== undefined) {
      payload.niveau_intellectuel = data.niveau_intellectuel;
    }
    if (data.activite_sexuelle !== undefined) {
      payload.activite_sexuelle = data.activite_sexuelle;
    }
    if (data.relations_environnement !== undefined) {
      payload.relations_environnement = data.relations_environnement;
    }

    return payload;
  }

  private isFemaleSexe(sexe: string | null | undefined): boolean {
    return (sexe ?? "").trim().toLowerCase() === "feminin";
  }

  private normalizeOptionalText(value: string | null | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private calculateAge(dateNaissance: string): number {
    const birthDate = new Date(`${dateNaissance}T00:00:00.000Z`);
    const now = new Date();

    let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
    const monthDelta = now.getUTCMonth() - birthDate.getUTCMonth();
    if (
      monthDelta < 0 ||
      (monthDelta === 0 && now.getUTCDate() < birthDate.getUTCDate())
    ) {
      age -= 1;
    }

    return age;
  }

  private parseNumeric(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Valeur numerique invalide dans le dernier examen.",
      });
    }

    return parsed;
  }

  private normalizeNumericValue(
    value: string | number | null | undefined,
  ): string | null | undefined {
    if (value === undefined || value === null) {
      return value;
    }

    return typeof value === "number" ? String(value) : value;
  }
}

export const patientService = new PatientService();
