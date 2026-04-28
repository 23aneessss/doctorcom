import type { db as databaseClient } from "@doctor.com/db";
import {
  historique_traitements,
  patients,
  patients_femmes,
  antecedents,
  antecedents_personnels,
} from "@doctor.com/db/schema";
import {
  medicationsDb,
  medicaments,
  contre_indications,
  precautions,
  interactions,
} from "@doctor.com/medications-db";
import { eq, and, inArray } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MedicationWithDetails {
  id: number;
  nom_medicament: string;
  nom_generique: string | null;
  classe_therapeutique: string | null;
  posologie_adulte: string | null;
  posologie_enfant: string | null;
  dose_maximale: string | null;
  frequence_administration: string | null;
  grossesse: string | null;
  allaitement: string | null;
  contre_indications: { id: number; description: string }[];
  precautions: { id: number; description: string }[];
  interactions: { id: number; medicament_interaction: string }[];
}

export interface ActiveTreatment {
  id: string;
  medicament_externe_id: string;
  nom_medicament: string;
  dosage: string | null;
  posologie: string;
}

export interface FullPatientData {
  patient: {
    id: string;
    date_naissance: string;
    sexe: string | null;
    habitudes_toxiques: string | null;
  };
  donnees_femme: {
    menopause: boolean | null;
    contraception: string | null;
    nb_grossesses: number | null;
  } | null;
  antecedents: {
    id: string;
    description: string | null;
    personnels: {
      id: string;
      details: string | null;
    }[];
  }[];
}

export interface CorePatientData {
  id: string;
  date_naissance: string;
  sexe: string | null;
  habitudes_toxiques: string | null;
}

export interface PatientFemaleData {
  menopause: boolean | null;
  contraception: string | null;
  nb_grossesses: number | null;
}

export interface PatientAntecedentData {
  id: string;
  description: string | null;
  personnels: {
    id: string;
    details: string | null;
  }[];
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class AnomalyFlagRepository {
  /**
   * Fetches the mandatory patient core data required by anomaly-flag logic.
   */
  async getCorePatientData(
    database: DatabaseClient,
    patientId: string,
  ): Promise<CorePatientData | null> {
    const [patientRecord] = await database
      .select({
        id: patients.id,
        date_naissance: patients.date_naissance,
        sexe: patients.sexe,
        habitudes_toxiques: patients.habitudes_toxiques,
      })
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1);

    if (!patientRecord) {
      return null;
    }

    return patientRecord;
  }

  async getPatientFemaleData(
    database: DatabaseClient,
    patientId: string,
  ): Promise<PatientFemaleData | null> {
    const [row] = await database
      .select({
        menopause: patients_femmes.menopause,
        contraception: patients_femmes.contraception,
        nb_grossesses: patients_femmes.nb_grossesses,
      })
      .from(patients_femmes)
      .where(eq(patients_femmes.patient_id, patientId))
      .limit(1);

    return row ?? null;
  }

  async getPatientAntecedents(
    database: DatabaseClient,
    patientId: string,
  ): Promise<PatientAntecedentData[]> {
    const antecedentRows = await database
      .select({
        id: antecedents.id,
        description: antecedents.description,
      })
      .from(antecedents)
      .where(eq(antecedents.patient_id, patientId));

    let personnelsByAntecedent = new Map<
      string,
      { id: string; details: string | null }[]
    >();

    if (antecedentRows.length > 0) {
      const antecedentIds = antecedentRows.map((a) => a.id);
      const personnelsRows = await database
        .select({
          id: antecedents_personnels.id,
          antecedent_id: antecedents_personnels.antecedent_id,
          details: antecedents_personnels.details,
        })
        .from(antecedents_personnels)
        .where(inArray(antecedents_personnels.antecedent_id, antecedentIds));

      personnelsByAntecedent = personnelsRows.reduce(
        (acc, row) => {
          const list = acc.get(row.antecedent_id) ?? [];
          list.push({ id: row.id, details: row.details });
          acc.set(row.antecedent_id, list);
          return acc;
        },
        new Map<string, { id: string; details: string | null }[]>(),
      );
    }

    return antecedentRows.map((ant) => ({
      id: ant.id,
      description: ant.description,
      personnels: personnelsByAntecedent.get(ant.id) ?? [],
    }));
  }

