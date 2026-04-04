import type { db as databaseClient } from "@doctor.com/db";
import { historique_traitements, utilisateurs } from "@doctor.com/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";

type RootDatabaseClient = typeof databaseClient;
type DatabaseTransaction = Parameters<Parameters<RootDatabaseClient["transaction"]>[0]>[0];
type DatabaseClient = RootDatabaseClient | DatabaseTransaction;
type NewTreatmentRecord = typeof historique_traitements.$inferInsert;

export type TreatmentRecord = typeof historique_traitements.$inferSelect;
export type UtilisateurRecord = typeof utilisateurs.$inferSelect;
export type TreatmentSourceType = TreatmentRecord["source_type"];

export interface CreateTreatmentInput {
  patient_id: string;
  medicament_externe_id: string;
  nom_medicament: string;
  dosage?: string | null;
  posologie: string;
  date_prescription: string;
  prescrit_par_utilisateur: string;
  est_actif?: boolean;
  source_type?: TreatmentSourceType;
  ordonnance_id?: string | null;
  ordonnance_medicament_id?: string | null;
}

export interface UpdateTreatmentInput {
  medicament_externe_id?: string;
  nom_medicament?: string;
  dosage?: string | null;
  posologie?: string;
  date_prescription?: string;
  est_actif?: boolean;
  ordonnance_id?: string | null;
  ordonnance_medicament_id?: string | null;
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
      medicament_externe_id: input.medicament_externe_id,
      nom_medicament: input.nom_medicament,
      dosage: input.dosage ?? null,
      posologie: input.posologie,
      est_actif: input.est_actif ?? true,
      date_prescription: input.date_prescription,
      prescrit_par_utilisateur: input.prescrit_par_utilisateur,
      source_type: input.source_type ?? "manuel",
      ordonnance_id: input.ordonnance_id ?? null,
      ordonnance_medicament_id: input.ordonnance_medicament_id ?? null,
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
    if (Object.keys(input).length === 0) {
      return this.getTreatmentById(database, treatmentId);
    }

    const [updatedTreatment] = await database
      .update(historique_traitements)
      .set(input)
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

  async stopTreatmentsByOrdonnanceId(
    database: DatabaseClient,
    ordonnanceId: string,
  ): Promise<TreatmentRecord[]> {
    return database
      .update(historique_traitements)
      .set({ est_actif: false })
      .where(eq(historique_traitements.ordonnance_id, ordonnanceId))
      .returning();
  }

  async detachTreatmentsByOrdonnanceId(
    database: DatabaseClient,
    ordonnanceId: string,
  ): Promise<TreatmentRecord[]> {
    return database
      .update(historique_traitements)
      .set({
        est_actif: false,
        ordonnance_id: null,
        ordonnance_medicament_id: null,
      })
      .where(eq(historique_traitements.ordonnance_id, ordonnanceId))
      .returning();
  }

  async updateTreatmentsByOrdonnanceId(
    database: DatabaseClient,
    ordonnanceId: string,
    input: Partial<
      Pick<TreatmentRecord, "patient_id" | "date_prescription" | "prescrit_par_utilisateur">
    >,
  ): Promise<TreatmentRecord[]> {
    if (Object.keys(input).length === 0) {
      return [];
    }

    return database
      .update(historique_traitements)
      .set(input)
      .where(eq(historique_traitements.ordonnance_id, ordonnanceId))
      .returning();
  }

  async stopTreatmentByOrdonnanceMedicamentId(
    database: DatabaseClient,
    ordonnanceMedicamentId: string,
  ): Promise<TreatmentRecord[]> {
    return database
      .update(historique_traitements)
      .set({ est_actif: false })
      .where(eq(historique_traitements.ordonnance_medicament_id, ordonnanceMedicamentId))
      .returning();
  }

  async detachTreatmentByOrdonnanceMedicamentId(
    database: DatabaseClient,
    ordonnanceMedicamentId: string,
  ): Promise<TreatmentRecord[]> {
    return database
      .update(historique_traitements)
      .set({
        est_actif: false,
        ordonnance_medicament_id: null,
      })
      .where(eq(historique_traitements.ordonnance_medicament_id, ordonnanceMedicamentId))
      .returning();
  }

  async deactivateActiveDerivedTreatmentsForPatientMedication(
    database: DatabaseClient,
    params: {
      patient_id: string;
      medicament_externe_id: string;
      exclude_ordonnance_medicament_id?: string;
    },
  ): Promise<TreatmentRecord[]> {
    const conditions = [
      eq(historique_traitements.patient_id, params.patient_id),
      eq(historique_traitements.medicament_externe_id, params.medicament_externe_id),
      eq(historique_traitements.source_type, "ordonnance"),
      eq(historique_traitements.est_actif, true),
    ];

    if (params.exclude_ordonnance_medicament_id) {
      conditions.push(
        ne(
          historique_traitements.ordonnance_medicament_id,
          params.exclude_ordonnance_medicament_id,
        ),
      );
    }

    return database
      .update(historique_traitements)
      .set({ est_actif: false })
      .where(and(...conditions))
      .returning();
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

  async getTreatmentByOrdonnanceMedicamentId(
    database: DatabaseClient,
    ordonnanceMedicamentId: string,
  ): Promise<TreatmentRecord | null> {
    const [treatment] = await database
      .select()
      .from(historique_traitements)
      .where(eq(historique_traitements.ordonnance_medicament_id, ordonnanceMedicamentId))
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
      .orderBy(
        desc(historique_traitements.date_prescription),
        desc(historique_traitements.id),
      );
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
      .orderBy(
        desc(historique_traitements.date_prescription),
        desc(historique_traitements.id),
      );
  }
}

export const treatmentRepository = new TreatmentRepository();
