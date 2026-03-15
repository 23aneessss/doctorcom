import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";

import type { SessionUtilisateur } from "../../trpc/context";
import {
  treatmentRepository,
  type CreateTreatmentInput,
  type TreatmentRecord,
  type UpdateTreatmentInput,
  type UtilisateurRecord,
} from "./repo";

type DatabaseClient = typeof databaseClient;
type TreatmentSession = Exclude<SessionUtilisateur, null>;

export interface StartTreatmentServiceInput {
  patient_id: string;
  medicament_id: string;
  posologie: string;
  date_prescription: string;
  est_actif?: boolean;
}

export interface UpdateTreatmentServiceInput {
  medicament_id?: string;
  posologie?: string;
  date_prescription?: string;
  est_actif?: boolean;
}

export class TreatmentService {
  async startTreatment(data: {
    db: DatabaseClient;
    session: TreatmentSession;
    input: StartTreatmentServiceInput;
  }): Promise<TreatmentRecord> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const payload = this.normalizeCreateInput(data.input, utilisateur.id);
    return treatmentRepository.createTreatment(data.db, payload);
  }

  async updateTreatment(data: {
    db: DatabaseClient;
    session: TreatmentSession;
    treatment_id: string;
    input: UpdateTreatmentServiceInput;
  }): Promise<TreatmentRecord> {
    await this.resolveUtilisateur(data.db, data.session);

    const existingTreatment = await treatmentRepository.getTreatmentById(
      data.db,
      data.treatment_id,
    );
    if (!existingTreatment) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Traitement introuvable.",
      });
    }

    const payload = this.normalizeUpdateInput(data.input);
    if (Object.keys(payload).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Aucun champ valide fourni pour mettre a jour le traitement.",
      });
    }

    const updatedTreatment = await treatmentRepository.updateTreatment(
      data.db,
      data.treatment_id,
      payload,
    );

    if (!updatedTreatment) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de la mise a jour du traitement.",
      });
    }

    return updatedTreatment;
  }

  async stopTreatment(data: {
    db: DatabaseClient;
    session: TreatmentSession;
    treatment_id: string;
  }): Promise<TreatmentRecord> {
    await this.resolveUtilisateur(data.db, data.session);

    const existingTreatment = await treatmentRepository.getTreatmentById(
      data.db,
      data.treatment_id,
    );
    if (!existingTreatment) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Traitement introuvable.",
      });
    }

    const stoppedTreatment = await treatmentRepository.stopTreatment(
      data.db,
      data.treatment_id,
    );
    if (!stoppedTreatment) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de l'arret du traitement.",
      });
    }

    return stoppedTreatment;
  }

  async getPatientTreatments(data: {
    db: DatabaseClient;
    session: TreatmentSession;
    patient_id: string;
  }): Promise<TreatmentRecord[]> {
    await this.resolveUtilisateur(data.db, data.session);
    return treatmentRepository.getTreatmentsByPatient(data.db, data.patient_id);
  }

  async getActivePatientTreatments(data: {
    db: DatabaseClient;
    session: TreatmentSession;
    patient_id: string;
  }): Promise<TreatmentRecord[]> {
    await this.resolveUtilisateur(data.db, data.session);
    return treatmentRepository.getActiveTreatmentsByPatient(data.db, data.patient_id);
  }

  private async resolveUtilisateur(
    database: DatabaseClient,
    session: TreatmentSession,
  ): Promise<UtilisateurRecord> {
    const email = this.resolveSessionEmail(session);
    const utilisateur = await treatmentRepository.findUtilisateurByEmail(database, email);

    if (!utilisateur) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Utilisateur introuvable pour la session courante.",
      });
    }

    return utilisateur;
  }

  private resolveSessionEmail(session: TreatmentSession): string {
    const email = session.user.email.trim().toLowerCase();
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Session invalide: email utilisateur manquant.",
      });
    }
    return email;
  }

  private normalizeCreateInput(
    input: StartTreatmentServiceInput,
    utilisateurId: string,
  ): CreateTreatmentInput {
    const posologie = input.posologie.trim();
    if (!posologie) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "La posologie est obligatoire.",
      });
    }

    return {
      patient_id: input.patient_id,
      medicament_id: input.medicament_id,
      posologie,
      date_prescription: input.date_prescription,
      prescrit_par_utilisateur: utilisateurId,
      est_actif: input.est_actif ?? true,
    };
  }

  private normalizeUpdateInput(input: UpdateTreatmentServiceInput): UpdateTreatmentInput {
    const payload: UpdateTreatmentInput = {};

    if (input.medicament_id !== undefined) {
      payload.medicament_id = input.medicament_id;
    }

    if (input.posologie !== undefined) {
      const posologie = input.posologie.trim();
      if (!posologie) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La posologie ne peut pas etre vide.",
        });
      }
      payload.posologie = posologie;
    }

    if (input.date_prescription !== undefined) {
      payload.date_prescription = input.date_prescription;
    }

    if (input.est_actif !== undefined) {
      payload.est_actif = input.est_actif;
    }

    return payload;
  }
}

export const treatmentService = new TreatmentService();
