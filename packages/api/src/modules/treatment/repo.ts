import type { db as databaseClient } from "@doctor.com/db";
import { historique_traitements, utilisateurs } from "@doctor.com/db/schema";
import { and, desc, eq } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;
type NewTreatmentRecord = typeof historique_traitements.$inferInsert;

export type TreatmentRecord = typeof historique_traitements.$inferSelect;
export type UtilisateurRecord = typeof utilisateurs.$inferSelect;

export interface CreateTreatmentInput {
  patient_id: string;
  medicament_id: string;
  posologie: string;
  date_prescription: string;
  prescrit_par_utilisateur: string;
  est_actif?: boolean;
}

export interface UpdateTreatmentInput {
  medicament_id?: string;
  posologie?: string;
  date_prescription?: string;
  est_actif?: boolean;
}

export class TreatmentRepository {
  async findUtilisateurByEmail(
    database: DatabaseClient,
    email: string,
  ): Promise<UtilisateurRecord | null> {
    const [utilisateur] = await database
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.email, email))
      .limit(1);

    return utilisateur ?? null;
  }

  async createTreatment(
    database: DatabaseClient,
    input: CreateTreatmentInput,
  ): Promise<TreatmentRecord> {
    const values: NewTreatmentRecord = {
      patient_id: input.patient_id,
      medicament_id: input.medicament_id,
      posologie: input.posologie,
      est_actif: input.est_actif ?? true,
      date_prescription: input.date_prescription,
      prescrit_par_utilisateur: input.prescrit_par_utilisateur,
    };

    const [createdTreatment] = await database
      .insert(historique_traitements)
      .values(values)
      .returning();

    if (!createdTreatment) {
      throw new Error("Echec de creation du traitement.");
    }

    return createdTreatment;
  }

  async updateTreatment(
    database: DatabaseClient,
    treatmentId: string,
    input: UpdateTreatmentInput,
  ): Promise<TreatmentRecord | null> {
    const updateData: UpdateTreatmentInput = {};

    if (input.medicament_id !== undefined) {
      updateData.medicament_id = input.medicament_id;
    }
    if (input.posologie !== undefined) {
      updateData.posologie = input.posologie;
    }
    if (input.date_prescription !== undefined) {
      updateData.date_prescription = input.date_prescription;
    }
    if (input.est_actif !== undefined) {
      updateData.est_actif = input.est_actif;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getTreatmentById(database, treatmentId);
    }

    const [updatedTreatment] = await database
      .update(historique_traitements)
      .set(updateData)
      .where(eq(historique_traitements.id, treatmentId))
      .returning();

    return updatedTreatment ?? null;
  }

  async stopTreatment(
    database: DatabaseClient,
    treatmentId: string,
  ): Promise<TreatmentRecord | null> {
    const [stoppedTreatment] = await database
      .update(historique_traitements)
      .set({ est_actif: false })
      .where(eq(historique_traitements.id, treatmentId))
      .returning();

    return stoppedTreatment ?? null;
  }

  async getTreatmentById(
    database: DatabaseClient,
    treatmentId: string,
  ): Promise<TreatmentRecord | null> {
    const [treatment] = await database
      .select()
      .from(historique_traitements)
      .where(eq(historique_traitements.id, treatmentId))
      .limit(1);

    return treatment ?? null;
  }

  async getTreatmentsByPatient(
    database: DatabaseClient,
    patientId: string,
  ): Promise<TreatmentRecord[]> {
    return database
      .select()
      .from(historique_traitements)
      .where(eq(historique_traitements.patient_id, patientId))
      .orderBy(desc(historique_traitements.date_prescription));
  }

  async getActiveTreatmentsByPatient(
    database: DatabaseClient,
    patientId: string,
  ): Promise<TreatmentRecord[]> {
    return database
      .select()
      .from(historique_traitements)
      .where(
        and(
          eq(historique_traitements.patient_id, patientId),
          eq(historique_traitements.est_actif, true),
        ),
      )
      .orderBy(desc(historique_traitements.date_prescription));
  }
}

export const treatmentRepository = new TreatmentRepository();
