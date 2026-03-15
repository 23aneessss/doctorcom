import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";

import type { SessionUtilisateur } from "../../trpc/context";
import {
  consultationRepository,
  type CreateExamenInput,
  type CreateSuiviInput,
  type ExamenConsultationRecord,
  type SuiviRecord,
  type UpdateExamenInput,
  type UpdateSuiviInput,
  type UtilisateurRecord,
} from "./repo";

type DatabaseClient = typeof databaseClient;
type ConsultationSession = Exclude<SessionUtilisateur, null>;

export interface CreateSuiviServiceInput {
  patient_id: string;
  hypothese_diagnostic?: string | null;
  motif: string;
  historique?: string | null;
  date_ouverture: string;
}

export interface UpdateSuiviServiceInput {
  hypothese_diagnostic?: string | null;
  motif?: string;
  historique?: string | null;
  date_ouverture?: string;
  date_fermeture?: string | null;
  est_actif?: boolean;
}

export interface CreateExamenServiceInput {
  rendez_vous_id: string;
  suivi_id: string;
  date: string;
  taille?: string | null;
  poids?: string | null;
  traitement_prescrit?: string | null;
  description_consultation?: string | null;
  aspect_general?: string | null;
  examen_respiratoire?: string | null;
  examen_cardiovasculaire?: string | null;
  examen_cutane_muqueux?: string | null;
  examen_orl?: string | null;
  examen_digestif?: string | null;
  examen_neurologique?: string | null;
  examen_locomoteur?: string | null;
  examen_genital?: string | null;
  examen_urinaire?: string | null;
  examen_ganglionnaire?: string | null;
  examen_endocrinien?: string | null;
  conclusion?: string | null;
}

export interface UpdateExamenServiceInput {
  date?: string;
  taille?: string | null;
  poids?: string | null;
  traitement_prescrit?: string | null;
  description_consultation?: string | null;
  aspect_general?: string | null;
  examen_respiratoire?: string | null;
  examen_cardiovasculaire?: string | null;
  examen_cutane_muqueux?: string | null;
  examen_orl?: string | null;
  examen_digestif?: string | null;
  examen_neurologique?: string | null;
  examen_locomoteur?: string | null;
  examen_genital?: string | null;
  examen_urinaire?: string | null;
  examen_ganglionnaire?: string | null;
  examen_endocrinien?: string | null;
  conclusion?: string | null;
}

export class ConsultationService {
  async createSuivi(data: {
    db: DatabaseClient;
    session: ConsultationSession;
    input: CreateSuiviServiceInput;
  }): Promise<SuiviRecord> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const input = this.normalizeCreateSuiviInput(data.input);

    const payload: CreateSuiviInput = {
      patient_id: input.patient_id,
      utilisateur_id: utilisateur.id,
      hypothese_diagnostic: input.hypothese_diagnostic ?? null,
      motif: input.motif,
      historique: input.historique ?? null,
      date_ouverture: input.date_ouverture,
      est_actif: true,
    };

