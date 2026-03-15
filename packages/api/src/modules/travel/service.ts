import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";

import type { SessionUtilisateur } from "../../trpc/context";
import {
  travelRepository,
  type CreateVoyageInput,
  type UpdateVoyageInput,
  type VoyageRecord,
} from "./repo";

type DatabaseClient = typeof databaseClient;
type TravelSession = Exclude<SessionUtilisateur, null>;

export interface CreateVoyageServiceInput {
  patient_id: string;
  destination: string;
  date: string;
  duree_jours?: number | null;
  epidemies_destination?: string | null;
}

export interface UpdateVoyageServiceInput {
  destination?: string;
  date?: string;
  duree_jours?: number | null;
  epidemies_destination?: string | null;
}

export class TravelService {
  async createVoyage(data: {
    db: DatabaseClient;
    session: TravelSession;
    input: CreateVoyageServiceInput;
  }): Promise<VoyageRecord> {
    this.ensureSession(data.session);
    const payload = this.normalizeCreateVoyageInput(data.input);
    return travelRepository.createVoyage(data.db, payload);
  }

  async updateVoyage(data: {
    db: DatabaseClient;
    session: TravelSession;
    voyage_id: string;
    input: UpdateVoyageServiceInput;
  }): Promise<VoyageRecord> {
    this.ensureSession(data.session);

    const existingVoyage = await travelRepository.getVoyageById(data.db, data.voyage_id);
    if (!existingVoyage) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Voyage recent introuvable.",
      });
    }

    const payload = this.normalizeUpdateVoyageInput(data.input);
    if (Object.keys(payload).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Aucun champ valide fourni pour mettre a jour le voyage.",
      });
    }

    const updatedVoyage = await travelRepository.updateVoyage(
      data.db,
      data.voyage_id,
      payload,
    );

    if (!updatedVoyage) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de la mise a jour du voyage recent.",
      });
    }

    return updatedVoyage;
  }

  async deleteVoyage(data: {
    db: DatabaseClient;
    session: TravelSession;
    voyage_id: string;
  }): Promise<{ success: boolean }> {
    this.ensureSession(data.session);

    const existingVoyage = await travelRepository.getVoyageById(data.db, data.voyage_id);
    if (!existingVoyage) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Voyage recent introuvable.",
      });
    }

    const isDeleted = await travelRepository.deleteVoyage(data.db, data.voyage_id);
    if (!isDeleted) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de suppression du voyage recent.",
      });
    }

    return { success: true };
  }

  async getPatientVoyages(data: {
    db: DatabaseClient;
    session: TravelSession;
    patient_id: string;
  }): Promise<VoyageRecord[]> {
    this.ensureSession(data.session);
    return travelRepository.getVoyagesByPatient(data.db, data.patient_id);
  }

  async getRecentPatientVoyages(data: {
    db: DatabaseClient;
    session: TravelSession;
    patient_id: string;
    recent_days?: number;
  }): Promise<VoyageRecord[]> {
    this.ensureSession(data.session);

    const days = data.recent_days ?? 90;
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Le nombre de jours doit etre un entier entre 1 et 3650.",
      });
    }

    const sinceDate = this.getIsoDateBefore(days);
    return travelRepository.getRecentVoyagesByPatient(data.db, data.patient_id, sinceDate);
  }

  private ensureSession(session: TravelSession): void {
    const email = session.user.email.trim();
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Session invalide.",
      });
    }
  }

  private normalizeCreateVoyageInput(input: CreateVoyageServiceInput): CreateVoyageInput {
    const destination = input.destination.trim();
    if (!destination) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "La destination est obligatoire.",
      });
    }

    return {
      patient_id: input.patient_id,
      destination,
      date: input.date,
      duree_jours: input.duree_jours ?? null,
      epidemies_destination: this.normalizeOptionalText(input.epidemies_destination),
    };
  }

  private normalizeUpdateVoyageInput(input: UpdateVoyageServiceInput): UpdateVoyageInput {
    const payload: UpdateVoyageInput = {};

    if (input.destination !== undefined) {
      const destination = input.destination.trim();
      if (!destination) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La destination ne peut pas etre vide.",
        });
      }
      payload.destination = destination;
    }

    if (input.date !== undefined) {
      payload.date = input.date;
    }
    if (input.duree_jours !== undefined) {
      payload.duree_jours = input.duree_jours;
    }
    if (input.epidemies_destination !== undefined) {
      payload.epidemies_destination = this.normalizeOptionalText(input.epidemies_destination);
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

  private getIsoDateBefore(days: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  }
}

export const travelService = new TravelService();
