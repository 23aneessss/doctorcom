import type { db as databaseClient } from "@doctor.com/db";
import {
  categories_pre_rempli,
  medicaments,
  ordonnance,
  ordonnance_medicaments,
  patients,
  pre_rempli_medicaments,
  pre_rempli_ordonnance,
  rendez_vous,
} from "@doctor.com/db/schema";
import { and, asc, desc, eq, ilike } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;

type NewOrdonnanceRecord = typeof ordonnance.$inferInsert;
type NewOrdonnanceMedicamentRecord = typeof ordonnance_medicaments.$inferInsert;
type NewCategoriePreRempliRecord = typeof categories_pre_rempli.$inferInsert;
type NewPreRempliOrdonnanceRecord = typeof pre_rempli_ordonnance.$inferInsert;
type NewPreRempliMedicamentRecord = typeof pre_rempli_medicaments.$inferInsert;

export type OrdonnanceRecord = typeof ordonnance.$inferSelect;
export type OrdonnanceMedicamentRecord = typeof ordonnance_medicaments.$inferSelect;
export type MedicamentRecord = typeof medicaments.$inferSelect;
export type CategoriePreRempliRecord = typeof categories_pre_rempli.$inferSelect;
export type PreRempliOrdonnanceRecord = typeof pre_rempli_ordonnance.$inferSelect;
export type PreRempliMedicamentRecord = typeof pre_rempli_medicaments.$inferSelect;

export type CreateOrdonnanceInput = Omit<NewOrdonnanceRecord, "id">;
export type UpdateOrdonnanceInput = Partial<CreateOrdonnanceInput>;

export type AddOrdonnanceMedicamentInput = Omit<NewOrdonnanceMedicamentRecord, "id">;
export type UpdateOrdonnanceMedicamentInput = Partial<
  Omit<NewOrdonnanceMedicamentRecord, "id" | "ordonnance_id">
>;

export type CreateCategorieInput = Omit<NewCategoriePreRempliRecord, "id">;
export type UpdateCategorieInput = Partial<CreateCategorieInput>;

export type CreatePreRempliInput = Omit<
  NewPreRempliOrdonnanceRecord,
  "id" | "created_at" | "updated_at"
>;
export type UpdatePreRempliInput = Partial<
  Omit<NewPreRempliOrdonnanceRecord, "id" | "created_by_user" | "created_at" | "updated_at">
>;

export type AddPreRempliMedicamentInput = Omit<NewPreRempliMedicamentRecord, "id">;
export type UpdatePreRempliMedicamentInput = Partial<
  Omit<NewPreRempliMedicamentRecord, "id" | "pre_rempli_id">
>;

export class OrdonnanceRepository {
  async createOrdonnance(
    database: DatabaseClient,
    data: CreateOrdonnanceInput,
  ): Promise<OrdonnanceRecord> {
    const [created] = await database.insert(ordonnance).values(data).returning();

    if (!created) {
      throw new Error("Echec de creation de l'ordonnance.");
    }

    return created;
  }

  async updateOrdonnance(
    database: DatabaseClient,
    id: string,
    data: UpdateOrdonnanceInput,
  ): Promise<OrdonnanceRecord | null> {
    if (Object.keys(data).length === 0) {
      return this.getOrdonnanceById(database, id);
    }

    const [updated] = await database
      .update(ordonnance)
      .set(data)
      .where(eq(ordonnance.id, id))
      .returning();

    return updated ?? null;
  }

  async deleteOrdonnance(database: DatabaseClient, id: string): Promise<boolean> {
    const [deleted] = await database
      .delete(ordonnance)
      .where(eq(ordonnance.id, id))
      .returning({ id: ordonnance.id });

    return Boolean(deleted);
  }

  async getOrdonnanceById(database: DatabaseClient, id: string): Promise<OrdonnanceRecord | null> {
    const [item] = await database
      .select()
      .from(ordonnance)
      .where(eq(ordonnance.id, id))
      .limit(1);

    return item ?? null;
  }

  async getOrdonnancesByPatient(
    database: DatabaseClient,
    patientId: string,
  ): Promise<OrdonnanceRecord[]> {
    return database
      .select()
      .from(ordonnance)
      .where(eq(ordonnance.patient_id, patientId))
      .orderBy(desc(ordonnance.date_prescription));
  }

  async getOrdonnancesByRendezVous(
    database: DatabaseClient,
    rendezVousId: string,
  ): Promise<OrdonnanceRecord[]> {
    return database
      .select()
      .from(ordonnance)
      .where(eq(ordonnance.rendez_vous_id, rendezVousId))
      .orderBy(desc(ordonnance.date_prescription));
  }

  async addMedicamentToOrdonnance(
    database: DatabaseClient,
    data: AddOrdonnanceMedicamentInput,
  ): Promise<OrdonnanceMedicamentRecord> {
    const [created] = await database
      .insert(ordonnance_medicaments)
      .values(data)
      .returning();

    if (!created) {
      throw new Error("Echec d'ajout du medicament a l'ordonnance.");
    }

    return created;
  }

