import type { db as databaseClient } from "@doctor.com/db";
import {
  logs,
  patients,
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
  heure_fin?: string | null;
  statut: RendezVousStatut;
  type_creneau?: string | null;
  patient_label?: string | null;
  patient_initials?: string | null;
  couleur?: string | null;
  notes?: string | null;
  important: boolean;
  frequence_rappel?: string | null;
  periode_rappel?: string | null;
}

export interface AgendaUpdateRendezVousInput {
  patient_id?: string;
  suivi_id?: string | null;
  date?: string;
  heure?: string;
  heure_fin?: string | null;
  statut?: RendezVousStatut;
  type_creneau?: string | null;
  patient_label?: string | null;
  patient_initials?: string | null;
  couleur?: string | null;
  notes?: string | null;
  important?: boolean;
  frequence_rappel?: string | null;
  periode_rappel?: string | null;
}

const ACTIVE_RENDEZ_VOUS_STATUTS: readonly RendezVousStatut[] = [
  "planifie",
  "confirme",
  "bloque",
] as const;

export interface AgendaMobileSlotRecord extends RendezVousRecord {
  patient_nom: string;
  patient_prenom: string;
}

export class AgendaRepository {
  async getUtilisateurByEmail(
    database: DatabaseClient,
    email: string,
  ): Promise<{
    id: string;
    nom: string;
    prenom: string;
    telephone: string | null;
    adresse: string | null;
  } | null> {
    const [utilisateur] = await database
      .select({
        id: utilisateurs.id,
        nom: utilisateurs.nom,
        prenom: utilisateurs.prenom,
        telephone: utilisateurs.telephone,
        adresse: utilisateurs.adresse,
      })
      .from(utilisateurs)
      .where(eq(utilisateurs.email, email))
      .limit(1);

    return utilisateur ?? null;
  }

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
        heure_fin: input.heure_fin ?? null,
        statut: input.statut,
        type_creneau: input.type_creneau ?? null,
        patient_label: input.patient_label ?? null,
        patient_initials: input.patient_initials ?? null,
        couleur: input.couleur ?? null,
        notes: input.notes ?? null,
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

  async getRendezVousById(
    database: DatabaseClient,
    rendezVousId: string,
  ): Promise<RendezVousRecord | null> {
    const [rendezVous] = await database
      .select()
      .from(rendez_vous)
      .where(eq(rendez_vous.id, rendezVousId))
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

    if (input.heure_fin !== undefined) {
      updateData.heure_fin = input.heure_fin;
    }

    if (input.type_creneau !== undefined) {
      updateData.type_creneau = input.type_creneau;
    }

    if (input.patient_label !== undefined) {
      updateData.patient_label = input.patient_label;
    }

    if (input.patient_initials !== undefined) {
      updateData.patient_initials = input.patient_initials;
    }

    if (input.couleur !== undefined) {
      updateData.couleur = input.couleur;
    }

    if (input.notes !== undefined) {
      updateData.notes = input.notes;
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

  async listMobileSlotsByDateRangeForUtilisateur(
    database: DatabaseClient,
    utilisateurId: string,
    dateStart: string,
    dateEnd: string,
  ): Promise<AgendaMobileSlotRecord[]> {
    const rows = await database
      .select({
        rendez_vous,
        patient_nom: patients.nom,
        patient_prenom: patients.prenom,
      })
      .from(rendez_vous)
      .innerJoin(patients, eq(rendez_vous.patient_id, patients.id))
      .where(
        and(
          eq(rendez_vous.utilisateur_id, utilisateurId),
          gte(rendez_vous.date, dateStart),
          lte(rendez_vous.date, dateEnd),
        ),
      )
      .orderBy(asc(rendez_vous.date), asc(rendez_vous.heure));

    return rows.map((row) => ({
      ...row.rendez_vous,
      patient_nom: row.patient_nom,
      patient_prenom: row.patient_prenom,
    }));
  }

  async getMobileSlotByIdForUtilisateur(
    database: DatabaseClient,
    rendezVousId: string,
    utilisateurId: string,
  ): Promise<AgendaMobileSlotRecord | null> {
    const [row] = await database
      .select({
        rendez_vous,
        patient_nom: patients.nom,
        patient_prenom: patients.prenom,
      })
      .from(rendez_vous)
      .innerJoin(patients, eq(rendez_vous.patient_id, patients.id))
      .where(
        and(
          eq(rendez_vous.id, rendezVousId),
          eq(rendez_vous.utilisateur_id, utilisateurId),
        ),
      )
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      ...row.rendez_vous,
      patient_nom: row.patient_nom,
      patient_prenom: row.patient_prenom,
    };
  }

  async deleteRendezVousByIdForUtilisateur(
    database: DatabaseClient,
    rendezVousId: string,
    utilisateurId: string,
  ): Promise<boolean> {
    const [deleted] = await database
      .delete(rendez_vous)
      .where(
        and(
          eq(rendez_vous.id, rendezVousId),
          eq(rendez_vous.utilisateur_id, utilisateurId),
        ),
      )
      .returning({ id: rendez_vous.id });

    return Boolean(deleted);
  }

  async listAllRendezVousByDate(
    database: DatabaseClient,
    date: string,
  ): Promise<(RendezVousRecord & {
    patient_email: string | null;
    patient_nom: string;
    patient_prenom: string;
    utilisateur_email: string;
  })[]> {
    const rows = await database
      .select({
        rendez_vous,
        patient_email: patients.email,
        patient_nom: patients.nom,
        patient_prenom: patients.prenom,
        utilisateur_email: utilisateurs.email,
      })
      .from(rendez_vous)
      .innerJoin(patients, eq(rendez_vous.patient_id, patients.id))
      .innerJoin(utilisateurs, eq(rendez_vous.utilisateur_id, utilisateurs.id))
      .where(
        and(
          eq(rendez_vous.date, date),
          inArray(rendez_vous.statut, ACTIVE_RENDEZ_VOUS_STATUTS),
        ),
      )
      .orderBy(asc(rendez_vous.date), asc(rendez_vous.heure));

    return rows.map((row) => ({
      ...row.rendez_vous,
      patient_email: row.patient_email,
      patient_nom: row.patient_nom,
      patient_prenom: row.patient_prenom,
      utilisateur_email: row.utilisateur_email,
    }));
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
