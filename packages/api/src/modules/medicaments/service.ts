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
import { ordonnanceEmbeddingTasks } from "../ai/ordonnance-recommendation/embedding-tasks";

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

export interface MobileMedicationSummary {
  id: number;
  name: string;
  genericName: string | null;
  category: string;
  classification: string | null;
  family: string | null;
  usageSnippet: string | null;
  alphabet: string;
  searchKey: string;
}

export interface MobileMedicationDetail extends MobileMedicationSummary {
  adultDosage: string | null;
  childDosage: string | null;
  maxDose: string | null;
  administrationFrequency: string | null;
  pregnancy: string | null;
  breastfeeding: string | null;
  indications: string[];
  precautions: string[];
  contraIndications: string[];
  activeSubstances: string[];
  interactions: string[];
  presentations: Array<{ forme: string | null; dosage: string | null }>;
  sideEffects: Array<{ effect: string; frequency: string | null }>;
}

interface MobileMedicationDataset {
  summaries: MobileMedicationSummary[];
  categories: string[];
  totalCount: number;
  byId: Map<number, MobileMedicationDetail>;
}

let mobileMedicationDatasetCache: MobileMedicationDataset | null = null;

export class MedicamentsService {
  async creerMedicament(input: CreateMedicamentAggregateInput): Promise<MedicamentAggregate> {
    const normalized = this.normalizeCreateInput(input);

    const aggregate = await withMedicationsTx(async (tx: MedicationsTransaction) => {
      const medicament = await medicamentsRepository.createMedicament(tx, normalized.medicament);
      const nested = await this.replaceNestedCollections(tx, medicament.id, normalized);
      return {
        medicament,
        ...nested,
      };
    });

    mobileMedicationDatasetCache = null;
    ordonnanceEmbeddingTasks.scheduleUpsertFromAggregate(aggregate);
    return aggregate;
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

    const aggregate = await withMedicationsTx(async (tx: MedicationsTransaction) => {
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
      const aggregate = {
        medicament,
        ...nested,
      };
      return aggregate;
    });

    mobileMedicationDatasetCache = null;
    ordonnanceEmbeddingTasks.scheduleUpsertFromAggregate(aggregate);
    return aggregate;
  }

