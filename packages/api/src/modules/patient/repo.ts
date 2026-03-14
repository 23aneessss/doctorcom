import type { db as databaseClient } from "@doctor.com/db";
import {
  antecedents,
  documents_patient,
  examen_consultation,
  ordonnance,
  patients,
  patients_femmes,
  rendez_vous,
  suivi,
  utilisateurs,
  vaccinations_patient,
  voyages_recents,
} from "@doctor.com/db/schema";
import { and, desc, eq, ilike, ne, type SQL } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;

type NewPatientRecord = typeof patients.$inferInsert;
type NewPatientFemmeRecord = typeof patients_femmes.$inferInsert;

export type PatientRecord = typeof patients.$inferSelect;
export type PatientFemmeRecord = typeof patients_femmes.$inferSelect;
export type AntecedentRecord = typeof antecedents.$inferSelect;
export type VaccinationPatientRecord = typeof vaccinations_patient.$inferSelect;
export type RendezVousRecord = typeof rendez_vous.$inferSelect;
export type SuiviRecord = typeof suivi.$inferSelect;
export type OrdonnanceRecord = typeof ordonnance.$inferSelect;
export type DocumentPatientRecord = typeof documents_patient.$inferSelect;
export type VoyageRecentRecord = typeof voyages_recents.$inferSelect;
export type ExamenConsultationRecord = typeof examen_consultation.$inferSelect;
export type UtilisateurRecord = typeof utilisateurs.$inferSelect;

export type CreatePatientInput = Omit<NewPatientRecord, "id">;
export type UpdatePatientInput = Partial<CreatePatientInput>;

export type CreateFemalePatientInfoInput = Omit<NewPatientFemmeRecord, "id">;
export type UpdateFemalePatientInfoInput = Partial<Omit<NewPatientFemmeRecord, "id" | "patient_id">>;

export interface SearchPatientsCriteria {
  nom?: string;
  prenom?: string;
  matricule?: string;
  nss?: number;
  telephone?: string;
  sexe?: string;
}

export class PatientRepository {
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

  async createPatient(
    database: DatabaseClient,
    data: CreatePatientInput,
  ): Promise<PatientRecord> {
    const [createdPatient] = await database.insert(patients).values(data).returning();

    if (!createdPatient) {
      throw new Error("Echec de creation du patient.");
    }

    return createdPatient;
  }

  async updatePatient(
    database: DatabaseClient,
    id: string,
    data: UpdatePatientInput,
  ): Promise<PatientRecord | null> {
    if (Object.keys(data).length === 0) {
      return this.getPatientById(database, id);
    }

    const [updatedPatient] = await database
      .update(patients)
      .set(data)
      .where(eq(patients.id, id))
      .returning();

    return updatedPatient ?? null;
  }

  async deletePatient(database: DatabaseClient, id: string): Promise<boolean> {
    const [deletedPatient] = await database
      .delete(patients)
      .where(eq(patients.id, id))
      .returning({ id: patients.id });

    return Boolean(deletedPatient);
  }

  async getPatientById(database: DatabaseClient, id: string): Promise<PatientRecord | null> {
    const [patient] = await database.select().from(patients).where(eq(patients.id, id)).limit(1);

    return patient ?? null;
  }

  async getPatientByMatricule(
    database: DatabaseClient,
    matricule: string,
  ): Promise<PatientRecord | null> {
    const [patient] = await database
      .select()
      .from(patients)
      .where(eq(patients.matricule, matricule))
      .limit(1);

    return patient ?? null;
  }

  async searchPatients(
    database: DatabaseClient,
    criteres: SearchPatientsCriteria,
  ): Promise<PatientRecord[]> {
    const filters: SQL[] = [];

    if (criteres.nom) {
      filters.push(ilike(patients.nom, `%${criteres.nom}%`));
    }
    if (criteres.prenom) {
      filters.push(ilike(patients.prenom, `%${criteres.prenom}%`));
    }
    if (criteres.matricule) {
      filters.push(ilike(patients.matricule, `%${criteres.matricule}%`));
    }
    if (criteres.telephone) {
      filters.push(ilike(patients.telephone, `%${criteres.telephone}%`));
    }
    if (criteres.sexe) {
      filters.push(eq(patients.sexe, criteres.sexe));
    }
    if (criteres.nss !== undefined) {
      filters.push(eq(patients.nss, criteres.nss));
    }

    if (filters.length === 0) {
      return this.getPatients(database);
    }

    return database
      .select()
      .from(patients)
      .where(and(...filters))
      .orderBy(patients.nom, patients.prenom);
  }

