import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";

import type { SessionUtilisateur } from "../../trpc/context";
import { medicamentsService } from "../medicaments/service";
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
  medicament_externe_id: string;
  dosage?: string | null;
  posologie: string;
  date_prescription: string;
  est_actif?: boolean;
}

export interface UpdateTreatmentServiceInput {
  medicament_externe_id?: string;
  dosage?: string | null;
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
    const payload = await this.normalizeCreateInput(data.input, utilisateur.id);
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

    if (existingTreatment.source_type === "ordonnance") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Les traitements derives d'une ordonnance se gerent depuis le module ordonnance.",
      });
    }

    const payload = await this.normalizeUpdateInput(data.input);
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

    if (existingTreatment.source_type === "ordonnance") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Les traitements derives d'une ordonnance se gerent depuis le module ordonnance.",
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

  private async normalizeCreateInput(
    input: StartTreatmentServiceInput,
    utilisateurId: string,
  ): Promise<CreateTreatmentInput> {
    const posologie = input.posologie.trim();
    if (!posologie) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "La posologie est obligatoire.",
      });
    }

    const snapshot = await this.resolveMedicamentSnapshot(input.medicament_externe_id);

    return {
      patient_id: input.patient_id,
      medicament_externe_id: snapshot.medicament_externe_id,
      nom_medicament: snapshot.nom_medicament,
      dosage: input.dosage?.trim() || null,
      posologie,
      date_prescription: input.date_prescription,
      prescrit_par_utilisateur: utilisateurId,
      est_actif: input.est_actif ?? true,
      source_type: "manuel",
    };
  }

  private async normalizeUpdateInput(
    input: UpdateTreatmentServiceInput,
  ): Promise<UpdateTreatmentInput> {
    const payload: UpdateTreatmentInput = {};

    if (input.medicament_externe_id !== undefined) {
      const snapshot = await this.resolveMedicamentSnapshot(input.medicament_externe_id);
      payload.medicament_externe_id = snapshot.medicament_externe_id;
      payload.nom_medicament = snapshot.nom_medicament;
    }

    if (input.dosage !== undefined) {
      payload.dosage = input.dosage?.trim() || null;
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

  private async resolveMedicamentSnapshot(medicamentExterneId: string) {
    const parsedId = Number.parseInt(medicamentExterneId.trim(), 10);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "medicament_externe_id invalide.",
      });
    }

    return medicamentsService.getMedicamentSnapshot(parsedId);
  }
}

export const treatmentService = new TreatmentService();
