import type { medicationsDb as medicationsDatabaseClient } from "@doctor.com/medications-db";
import {
  medicaments,
  substances_actives,
  indications,
  contre_indications,
  precautions,
  interactions,
  effets_indesirables,
  presentations,
} from "@doctor.com/medications-db/schema";
import { and, asc, count, eq, ilike, inArray, or } from "drizzle-orm";

type RootDatabaseClient = typeof medicationsDatabaseClient;
type DatabaseTransaction = Parameters<Parameters<RootDatabaseClient["transaction"]>[0]>[0];
type DatabaseClient = RootDatabaseClient | DatabaseTransaction;
type NewMedicamentRecord = typeof medicaments.$inferInsert;

export type MedicamentRecord = typeof medicaments.$inferSelect;
export type SubstanceActiveRecord = typeof substances_actives.$inferSelect;
export type IndicationRecord = typeof indications.$inferSelect;
export type ContreIndicationRecord = typeof contre_indications.$inferSelect;
export type PrecautionRecord = typeof precautions.$inferSelect;
export type InteractionRecord = typeof interactions.$inferSelect;
export type EffetIndesirableRecord = typeof effets_indesirables.$inferSelect;
export type PresentationRecord = typeof presentations.$inferSelect;

export interface CreateMedicamentInput {
  nom_medicament: string;
  nom_generique?: string | null;
  classe_therapeutique?: string | null;
  famille_pharmacologique?: string | null;
  posologie_adulte?: string | null;
  posologie_enfant?: string | null;
  dose_maximale?: string | null;
  frequence_administration?: string | null;
  grossesse?: string | null;
  allaitement?: string | null;
}

export type UpdateMedicamentInput = Partial<CreateMedicamentInput>;

export interface CreateSubstanceInput {
  nom_substance: string;
}

export interface CreateIndicationInput {
  indication: string;
}

export interface CreateDescriptionInput {
  description: string;
}

export interface CreateInteractionInput {
  medicament_interaction: string;
}

export interface CreateEffetIndesirableInput {
  frequence?: string | null;
  effet: string;
}

export interface CreatePresentationInput {
  forme?: string | null;
  dosage?: string | null;
}

export interface MedicamentSearchFilters {
  query?: string;
  classe_therapeutique?: string;
  famille_pharmacologique?: string;
  grossesse?: string;
  allaitement?: string;
  nom_substance?: string;
  indication?: string;
  contre_indication?: string;
  precaution?: string;
  interaction?: string;
  forme?: string;
  dosage?: string;
  page: number;
  page_size: number;
}

export interface PaginatedMedicaments {
  items: MedicamentRecord[];
  total: number;
  page: number;
  page_size: number;
  page_count: number;
}

export class MedicamentsRepository {
  async createMedicament(
    database: DatabaseClient,
    input: CreateMedicamentInput,
  ): Promise<MedicamentRecord> {
    const values: NewMedicamentRecord = {
      ...input,
    };

    const [created] = await database.insert(medicaments).values(values).returning();
    if (!created) {
      throw new Error("Echec de creation du medicament.");
    }

    return created;
  }

  async updateMedicament(
    database: DatabaseClient,
    medicamentId: number,
    input: UpdateMedicamentInput,
  ): Promise<MedicamentRecord | null> {
    if (Object.keys(input).length === 0) {
      return this.getMedicamentById(database, medicamentId);
    }

    const [updated] = await database
      .update(medicaments)
      .set(input)
      .where(eq(medicaments.id, medicamentId))
      .returning();

    return updated ?? null;
  }

  async deleteMedicament(database: DatabaseClient, medicamentId: number): Promise<boolean> {
    await database.delete(substances_actives).where(eq(substances_actives.medicament_id, medicamentId));
    await database.delete(indications).where(eq(indications.medicament_id, medicamentId));
    await database
      .delete(contre_indications)
      .where(eq(contre_indications.medicament_id, medicamentId));
    await database.delete(precautions).where(eq(precautions.medicament_id, medicamentId));
    await database.delete(interactions).where(eq(interactions.medicament_id, medicamentId));
    await database
      .delete(effets_indesirables)
      .where(eq(effets_indesirables.medicament_id, medicamentId));
    await database.delete(presentations).where(eq(presentations.medicament_id, medicamentId));

    const [deleted] = await database
      .delete(medicaments)
      .where(eq(medicaments.id, medicamentId))
      .returning({ id: medicaments.id });

    return Boolean(deleted);
  }

  async getMedicamentById(
    database: DatabaseClient,
    medicamentId: number,
  ): Promise<MedicamentRecord | null> {
    const [record] = await database
      .select()
      .from(medicaments)
      .where(eq(medicaments.id, medicamentId))
      .limit(1);

    return record ?? null;
  }

