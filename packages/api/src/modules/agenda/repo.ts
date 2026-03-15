import type { db as databaseClient } from "@doctor.com/db";
import {
  logs,
  rendez_vous,
  rendez_vous_statut_values,
  utilisateurs,
} from "@doctor.com/db/schema";
import { and, asc, eq, gte, inArray, lte, ne } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;

export type RendezVousStatut = (typeof rendez_vous_statut_values)[number];
export type RendezVousRecord = typeof rendez_vous.$inferSelect;
export type UtilisateurRecord = typeof utilisateurs.$inferSelect;

export interface AgendaCreateRendezVousInput {
  patient_id: string;
  suivi_id?: string | null;
  date: string;
  heure: string;
  statut: RendezVousStatut;
  important: boolean;
  frequence_rappel?: string | null;
  periode_rappel?: string | null;
}

export interface AgendaUpdateRendezVousInput {
  patient_id?: string;
  suivi_id?: string | null;
  date?: string;
  heure?: string;
  statut?: RendezVousStatut;
  important?: boolean;
  frequence_rappel?: string | null;
  periode_rappel?: string | null;
}

const ACTIVE_RENDEZ_VOUS_STATUTS: readonly RendezVousStatut[] = [
  "planifie",
  "confirme",
] as const;

export class AgendaRepository {
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

  async createRendezVous(
    database: DatabaseClient,
    utilisateurId: string,
    input: AgendaCreateRendezVousInput,
  ): Promise<RendezVousRecord> {
    const [createdRendezVous] = await database
      .insert(rendez_vous)
      .values({
        patient_id: input.patient_id,
        suivi_id: input.suivi_id ?? null,
        utilisateur_id: utilisateurId,
        date: input.date,
        heure: input.heure,
        statut: input.statut,
        important: input.important,
        frequence_rappel: input.frequence_rappel ?? null,
        periode_rappel: input.periode_rappel ?? null,
      })
      .returning();

    if (!createdRendezVous) {
      throw new Error("Echec de creation du rendez-vous.");
    }

    return createdRendezVous;
  }

  async findRendezVousByIdForUtilisateur(
    database: DatabaseClient,
    rendezVousId: string,
    utilisateurId: string,
  ): Promise<RendezVousRecord | null> {
    const [rendezVous] = await database
      .select()
      .from(rendez_vous)
      .where(
        and(
          eq(rendez_vous.id, rendezVousId),
          eq(rendez_vous.utilisateur_id, utilisateurId),
        ),
      )
      .limit(1);

    return rendezVous ?? null;
  }

  async updateRendezVousByIdForUtilisateur(
    database: DatabaseClient,
    rendezVousId: string,
    utilisateurId: string,
    input: AgendaUpdateRendezVousInput,
  ): Promise<RendezVousRecord | null> {
    const updateData: AgendaUpdateRendezVousInput = {};

    if (input.patient_id !== undefined) {
      updateData.patient_id = input.patient_id;
    }

    if (input.suivi_id !== undefined) {
      updateData.suivi_id = input.suivi_id;
    }

    if (input.date !== undefined) {
      updateData.date = input.date;
    }

    if (input.heure !== undefined) {
      updateData.heure = input.heure;
    }

    if (input.statut !== undefined) {
      updateData.statut = input.statut;
    }

    if (input.important !== undefined) {
      updateData.important = input.important;
    }

    if (input.frequence_rappel !== undefined) {
      updateData.frequence_rappel = input.frequence_rappel;
    }

    if (input.periode_rappel !== undefined) {
      updateData.periode_rappel = input.periode_rappel;
    }

    if (Object.keys(updateData).length === 0) {
      return this.findRendezVousByIdForUtilisateur(
        database,
        rendezVousId,
        utilisateurId,
      );
    }

    const [updatedRendezVous] = await database
      .update(rendez_vous)
      .set(updateData)
      .where(
        and(
          eq(rendez_vous.id, rendezVousId),
          eq(rendez_vous.utilisateur_id, utilisateurId),
        ),
      )
      .returning();

    return updatedRendezVous ?? null;
  }

  async hasActiveConflict(
    database: DatabaseClient,
    data: {
      utilisateur_id: string;
      date: string;
      heure: string;
      exclude_rendez_vous_id?: string;
    },
  ): Promise<boolean> {
    const predicates = [
      eq(rendez_vous.utilisateur_id, data.utilisateur_id),
      eq(rendez_vous.date, data.date),
      eq(rendez_vous.heure, data.heure),
      inArray(rendez_vous.statut, ACTIVE_RENDEZ_VOUS_STATUTS),
    ];

    if (data.exclude_rendez_vous_id) {
      predicates.push(ne(rendez_vous.id, data.exclude_rendez_vous_id));
    }

    const [conflictingRendezVous] = await database
      .select({ id: rendez_vous.id })
      .from(rendez_vous)
      .where(and(...predicates))
      .limit(1);

    return Boolean(conflictingRendezVous);
  }

  async listRendezVousByDateForUtilisateur(
    database: DatabaseClient,
    utilisateurId: string,
    dateValue: string,
  ): Promise<RendezVousRecord[]> {
    return database
      .select()
      .from(rendez_vous)
      .where(
        and(
          eq(rendez_vous.utilisateur_id, utilisateurId),
          eq(rendez_vous.date, dateValue),
        ),
      )
      .orderBy(asc(rendez_vous.date), asc(rendez_vous.heure));
  }

  async listRendezVousByPatientForUtilisateur(
    database: DatabaseClient,
    utilisateurId: string,
    patientId: string,
  ): Promise<RendezVousRecord[]> {
    return database
      .select()
      .from(rendez_vous)
      .where(
        and(
          eq(rendez_vous.utilisateur_id, utilisateurId),
          eq(rendez_vous.patient_id, patientId),
        ),
      )
      .orderBy(asc(rendez_vous.date), asc(rendez_vous.heure));
  }

  async listRendezVousByStatutForUtilisateur(
    database: DatabaseClient,
    utilisateurId: string,
    statut: RendezVousStatut,
  ): Promise<RendezVousRecord[]> {
    return database
      .select()
      .from(rendez_vous)
      .where(
        and(
          eq(rendez_vous.utilisateur_id, utilisateurId),
          eq(rendez_vous.statut, statut),
        ),
      )
      .orderBy(asc(rendez_vous.date), asc(rendez_vous.heure));
  }

  async listRendezVousByDateRangeForUtilisateur(
    database: DatabaseClient,
    utilisateurId: string,
    dateStart: string,
    dateEnd: string,
  ): Promise<RendezVousRecord[]> {
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

  async createAgendaLog(
    database: DatabaseClient,
    data: {
      utilisateur_id: string;
      action: string;
    },
  ): Promise<void> {
    await database.insert(logs).values({
      utilisateur_id: data.utilisateur_id,
      action: data.action,
      horodatage: new Date().toISOString(),
    });
  }
}

export const agendaRepository = new AgendaRepository();
