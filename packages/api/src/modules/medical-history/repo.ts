import type { db as databaseClient } from "@doctor.com/db";
import {
  antecedents,
  antecedents_familiaux,
  antecedents_personnels,
} from "@doctor.com/db/schema";
import { asc, eq } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;
type TransactionClient = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];
export type QueryClient = DatabaseClient | TransactionClient;

type NewAntecedentRecord = typeof antecedents.$inferInsert;
type NewPersonalAntecedentRecord = typeof antecedents_personnels.$inferInsert;
type NewFamilyAntecedentRecord = typeof antecedents_familiaux.$inferInsert;

export type AntecedentRecord = typeof antecedents.$inferSelect;
export type PersonalAntecedentRecord = typeof antecedents_personnels.$inferSelect;
export type FamilyAntecedentRecord = typeof antecedents_familiaux.$inferSelect;

export interface CreateAntecedentInput {
  patient_id: string;
  type: AntecedentRecord["type"];
  description: string;
}

export interface UpdateAntecedentInput {
  type?: AntecedentRecord["type"];
  description?: string;
}

export interface CreatePersonalAntecedentInput {
  antecedent_id: string;
  type: string;
  details?: string | null;
  est_actif?: boolean;
}

export interface UpdatePersonalAntecedentInput {
  type?: string;
  details?: string | null;
  est_actif?: boolean;
}

export interface CreateFamilyAntecedentInput {
  antecedent_id: string;
  details?: string | null;
  lien_parente?: string | null;
}

export interface UpdateFamilyAntecedentInput {
  details?: string | null;
  lien_parente?: string | null;
}

export class MedicalHistoryRepository {
  async createAntecedent(
    database: QueryClient,
    input: CreateAntecedentInput,
  ): Promise<AntecedentRecord> {
    const values: NewAntecedentRecord = {
      patient_id: input.patient_id,
      type: input.type,
      description: input.description,
    };

    const [createdAntecedent] = await database.insert(antecedents).values(values).returning();

    if (!createdAntecedent) {
      throw new Error("Echec de creation de l'antecedent.");
    }

    return createdAntecedent;
  }

  async updateAntecedent(
    database: QueryClient,
    antecedentId: string,
    input: UpdateAntecedentInput,
  ): Promise<AntecedentRecord | null> {
    const updateData: UpdateAntecedentInput = {};

    if (input.type !== undefined) {
      updateData.type = input.type;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getAntecedentById(database, antecedentId);
    }

    const [updatedAntecedent] = await database
      .update(antecedents)
      .set(updateData)
      .where(eq(antecedents.id, antecedentId))
      .returning();

    return updatedAntecedent ?? null;
  }

  async deleteAntecedent(database: QueryClient, antecedentId: string): Promise<boolean> {
    const [deletedAntecedent] = await database
      .delete(antecedents)
      .where(eq(antecedents.id, antecedentId))
      .returning({ id: antecedents.id });

    return Boolean(deletedAntecedent);
  }

  async getAntecedentById(
    database: QueryClient,
    antecedentId: string,
  ): Promise<AntecedentRecord | null> {
    const [antecedent] = await database
      .select()
      .from(antecedents)
      .where(eq(antecedents.id, antecedentId))
      .limit(1);

    return antecedent ?? null;
  }

  async getAntecedentsByPatient(
    database: QueryClient,
    patientId: string,
  ): Promise<AntecedentRecord[]> {
    return database
      .select()
      .from(antecedents)
      .where(eq(antecedents.patient_id, patientId))
      .orderBy(asc(antecedents.type), asc(antecedents.description));
  }

  async createPersonalAntecedent(
    database: QueryClient,
    input: CreatePersonalAntecedentInput,
  ): Promise<PersonalAntecedentRecord> {
    const values: NewPersonalAntecedentRecord = {
      antecedent_id: input.antecedent_id,
      type: input.type,
      details: input.details ?? null,
      est_actif: input.est_actif ?? true,
    };

    const [createdPersonalAntecedent] = await database
      .insert(antecedents_personnels)
      .values(values)
      .returning();

    if (!createdPersonalAntecedent) {
      throw new Error("Echec de creation de l'antecedent personnel.");
    }

    return createdPersonalAntecedent;
  }