  async getSubstancesByMedicament(
    database: DatabaseClient,
    medicamentId: number,
  ): Promise<SubstanceActiveRecord[]> {
    return database
      .select()
      .from(substances_actives)
      .where(eq(substances_actives.medicament_id, medicamentId))
      .orderBy(asc(substances_actives.id));
  }

  async replaceSubstances(
    database: DatabaseClient,
    medicamentId: number,
    items: CreateSubstanceInput[],
  ): Promise<SubstanceActiveRecord[]> {
    await database.delete(substances_actives).where(eq(substances_actives.medicament_id, medicamentId));
    if (items.length === 0) {
      return [];
    }

    return database
      .insert(substances_actives)
      .values(items.map((item) => ({ medicament_id: medicamentId, nom_substance: item.nom_substance })))
      .returning();
  }

  async getIndicationsByMedicament(
    database: DatabaseClient,
    medicamentId: number,
  ): Promise<IndicationRecord[]> {
    return database
      .select()
      .from(indications)
      .where(eq(indications.medicament_id, medicamentId))
      .orderBy(asc(indications.id));
  }

  async replaceIndications(
    database: DatabaseClient,
    medicamentId: number,
    items: CreateIndicationInput[],
  ): Promise<IndicationRecord[]> {
    await database.delete(indications).where(eq(indications.medicament_id, medicamentId));
    if (items.length === 0) {
      return [];
    }

    return database
      .insert(indications)
      .values(items.map((item) => ({ medicament_id: medicamentId, indication: item.indication })))
      .returning();
  }

  async getContreIndicationsByMedicament(
    database: DatabaseClient,
    medicamentId: number,
  ): Promise<ContreIndicationRecord[]> {
    return database
      .select()
      .from(contre_indications)
      .where(eq(contre_indications.medicament_id, medicamentId))
      .orderBy(asc(contre_indications.id));
  }

  async replaceContreIndications(
    database: DatabaseClient,
    medicamentId: number,
    items: CreateDescriptionInput[],
  ): Promise<ContreIndicationRecord[]> {
    await database
      .delete(contre_indications)
      .where(eq(contre_indications.medicament_id, medicamentId));
    if (items.length === 0) {
      return [];
    }

    return database
      .insert(contre_indications)
      .values(items.map((item) => ({ medicament_id: medicamentId, description: item.description })))
      .returning();
  }

  async getPrecautionsByMedicament(
    database: DatabaseClient,
    medicamentId: number,
  ): Promise<PrecautionRecord[]> {
    return database
      .select()
      .from(precautions)
      .where(eq(precautions.medicament_id, medicamentId))
      .orderBy(asc(precautions.id));
  }

  async replacePrecautions(
    database: DatabaseClient,
    medicamentId: number,
    items: CreateDescriptionInput[],
  ): Promise<PrecautionRecord[]> {
    await database.delete(precautions).where(eq(precautions.medicament_id, medicamentId));
    if (items.length === 0) {
      return [];
    }

    return database
      .insert(precautions)
      .values(items.map((item) => ({ medicament_id: medicamentId, description: item.description })))
      .returning();
  }

  async getInteractionsByMedicament(
    database: DatabaseClient,
    medicamentId: number,
  ): Promise<InteractionRecord[]> {
    return database
      .select()
      .from(interactions)
      .where(eq(interactions.medicament_id, medicamentId))
      .orderBy(asc(interactions.id));
  }

  async replaceInteractions(
    database: DatabaseClient,
    medicamentId: number,
    items: CreateInteractionInput[],
  ): Promise<InteractionRecord[]> {
    await database.delete(interactions).where(eq(interactions.medicament_id, medicamentId));
    if (items.length === 0) {
      return [];
    }

    return database
      .insert(interactions)
      .values(
        items.map((item) => ({
          medicament_id: medicamentId,
          medicament_interaction: item.medicament_interaction,
        })),
      )
      .returning();
  }

  async getEffetsIndesirablesByMedicament(
    database: DatabaseClient,
    medicamentId: number,
  ): Promise<EffetIndesirableRecord[]> {
    return database
      .select()
      .from(effets_indesirables)
      .where(eq(effets_indesirables.medicament_id, medicamentId))
      .orderBy(asc(effets_indesirables.id));
  }

  async replaceEffetsIndesirables(
    database: DatabaseClient,
    medicamentId: number,
    items: CreateEffetIndesirableInput[],
  ): Promise<EffetIndesirableRecord[]> {
    await database
      .delete(effets_indesirables)
      .where(eq(effets_indesirables.medicament_id, medicamentId));
    if (items.length === 0) {
      return [];
    }

    return database
      .insert(effets_indesirables)
      .values(
        items.map((item) => ({
          medicament_id: medicamentId,
          frequence: item.frequence ?? null,
          effet: item.effet,
        })),
      )
      .returning();
  }

