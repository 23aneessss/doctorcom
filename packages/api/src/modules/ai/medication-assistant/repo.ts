import type { db as rootDatabaseClient } from "@doctor.com/db";
import { utilisateurs } from "@doctor.com/db/schema";
import { medicationsDb } from "@doctor.com/medications-db";
import {
  contre_indications,
  effets_indesirables,
  indications,
  interactions,
  medicaments,
  precautions,
  presentations,
  substances_actives,
} from "@doctor.com/medications-db/schema";
import { asc, eq, inArray, or, sql, type SQL } from "drizzle-orm";

type AppDatabaseClient = typeof rootDatabaseClient;

export type UtilisateurRecord = typeof utilisateurs.$inferSelect;
export type MedicamentRecord = typeof medicaments.$inferSelect;
export type SubstanceActiveRecord = typeof substances_actives.$inferSelect;
export type IndicationRecord = typeof indications.$inferSelect;
export type ContreIndicationRecord = typeof contre_indications.$inferSelect;
export type PrecautionRecord = typeof precautions.$inferSelect;
export type InteractionRecord = typeof interactions.$inferSelect;
export type EffetIndesirableRecord = typeof effets_indesirables.$inferSelect;
export type PresentationRecord = typeof presentations.$inferSelect;

export interface MedicationAggregate {
  medicament: MedicamentRecord;
  substances_actives: SubstanceActiveRecord[];
  indications: IndicationRecord[];
  contre_indications: ContreIndicationRecord[];
  precautions: PrecautionRecord[];
  interactions: InteractionRecord[];
  effets_indesirables: EffetIndesirableRecord[];
  presentations: PresentationRecord[];
}

const accentSource = "àáâäãåçèéêëìíîïñòóôöõùúûüýÿ";
const accentTarget = "aaaaaaceeeeiiiinooooouuuuyy";

function normalizeSearchTerm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizedSqlText(column: unknown): SQL {
  return sql`translate(lower(coalesce(${column}, '')), ${accentSource}, ${accentTarget})`;
}

function normalizedLike(column: unknown, term: string): SQL {
  return sql`${normalizedSqlText(column)} like ${`%${normalizeSearchTerm(term)}%`}`;
}