  async supprimerMedicament(medicamentId: number): Promise<{ success: true }> {
    const existing = await medicamentsRepository.getMedicamentById(medicationsDb, medicamentId);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Medicament introuvable.",
      });
    }

    const deleted = await withMedicationsTx(async (tx: MedicationsTransaction) => {
      return medicamentsRepository.deleteMedicament(tx, medicamentId);
    });

    if (!deleted) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de suppression du medicament.",
      });
    }

    mobileMedicationDatasetCache = null;
    ordonnanceEmbeddingTasks.scheduleDelete(medicamentId);
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

  async listAllMedicaments(): Promise<MedicamentRecord[]> {
    return medicamentsRepository.listAllMedicaments(medicationsDb);
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

  async getMobileMedicationCategories(): Promise<{
    categories: string[];
    totalCount: number;
  }> {
    const dataset = await this.getMobileMedicationDataset();
    return {
      categories: dataset.categories,
      totalCount: dataset.totalCount,
    };
  }

  async searchMobileMedicationCatalog(filters: {
    query?: string;
    startsWith?: string;
    category?: string;
    limit?: number;
  }): Promise<{
    items: MobileMedicationSummary[];
    total: number;
  }> {
    const dataset = await this.getMobileMedicationDataset();
    const normalizedQuery = this.normalizeText(filters.query);
    const normalizedCategory = filters.category?.trim();
    const normalizedLetter = filters.startsWith?.trim().toUpperCase();

    const items = dataset.summaries.filter((medication) => {
      const matchesQuery =
        !normalizedQuery || medication.searchKey.includes(normalizedQuery);
      const matchesLetter =
        !normalizedLetter || medication.alphabet === normalizedLetter;
      const matchesCategory =
        !normalizedCategory ||
        normalizedCategory === "Toutes les catégories" ||
        medication.category === normalizedCategory;

      return matchesQuery && matchesLetter && matchesCategory;
    });

    return {
      items: items.slice(0, filters.limit ?? 80),
      total: items.length,
    };
  }

  async getMobileMedicationById(medicamentId: number): Promise<MobileMedicationDetail> {
    const dataset = await this.getMobileMedicationDataset();
    const medication = dataset.byId.get(medicamentId);

    if (!medication) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Médicament introuvable.",
      });
    }

    return medication;
  }

  private normalizeMedicamentId(value: number | string): number {
    return typeof value === "number" ? value : Number(value);
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

  private normalizeText(value: string | null | undefined): string {
    return (value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  private getPrimaryCategory(medicament: MedicamentRecord): string {
    const source =
      medicament.classe_therapeutique ??
      medicament.famille_pharmacologique ??
      "Autres";
    const firstSegment = source.split("||")[0] ?? "Autres";
    const cleaned = firstSegment
      .replace(/^Classification pharmacothérapeutique VIDAL:\s*/i, "")
      .replace(/^Classification ATC:\s*/i, "")
      .trim();

    const primary = cleaned.split(">")[0]?.trim() || cleaned;
    return primary.length > 0 ? primary : "Autres";
  }

  private async getMobileMedicationDataset(): Promise<MobileMedicationDataset> {
    if (mobileMedicationDatasetCache) {
      return mobileMedicationDatasetCache;
    }

    const [
      medicaments,
      indications,
      precautions,
      contreIndications,
      effetsIndesirables,
      presentations,
      interactions,
      substancesActives,
    ] = await Promise.all([
      medicamentsRepository.listAllMedicaments(medicationsDb),
      medicamentsRepository.listAllIndications(medicationsDb),
      medicamentsRepository.listAllPrecautions(medicationsDb),
      medicamentsRepository.listAllContreIndications(medicationsDb),
      medicamentsRepository.listAllEffetsIndesirables(medicationsDb),
      medicamentsRepository.listAllPresentations(medicationsDb),
      medicamentsRepository.listAllInteractions(medicationsDb),
      medicamentsRepository.listAllSubstances(medicationsDb),
    ]);

    const groupByMedicament = <T extends { medicament_id: number | string }>(rows: T[]) => {
      const map = new Map<number, T[]>();

      for (const row of rows) {
        const medicamentId = this.normalizeMedicamentId(row.medicament_id);
        const current = map.get(medicamentId) ?? [];
        current.push(row);
        map.set(medicamentId, current);
      }

      return map;
    };

    const unique = <T,>(values: T[]) => Array.from(new Set(values));

    const indicationsMap = groupByMedicament(indications);
    const precautionsMap = groupByMedicament(precautions);
    const contreIndicationsMap = groupByMedicament(contreIndications);
    const sideEffectsMap = groupByMedicament(effetsIndesirables);
    const presentationsMap = groupByMedicament(presentations);
    const interactionsMap = groupByMedicament(interactions);
    const substancesMap = groupByMedicament(substancesActives);

    const summaries: MobileMedicationSummary[] = [];
    const byId = new Map<number, MobileMedicationDetail>();

    for (const medicament of medicaments) {
      const medicamentId = this.normalizeMedicamentId(medicament.id);
      const category = this.getPrimaryCategory(medicament);
      const medicationIndications = unique(
        (indicationsMap.get(medicamentId) ?? [])
          .map((row) => row.indication.trim())
          .filter(Boolean),
      );
      const medicationPrecautions = unique(
        (precautionsMap.get(medicamentId) ?? [])
          .map((row) => row.description.trim())
          .filter(Boolean),
      );
      const medicationContraIndications = unique(
        (contreIndicationsMap.get(medicamentId) ?? [])
          .map((row) => row.description.trim())
          .filter(Boolean),
      );
      const medicationInteractions = unique(
        (interactionsMap.get(medicamentId) ?? [])
          .map((row) => row.medicament_interaction.trim())
          .filter(Boolean),
      );
      const medicationSubstances = unique(
        (substancesMap.get(medicamentId) ?? [])
          .map((row) => row.nom_substance.trim())
          .filter(Boolean),
      );
      const medicationPresentations = unique(
        (presentationsMap.get(medicamentId) ?? []).map((row) =>
          JSON.stringify({
            forme: row.forme?.trim() ?? null,
            dosage: row.dosage?.trim() ?? null,
          }),
        ),
      ).map((value) => JSON.parse(value) as { forme: string | null; dosage: string | null });

      const medicationSideEffects = (sideEffectsMap.get(medicamentId) ?? []).map((row) => ({
        effect: row.effet.trim(),
        frequency: row.frequence?.trim() ?? null,
      }));

      const summary: MobileMedicationSummary = {
        id: medicamentId,
        name: medicament.nom_medicament,
        genericName: medicament.nom_generique,
        category,
        classification: medicament.classe_therapeutique,
        family: medicament.famille_pharmacologique,
        usageSnippet:
          medicationIndications[0] ??
          medicament.classe_therapeutique ??
          medicament.famille_pharmacologique,
        alphabet:
          this.normalizeText(medicament.nom_medicament).charAt(0).toUpperCase() || "#",
        searchKey: this.normalizeText(
          [
            medicament.nom_medicament,
            medicament.nom_generique,
            category,
            medicament.classe_therapeutique,
            medicament.famille_pharmacologique,
            medicationIndications[0],
          ]
            .filter(Boolean)
            .join(" "),
        ),
      };

      summaries.push(summary);
      byId.set(medicamentId, {
        ...summary,
        adultDosage: medicament.posologie_adulte,
        childDosage: medicament.posologie_enfant,
        maxDose: medicament.dose_maximale,
        administrationFrequency: medicament.frequence_administration,
        pregnancy: medicament.grossesse,
        breastfeeding: medicament.allaitement,
        indications: medicationIndications,
        precautions: medicationPrecautions,
        contraIndications: medicationContraIndications,
        activeSubstances: medicationSubstances,
        interactions: medicationInteractions,
        presentations: medicationPresentations,
        sideEffects: medicationSideEffects,
      });
    }

    summaries.sort((a, b) => a.name.localeCompare(b.name, "fr-FR"));
    const categories = unique(summaries.map((item) => item.category)).sort((a, b) =>
      a.localeCompare(b, "fr-FR"),
    );

    mobileMedicationDatasetCache = {
      summaries,
      categories,
      totalCount: summaries.length,
      byId,
    };

    return mobileMedicationDatasetCache;
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
