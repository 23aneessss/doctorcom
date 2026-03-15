import type { db as databaseClient } from "@doctor.com/db";
import { examen_consultation, suivi, utilisateurs } from "@doctor.com/db/schema";
import { and, desc, eq } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;

type NewSuivi = typeof suivi.$inferInsert;
type NewExamenConsultation = typeof examen_consultation.$inferInsert;

export type SuiviRecord = typeof suivi.$inferSelect;
export type ExamenConsultationRecord = typeof examen_consultation.$inferSelect;
export type UtilisateurRecord = typeof utilisateurs.$inferSelect;

export interface CreateSuiviInput {
  patient_id: string;
  utilisateur_id: string;
  hypothese_diagnostic?: string | null;
  motif: string;
  historique?: string | null;
  date_ouverture: string;
  est_actif?: boolean;
}

export interface UpdateSuiviInput {
  hypothese_diagnostic?: string | null;
  motif?: string;
  historique?: string | null;
  date_ouverture?: string;
  date_fermeture?: string | null;
  est_actif?: boolean;
}

export interface CreateExamenInput {
  rendez_vous_id: string;
  suivi_id: string;
  date: string;
  taille?: string | null;
  poids?: string | null;
  traitement_prescrit?: string | null;
  description_consultation?: string | null;
  aspect_general?: string | null;
  examen_respiratoire?: string | null;
  examen_cardiovasculaire?: string | null;
  examen_cutane_muqueux?: string | null;
  examen_orl?: string | null;
  examen_digestif?: string | null;
  examen_neurologique?: string | null;
  examen_locomoteur?: string | null;
  examen_genital?: string | null;
  examen_urinaire?: string | null;
  examen_ganglionnaire?: string | null;
  examen_endocrinien?: string | null;
  conclusion?: string | null;
}

export interface UpdateExamenInput {
  date?: string;
  taille?: string | null;
  poids?: string | null;
  traitement_prescrit?: string | null;
  description_consultation?: string | null;
  aspect_general?: string | null;
  examen_respiratoire?: string | null;
  examen_cardiovasculaire?: string | null;
  examen_cutane_muqueux?: string | null;
  examen_orl?: string | null;
  examen_digestif?: string | null;
  examen_neurologique?: string | null;
  examen_locomoteur?: string | null;
  examen_genital?: string | null;
  examen_urinaire?: string | null;
  examen_ganglionnaire?: string | null;
  examen_endocrinien?: string | null;
  conclusion?: string | null;
}

export class ConsultationRepository {
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

  async createSuivi(
    database: DatabaseClient,
    input: CreateSuiviInput,
  ): Promise<SuiviRecord> {
    const values: NewSuivi = {
      patient_id: input.patient_id,
      utilisateur_id: input.utilisateur_id,
      hypothese_diagnostic: input.hypothese_diagnostic ?? null,
      motif: input.motif,
      historique: input.historique ?? null,
      date_ouverture: input.date_ouverture,
      est_actif: input.est_actif ?? true,
    };

    const [createdSuivi] = await database.insert(suivi).values(values).returning();
    if (!createdSuivi) {
      throw new Error("Echec de creation du suivi.");
    }

    return createdSuivi;
  }

  async updateSuivi(
    database: DatabaseClient,
    suiviId: string,
    input: UpdateSuiviInput,
  ): Promise<SuiviRecord | null> {
    const updateData: UpdateSuiviInput = {};

    if (input.hypothese_diagnostic !== undefined) {
      updateData.hypothese_diagnostic = input.hypothese_diagnostic;
    }
    if (input.motif !== undefined) {
      updateData.motif = input.motif;
    }
    if (input.historique !== undefined) {
      updateData.historique = input.historique;
    }
    if (input.date_ouverture !== undefined) {
      updateData.date_ouverture = input.date_ouverture;
    }
    if (input.date_fermeture !== undefined) {
      updateData.date_fermeture = input.date_fermeture;
    }
    if (input.est_actif !== undefined) {
      updateData.est_actif = input.est_actif;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getSuiviById(database, suiviId);
    }

    const [updatedSuivi] = await database
      .update(suivi)
      .set(updateData)
      .where(eq(suivi.id, suiviId))
      .returning();

    return updatedSuivi ?? null;
  }

  async closeSuivi(
    database: DatabaseClient,
    suiviId: string,
    dateFermeture: string,
  ): Promise<SuiviRecord | null> {
    const [closedSuivi] = await database
      .update(suivi)
      .set({
        date_fermeture: dateFermeture,
        est_actif: false,
      })
      .where(eq(suivi.id, suiviId))
      .returning();

    return closedSuivi ?? null;
  }

  async getSuiviById(
    database: DatabaseClient,
    suiviId: string,
  ): Promise<SuiviRecord | null> {
    const [foundSuivi] = await database
      .select()
      .from(suivi)
      .where(eq(suivi.id, suiviId))
      .limit(1);

    return foundSuivi ?? null;
  }

  async getSuivisByPatient(
    database: DatabaseClient,
    patientId: string,
  ): Promise<SuiviRecord[]> {
    return database
      .select()
      .from(suivi)
      .where(eq(suivi.patient_id, patientId))
      .orderBy(desc(suivi.date_ouverture));
  }

