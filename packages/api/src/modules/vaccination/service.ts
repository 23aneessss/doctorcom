import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";

import type { SessionUtilisateur } from "../../trpc/context";
import {
  vaccinationRepository,
  type CreateVaccinationInput,
  type UpdateVaccinationInput,
  type VaccinationRecord,
} from "./repo";

type DatabaseClient = typeof databaseClient;
type VaccinationSession = Exclude<SessionUtilisateur, null>;

export interface RecordVaccinationServiceInput {
  patient_id: string;
  vaccin: string;
  date_vaccination: string;
  notes?: string | null;
}

export interface UpdateVaccinationServiceInput {
  vaccin?: string;
  date_vaccination?: string;
  notes?: string | null;
}

export class VaccinationService {
  async recordVaccination(data: {
    db: DatabaseClient;
    session: VaccinationSession;
    input: RecordVaccinationServiceInput;
  }): Promise<VaccinationRecord> {
    this.ensureSession(data.session);
    const payload = this.normalizeCreateVaccinationInput(data.input);
    return vaccinationRepository.createVaccination(data.db, payload);
  }

  async updateVaccination(data: {
    db: DatabaseClient;
    session: VaccinationSession;
    vaccination_id: string;
    input: UpdateVaccinationServiceInput;
  }): Promise<VaccinationRecord> {
    this.ensureSession(data.session);

    const existingVaccination = await vaccinationRepository.getVaccinationById(
      data.db,
      data.vaccination_id,
    );
    if (!existingVaccination) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Vaccination introuvable.",
      });
    }

    const payload = this.normalizeUpdateVaccinationInput(data.input);
    if (Object.keys(payload).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Aucun champ valide fourni pour mettre a jour la vaccination.",
      });
    }

    const updatedVaccination = await vaccinationRepository.updateVaccination(
      data.db,
      data.vaccination_id,
      payload,
    );

    if (!updatedVaccination) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de la mise a jour de la vaccination.",
      });
    }

    return updatedVaccination;
  }

  async deleteVaccination(data: {
    db: DatabaseClient;
    session: VaccinationSession;
    vaccination_id: string;
  }): Promise<{ success: boolean }> {
    this.ensureSession(data.session);

    const existingVaccination = await vaccinationRepository.getVaccinationById(
      data.db,
      data.vaccination_id,
    );
    if (!existingVaccination) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Vaccination introuvable.",
      });
    }

    const isDeleted = await vaccinationRepository.deleteVaccination(
      data.db,
      data.vaccination_id,
    );
    if (!isDeleted) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de suppression de la vaccination.",
      });
    }

    return { success: true };
  }

  async getPatientVaccinations(data: {
    db: DatabaseClient;
    session: VaccinationSession;
    patient_id: string;
  }): Promise<VaccinationRecord[]> {
    this.ensureSession(data.session);
    return vaccinationRepository.getVaccinationsByPatient(data.db, data.patient_id);
  }

  private ensureSession(session: VaccinationSession): void {
    const email = session.user.email.trim();
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Session invalide.",
      });
    }
  }

  private normalizeCreateVaccinationInput(
    input: RecordVaccinationServiceInput,
  ): CreateVaccinationInput {
    const vaccin = input.vaccin.trim();
    if (!vaccin) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Le nom du vaccin est obligatoire.",
      });
    }

    return {
      patient_id: input.patient_id,
      vaccin,
      date_vaccination: input.date_vaccination,
      notes: this.normalizeOptionalText(input.notes),
    };
  }

  private normalizeUpdateVaccinationInput(
    input: UpdateVaccinationServiceInput,
  ): UpdateVaccinationInput {
    const payload: UpdateVaccinationInput = {};

    if (input.vaccin !== undefined) {
      const vaccin = input.vaccin.trim();
      if (!vaccin) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Le nom du vaccin ne peut pas etre vide.",
        });
      }
      payload.vaccin = vaccin;
    }

    if (input.date_vaccination !== undefined) {
      payload.date_vaccination = input.date_vaccination;
    }

    if (input.notes !== undefined) {
      payload.notes = this.normalizeOptionalText(input.notes);
    }

    return payload;
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
}

export const vaccinationService = new VaccinationService();
