import type { db as databaseClient } from "@doctor.com/db";
import {
  ordonnance,
  ordonnance_medicaments,
  patients,
  rendez_vous,
  utilisateurs,
} from "@doctor.com/db/schema";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;

export type DashboardUtilisateurRecord = Pick<
  typeof utilisateurs.$inferSelect,
  "id" | "nom" | "prenom" | "email"
>;
export type DashboardPatientRecord = Pick<
  typeof patients.$inferSelect,
  "id" | "nom" | "prenom" | "date_admission" | "cree_par_utilisateur"
>;
export type DashboardRendezVousRecord = typeof rendez_vous.$inferSelect;

export interface DashboardMedicationRow {
  id: string;
  nom_medicament: string;
}

export class DashboardRepository {
  async findUtilisateurByEmail(
    database: DatabaseClient,
    email: string,
  ): Promise<DashboardUtilisateurRecord | null> {
    const [utilisateur] = await database
      .select({
        id: utilisateurs.id,
        nom: utilisateurs.nom,
        prenom: utilisateurs.prenom,
        email: utilisateurs.email,
      })
      .from(utilisateurs)
      .where(eq(utilisateurs.email, email))
      .limit(1);

    return utilisateur ?? null;
  }

  async listPatientsForUtilisateur(
    database: DatabaseClient,
    utilisateurId: string,
  ): Promise<DashboardPatientRecord[]> {
    return database
      .select({
        id: patients.id,
        nom: patients.nom,
        prenom: patients.prenom,
        date_admission: patients.date_admission,
        cree_par_utilisateur: patients.cree_par_utilisateur,
      })
      .from(patients)
      .where(eq(patients.cree_par_utilisateur, utilisateurId))
      .orderBy(desc(patients.date_admission), asc(patients.nom));
  }

  async listRendezVousByDateRangeForUtilisateur(
    database: DatabaseClient,
    utilisateurId: string,
    dateStart: string,
    dateEnd: string,
  ): Promise<DashboardRendezVousRecord[]> {
    return database
      .select()
      .from(rendez_vous)
      .where(
        and(
          eq(rendez_vous.utilisateur_id, utilisateurId),
          gte(rendez_vous.date, dateStart),
          lte(rendez_vous.date, dateEnd),
        ),
      )
      .orderBy(asc(rendez_vous.date), asc(rendez_vous.heure));
  }

  async listPrescribedMedicationsForUtilisateur(
    database: DatabaseClient,
    utilisateurId: string,
    dateStart: string,
    dateEnd: string,
  ): Promise<DashboardMedicationRow[]> {
    return database
      .select({
        id: ordonnance_medicaments.id,
        nom_medicament: ordonnance_medicaments.nom_medicament,
      })
      .from(ordonnance_medicaments)
      .innerJoin(ordonnance, eq(ordonnance_medicaments.ordonnance_id, ordonnance.id))
      .where(
        and(
          eq(ordonnance.utilisateur_id, utilisateurId),
          gte(ordonnance.date_prescription, dateStart),
          lte(ordonnance.date_prescription, dateEnd),
        ),
      );
  }
}

export const dashboardRepository = new DashboardRepository();