  async getActiveSuivisByPatient(
    database: DatabaseClient,
    patientId: string,
  ): Promise<SuiviRecord[]> {
    return database
      .select()
      .from(suivi)
      .where(and(eq(suivi.patient_id, patientId), eq(suivi.est_actif, true)))
      .orderBy(desc(suivi.date_ouverture));
  }

  async createExamen(
    database: DatabaseClient,
    input: CreateExamenInput,
  ): Promise<ExamenConsultationRecord> {
    const values: NewExamenConsultation = {
      rendez_vous_id: input.rendez_vous_id,
      suivi_id: input.suivi_id,
      date: input.date,
      taille: input.taille ?? null,
      poids: input.poids ?? null,
      traitement_prescrit: input.traitement_prescrit ?? null,
      description_consultation: input.description_consultation ?? null,
      aspect_general: input.aspect_general ?? null,
      examen_respiratoire: input.examen_respiratoire ?? null,
      examen_cardiovasculaire: input.examen_cardiovasculaire ?? null,
      examen_cutane_muqueux: input.examen_cutane_muqueux ?? null,
      examen_orl: input.examen_orl ?? null,
      examen_digestif: input.examen_digestif ?? null,
      examen_neurologique: input.examen_neurologique ?? null,
      examen_locomoteur: input.examen_locomoteur ?? null,
      examen_genital: input.examen_genital ?? null,
      examen_urinaire: input.examen_urinaire ?? null,
      examen_ganglionnaire: input.examen_ganglionnaire ?? null,
      examen_endocrinien: input.examen_endocrinien ?? null,
      conclusion: input.conclusion ?? null,
    };

    const [createdExamen] = await database
      .insert(examen_consultation)
      .values(values)
      .returning();

    if (!createdExamen) {
      throw new Error("Echec de creation de l'examen de consultation.");
    }

    return createdExamen;
  }

  async updateExamen(
    database: DatabaseClient,
    examenId: string,
    input: UpdateExamenInput,
  ): Promise<ExamenConsultationRecord | null> {
    const updateData: UpdateExamenInput = {};

    if (input.date !== undefined) {
      updateData.date = input.date;
    }
    if (input.taille !== undefined) {
      updateData.taille = input.taille;
    }
    if (input.poids !== undefined) {
      updateData.poids = input.poids;
    }
    if (input.traitement_prescrit !== undefined) {
      updateData.traitement_prescrit = input.traitement_prescrit;
    }
    if (input.description_consultation !== undefined) {
      updateData.description_consultation = input.description_consultation;
    }
    if (input.aspect_general !== undefined) {
      updateData.aspect_general = input.aspect_general;
    }
    if (input.examen_respiratoire !== undefined) {
      updateData.examen_respiratoire = input.examen_respiratoire;
    }
    if (input.examen_cardiovasculaire !== undefined) {
      updateData.examen_cardiovasculaire = input.examen_cardiovasculaire;
    }
    if (input.examen_cutane_muqueux !== undefined) {
      updateData.examen_cutane_muqueux = input.examen_cutane_muqueux;
    }
    if (input.examen_orl !== undefined) {
      updateData.examen_orl = input.examen_orl;
    }
    if (input.examen_digestif !== undefined) {
      updateData.examen_digestif = input.examen_digestif;
    }
    if (input.examen_neurologique !== undefined) {
      updateData.examen_neurologique = input.examen_neurologique;
    }
    if (input.examen_locomoteur !== undefined) {
      updateData.examen_locomoteur = input.examen_locomoteur;
    }
    if (input.examen_genital !== undefined) {
      updateData.examen_genital = input.examen_genital;
    }
    if (input.examen_urinaire !== undefined) {
      updateData.examen_urinaire = input.examen_urinaire;
    }
    if (input.examen_ganglionnaire !== undefined) {
      updateData.examen_ganglionnaire = input.examen_ganglionnaire;
    }
    if (input.examen_endocrinien !== undefined) {
      updateData.examen_endocrinien = input.examen_endocrinien;
    }
    if (input.conclusion !== undefined) {
      updateData.conclusion = input.conclusion;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getExamenById(database, examenId);
    }

    const [updatedExamen] = await database
      .update(examen_consultation)
      .set(updateData)
      .where(eq(examen_consultation.id, examenId))
      .returning();

    return updatedExamen ?? null;
  }

  async getExamenById(
    database: DatabaseClient,
    examenId: string,
  ): Promise<ExamenConsultationRecord | null> {
    const [foundExamen] = await database
      .select()
      .from(examen_consultation)
      .where(eq(examen_consultation.id, examenId))
      .limit(1);

    return foundExamen ?? null;
  }

  async getExamensBySuivi(
    database: DatabaseClient,
    suiviId: string,
  ): Promise<ExamenConsultationRecord[]> {
    return database
      .select()
      .from(examen_consultation)
      .where(eq(examen_consultation.suivi_id, suiviId))
      .orderBy(desc(examen_consultation.date));
  }

  async getExamensByPatient(
    database: DatabaseClient,
    patientId: string,
  ): Promise<ExamenConsultationRecord[]> {
    const rows = await database
      .select({ examen: examen_consultation })
      .from(examen_consultation)
      .innerJoin(suivi, eq(examen_consultation.suivi_id, suivi.id))
      .where(eq(suivi.patient_id, patientId))
      .orderBy(desc(examen_consultation.date));

    return rows.map((row) => row.examen);
  }
}

export const consultationRepository = new ConsultationRepository();
