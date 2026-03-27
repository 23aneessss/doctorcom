import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";
import { patients } from "@doctor.com/db/schema";
import { user as authUser } from "@doctor.com/db/schema/auth";
import { eq } from "drizzle-orm";
import {
  envoyerRappelRDV as envoyerRappelRDVInfrastructure,
  type ClinicInfo,
} from "@doctor.com/api/infrastructure/email/index";

import type { SessionUtilisateur } from "../../trpc/context";
import {
  agendaRepository,
  type AgendaCreateRendezVousInput,
  type AgendaUpdateRendezVousInput,
  type RendezVousRecord,
  type RendezVousStatut,
  type UtilisateurRecord,
} from "./repo";

type DatabaseClient = typeof databaseClient;
type AgendaSession = Exclude<SessionUtilisateur, null>;

export class AgendaService {
  async planifierRDV(data: {
    db: DatabaseClient;
    session: AgendaSession;
    input: AgendaCreateRendezVousInput;
  }): Promise<RendezVousRecord> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const hasConflict = await agendaRepository.hasActiveConflict(data.db, {
      utilisateur_id: utilisateur.id,
      date: data.input.date,
      heure: data.input.heure,
    });

    if (hasConflict) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Un rendez-vous actif existe deja pour ce creneau.",
      });
    }

    return agendaRepository.createRendezVous(data.db, utilisateur.id, data.input);
  }

  async modifierRDV(data: {
    db: DatabaseClient;
    session: AgendaSession;
    rdv_id: string;
    input: AgendaUpdateRendezVousInput;
  }): Promise<RendezVousRecord> {
    if (Object.keys(data.input).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Aucun champ fourni pour la modification du rendez-vous.",
      });
    }

    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const existingRendezVous = await this.requireRendezVous(
      data.db,
      utilisateur.id,
      data.rdv_id,
    );

    const nextDate = data.input.date ?? existingRendezVous.date;
    const nextHeure = data.input.heure ?? existingRendezVous.heure;
    const nextStatut = data.input.statut ?? existingRendezVous.statut;

    if (this.isActiveStatut(nextStatut)) {
      const hasConflict = await agendaRepository.hasActiveConflict(data.db, {
        utilisateur_id: utilisateur.id,
        date: nextDate,
        heure: nextHeure,
        exclude_rendez_vous_id: existingRendezVous.id,
      });

      if (hasConflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Le creneau cible est deja occupe par un rendez-vous actif.",
        });
      }
    }

    const updatedRendezVous = await agendaRepository.updateRendezVousByIdForUtilisateur(
      data.db,
      data.rdv_id,
      utilisateur.id,
      data.input,
    );

    if (!updatedRendezVous) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de la mise a jour du rendez-vous.",
      });
    }

    return updatedRendezVous;
  }

  async annulerRDV(data: {
    db: DatabaseClient;
    session: AgendaSession;
    rdv_id: string;
    raison: string;
  }): Promise<RendezVousRecord> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const rendezVous = await this.requireRendezVous(data.db, utilisateur.id, data.rdv_id);

    const updatedRendezVous = await agendaRepository.updateRendezVousByIdForUtilisateur(
      data.db,
      rendezVous.id,
      utilisateur.id,
      { statut: "annule" },
    );

    if (!updatedRendezVous) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de l'annulation du rendez-vous.",
      });
    }

    await agendaRepository.createAgendaLog(data.db, {
      utilisateur_id: utilisateur.id,
      action: `Annulation rendez-vous ${rendezVous.id}: ${data.raison.trim()}`,
    });

    return updatedRendezVous;
  }

  async confirmerRDV(data: {
    db: DatabaseClient;
    session: AgendaSession;
    rdv_id: string;
  }): Promise<RendezVousRecord> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const rendezVous = await this.requireRendezVous(data.db, utilisateur.id, data.rdv_id);

    const hasConflict = await agendaRepository.hasActiveConflict(data.db, {
      utilisateur_id: utilisateur.id,
      date: rendezVous.date,
      heure: rendezVous.heure,
      exclude_rendez_vous_id: rendezVous.id,
    });

    if (hasConflict) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Impossible de confirmer ce rendez-vous: creneau deja occupe.",
      });
    }

    const updatedRendezVous = await agendaRepository.updateRendezVousByIdForUtilisateur(
      data.db,
      rendezVous.id,
      utilisateur.id,
      { statut: "confirme" },
    );

    if (!updatedRendezVous) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de la confirmation du rendez-vous.",
      });
    }

    return updatedRendezVous;
  }

  async consulterListeRDV(data: {
    db: DatabaseClient;
    session: AgendaSession;
    date: string;
  }): Promise<RendezVousRecord[]> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    return agendaRepository.listRendezVousByDateForUtilisateur(
      data.db,
      utilisateur.id,
      data.date,
    );
  }

  async getRDVParPatient(data: {
    db: DatabaseClient;
    session: AgendaSession;
    patient_id: string;
  }): Promise<RendezVousRecord[]> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    return agendaRepository.listRendezVousByPatientForUtilisateur(
      data.db,
      utilisateur.id,
      data.patient_id,
    );
  }

  async getRDVParDate(data: {
    db: DatabaseClient;
    session: AgendaSession;
    date: string;
  }): Promise<RendezVousRecord[]> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    return agendaRepository.listRendezVousByDateForUtilisateur(
      data.db,
      utilisateur.id,
      data.date,
    );
  }

  async getRDVParStatut(data: {
    db: DatabaseClient;
    session: AgendaSession;
    statut: RendezVousStatut;
  }): Promise<RendezVousRecord[]> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    return agendaRepository.listRendezVousByStatutForUtilisateur(
      data.db,
      utilisateur.id,
      data.statut,
    );
  }

  async verifierDisponibilite(data: {
    db: DatabaseClient;
    session: AgendaSession;
    date: string;
    heure: string;
  }): Promise<{ disponible: boolean }> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const hasConflict = await agendaRepository.hasActiveConflict(data.db, {
      utilisateur_id: utilisateur.id,
      date: data.date,
      heure: data.heure,
    });

    return { disponible: !hasConflict };
  }

  async envoyerNotificationRappel(data: {
    db: DatabaseClient;
    session: AgendaSession;
    rdv_id: string;
  }): Promise<{ success: boolean; message: string }> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    await this.requireRendezVous(data.db, utilisateur.id, data.rdv_id);

    return {
      success: true,
      message: "Notification de rappel non implementee (placeholder).",
    };
  }

  async envoyerRappelRDV(data: {
    db: DatabaseClient;
    rendezVousId: string;
    userEmail?: string;
    userId?: string;
  }): Promise<{ success: true; message: string }> {
    const rendezVous = await agendaRepository.getRendezVousById(data.db, data.rendezVousId);

    if (!rendezVous) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Rendez-vous introuvable.",
      });
    }

    const patient = await data.db
      .select({
        nom: patients.nom,
        prenom: patients.prenom,
        email: patients.email,
      })
      .from(patients)
      .where(eq(patients.id, rendezVous.patient_id))
      .then((rows) => rows[0]);

    if (!patient) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Patient introuvable.",
      });
    }

    if (!patient.email) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Le patient n'a pas d'adresse email.",
      });
    }

    const sessionEmail = await this.resolveSessionUserEmail(data);
    const utilisateur = await agendaRepository.getUtilisateurByEmail(data.db, sessionEmail);

    if (!utilisateur) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Utilisateur introuvable.",
      });
    }

    const clinic: ClinicInfo = {
      doctorName: `Dr. ${utilisateur.prenom} ${utilisateur.nom}`,
      clinicName: `Cabinet ${utilisateur.prenom} ${utilisateur.nom}`,
      phone: utilisateur.telephone ?? "",
      address: utilisateur.adresse ?? "",
    };

    const dateObj = new Date(rendezVous.date);
    const dateStr = dateObj.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    await envoyerRappelRDVInfrastructure({
      clinic,
      patientEmail: patient.email,
      patientNom: patient.nom,
      patientPrenom: patient.prenom,
      dateRDV: dateStr,
      heureRDV: rendezVous.heure,
      important: rendezVous.important,
    });

    return { success: true, message: "Rappel envoyé avec succès." };
  }

  async getRDVAujourdhui(data: {
    db: DatabaseClient;
    session: AgendaSession;
  }): Promise<RendezVousRecord[]> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const today = this.formatDate(new Date());

    return agendaRepository.listRendezVousByDateForUtilisateur(
      data.db,
      utilisateur.id,
      today,
    );
  }

  async getProchainsRDV(data: {
    db: DatabaseClient;
    session: AgendaSession;
    jours: number;
  }): Promise<RendezVousRecord[]> {
    if (!Number.isInteger(data.jours) || data.jours < 1) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Le parametre jours doit etre un entier superieur ou egal a 1.",
      });
    }

    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const now = new Date();
    const tomorrow = this.addDays(now, 1);
    const dateStart = this.formatDate(tomorrow);
    const dateEnd = this.formatDate(this.addDays(now, data.jours));

    return agendaRepository.listRendezVousByDateRangeForUtilisateur(
      data.db,
      utilisateur.id,
      dateStart,
      dateEnd,
    );
  }

  async marquerImportant(data: {
    db: DatabaseClient;
    session: AgendaSession;
    rdv_id: string;
    important: boolean;
  }): Promise<RendezVousRecord> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    await this.requireRendezVous(data.db, utilisateur.id, data.rdv_id);

    const updatedRendezVous = await agendaRepository.updateRendezVousByIdForUtilisateur(
      data.db,
      data.rdv_id,
      utilisateur.id,
      { important: data.important },
    );

    if (!updatedRendezVous) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de la mise a jour du marqueur important.",
      });
    }

    return updatedRendezVous;
  }

  private resolveSessionEmail(session: AgendaSession): string {
    const email = session.user.email.trim().toLowerCase();
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Session invalide: email utilisateur manquant.",
      });
    }

    return email;
  }

  private async resolveUtilisateur(
    database: DatabaseClient,
    session: AgendaSession,
  ): Promise<UtilisateurRecord> {
    const email = this.resolveSessionEmail(session);
    const utilisateur = await agendaRepository.findUtilisateurByEmail(database, email);

    if (!utilisateur) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Utilisateur connecte introuvable.",
      });
    }

    return utilisateur;
  }

  private async requireRendezVous(
    database: DatabaseClient,
    utilisateurId: string,
    rendezVousId: string,
  ): Promise<RendezVousRecord> {
    const rendezVous = await agendaRepository.findRendezVousByIdForUtilisateur(
      database,
      rendezVousId,
      utilisateurId,
    );

    if (!rendezVous) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Rendez-vous introuvable pour cet utilisateur.",
      });
    }

    return rendezVous;
  }

  private isActiveStatut(statut: RendezVousStatut): boolean {
    return statut === "planifie" || statut === "confirme";
  }

  private formatDate(dateValue: Date): string {
    return dateValue.toISOString().slice(0, 10);
  }

  private addDays(dateValue: Date, days: number): Date {
    const nextDate = new Date(dateValue);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate;
  }

  private async resolveSessionUserEmail(data: {
    db: DatabaseClient;
    userEmail?: string;
    userId?: string;
  }): Promise<string> {
    const directEmail = data.userEmail?.trim().toLowerCase();
    if (directEmail) {
      return directEmail;
    }

    if (!data.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Email utilisateur manquant dans la session.",
      });
    }

    const [sessionUser] = await data.db
      .select({ email: authUser.email })
      .from(authUser)
      .where(eq(authUser.id, data.userId))
      .limit(1);

    if (!sessionUser?.email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Email utilisateur introuvable dans la session.",
      });
    }

    return sessionUser.email.trim().toLowerCase();
  }
}

export const agendaService = new AgendaService();