  /**
   * Fetches only the patient data required by anomaly-flag logic.
   */
  async getFullPatientData(
    database: DatabaseClient,
    patientId: string,
  ): Promise<FullPatientData | null> {
    const patientRecord = await this.getCorePatientData(database, patientId);

    if (!patientRecord) {
      return null;
    }

    const [donneesFemme, antecedents] = await Promise.all([
      this.getPatientFemaleData(database, patientId),
      this.getPatientAntecedents(database, patientId),
    ]);

    return {
      patient: patientRecord,
      donnees_femme: donneesFemme,
      antecedents,
    };
  }

  /**
   * Fetches multiple medications with details in batches.
   * Returns only the medications that were found.
   */
  async getMedicationsByIds(
    medicamentIds: number[],
  ): Promise<MedicationWithDetails[]> {
    const uniqueIds = [...new Set(medicamentIds.filter((id) => Number.isInteger(id)))];
    if (uniqueIds.length === 0) {
      return [];
    }

    const medicationRows = await medicationsDb
      .select()
      .from(medicaments)
      .where(inArray(medicaments.id, uniqueIds));

    if (medicationRows.length === 0) {
      return [];
    }

    const foundIds = medicationRows.map((med) => med.id);

    const [contreIndicationRows, precautionRows, interactionRows] =
      await Promise.all([
        medicationsDb
          .select({
            id: contre_indications.id,
            medicament_id: contre_indications.medicament_id,
            description: contre_indications.description,
          })
          .from(contre_indications)
          .where(inArray(contre_indications.medicament_id, foundIds)),
        medicationsDb
          .select({
            id: precautions.id,
            medicament_id: precautions.medicament_id,
            description: precautions.description,
          })
          .from(precautions)
          .where(inArray(precautions.medicament_id, foundIds)),
        medicationsDb
          .select({
            id: interactions.id,
            medicament_id: interactions.medicament_id,
            medicament_interaction: interactions.medicament_interaction,
          })
          .from(interactions)
          .where(inArray(interactions.medicament_id, foundIds)),
      ]);

    const contreIndicationsByMedication = contreIndicationRows.reduce(
      (acc, row) => {
        const list = acc.get(row.medicament_id) ?? [];
        list.push({ id: row.id, description: row.description });
        acc.set(row.medicament_id, list);
        return acc;
      },
      new Map<number, { id: number; description: string }[]>(),
    );

    const precautionsByMedication = precautionRows.reduce(
      (acc, row) => {
        const list = acc.get(row.medicament_id) ?? [];
        list.push({ id: row.id, description: row.description });
        acc.set(row.medicament_id, list);
        return acc;
      },
      new Map<number, { id: number; description: string }[]>(),
    );

    const interactionsByMedication = interactionRows.reduce(
      (acc, row) => {
        const list = acc.get(row.medicament_id) ?? [];
        list.push({
          id: row.id,
          medicament_interaction: row.medicament_interaction,
        });
        acc.set(row.medicament_id, list);
        return acc;
      },
      new Map<number, { id: number; medicament_interaction: string }[]>(),
    );

    return medicationRows.map((medication) => ({
      id: medication.id,
      nom_medicament: medication.nom_medicament,
      nom_generique: medication.nom_generique,
      classe_therapeutique: medication.classe_therapeutique,
      posologie_adulte: medication.posologie_adulte,
      posologie_enfant: medication.posologie_enfant,
      dose_maximale: medication.dose_maximale,
      frequence_administration: medication.frequence_administration,
      grossesse: medication.grossesse,
      allaitement: medication.allaitement,
      contre_indications:
        contreIndicationsByMedication.get(medication.id) ?? [],
      precautions: precautionsByMedication.get(medication.id) ?? [],
      interactions: interactionsByMedication.get(medication.id) ?? [],
    }));
  }

  /**
   * Fetches all active treatments for a patient from the clinic database.
   */
  async getActivePatientTreatments(
    database: DatabaseClient,
    patientId: string,
  ): Promise<ActiveTreatment[]> {
    const rows = await database
      .select({
        id: historique_traitements.id,
        medicament_externe_id: historique_traitements.medicament_externe_id,
        nom_medicament: historique_traitements.nom_medicament,
        dosage: historique_traitements.dosage,
        posologie: historique_traitements.posologie,
      })
      .from(historique_traitements)
      .where(
        and(
          eq(historique_traitements.patient_id, patientId),
          eq(historique_traitements.est_actif, true),
        ),
      );

    return rows;
  }
}

export const anomalyFlagRepository = new AnomalyFlagRepository();
