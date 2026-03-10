import type { db as databaseClient } from "@doctor.com/db";
import { vaccinations_patient } from "@doctor.com/db/schema";
import { desc, eq } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;
type NewVaccinationRecord = typeof vaccinations_patient.$inferInsert;

export type VaccinationRecord = typeof vaccinations_patient.$inferSelect;

export interface CreateVaccinationInput {
  patient_id: string;
  vaccin: string;
  date_vaccination: string;
  notes?: string | null;
}

export interface UpdateVaccinationInput {
  vaccin?: string;
  date_vaccination?: string;
  notes?: string | null;
}

export class VaccinationRepository {
  async createVaccination(
    database: DatabaseClient,
    input: CreateVaccinationInput,
  ): Promise<VaccinationRecord> {
    const values: NewVaccinationRecord = {
      patient_id: input.patient_id,
      vaccin: input.vaccin,
      date_vaccination: input.date_vaccination,
      notes: input.notes ?? null,
    };

    const [createdVaccination] = await database
      .insert(vaccinations_patient)
      .values(values)
      .returning();

    if (!createdVaccination) {
      throw new Error("Echec d'enregistrement de la vaccination.");
    }

    return createdVaccination;
  }

  async updateVaccination(
    database: DatabaseClient,
    vaccinationId: string,
    input: UpdateVaccinationInput,
  ): Promise<VaccinationRecord | null> {
    const updateData: UpdateVaccinationInput = {};

    if (input.vaccin !== undefined) {
      updateData.vaccin = input.vaccin;
    }
    if (input.date_vaccination !== undefined) {
      updateData.date_vaccination = input.date_vaccination;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getVaccinationById(database, vaccinationId);
    }

    const [updatedVaccination] = await database
      .update(vaccinations_patient)
      .set(updateData)
      .where(eq(vaccinations_patient.id, vaccinationId))
      .returning();

    return updatedVaccination ?? null;
  }

  async deleteVaccination(
    database: DatabaseClient,
    vaccinationId: string,
  ): Promise<boolean> {
    const [deletedVaccination] = await database
      .delete(vaccinations_patient)
      .where(eq(vaccinations_patient.id, vaccinationId))
      .returning({ id: vaccinations_patient.id });

    return Boolean(deletedVaccination);
  }

  async getVaccinationById(
    database: DatabaseClient,
    vaccinationId: string,
  ): Promise<VaccinationRecord | null> {
    const [vaccination] = await database
      .select()
      .from(vaccinations_patient)
      .where(eq(vaccinations_patient.id, vaccinationId))
      .limit(1);

    return vaccination ?? null;
  }

  async getVaccinationsByPatient(
    database: DatabaseClient,
    patientId: string,
  ): Promise<VaccinationRecord[]> {
    return database
      .select()
      .from(vaccinations_patient)
      .where(eq(vaccinations_patient.patient_id, patientId))
      .orderBy(desc(vaccinations_patient.date_vaccination));
  }
}

export const vaccinationRepository = new VaccinationRepository();
