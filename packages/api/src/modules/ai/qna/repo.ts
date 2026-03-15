import type { db as databaseClient } from "@doctor.com/db";
import {
  patients,
  patients_femmes,
  voyages_recents,
  antecedents,
  antecedents_personnels,
  antecedents_familiaux,
  suivi,
  rendez_vous,
  examen_consultation,
  medicaments,
  historique_traitements,
  ordonnance,
  ordonnance_medicaments,
  vaccinations_patient,
  certificats_medicaux,
  lettres_orientation,
  documents_patient,
} from "@doctor.com/db/schema";
import { eq } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;

export type PatientRecord = typeof patients.$inferSelect;
export type PatientFemmeRecord = typeof patients_femmes.$inferSelect;
export type VoyageRecentRecord = typeof voyages_recents.$inferSelect;
export type AntecedentRecord = typeof antecedents.$inferSelect;
export type AntecedentPersonnelRecord = typeof antecedents_personnels.$inferSelect;
export type AntecedentFamilialRecord = typeof antecedents_familiaux.$inferSelect;
export type SuiviRecord = typeof suivi.$inferSelect;
export type RendezVousRecord = typeof rendez_vous.$inferSelect;
export type ExamenConsultationRecord = typeof examen_consultation.$inferSelect;
export type MedicamentRecord = typeof medicaments.$inferSelect;
export type HistoriqueTraitementRecord = typeof historique_traitements.$inferSelect;
export type OrdonnanceRecord = typeof ordonnance.$inferSelect;
export type OrdonnanceMedicamentRecord = typeof ordonnance_medicaments.$inferSelect;
export type VaccinationPatientRecord = typeof vaccinations_patient.$inferSelect;
export type CertificatMedicalRecord = typeof certificats_medicaux.$inferSelect;
export type LettreOrientationRecord = typeof lettres_orientation.$inferSelect;

export interface AntecedentWithDetails extends AntecedentRecord {
  personnels: AntecedentPersonnelRecord[];
  familiaux: AntecedentFamilialRecord[];
}

export interface HistoriqueTraitementWithMedicament extends HistoriqueTraitementRecord {
  medicament: MedicamentRecord | null;
}

export interface OrdonnanceMedicamentWithDetails extends OrdonnanceMedicamentRecord {
  medicament: MedicamentRecord | null;
}

export interface OrdonnanceWithMedicaments extends OrdonnanceRecord {
  medicaments: OrdonnanceMedicamentWithDetails[];
}

export interface FullPatientData {
  patient: PatientRecord;
  donnees_femme: PatientFemmeRecord | null;
  voyages: VoyageRecentRecord[];
  antecedents: AntecedentWithDetails[];
  suivis: SuiviRecord[];
  rendez_vous: RendezVousRecord[];
  examens: ExamenConsultationRecord[];
  traitements: HistoriqueTraitementWithMedicament[];
  ordonnances: OrdonnanceWithMedicaments[];
  vaccinations: VaccinationPatientRecord[];
  certificats: CertificatMedicalRecord[];
  lettres_orientation: LettreOrientationRecord[];
}

export class AiRepository {
  async getFullPatientData(
    database: DatabaseClient,
    patientId: string,
  ): Promise<FullPatientData | null> {
    // 1. Fetch patient base record
    const [patientRecord] = await database
      .select()
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1);

    if (!patientRecord) {
      return null;
    }