  async updateOrdonnanceMedicament(
    database: DatabaseClient,
    id: string,
    data: UpdateOrdonnanceMedicamentInput,
  ): Promise<OrdonnanceMedicamentRecord | null> {
    if (Object.keys(data).length === 0) {
      const [existing] = await database
        .select()
        .from(ordonnance_medicaments)
        .where(eq(ordonnance_medicaments.id, id))
        .limit(1);

      return existing ?? null;
    }

    const [updated] = await database
      .update(ordonnance_medicaments)
      .set(data)
      .where(eq(ordonnance_medicaments.id, id))
      .returning();

    return updated ?? null;
  }

  async removeMedicamentFromOrdonnance(database: DatabaseClient, id: string): Promise<boolean> {
    const [deleted] = await database
      .delete(ordonnance_medicaments)
      .where(eq(ordonnance_medicaments.id, id))
      .returning({ id: ordonnance_medicaments.id });

    return Boolean(deleted);
  }

  async getMedicamentsByOrdonnance(
    database: DatabaseClient,
    ordonnanceId: string,
  ): Promise<OrdonnanceMedicamentRecord[]> {
    return database
      .select()
      .from(ordonnance_medicaments)
      .where(eq(ordonnance_medicaments.ordonnance_id, ordonnanceId));
  }

  async getOrdonnanceMedicamentById(
    database: DatabaseClient,
    id: string,
  ): Promise<OrdonnanceMedicamentRecord | null> {
    const [item] = await database
      .select()
      .from(ordonnance_medicaments)
      .where(eq(ordonnance_medicaments.id, id))
      .limit(1);

    return item ?? null;
  }

  async getMedicamentById(database: DatabaseClient, id: string): Promise<MedicamentRecord | null> {
    const [item] = await database
      .select()
      .from(medicaments)
      .where(eq(medicaments.id, id))
      .limit(1);

    return item ?? null;
  }

  async getMedicamentByNom(
    database: DatabaseClient,
    nom: string,
  ): Promise<MedicamentRecord | null> {
    const [item] = await database
      .select()
      .from(medicaments)
      .where(ilike(medicaments.dci, nom))
      .limit(1);

    return item ?? null;
  }

  async searchMedicaments(database: DatabaseClient, query: string): Promise<MedicamentRecord[]> {
    return database
      .select()
      .from(medicaments)
      .where(ilike(medicaments.dci, `%${query}%`))
      .orderBy(asc(medicaments.dci))
      .limit(25);
  }

  async createCategorie(
    database: DatabaseClient,
    data: CreateCategorieInput,
  ): Promise<CategoriePreRempliRecord> {
    const [created] = await database
      .insert(categories_pre_rempli)
      .values(data)
      .returning();

    if (!created) {
      throw new Error("Echec de creation de la categorie pre-remplie.");
    }

    return created;
  }

  async updateCategorie(
    database: DatabaseClient,
    id: string,
    data: UpdateCategorieInput,
  ): Promise<CategoriePreRempliRecord | null> {
    if (Object.keys(data).length === 0) {
      return this.getCategorieById(database, id);
    }

    const [updated] = await database
      .update(categories_pre_rempli)
      .set(data)
      .where(eq(categories_pre_rempli.id, id))
      .returning();

    return updated ?? null;
  }

  async deleteCategorie(database: DatabaseClient, id: string): Promise<boolean> {
    const [deleted] = await database
      .delete(categories_pre_rempli)
      .where(eq(categories_pre_rempli.id, id))
      .returning({ id: categories_pre_rempli.id });

    return Boolean(deleted);
  }

  async getAllCategories(database: DatabaseClient): Promise<CategoriePreRempliRecord[]> {
    return database
      .select()
      .from(categories_pre_rempli)
      .orderBy(asc(categories_pre_rempli.nom));
  }

  async getCategorieById(
    database: DatabaseClient,
    id: string,
  ): Promise<CategoriePreRempliRecord | null> {
    const [item] = await database
      .select()
      .from(categories_pre_rempli)
      .where(eq(categories_pre_rempli.id, id))
      .limit(1);

    return item ?? null;
  }

  async createPreRempli(
    database: DatabaseClient,
    data: CreatePreRempliInput,
  ): Promise<PreRempliOrdonnanceRecord> {
    const [created] = await database
      .insert(pre_rempli_ordonnance)
      .values(data)
      .returning();

    if (!created) {
      throw new Error("Echec de creation du pre-rempli ordonnance.");
    }

    return created;
  }

  async updatePreRempli(
    database: DatabaseClient,
    id: string,
    data: UpdatePreRempliInput,
  ): Promise<PreRempliOrdonnanceRecord | null> {
    if (Object.keys(data).length === 0) {
      return this.getPreRempliById(database, id);
    }

    const [updated] = await database
      .update(pre_rempli_ordonnance)
      .set(data)
      .where(eq(pre_rempli_ordonnance.id, id))
      .returning();

    return updated ?? null;
  }