    return consultationRepository.createSuivi(data.db, payload);
  }

  async updateSuivi(data: {
    db: DatabaseClient;
    session: ConsultationSession;
    suivi_id: string;
    input: UpdateSuiviServiceInput;
  }): Promise<SuiviRecord> {
    await this.resolveUtilisateur(data.db, data.session);

    const existingSuivi = await consultationRepository.getSuiviById(
      data.db,
      data.suivi_id,
    );
    if (!existingSuivi) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Suivi introuvable.",
      });
    }

    const normalizedInput = this.normalizeUpdateSuiviInput(data.input);
    if (Object.keys(normalizedInput).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Aucun champ valide fourni pour mettre a jour le suivi.",
      });
    }

    const updatedSuivi = await consultationRepository.updateSuivi(
      data.db,
      data.suivi_id,
      normalizedInput,
    );

    if (!updatedSuivi) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de la mise a jour du suivi.",
      });
    }

    return updatedSuivi;
  }

  async closeSuivi(data: {
    db: DatabaseClient;
    session: ConsultationSession;
    suivi_id: string;
    date_fermeture?: string;
  }): Promise<SuiviRecord> {
    await this.resolveUtilisateur(data.db, data.session);

    const existingSuivi = await consultationRepository.getSuiviById(
      data.db,
      data.suivi_id,
    );
    if (!existingSuivi) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Suivi introuvable.",
      });
    }

    const dateFermeture = data.date_fermeture ?? this.getCurrentIsoDate();
    const closedSuivi = await consultationRepository.closeSuivi(
      data.db,
      data.suivi_id,
      dateFermeture,
    );

    if (!closedSuivi) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de la fermeture du suivi.",
      });
    }

    return closedSuivi;
  }

  async getPatientSuivis(data: {
    db: DatabaseClient;
    session: ConsultationSession;
    patient_id: string;
  }): Promise<SuiviRecord[]> {
    await this.resolveUtilisateur(data.db, data.session);
    return consultationRepository.getSuivisByPatient(data.db, data.patient_id);
  }

  async getActiveSuivis(data: {
    db: DatabaseClient;
    session: ConsultationSession;
    patient_id: string;
  }): Promise<SuiviRecord[]> {
    await this.resolveUtilisateur(data.db, data.session);
    return consultationRepository.getActiveSuivisByPatient(data.db, data.patient_id);
  }

  async createExamen(data: {
    db: DatabaseClient;
    session: ConsultationSession;
    input: CreateExamenServiceInput;
  }): Promise<ExamenConsultationRecord> {
    await this.resolveUtilisateur(data.db, data.session);

    const existingSuivi = await consultationRepository.getSuiviById(
      data.db,
      data.input.suivi_id,
    );
    if (!existingSuivi) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Impossible de creer un examen: suivi introuvable.",
      });
    }

    const payload = this.normalizeCreateExamenInput(data.input);
    return consultationRepository.createExamen(data.db, payload);
  }

  async updateExamen(data: {
    db: DatabaseClient;
    session: ConsultationSession;
    examen_id: string;
    input: UpdateExamenServiceInput;
  }): Promise<ExamenConsultationRecord> {
    await this.resolveUtilisateur(data.db, data.session);

    const existingExamen = await consultationRepository.getExamenById(
      data.db,
      data.examen_id,
    );
    if (!existingExamen) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Examen de consultation introuvable.",
      });
    }

    const normalizedInput = this.normalizeUpdateExamenInput(data.input);
    if (Object.keys(normalizedInput).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Aucun champ valide fourni pour mettre a jour l'examen.",
      });
    }

    const updatedExamen = await consultationRepository.updateExamen(
      data.db,
      data.examen_id,
      normalizedInput,
    );

    if (!updatedExamen) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de la mise a jour de l'examen de consultation.",
      });
    }

    return updatedExamen;
  }

  async getExamensSuivi(data: {
    db: DatabaseClient;
    session: ConsultationSession;
    suivi_id: string;
  }): Promise<ExamenConsultationRecord[]> {
    await this.resolveUtilisateur(data.db, data.session);

    const existingSuivi = await consultationRepository.getSuiviById(
      data.db,
      data.suivi_id,
    );
    if (!existingSuivi) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Suivi introuvable.",
      });
    }

    return consultationRepository.getExamensBySuivi(data.db, data.suivi_id);
  }

  async getExamensPatient(data: {
    db: DatabaseClient;
    session: ConsultationSession;
    patient_id: string;
  }): Promise<ExamenConsultationRecord[]> {
    await this.resolveUtilisateur(data.db, data.session);
    return consultationRepository.getExamensByPatient(data.db, data.patient_id);
  }

  private resolveSessionEmail(session: ConsultationSession): string {
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
    session: ConsultationSession,
  ): Promise<UtilisateurRecord> {
    const email = this.resolveSessionEmail(session);
    const utilisateur = await consultationRepository.findUtilisateurByEmail(
      database,
      email,
    );

    if (!utilisateur) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Utilisateur connecte introuvable.",
      });
    }

    return utilisateur;
  }

  private normalizeCreateSuiviInput(input: CreateSuiviServiceInput): CreateSuiviServiceInput {
    const motif = input.motif.trim();
    if (!motif) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Le motif du suivi est obligatoire.",
      });
    }

    return {
      patient_id: input.patient_id,
      hypothese_diagnostic: this.normalizeOptionalText(input.hypothese_diagnostic),
      motif,
      historique: this.normalizeOptionalText(input.historique),
      date_ouverture: input.date_ouverture,
    };
  }

  private normalizeUpdateSuiviInput(input: UpdateSuiviServiceInput): UpdateSuiviInput {
    const normalized: UpdateSuiviInput = {};

    if (input.hypothese_diagnostic !== undefined) {
      normalized.hypothese_diagnostic = this.normalizeOptionalText(input.hypothese_diagnostic);
    }
    if (input.motif !== undefined) {
      const motif = input.motif.trim();
      if (!motif) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Le motif du suivi ne peut pas etre vide.",
        });
      }
      normalized.motif = motif;
    }
    if (input.historique !== undefined) {
      normalized.historique = this.normalizeOptionalText(input.historique);
    }
    if (input.date_ouverture !== undefined) {
      normalized.date_ouverture = input.date_ouverture;
    }
    if (input.date_fermeture !== undefined) {
      normalized.date_fermeture = input.date_fermeture;
    }
    if (input.est_actif !== undefined) {
      normalized.est_actif = input.est_actif;
    }

    return normalized;
  }

  private normalizeCreateExamenInput(input: CreateExamenServiceInput): CreateExamenInput {
    return {
      rendez_vous_id: input.rendez_vous_id,
      suivi_id: input.suivi_id,
      date: input.date,
      taille: this.normalizeOptionalNumeric(input.taille),
      poids: this.normalizeOptionalNumeric(input.poids),
      traitement_prescrit: this.normalizeOptionalText(input.traitement_prescrit),
      description_consultation: this.normalizeOptionalText(input.description_consultation),
      aspect_general: this.normalizeOptionalText(input.aspect_general),
      examen_respiratoire: this.normalizeOptionalText(input.examen_respiratoire),
      examen_cardiovasculaire: this.normalizeOptionalText(input.examen_cardiovasculaire),
      examen_cutane_muqueux: this.normalizeOptionalText(input.examen_cutane_muqueux),
      examen_orl: this.normalizeOptionalText(input.examen_orl),
      examen_digestif: this.normalizeOptionalText(input.examen_digestif),
      examen_neurologique: this.normalizeOptionalText(input.examen_neurologique),
      examen_locomoteur: this.normalizeOptionalText(input.examen_locomoteur),
      examen_genital: this.normalizeOptionalText(input.examen_genital),
      examen_urinaire: this.normalizeOptionalText(input.examen_urinaire),
      examen_ganglionnaire: this.normalizeOptionalText(input.examen_ganglionnaire),
      examen_endocrinien: this.normalizeOptionalText(input.examen_endocrinien),
      conclusion: this.normalizeOptionalText(input.conclusion),
    };
  }

  private normalizeUpdateExamenInput(input: UpdateExamenServiceInput): UpdateExamenInput {
    const normalized: UpdateExamenInput = {};

    if (input.date !== undefined) {
      normalized.date = input.date;
    }
    if (input.taille !== undefined) {
      normalized.taille = this.normalizeOptionalNumeric(input.taille);
    }
    if (input.poids !== undefined) {
      normalized.poids = this.normalizeOptionalNumeric(input.poids);
    }
    if (input.traitement_prescrit !== undefined) {
      normalized.traitement_prescrit = this.normalizeOptionalText(input.traitement_prescrit);
    }
    if (input.description_consultation !== undefined) {
      normalized.description_consultation = this.normalizeOptionalText(
        input.description_consultation,
      );
    }
    if (input.aspect_general !== undefined) {
      normalized.aspect_general = this.normalizeOptionalText(input.aspect_general);
    }
    if (input.examen_respiratoire !== undefined) {
      normalized.examen_respiratoire = this.normalizeOptionalText(input.examen_respiratoire);
    }
    if (input.examen_cardiovasculaire !== undefined) {
      normalized.examen_cardiovasculaire = this.normalizeOptionalText(
        input.examen_cardiovasculaire,
      );
    }
    if (input.examen_cutane_muqueux !== undefined) {
      normalized.examen_cutane_muqueux = this.normalizeOptionalText(
        input.examen_cutane_muqueux,
      );
    }
    if (input.examen_orl !== undefined) {
      normalized.examen_orl = this.normalizeOptionalText(input.examen_orl);
    }
    if (input.examen_digestif !== undefined) {
      normalized.examen_digestif = this.normalizeOptionalText(input.examen_digestif);
    }
    if (input.examen_neurologique !== undefined) {
      normalized.examen_neurologique = this.normalizeOptionalText(input.examen_neurologique);
    }
    if (input.examen_locomoteur !== undefined) {
      normalized.examen_locomoteur = this.normalizeOptionalText(input.examen_locomoteur);
    }
    if (input.examen_genital !== undefined) {
      normalized.examen_genital = this.normalizeOptionalText(input.examen_genital);
    }
    if (input.examen_urinaire !== undefined) {
      normalized.examen_urinaire = this.normalizeOptionalText(input.examen_urinaire);
    }
    if (input.examen_ganglionnaire !== undefined) {
      normalized.examen_ganglionnaire = this.normalizeOptionalText(input.examen_ganglionnaire);
    }
    if (input.examen_endocrinien !== undefined) {
      normalized.examen_endocrinien = this.normalizeOptionalText(input.examen_endocrinien);
    }
    if (input.conclusion !== undefined) {
      normalized.conclusion = this.normalizeOptionalText(input.conclusion);
    }

    return normalized;
  }

  private normalizeOptionalText(value: string | null | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeOptionalNumeric(value: string | null | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private getCurrentIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }
}

export const consultationService = new ConsultationService();
