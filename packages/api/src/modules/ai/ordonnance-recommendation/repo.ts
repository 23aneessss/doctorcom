import type { db as databaseClient } from "@doctor.com/db";
import {
  antecedents,
  antecedents_familiaux,
  antecedents_personnels,
  examen_consultation,
  historique_traitements,
  patients,
  patients_femmes,
  suivi,
  utilisateurs,
  vaccinations_patient,
  voyages_recents,
} from "@doctor.com/db/schema";
import { and, desc, eq, inArray, ne } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;

export type UtilisateurRecord = typeof utilisateurs.$inferSelect;
export type SuiviRecord = typeof suivi.$inferSelect;
export type ExamenConsultationRecord = typeof examen_consultation.$inferSelect;
export type PatientRecord = typeof patients.$inferSelect;
export type PatientFemmeRecord = typeof patients_femmes.$inferSelect;
export type AntecedentRecord = typeof antecedents.$inferSelect;
export type AntecedentPersonnelRecord = typeof antecedents_personnels.$inferSelect;
export type AntecedentFamilialRecord = typeof antecedents_familiaux.$inferSelect;
export type TreatmentRecord = typeof historique_traitements.$inferSelect;
export type VoyageRecentRecord = typeof voyages_recents.$inferSelect;
export type VaccinationRecord = typeof vaccinations_patient.$inferSelect;

export class OrdonnanceRecommendationRepository {
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

  async getSuiviById(
    database: DatabaseClient,
    suiviId: string,
  ): Promise<SuiviRecord | null> {
    const [currentSuivi] = await database
      .select()
      .from(suivi)
      .where(eq(suivi.id, suiviId))
      .limit(1);

    return currentSuivi ?? null;
  }

  async getExamenById(
    database: DatabaseClient,
    examenId: string,
  ): Promise<ExamenConsultationRecord | null> {
    const [examen] = await database
      .select()
      .from(examen_consultation)
      .where(eq(examen_consultation.id, examenId))
      .limit(1);

    return examen ?? null;
  }

  async getLatestExamenBySuivi(
    database: DatabaseClient,
    suiviId: string,
  ): Promise<ExamenConsultationRecord | null> {
    const [examen] = await database
      .select()
      .from(examen_consultation)
      .where(eq(examen_consultation.suivi_id, suiviId))
      .orderBy(desc(examen_consultation.date), desc(examen_consultation.id))
      .limit(1);

    return examen ?? null;
  }

  async getPatientById(
    database: DatabaseClient,
    patientId: string,
  ): Promise<PatientRecord | null> {
    const [patient] = await database
      .select()
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1);

    return patient ?? null;
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

  async getAntecedentsByPatient(
    database: DatabaseClient,
    patientId: string,
  ): Promise<AntecedentRecord[]> {
    return database
      .select()
      .from(antecedents)
      .where(eq(antecedents.patient_id, patientId))
      .orderBy(desc(antecedents.id));
  }

  async getPersonalAntecedentsByAntecedentIds(
    database: DatabaseClient,
    antecedentIds: string[],
  ): Promise<AntecedentPersonnelRecord[]> {
    if (antecedentIds.length === 0) {
      return [];
    }

    return database
      .select()
      .from(antecedents_personnels)
      .where(inArray(antecedents_personnels.antecedent_id, antecedentIds))
      .orderBy(desc(antecedents_personnels.id));
  }

  async getFamilyAntecedentsByAntecedentIds(
    database: DatabaseClient,
    antecedentIds: string[],
  ): Promise<AntecedentFamilialRecord[]> {
    if (antecedentIds.length === 0) {
      return [];
    }

    return database
      .select()
      .from(antecedents_familiaux)
      .where(inArray(antecedents_familiaux.antecedent_id, antecedentIds))
      .orderBy(desc(antecedents_familiaux.id));
  }

  async getActiveTreatmentsByPatient(
    database: DatabaseClient,
    patientId: string,
    limit: number,
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
      )
      .limit(limit);
  }

  async getRecentTreatmentsByPatient(
    database: DatabaseClient,
    patientId: string,
    limit: number,
  ): Promise<TreatmentRecord[]> {
    return database
      .select()
      .from(historique_traitements)
      .where(eq(historique_traitements.patient_id, patientId))
      .orderBy(
        desc(historique_traitements.date_prescription),
        desc(historique_traitements.id),
      )
      .limit(limit);
  }

  async getRecentSuivisByPatient(
    database: DatabaseClient,
    patientId: string,
    currentSuiviId: string,
    limit: number,
  ): Promise<SuiviRecord[]> {
    return database
      .select()
      .from(suivi)
      .where(and(eq(suivi.patient_id, patientId), ne(suivi.id, currentSuiviId)))
      .orderBy(desc(suivi.date_ouverture), desc(suivi.id))
      .limit(limit);
  }

  async getLatestExamensBySuiviIds(
    database: DatabaseClient,
    suiviIds: string[],
  ): Promise<ExamenConsultationRecord[]> {
    if (suiviIds.length === 0) {
      return [];
    }

    return database
      .select()
      .from(examen_consultation)
      .where(inArray(examen_consultation.suivi_id, suiviIds))
      .orderBy(desc(examen_consultation.date), desc(examen_consultation.id));
  }

  async getRecentVoyagesByPatient(
    database: DatabaseClient,
    patientId: string,
    limit: number,
  ): Promise<VoyageRecentRecord[]> {
    return database
      .select()
      .from(voyages_recents)
      .where(eq(voyages_recents.patient_id, patientId))
      .orderBy(desc(voyages_recents.date), desc(voyages_recents.id))
      .limit(limit);
  }

  async getRecentVaccinationsByPatient(
    database: DatabaseClient,
    patientId: string,
    limit: number,
  ): Promise<VaccinationRecord[]> {
    return database
      .select()
      .from(vaccinations_patient)
      .where(eq(vaccinations_patient.patient_id, patientId))
      .orderBy(
        desc(vaccinations_patient.date_vaccination),
        desc(vaccinations_patient.id),
      )
      .limit(limit);
  }
}

export const ordonnanceRecommendationRepository =
  new OrdonnanceRecommendationRepository();