  async deletePreRempli(database: DatabaseClient, id: string): Promise<boolean> {
    const [deleted] = await database
      .delete(pre_rempli_ordonnance)
      .where(eq(pre_rempli_ordonnance.id, id))
      .returning({ id: pre_rempli_ordonnance.id });

    return Boolean(deleted);
  }

  async getPreRempliById(
    database: DatabaseClient,
    id: string,
  ): Promise<PreRempliOrdonnanceRecord | null> {
    const [item] = await database
      .select()
      .from(pre_rempli_ordonnance)
      .where(eq(pre_rempli_ordonnance.id, id))
      .limit(1);

    return item ?? null;
  }

  async getPreRemplisByCategorie(
    database: DatabaseClient,
    categorieId: string,
  ): Promise<PreRempliOrdonnanceRecord[]> {
    return database
      .select()
      .from(pre_rempli_ordonnance)
      .where(eq(pre_rempli_ordonnance.categorie_pre_rempli_id, categorieId))
      .orderBy(asc(pre_rempli_ordonnance.nom));
  }

  async getPreRemplisBySpecialite(
    database: DatabaseClient,
    specialite: string,
  ): Promise<PreRempliOrdonnanceRecord[]> {
    return database
      .select()
      .from(pre_rempli_ordonnance)
      .where(
        and(
          ilike(pre_rempli_ordonnance.specialite, specialite),
          eq(pre_rempli_ordonnance.est_actif, true),
        ),
      )
      .orderBy(asc(pre_rempli_ordonnance.nom));
  }

  async getAllPreRemplis(database: DatabaseClient): Promise<PreRempliOrdonnanceRecord[]> {
    return database
      .select()
      .from(pre_rempli_ordonnance)
      .orderBy(asc(pre_rempli_ordonnance.nom));
  }

  async dupliquerPreRempli(
    database: DatabaseClient,
    id: string,
    nouveauNom: string,
  ): Promise<PreRempliOrdonnanceRecord> {
    const source = await this.getPreRempliById(database, id);
    if (!source) {
      throw new Error("Pre-rempli source introuvable.");
    }

    return this.createPreRempli(database, {
      nom: nouveauNom,
      description: source.description,
      specialite: source.specialite,
      categorie_pre_rempli_id: source.categorie_pre_rempli_id,
      est_actif: source.est_actif,
      created_by_user: source.created_by_user,
    });
  }

  async addMedicamentToPreRempli(
    database: DatabaseClient,
    data: AddPreRempliMedicamentInput,
  ): Promise<PreRempliMedicamentRecord> {
    const [created] = await database
      .insert(pre_rempli_medicaments)
      .values(data)
      .returning();

    if (!created) {
      throw new Error("Echec d'ajout du medicament au pre-rempli.");
    }

    return created;
  }

  async updatePreRempliMedicament(
    database: DatabaseClient,
    id: string,
    data: UpdatePreRempliMedicamentInput,
  ): Promise<PreRempliMedicamentRecord | null> {
    if (Object.keys(data).length === 0) {
      const [existing] = await database
        .select()
        .from(pre_rempli_medicaments)
        .where(eq(pre_rempli_medicaments.id, id))
        .limit(1);

      return existing ?? null;
    }

    const [updated] = await database
      .update(pre_rempli_medicaments)
      .set(data)
      .where(eq(pre_rempli_medicaments.id, id))
      .returning();

    return updated ?? null;
  }

  async removeMedicamentFromPreRempli(database: DatabaseClient, id: string): Promise<boolean> {
    const [deleted] = await database
      .delete(pre_rempli_medicaments)
      .where(eq(pre_rempli_medicaments.id, id))
      .returning({ id: pre_rempli_medicaments.id });

    return Boolean(deleted);
  }

  async getMedicamentsByPreRempli(
    database: DatabaseClient,
    preRempliId: string,
  ): Promise<PreRempliMedicamentRecord[]> {
    return database
      .select()
      .from(pre_rempli_medicaments)
      .where(eq(pre_rempli_medicaments.pre_rempli_id, preRempliId))
      .orderBy(asc(pre_rempli_medicaments.ordre_affichage));
  }

  async getPreRempliMedicamentById(
    database: DatabaseClient,
    id: string,
  ): Promise<PreRempliMedicamentRecord | null> {
    const [item] = await database
      .select()
      .from(pre_rempli_medicaments)
      .where(eq(pre_rempli_medicaments.id, id))
      .limit(1);

    return item ?? null;
  }

  async getRendezVousById(
    database: DatabaseClient,
    id: string,
  ): Promise<{ id: string; statut: string } | null> {
    const [item] = await database
      .select({
        id: rendez_vous.id,
        statut: rendez_vous.statut,
      })
      .from(rendez_vous)
      .where(eq(rendez_vous.id, id))
      .limit(1);

    return item ?? null;
  }

  async getPatientById(database: DatabaseClient, id: string): Promise<{ id: string } | null> {
    const [item] = await database
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);

    return item ?? null;
  }
}

export const ordonnanceRepository = new OrdonnanceRepository();