    // 2. Fetch all related data in parallel
    const [
      donneesFemmeRows,
      voyagesRows,
      antecedentsRows,
      suivisRows,
      rendezVousRows,
      examensRows,
      traitementsRows,
      ordonnancesRows,
      vaccinationsRows,
      certificatsRows,
      lettresRows,
    ] = await Promise.all([
      // patients_femmes
      database
        .select()
        .from(patients_femmes)
        .where(eq(patients_femmes.patient_id, patientId))
        .limit(1),

      // voyages_recents
      database
        .select()
        .from(voyages_recents)
        .where(eq(voyages_recents.patient_id, patientId)),

      // antecedents with personnels and familiaux
      this.fetchAntecedentsWithDetails(database, patientId),

      // suivi
      database.select().from(suivi).where(eq(suivi.patient_id, patientId)),

      // rendez_vous
      database
        .select()
        .from(rendez_vous)
        .where(eq(rendez_vous.patient_id, patientId)),

      // examen_consultation (via suivi join)
      database
        .select({ examen: examen_consultation })
        .from(examen_consultation)
        .innerJoin(suivi, eq(examen_consultation.suivi_id, suivi.id))
        .where(eq(suivi.patient_id, patientId))
        .then((rows) => rows.map((r) => r.examen)),

      // historique_traitements with medicaments
      this.fetchTraitementsWithMedicaments(database, patientId),

      // ordonnances with medicaments
      this.fetchOrdonnancesWithMedicaments(database, patientId),

      // vaccinations_patient
      database
        .select()
        .from(vaccinations_patient)
        .where(eq(vaccinations_patient.patient_id, patientId)),

      // certificats_medicaux (via documents_patient)
      database
        .select({ certificat: certificats_medicaux })
        .from(certificats_medicaux)
        .innerJoin(
          documents_patient,
          eq(certificats_medicaux.documents_patient_id, documents_patient.id),
        )
        .where(eq(documents_patient.patient_id, patientId))
        .then((rows) => rows.map((r) => r.certificat)),

      // lettres_orientation (via documents_patient)
      database
        .select({ lettre: lettres_orientation })
        .from(lettres_orientation)
        .innerJoin(
          documents_patient,
          eq(lettres_orientation.documents_patient_id, documents_patient.id),
        )
        .where(eq(documents_patient.patient_id, patientId))
        .then((rows) => rows.map((r) => r.lettre)),
    ]);

    return {
      patient: patientRecord,
      donnees_femme: donneesFemmeRows[0] ?? null,
      voyages: voyagesRows,
      antecedents: antecedentsRows,
      suivis: suivisRows,
      rendez_vous: rendezVousRows,
      examens: examensRows,
      traitements: traitementsRows,
      ordonnances: ordonnancesRows,
      vaccinations: vaccinationsRows,
      certificats: certificatsRows,
      lettres_orientation: lettresRows,
    };
  }

  private async fetchAntecedentsWithDetails(
    database: DatabaseClient,
    patientId: string,
  ): Promise<AntecedentWithDetails[]> {
    const antecedentsRows = await database
      .select()
      .from(antecedents)
      .where(eq(antecedents.patient_id, patientId));

    if (antecedentsRows.length === 0) {
      return [];
    }

    const result: AntecedentWithDetails[] = [];

    for (const ant of antecedentsRows) {
      const [personnelsRows, familiauxRows] = await Promise.all([
        database
          .select()
          .from(antecedents_personnels)
          .where(eq(antecedents_personnels.antecedent_id, ant.id)),
        database
          .select()
          .from(antecedents_familiaux)
          .where(eq(antecedents_familiaux.antecedent_id, ant.id)),
      ]);

      result.push({
        ...ant,
        personnels: personnelsRows,
        familiaux: familiauxRows,
      });
    }

    return result;
  }

  private async fetchTraitementsWithMedicaments(
    database: DatabaseClient,
    patientId: string,
  ): Promise<HistoriqueTraitementWithMedicament[]> {
    const rows = await database
      .select({
        traitement: historique_traitements,
        medicament: medicaments,
      })
      .from(historique_traitements)
      .leftJoin(medicaments, eq(historique_traitements.medicament_id, medicaments.id))
      .where(eq(historique_traitements.patient_id, patientId));

    return rows.map((row) => ({
      ...row.traitement,
      medicament: row.medicament,
    }));
  }

  private async fetchOrdonnancesWithMedicaments(
    database: DatabaseClient,
    patientId: string,
  ): Promise<OrdonnanceWithMedicaments[]> {
    const ordonnancesRows = await database
      .select()
      .from(ordonnance)
      .where(eq(ordonnance.patient_id, patientId));

    if (ordonnancesRows.length === 0) {
      return [];
    }

    const result: OrdonnanceWithMedicaments[] = [];

    for (const ord of ordonnancesRows) {
      const medsRows = await database
        .select({
          ordonnance_med: ordonnance_medicaments,
          medicament: medicaments,
        })
        .from(ordonnance_medicaments)
        .leftJoin(medicaments, eq(ordonnance_medicaments.medicament_id, medicaments.id))
        .where(eq(ordonnance_medicaments.ordonnance_id, ord.id));

      result.push({
        ...ord,
        medicaments: medsRows.map((row) => ({
          ...row.ordonnance_med,
          medicament: row.medicament,
        })),
      });
    }

    return result;
  }
}

export const aiRepository = new AiRepository();