  async getPatients(database: DatabaseClient): Promise<PatientRecord[]> {
    return database.select().from(patients).orderBy(patients.nom, patients.prenom);
  }

  async createFemalePatientInfo(
    database: DatabaseClient,
    data: CreateFemalePatientInfoInput,
  ): Promise<PatientFemmeRecord> {
    const [createdInfo] = await database.insert(patients_femmes).values(data).returning();

    if (!createdInfo) {
      throw new Error("Echec de creation des informations medicales feminines.");
    }

    return createdInfo;
  }

  async updateFemalePatientInfo(
    database: DatabaseClient,
    patientId: string,
    data: UpdateFemalePatientInfoInput,
  ): Promise<PatientFemmeRecord | null> {
    if (Object.keys(data).length === 0) {
      return this.getFemalePatientInfo(database, patientId);
    }

    const [updatedInfo] = await database
      .update(patients_femmes)
      .set(data)
      .where(eq(patients_femmes.patient_id, patientId))
      .returning();

    return updatedInfo ?? null;
  }

  async getFemalePatientInfo(
    database: DatabaseClient,
    patientId: string,
  ): Promise<PatientFemmeRecord | null> {
    const [femaleInfo] = await database
      .select()
      .from(patients_femmes)
      .where(eq(patients_femmes.patient_id, patientId))
      .limit(1);

    return femaleInfo ?? null;
  }

  async getPatientAntecedents(
    database: DatabaseClient,
    patientId: string,
  ): Promise<AntecedentRecord[]> {
    return database
      .select()
      .from(antecedents)
      .where(eq(antecedents.patient_id, patientId));
  }

  async getPatientVaccinations(
    database: DatabaseClient,
    patientId: string,
  ): Promise<VaccinationPatientRecord[]> {
    return database
      .select()
      .from(vaccinations_patient)
      .where(eq(vaccinations_patient.patient_id, patientId))
      .orderBy(desc(vaccinations_patient.date_vaccination));
  }

  async getPatientRendezVous(
    database: DatabaseClient,
    patientId: string,
  ): Promise<RendezVousRecord[]> {
    return database
      .select()
      .from(rendez_vous)
      .where(eq(rendez_vous.patient_id, patientId))
      .orderBy(desc(rendez_vous.date));
  }

  async getPatientSuivis(database: DatabaseClient, patientId: string): Promise<SuiviRecord[]> {
    return database.select().from(suivi).where(eq(suivi.patient_id, patientId)).orderBy(desc(suivi.date_ouverture));
  }

  async getPatientOrdonnances(
    database: DatabaseClient,
    patientId: string,
  ): Promise<OrdonnanceRecord[]> {
    return database
      .select()
      .from(ordonnance)
      .where(eq(ordonnance.patient_id, patientId))
      .orderBy(desc(ordonnance.date_prescription));
  }

  async getPatientDocuments(
    database: DatabaseClient,
    patientId: string,
  ): Promise<DocumentPatientRecord[]> {
    return database
      .select()
      .from(documents_patient)
      .where(eq(documents_patient.patient_id, patientId))
      .orderBy(desc(documents_patient.date_upload));
  }

  async getPatientVoyages(
    database: DatabaseClient,
    patientId: string,
  ): Promise<VoyageRecentRecord[]> {
    return database
      .select()
      .from(voyages_recents)
      .where(eq(voyages_recents.patient_id, patientId))
      .orderBy(desc(voyages_recents.date));
  }

  async getPatientLastExamen(
    database: DatabaseClient,
    patientId: string,
  ): Promise<ExamenConsultationRecord | null> {
    const [lastExamen] = await database
      .select({ examen: examen_consultation })
      .from(examen_consultation)
      .innerJoin(rendez_vous, eq(examen_consultation.rendez_vous_id, rendez_vous.id))
      .where(eq(rendez_vous.patient_id, patientId))
      .orderBy(desc(examen_consultation.date))
      .limit(1);

    return lastExamen?.examen ?? null;
  }

  async hasNssConflict(
    database: DatabaseClient,
    nss: number,
    excludedPatientId?: string,
  ): Promise<boolean> {
    const whereClause = excludedPatientId
      ? and(eq(patients.nss, nss), ne(patients.id, excludedPatientId))
      : eq(patients.nss, nss);

    const [existingPatient] = await database
      .select({ id: patients.id })
      .from(patients)
      .where(whereClause)
      .limit(1);

    if (!existingPatient) {
      return false;
    }

    return true;
  }
}

export const patientRepository = new PatientRepository();