  async updatePersonalAntecedent(
    database: QueryClient,
    personalAntecedentId: string,
    input: UpdatePersonalAntecedentInput,
  ): Promise<PersonalAntecedentRecord | null> {
    const updateData: UpdatePersonalAntecedentInput = {};

    if (input.type !== undefined) {
      updateData.type = input.type;
    }
    if (input.details !== undefined) {
      updateData.details = input.details;
    }
    if (input.est_actif !== undefined) {
      updateData.est_actif = input.est_actif;
    }

    if (Object.keys(updateData).length === 0) {
      const [personalAntecedent] = await database
        .select()
        .from(antecedents_personnels)
        .where(eq(antecedents_personnels.id, personalAntecedentId))
        .limit(1);
      return personalAntecedent ?? null;
    }

    const [updatedPersonalAntecedent] = await database
      .update(antecedents_personnels)
      .set(updateData)
      .where(eq(antecedents_personnels.id, personalAntecedentId))
      .returning();

    return updatedPersonalAntecedent ?? null;
  }

  async markPersonalAntecedentInactive(
    database: QueryClient,
    personalAntecedentId: string,
  ): Promise<PersonalAntecedentRecord | null> {
    const [updatedPersonalAntecedent] = await database
      .update(antecedents_personnels)
      .set({ est_actif: false })
      .where(eq(antecedents_personnels.id, personalAntecedentId))
      .returning();

    return updatedPersonalAntecedent ?? null;
  }

  async getPersonalAntecedentsByAntecedent(
    database: QueryClient,
    antecedentId: string,
  ): Promise<PersonalAntecedentRecord[]> {
    return database
      .select()
      .from(antecedents_personnels)
      .where(eq(antecedents_personnels.antecedent_id, antecedentId))
      .orderBy(asc(antecedents_personnels.type), asc(antecedents_personnels.id));
  }

  async createFamilyAntecedent(
    database: QueryClient,
    input: CreateFamilyAntecedentInput,
  ): Promise<FamilyAntecedentRecord> {
    const values: NewFamilyAntecedentRecord = {
      antecedent_id: input.antecedent_id,
      details: input.details ?? null,
      lien_parente: input.lien_parente ?? null,
    };

    const [createdFamilyAntecedent] = await database
      .insert(antecedents_familiaux)
      .values(values)
      .returning();

    if (!createdFamilyAntecedent) {
      throw new Error("Echec de creation de l'antecedent familial.");
    }

    return createdFamilyAntecedent;
  }

  async updateFamilyAntecedent(
    database: QueryClient,
    familyAntecedentId: string,
    input: UpdateFamilyAntecedentInput,
  ): Promise<FamilyAntecedentRecord | null> {
    const updateData: UpdateFamilyAntecedentInput = {};

    if (input.details !== undefined) {
      updateData.details = input.details;
    }
    if (input.lien_parente !== undefined) {
      updateData.lien_parente = input.lien_parente;
    }

    if (Object.keys(updateData).length === 0) {
      const [familyAntecedent] = await database
        .select()
        .from(antecedents_familiaux)
        .where(eq(antecedents_familiaux.id, familyAntecedentId))
        .limit(1);
      return familyAntecedent ?? null;
    }

    const [updatedFamilyAntecedent] = await database
      .update(antecedents_familiaux)
      .set(updateData)
      .where(eq(antecedents_familiaux.id, familyAntecedentId))
      .returning();

    return updatedFamilyAntecedent ?? null;
  }

  async getFamilyAntecedentsByAntecedent(
    database: QueryClient,
    antecedentId: string,
  ): Promise<FamilyAntecedentRecord[]> {
    return database
      .select()
      .from(antecedents_familiaux)
      .where(eq(antecedents_familiaux.antecedent_id, antecedentId))
      .orderBy(asc(antecedents_familiaux.lien_parente), asc(antecedents_familiaux.id));
  }

  async deletePersonalAntecedentsByAntecedent(
    database: QueryClient,
    antecedentId: string,
  ): Promise<number> {
    const deletedAntecedents = await database
      .delete(antecedents_personnels)
      .where(eq(antecedents_personnels.antecedent_id, antecedentId))
      .returning({ id: antecedents_personnels.id });

    return deletedAntecedents.length;
  }

  async deleteFamilyAntecedentsByAntecedent(
    database: QueryClient,
    antecedentId: string,
  ): Promise<number> {
    const deletedAntecedents = await database
      .delete(antecedents_familiaux)
      .where(eq(antecedents_familiaux.antecedent_id, antecedentId))
      .returning({ id: antecedents_familiaux.id });

    return deletedAntecedents.length;
  }
}

export const medicalHistoryRepository = new MedicalHistoryRepository();