  async getPresentationsByMedicament(
    database: DatabaseClient,
    medicamentId: number,
  ): Promise<PresentationRecord[]> {
    return database
      .select()
      .from(presentations)
      .where(eq(presentations.medicament_id, medicamentId))
      .orderBy(asc(presentations.id));
  }

  async replacePresentations(
    database: DatabaseClient,
    medicamentId: number,
    items: CreatePresentationInput[],
  ): Promise<PresentationRecord[]> {
    await database.delete(presentations).where(eq(presentations.medicament_id, medicamentId));
    if (items.length === 0) {
      return [];
    }

    return database
      .insert(presentations)
      .values(
        items.map((item) => ({
          medicament_id: medicamentId,
          forme: item.forme ?? null,
          dosage: item.dosage ?? null,
        })),
      )
      .returning();
  }

  async searchMedicaments(
    database: DatabaseClient,
    filters: MedicamentSearchFilters,
  ): Promise<PaginatedMedicaments> {
    const conditions = [];

    if (filters.query) {
      const pattern = `%${filters.query}%`;
      conditions.push(
        or(
          ilike(medicaments.nom_medicament, pattern),
          ilike(medicaments.nom_generique, pattern),
          ilike(medicaments.classe_therapeutique, pattern),
          ilike(medicaments.famille_pharmacologique, pattern),
        ),
      );
    }

    if (filters.classe_therapeutique) {
      conditions.push(
        ilike(medicaments.classe_therapeutique, `%${filters.classe_therapeutique}%`),
      );
    }

    if (filters.famille_pharmacologique) {
      conditions.push(
        ilike(
          medicaments.famille_pharmacologique,
          `%${filters.famille_pharmacologique}%`,
        ),
      );
    }

    if (filters.grossesse) {
      conditions.push(ilike(medicaments.grossesse, `%${filters.grossesse}%`));
    }

    if (filters.allaitement) {
      conditions.push(ilike(medicaments.allaitement, `%${filters.allaitement}%`));
    }

    if (filters.nom_substance) {
      const subquery = database
        .select({ medicament_id: substances_actives.medicament_id })
        .from(substances_actives)
        .where(ilike(substances_actives.nom_substance, `%${filters.nom_substance}%`));

      conditions.push(inArray(medicaments.id, subquery));
    }

    if (filters.indication) {
      const subquery = database
        .select({ medicament_id: indications.medicament_id })
        .from(indications)
        .where(ilike(indications.indication, `%${filters.indication}%`));

      conditions.push(inArray(medicaments.id, subquery));
    }

    if (filters.contre_indication) {
      const subquery = database
        .select({ medicament_id: contre_indications.medicament_id })
        .from(contre_indications)
        .where(ilike(contre_indications.description, `%${filters.contre_indication}%`));

      conditions.push(inArray(medicaments.id, subquery));
    }

    if (filters.precaution) {
      const subquery = database
        .select({ medicament_id: precautions.medicament_id })
        .from(precautions)
        .where(ilike(precautions.description, `%${filters.precaution}%`));

      conditions.push(inArray(medicaments.id, subquery));
    }

    if (filters.interaction) {
      const subquery = database
        .select({ medicament_id: interactions.medicament_id })
        .from(interactions)
        .where(
          ilike(interactions.medicament_interaction, `%${filters.interaction}%`),
        );

      conditions.push(inArray(medicaments.id, subquery));
    }

    if (filters.forme || filters.dosage) {
      const subqueryBase = database
        .select({ medicament_id: presentations.medicament_id })
        .from(presentations);

      const presentationConditions = [];
      if (filters.forme) {
        presentationConditions.push(ilike(presentations.forme, `%${filters.forme}%`));
      }
      if (filters.dosage) {
        presentationConditions.push(ilike(presentations.dosage, `%${filters.dosage}%`));
      }

      const subquery =
        presentationConditions.length > 0
          ? subqueryBase.where(and(...presentationConditions))
          : subqueryBase;

      conditions.push(inArray(medicaments.id, subquery));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (filters.page - 1) * filters.page_size;

    const countQuery = database.select({ total: count() }).from(medicaments);
    const itemsQuery = database.select().from(medicaments);

    const countRows = whereClause
      ? await countQuery.where(whereClause)
      : await countQuery;
    const total = countRows[0]?.total ?? 0;

    const items = whereClause
      ? await itemsQuery
          .where(whereClause)
          .orderBy(asc(medicaments.nom_medicament))
          .limit(filters.page_size)
          .offset(offset)
      : await itemsQuery
          .orderBy(asc(medicaments.nom_medicament))
          .limit(filters.page_size)
          .offset(offset);

    return {
      items,
      total,
      page: filters.page,
      page_size: filters.page_size,
      page_count: Math.max(1, Math.ceil(total / filters.page_size)),
    };
  }
}

export const medicamentsRepository = new MedicamentsRepository();
