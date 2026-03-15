import { TRPCError } from "@trpc/server";
import { medicationsDb, withMedicationsTx } from "@doctor.com/medications-db";

import {
  medicamentsRepository,
  type ContreIndicationRecord,
  type CreateDescriptionInput,
  type CreateEffetIndesirableInput,
  type CreateIndicationInput,
  type CreateInteractionInput,
  type CreateMedicamentInput,
  type CreatePresentationInput,
  type CreateSubstanceInput,
  type EffetIndesirableRecord,
  type IndicationRecord,
  type InteractionRecord,
  type MedicamentRecord,
  type MedicamentSearchFilters,
  type PaginatedMedicaments,
  type PrecautionRecord,
  type PresentationRecord,
  type SubstanceActiveRecord,
  type UpdateMedicamentInput,
} from "./repo";

type MedicationsDatabaseClient = typeof medicationsDb;
type MedicationsTransaction = Parameters<Parameters<typeof withMedicationsTx>[0]>[0];

export interface MedicamentAggregate {
  medicament: MedicamentRecord;
  substances_actives: SubstanceActiveRecord[];
  indications: IndicationRecord[];
  contre_indications: ContreIndicationRecord[];
  precautions: PrecautionRecord[];
  interactions: InteractionRecord[];
  effets_indesirables: EffetIndesirableRecord[];
  presentations: PresentationRecord[];
}

export interface CreateMedicamentAggregateInput extends CreateMedicamentInput {
  substances_actives?: CreateSubstanceInput[];
  indications?: CreateIndicationInput[];
  contre_indications?: CreateDescriptionInput[];
  precautions?: CreateDescriptionInput[];
  interactions?: CreateInteractionInput[];
  effets_indesirables?: CreateEffetIndesirableInput[];
  presentations?: CreatePresentationInput[];
}

export interface UpdateMedicamentAggregateInput extends UpdateMedicamentInput {
  substances_actives?: CreateSubstanceInput[];
  indications?: CreateIndicationInput[];
  contre_indications?: CreateDescriptionInput[];
  precautions?: CreateDescriptionInput[];
  interactions?: CreateInteractionInput[];
  effets_indesirables?: CreateEffetIndesirableInput[];
  presentations?: CreatePresentationInput[];
}

interface NormalizedCreatePayload {
  medicament: CreateMedicamentInput;
  substances_actives: CreateSubstanceInput[];
  indications: CreateIndicationInput[];
  contre_indications: CreateDescriptionInput[];
  precautions: CreateDescriptionInput[];
  interactions: CreateInteractionInput[];
  effets_indesirables: CreateEffetIndesirableInput[];
  presentations: CreatePresentationInput[];
}

interface NormalizedUpdatePayload {
  medicament: UpdateMedicamentInput;
  substances_actives?: CreateSubstanceInput[];
  indications?: CreateIndicationInput[];
  contre_indications?: CreateDescriptionInput[];
  precautions?: CreateDescriptionInput[];
  interactions?: CreateInteractionInput[];
  effets_indesirables?: CreateEffetIndesirableInput[];
  presentations?: CreatePresentationInput[];
}

export class MedicamentsService {
  async creerMedicament(input: CreateMedicamentAggregateInput): Promise<MedicamentAggregate> {
    const normalized = this.normalizeCreateInput(input);

    return withMedicationsTx(async (tx: MedicationsTransaction) => {
      const medicament = await medicamentsRepository.createMedicament(tx, normalized.medicament);
      const nested = await this.replaceNestedCollections(tx, medicament.id, normalized);

      return {
        medicament,
        ...nested,
      };
    });
  }