export class MedicationAssistantRepository {
  async findUtilisateurByEmail(
    database: AppDatabaseClient,
    email: string,
  ): Promise<UtilisateurRecord | null> {
    const [utilisateur] = await database
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.email, email))
      .limit(1);

    return utilisateur ?? null;
  }

  async getMedicamentsByIds(ids: number[]): Promise<MedicamentRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await medicationsDb
      .select()
      .from(medicaments)
      .where(inArray(medicaments.id, ids));

    const rowsById = new Map(rows.map((row) => [row.id, row]));

    return ids
      .map((id) => rowsById.get(id))
      .filter((row): row is MedicamentRecord => Boolean(row));
  }

  async searchMedicamentsByNames(
    names: string[],
    limit: number,
  ): Promise<MedicamentRecord[]> {
    const normalizedNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))].slice(
      0,
      10,
    );

    if (normalizedNames.length === 0) {
      return [];
    }

    const conditions = normalizedNames.flatMap((name) => {
      return [
        normalizedLike(medicaments.nom_medicament, name),
        normalizedLike(medicaments.nom_generique, name),
        inArray(
          medicaments.id,
          medicationsDb
            .select({ medicament_id: substances_actives.medicament_id })
            .from(substances_actives)
            .where(normalizedLike(substances_actives.nom_substance, name)),
        ),
      ];
    });

    if (conditions.length === 0) {
      return [];
    }

    return medicationsDb
      .select()
      .from(medicaments)
      .where(or(...conditions))
      .orderBy(asc(medicaments.nom_medicament))
      .limit(limit);
  }

  async searchMedicamentsBroadRecall(
    terms: string[],
    limit: number,
  ): Promise<MedicamentRecord[]> {
    const normalizedTerms = [...new Set(terms.map((term) => term.trim()).filter(Boolean))].slice(
      0,
      12,
    );

    if (normalizedTerms.length === 0) {
      return [];
    }

    const conditions = normalizedTerms.flatMap((term) => {
      return [
        normalizedLike(medicaments.nom_medicament, term),
        normalizedLike(medicaments.nom_generique, term),
        normalizedLike(medicaments.classe_therapeutique, term),
        normalizedLike(medicaments.famille_pharmacologique, term),
        normalizedLike(medicaments.posologie_adulte, term),
        normalizedLike(medicaments.posologie_enfant, term),
        normalizedLike(medicaments.grossesse, term),
        normalizedLike(medicaments.allaitement, term),
        inArray(
          medicaments.id,
          medicationsDb
            .select({ medicament_id: substances_actives.medicament_id })
            .from(substances_actives)
            .where(normalizedLike(substances_actives.nom_substance, term)),
        ),
        inArray(
          medicaments.id,
          medicationsDb
            .select({ medicament_id: indications.medicament_id })
            .from(indications)
            .where(normalizedLike(indications.indication, term)),
        ),
        inArray(
          medicaments.id,
          medicationsDb
            .select({ medicament_id: contre_indications.medicament_id })
            .from(contre_indications)
            .where(normalizedLike(contre_indications.description, term)),
        ),
        inArray(
          medicaments.id,
          medicationsDb
            .select({ medicament_id: precautions.medicament_id })
            .from(precautions)
            .where(normalizedLike(precautions.description, term)),
        ),
        inArray(
          medicaments.id,
          medicationsDb
            .select({ medicament_id: interactions.medicament_id })
            .from(interactions)
            .where(normalizedLike(interactions.medicament_interaction, term)),
        ),
        inArray(
          medicaments.id,
          medicationsDb
            .select({ medicament_id: presentations.medicament_id })
            .from(presentations)
            .where(
              or(
                normalizedLike(presentations.forme, term),
                normalizedLike(presentations.dosage, term),
              ),
            ),
        ),
      ];
    });

    if (conditions.length === 0) {
      return [];
    }

    return medicationsDb
      .select()
      .from(medicaments)
      .where(or(...conditions))
      .orderBy(asc(medicaments.nom_medicament))
      .limit(limit);
  }

  async getMedicationAggregatesByIds(ids: number[]): Promise<MedicationAggregate[]> {
    if (ids.length === 0) {
      return [];
    }

    const medicamentRows = await this.getMedicamentsByIds(ids);

    const aggregates = await Promise.all(
      medicamentRows.map(async (medicament) => ({
        medicament,
        substances_actives: await this.getSubstancesByMedicament(medicament.id),
        indications: await this.getIndicationsByMedicament(medicament.id),
        contre_indications: await this.getContreIndicationsByMedicament(medicament.id),
        precautions: await this.getPrecautionsByMedicament(medicament.id),
        interactions: await this.getInteractionsByMedicament(medicament.id),
        effets_indesirables: await this.getEffetsIndesirablesByMedicament(medicament.id),
        presentations: await this.getPresentationsByMedicament(medicament.id),
      })),
    );

    const aggregatesById = new Map(
      aggregates.map((aggregate) => [aggregate.medicament.id, aggregate]),
    );

    return ids
      .map((id) => aggregatesById.get(id))
      .filter((aggregate): aggregate is MedicationAggregate => Boolean(aggregate));
  }

  private async getSubstancesByMedicament(
    medicamentId: number,
  ): Promise<SubstanceActiveRecord[]> {
    return medicationsDb
      .select()
      .from(substances_actives)
      .where(eq(substances_actives.medicament_id, medicamentId))
      .orderBy(asc(substances_actives.id));
  }

  private async getIndicationsByMedicament(
    medicamentId: number,
  ): Promise<IndicationRecord[]> {
    return medicationsDb
      .select()
      .from(indications)
      .where(eq(indications.medicament_id, medicamentId))
      .orderBy(asc(indications.id));
  }

  private async getContreIndicationsByMedicament(
    medicamentId: number,
  ): Promise<ContreIndicationRecord[]> {
    return medicationsDb
      .select()
      .from(contre_indications)
      .where(eq(contre_indications.medicament_id, medicamentId))
      .orderBy(asc(contre_indications.id));
  }

  private async getPrecautionsByMedicament(
    medicamentId: number,
  ): Promise<PrecautionRecord[]> {
    return medicationsDb
      .select()
      .from(precautions)
      .where(eq(precautions.medicament_id, medicamentId))
      .orderBy(asc(precautions.id));
  }

  private async getInteractionsByMedicament(
    medicamentId: number,
  ): Promise<InteractionRecord[]> {
    return medicationsDb
      .select()
      .from(interactions)
      .where(eq(interactions.medicament_id, medicamentId))
      .orderBy(asc(interactions.id));
  }

  private async getEffetsIndesirablesByMedicament(
    medicamentId: number,
  ): Promise<EffetIndesirableRecord[]> {
    return medicationsDb
      .select()
      .from(effets_indesirables)
      .where(eq(effets_indesirables.medicament_id, medicamentId))
      .orderBy(asc(effets_indesirables.id));
  }

  private async getPresentationsByMedicament(
    medicamentId: number,
  ): Promise<PresentationRecord[]> {
    return medicationsDb
      .select()
      .from(presentations)
      .where(eq(presentations.medicament_id, medicamentId))
      .orderBy(asc(presentations.id));
  }
}

export const medicationAssistantRepository = new MedicationAssistantRepository();
