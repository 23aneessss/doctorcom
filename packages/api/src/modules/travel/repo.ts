import type { db as databaseClient } from "@doctor.com/db";
import { voyages_recents } from "@doctor.com/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;
type NewVoyageRecord = typeof voyages_recents.$inferInsert;

export type VoyageRecord = typeof voyages_recents.$inferSelect;

export interface CreateVoyageInput {
  patient_id: string;
  destination: string;
  date: string;
  duree_jours?: number | null;
  epidemies_destination?: string | null;
}

export interface UpdateVoyageInput {
  destination?: string;
  date?: string;
  duree_jours?: number | null;
  epidemies_destination?: string | null;
}

export class TravelRepository {
  async createVoyage(
    database: DatabaseClient,
    input: CreateVoyageInput,
  ): Promise<VoyageRecord> {
    const values: NewVoyageRecord = {
      patient_id: input.patient_id,
      destination: input.destination,
      date: input.date,
      duree_jours: input.duree_jours ?? null,
      epidemies_destination: input.epidemies_destination ?? null,
    };

    const [createdVoyage] = await database
      .insert(voyages_recents)
      .values(values)
      .returning();

    if (!createdVoyage) {
      throw new Error("Echec de creation du voyage recent.");
    }

    return createdVoyage;
  }

  async updateVoyage(
    database: DatabaseClient,
    voyageId: string,
    input: UpdateVoyageInput,
  ): Promise<VoyageRecord | null> {
    const updateData: UpdateVoyageInput = {};

    if (input.destination !== undefined) {
      updateData.destination = input.destination;
    }
    if (input.date !== undefined) {
      updateData.date = input.date;
    }
    if (input.duree_jours !== undefined) {
      updateData.duree_jours = input.duree_jours;
    }
    if (input.epidemies_destination !== undefined) {
      updateData.epidemies_destination = input.epidemies_destination;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getVoyageById(database, voyageId);
    }

    const [updatedVoyage] = await database
      .update(voyages_recents)
      .set(updateData)
      .where(eq(voyages_recents.id, voyageId))
      .returning();

    return updatedVoyage ?? null;
  }

  async deleteVoyage(database: DatabaseClient, voyageId: string): Promise<boolean> {
    const [deletedVoyage] = await database
      .delete(voyages_recents)
      .where(eq(voyages_recents.id, voyageId))
      .returning({ id: voyages_recents.id });

    return Boolean(deletedVoyage);
  }

  async getVoyageById(
    database: DatabaseClient,
    voyageId: string,
  ): Promise<VoyageRecord | null> {
    const [voyage] = await database
      .select()
      .from(voyages_recents)
      .where(eq(voyages_recents.id, voyageId))
      .limit(1);

    return voyage ?? null;
  }

  async getVoyagesByPatient(
    database: DatabaseClient,
    patientId: string,
  ): Promise<VoyageRecord[]> {
    return database
      .select()
      .from(voyages_recents)
      .where(eq(voyages_recents.patient_id, patientId))
      .orderBy(desc(voyages_recents.date));
  }

  async getRecentVoyagesByPatient(
    database: DatabaseClient,
    patientId: string,
    sinceDate: string,
  ): Promise<VoyageRecord[]> {
    return database
      .select()
      .from(voyages_recents)
      .where(
        and(
          eq(voyages_recents.patient_id, patientId),
          gte(voyages_recents.date, sinceDate),
        ),
      )
      .orderBy(desc(voyages_recents.date));
  }
}

export const travelRepository = new TravelRepository();