  async mettreAJourMedicament(
    medicamentId: number,
    input: UpdateMedicamentAggregateInput,
  ): Promise<MedicamentAggregate> {
    const existing = await medicamentsRepository.getMedicamentById(medicationsDb, medicamentId);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Medicament introuvable.",
      });
    }

    const normalized = this.normalizeUpdateInput(input);

    return withMedicationsTx(async (tx: MedicationsTransaction) => {
      const medicament = await medicamentsRepository.updateMedicament(
        tx,
        medicamentId,
        normalized.medicament,
      );

      if (!medicament) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Echec de mise a jour du medicament.",
        });
      }

      const nested = await this.replaceNestedCollections(tx, medicamentId, normalized, false);
      return {
        medicament,
        ...nested,
      };
    });
  }

  async supprimerMedicament(medicamentId: number): Promise<{ success: true }> {
    const existing = await medicamentsRepository.getMedicamentById(medicationsDb, medicamentId);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Medicament introuvable.",
      });
    }

    const deleted = await withMedicationsTx(async (tx: MedicationsTransaction) =>
      medicamentsRepository.deleteMedicament(tx, medicamentId),
    );

    if (!deleted) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de suppression du medicament.",
      });
    }

    return { success: true };
  }

  async getMedicamentById(medicamentId: number): Promise<MedicamentAggregate> {
    const medicament = await medicamentsRepository.getMedicamentById(medicationsDb, medicamentId);
    if (!medicament) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Medicament introuvable.",
      });
    }

    return {
      medicament,
      substances_actives: await medicamentsRepository.getSubstancesByMedicament(
        medicationsDb,
        medicamentId,
      ),
      indications: await medicamentsRepository.getIndicationsByMedicament(
        medicationsDb,
        medicamentId,
      ),
      contre_indications: await medicamentsRepository.getContreIndicationsByMedicament(
        medicationsDb,
        medicamentId,
      ),
      precautions: await medicamentsRepository.getPrecautionsByMedicament(
        medicationsDb,
        medicamentId,
      ),
      interactions: await medicamentsRepository.getInteractionsByMedicament(
        medicationsDb,
        medicamentId,
      ),
      effets_indesirables: await medicamentsRepository.getEffetsIndesirablesByMedicament(
        medicationsDb,
        medicamentId,
      ),
      presentations: await medicamentsRepository.getPresentationsByMedicament(
        medicationsDb,
        medicamentId,
      ),
    };
  }

  async rechercherMedicaments(filters: MedicamentSearchFilters): Promise<PaginatedMedicaments> {
    return medicamentsRepository.searchMedicaments(medicationsDb, filters);
  }

  async getMedicamentSnapshot(medicamentId: number): Promise<{
    medicament_externe_id: string;
    nom_medicament: string;
    dci: string | null;
  }> {
    const medicament = await medicamentsRepository.getMedicamentById(medicationsDb, medicamentId);
    if (!medicament) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Medicament introuvable dans la base medicale.",
      });
    }

    return {
      medicament_externe_id: String(medicament.id),
      nom_medicament: medicament.nom_medicament,
      dci: medicament.nom_generique ?? null,
    };
  }

  private normalizeCreateInput(input: CreateMedicamentAggregateInput): NormalizedCreatePayload {
    return {
      medicament: {
        nom_medicament: this.requireTrimmedValue(input.nom_medicament, "Le nom du medicament est obligatoire."),
        nom_generique: input.nom_generique?.trim() || null,
        classe_therapeutique: input.classe_therapeutique?.trim() || null,
        famille_pharmacologique: input.famille_pharmacologique?.trim() || null,
        posologie_adulte: input.posologie_adulte?.trim() || null,
        posologie_enfant: input.posologie_enfant?.trim() || null,
        dose_maximale: input.dose_maximale?.trim() || null,
        frequence_administration: input.frequence_administration?.trim() || null,
        grossesse: input.grossesse?.trim() || null,
        allaitement: input.allaitement?.trim() || null,
      },
      substances_actives: this.normalizeSubstances(input.substances_actives),
      indications: this.normalizeIndications(input.indications),
      contre_indications: this.normalizeDescriptions(input.contre_indications),
      precautions: this.normalizeDescriptions(input.precautions),
      interactions: this.normalizeInteractions(input.interactions),
      effets_indesirables: this.normalizeEffets(input.effets_indesirables),
      presentations: this.normalizePresentations(input.presentations),
    };
  }

  private normalizeUpdateInput(input: UpdateMedicamentAggregateInput): NormalizedUpdatePayload {
    const medicament: UpdateMedicamentInput = {};

    if (input.nom_medicament !== undefined) {
      medicament.nom_medicament = this.requireTrimmedValue(
        input.nom_medicament,
        "Le nom du medicament ne peut pas etre vide.",
      );
    }

    const optionalFields = [
      "nom_generique",
      "classe_therapeutique",
      "famille_pharmacologique",
      "posologie_adulte",
      "posologie_enfant",
      "dose_maximale",
      "frequence_administration",
      "grossesse",
      "allaitement",
    ] as const;

    for (const field of optionalFields) {
      if (input[field] !== undefined) {
        medicament[field] = input[field]?.trim() || null;
      }
    }

    return {
      medicament,
      substances_actives:
        input.substances_actives === undefined
          ? undefined
          : this.normalizeSubstances(input.substances_actives),
      indications:
        input.indications === undefined
          ? undefined
          : this.normalizeIndications(input.indications),
      contre_indications:
        input.contre_indications === undefined
          ? undefined
          : this.normalizeDescriptions(input.contre_indications),
      precautions:
        input.precautions === undefined
          ? undefined
          : this.normalizeDescriptions(input.precautions),
      interactions:
        input.interactions === undefined
          ? undefined
          : this.normalizeInteractions(input.interactions),
      effets_indesirables:
        input.effets_indesirables === undefined
          ? undefined
          : this.normalizeEffets(input.effets_indesirables),
      presentations:
        input.presentations === undefined
          ? undefined
          : this.normalizePresentations(input.presentations),
    };
  }

  private normalizeSubstances(items: CreateSubstanceInput[] | undefined): CreateSubstanceInput[] {
    return (items ?? [])
      .map((item) => ({ nom_substance: item.nom_substance.trim() }))
      .filter((item) => item.nom_substance.length > 0);
  }

  private normalizeIndications(
    items: CreateIndicationInput[] | undefined,
  ): CreateIndicationInput[] {
    return (items ?? [])
      .map((item) => ({ indication: item.indication.trim() }))
      .filter((item) => item.indication.length > 0);
  }

  private normalizeDescriptions(
    items: CreateDescriptionInput[] | undefined,
  ): CreateDescriptionInput[] {
    return (items ?? [])
      .map((item) => ({ description: item.description.trim() }))
      .filter((item) => item.description.length > 0);
  }

  private normalizeInteractions(
    items: CreateInteractionInput[] | undefined,
  ): CreateInteractionInput[] {
    return (items ?? [])
      .map((item) => ({ medicament_interaction: item.medicament_interaction.trim() }))
      .filter((item) => item.medicament_interaction.length > 0);
  }

  private normalizeEffets(
    items: CreateEffetIndesirableInput[] | undefined,
  ): CreateEffetIndesirableInput[] {
    return (items ?? [])
      .map((item) => ({
        frequence: item.frequence?.trim() || null,
        effet: item.effet.trim(),
      }))
      .filter((item) => item.effet.length > 0);
  }

  private normalizePresentations(
    items: CreatePresentationInput[] | undefined,
  ): CreatePresentationInput[] {
    return (items ?? [])
      .map((item) => ({
        forme: item.forme?.trim() || null,
        dosage: item.dosage?.trim() || null,
      }))
      .filter((item) => item.forme || item.dosage);
  }

  private requireTrimmedValue(value: string, message: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message,
      });
    }
    return normalized;
  }

  private async replaceNestedCollections(
    database: MedicationsDatabaseClient | MedicationsTransaction,
    medicamentId: number,
    normalized: NormalizedCreatePayload | NormalizedUpdatePayload,
    createEmptyWhenUndefined = true,
  ) {
    const substances_actives =
      normalized.substances_actives === undefined && !createEmptyWhenUndefined
        ? await medicamentsRepository.getSubstancesByMedicament(database, medicamentId)
        : await medicamentsRepository.replaceSubstances(
            database,
            medicamentId,
            normalized.substances_actives ?? [],
          );

    const indications =
      normalized.indications === undefined && !createEmptyWhenUndefined
        ? await medicamentsRepository.getIndicationsByMedicament(database, medicamentId)
        : await medicamentsRepository.replaceIndications(
            database,
            medicamentId,
            normalized.indications ?? [],
          );

    const contre_indications =
      normalized.contre_indications === undefined && !createEmptyWhenUndefined
        ? await medicamentsRepository.getContreIndicationsByMedicament(database, medicamentId)
        : await medicamentsRepository.replaceContreIndications(
            database,
            medicamentId,
            normalized.contre_indications ?? [],
          );

    const precautions =
      normalized.precautions === undefined && !createEmptyWhenUndefined
        ? await medicamentsRepository.getPrecautionsByMedicament(database, medicamentId)
        : await medicamentsRepository.replacePrecautions(
            database,
            medicamentId,
            normalized.precautions ?? [],
          );

    const interactions =
      normalized.interactions === undefined && !createEmptyWhenUndefined
        ? await medicamentsRepository.getInteractionsByMedicament(database, medicamentId)
        : await medicamentsRepository.replaceInteractions(
            database,
            medicamentId,
            normalized.interactions ?? [],
          );

    const effets_indesirables =
      normalized.effets_indesirables === undefined && !createEmptyWhenUndefined
        ? await medicamentsRepository.getEffetsIndesirablesByMedicament(database, medicamentId)
        : await medicamentsRepository.replaceEffetsIndesirables(
            database,
            medicamentId,
            normalized.effets_indesirables ?? [],
          );

    const presentations =
      normalized.presentations === undefined && !createEmptyWhenUndefined
        ? await medicamentsRepository.getPresentationsByMedicament(database, medicamentId)
        : await medicamentsRepository.replacePresentations(
            database,
            medicamentId,
            normalized.presentations ?? [],
          );

    return {
      substances_actives,
      indications,
      contre_indications,
      precautions,
      interactions,
      effets_indesirables,
      presentations,
    };
  }
}

export const medicamentsService = new MedicamentsService();
