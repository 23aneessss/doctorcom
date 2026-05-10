import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";
import { patients } from "@doctor.com/db/schema";
import { user as authUser } from "@doctor.com/db/schema/auth";
import { eq } from "drizzle-orm";
import {
  envoyerRappelMedecinRDV,
  envoyerRappelRDV as envoyerRappelRDVInfrastructure,
  type ClinicInfo,
} from "@doctor.com/api/infrastructure/email/index";

import type { SessionUtilisateur } from "../../trpc/context";
import {
  agendaRepository,
  type AgendaCreateRendezVousInput,
  type AgendaMobileSlotRecord,
  type AgendaUpdateRendezVousInput,
  type RendezVousRecord,
  type RendezVousStatut,
  type UtilisateurRecord,
} from "./repo";

type DatabaseClient = typeof databaseClient;
type AgendaSession = Exclude<SessionUtilisateur, null>;

type MobileSlotStatus = "booked" | "pending" | "completed" | "cancelled" | "blocked";

export interface MobileAgendaSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: MobileSlotStatus;
  slotType: string;
  patientInitials: string;
  patientLabel: string;
  notes: string | null;
  color: string | null;
  important: boolean;
}

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
    const rendezVous = await this.requireRendezVous(data.db, utilisateur.id, data.rdv_id);
    const patient = await data.db
      .select({
        nom: patients.nom,
        prenom: patients.prenom,
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

    await envoyerRappelMedecinRDV({
      doctorEmail: this.resolveSessionEmail(data.session),
      patientNom: patient.nom,
      patientPrenom: patient.prenom,
      dateRDV: rendezVous.date,
      heureRDV: rendezVous.heure,
      type: "now",
      important: rendezVous.important,
    });

    await agendaRepository.createAgendaLog(data.db, {
      utilisateur_id: utilisateur.id,
      action: `rdv-reminder:manual:${rendezVous.id}:${new Date().toISOString()}`,
    });

    return { success: true, message: "Notification de rappel envoyee." };
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

  async getSlots(data: {
    db: DatabaseClient;
    session: AgendaSession;
    startDate: string;
    endDate: string;
  }): Promise<MobileAgendaSlot[]> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const slots = await agendaRepository.listMobileSlotsByDateRangeForUtilisateur(
      data.db,
      utilisateur.id,
      data.startDate,
      data.endDate,
    );

    return slots.map((slot) => this.formatMobileSlot(slot));
  }

  async getDaySlots(data: {
    db: DatabaseClient;
    session: AgendaSession;
    date: string;
  }): Promise<MobileAgendaSlot[]> {
    return this.getSlots({
      db: data.db,
      session: data.session,
      startDate: data.date,
      endDate: data.date,
    });
  }

  async getSlot(data: {
    db: DatabaseClient;
    session: AgendaSession;
    id: string;
  }): Promise<MobileAgendaSlot> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const slot = await agendaRepository.getMobileSlotByIdForUtilisateur(
      data.db,
      data.id,
      utilisateur.id,
    );

    if (!slot) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Le rendez-vous demandé est introuvable.",
      });
    }

    return this.formatMobileSlot(slot);
  }

  async createSlot(data: {
    db: DatabaseClient;
    session: AgendaSession;
    input: {
      date: string;
      startTime: string;
      endTime: string;
      status: MobileSlotStatus;
      slotType: string;
      patientInitials?: string;
      patientLabel?: string;
      notes?: string;
      color?: string | null;
      important?: boolean;
    };
  }): Promise<MobileAgendaSlot> {
    this.validateSlotTimeWindow(data.input.startTime, data.input.endTime);

    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const placeholderPatientId = await this.ensureMobilePlaceholderPatient(data.db, utilisateur);
    await this.ensureSlotWindowAvailability(data.db, utilisateur.id, {
      date: data.input.date,
      startTime: data.input.startTime,
      endTime: data.input.endTime,
    });

    const created = await agendaRepository.createRendezVous(data.db, utilisateur.id, {
      patient_id: placeholderPatientId,
      date: data.input.date,
      heure: data.input.startTime,
      heure_fin: data.input.endTime,
      statut: this.mapMobileStatusToRendezVous(data.input.status),
      type_creneau: data.input.slotType,
      patient_label: data.input.patientLabel?.trim() || null,
      patient_initials: data.input.patientInitials?.trim() || null,
      couleur: data.input.color ?? null,
      notes: data.input.notes?.trim() || null,
      important: data.input.important ?? false,
    });

    const slot = await agendaRepository.getMobileSlotByIdForUtilisateur(
      data.db,
      created.id,
      utilisateur.id,
    );

    if (!slot) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Le rendez-vous n'a pas pu être créé.",
      });
    }

    return this.formatMobileSlot(slot);
  }

  async updateSlot(data: {
    db: DatabaseClient;
    session: AgendaSession;
    id: string;
    input: {
      date?: string;
      startTime?: string;
      endTime?: string;
      status?: MobileSlotStatus;
      slotType?: string;
      patientInitials?: string;
      patientLabel?: string;
      notes?: string;
      color?: string | null;
    };
  }): Promise<MobileAgendaSlot> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const existing = await agendaRepository.getMobileSlotByIdForUtilisateur(
      data.db,
      data.id,
      utilisateur.id,
    );

    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Le rendez-vous demandé est introuvable.",
      });
    }

    const nextDate = data.input.date ?? existing.date;
    const nextStartTime = data.input.startTime ?? this.normalizeTime(existing.heure);
    const nextEndTime =
      data.input.endTime ??
      this.normalizeTime(existing.heure_fin ?? this.addMinutes(existing.heure, 30));

    this.validateSlotTimeWindow(nextStartTime, nextEndTime);
    await this.ensureSlotWindowAvailability(data.db, utilisateur.id, {
      date: nextDate,
      startTime: nextStartTime,
      endTime: nextEndTime,
      excludeId: existing.id,
    });

    const updated = await agendaRepository.updateRendezVousByIdForUtilisateur(
      data.db,
      existing.id,
      utilisateur.id,
      {
        date: data.input.date,
        heure: data.input.startTime,
        heure_fin: data.input.endTime,
        statut:
          data.input.status === undefined
            ? undefined
            : this.mapMobileStatusToRendezVous(data.input.status),
        type_creneau: data.input.slotType,
        patient_initials: data.input.patientInitials?.trim() || null,
        patient_label: data.input.patientLabel?.trim() || null,
        notes: data.input.notes?.trim() || null,
        couleur: data.input.color ?? null,
      },
    );

    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Le rendez-vous n'a pas pu être mis à jour.",
      });
    }

    const slot = await agendaRepository.getMobileSlotByIdForUtilisateur(
      data.db,
      existing.id,
      utilisateur.id,
    );

    if (!slot) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Le rendez-vous mis à jour est introuvable.",
      });
    }

    return this.formatMobileSlot(slot);
  }

  async deleteSlot(data: {
    db: DatabaseClient;
    session: AgendaSession;
    id: string;
  }): Promise<{ success: true }> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const deleted = await agendaRepository.deleteRendezVousByIdForUtilisateur(
      data.db,
      data.id,
      utilisateur.id,
    );

    if (!deleted) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Le rendez-vous demandé est introuvable.",
      });
    }

    return { success: true };
  }

  private resolveSessionEmail(session: AgendaSession): string {
    const email = session.user.email.trim().toLowerCase();
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "La session a expiré. Reconnectez-vous.",
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
        message: "Le compte associé à cette session est introuvable.",
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
    return statut === "planifie" || statut === "confirme" || statut === "bloque";
  }

  private formatMobileSlot(slot: AgendaMobileSlotRecord): MobileAgendaSlot {
    const patientLabel =
      this.normalizeAgendaPlaceholderName(slot.patient_label) ||
      this.formatPatientName(slot.patient_prenom, slot.patient_nom) ||
      "Rendez-vous";

    const patientInitials =
      slot.patient_initials?.trim() ||
      `${this.normalizeAgendaPlaceholderName(slot.patient_prenom).charAt(0)}${slot.patient_nom.charAt(0)}`.toUpperCase();

    return {
      id: slot.id,
      date: slot.date,
      startTime: this.normalizeTime(slot.heure),
      endTime: this.normalizeTime(slot.heure_fin ?? this.addMinutes(slot.heure, 30)),
      status: this.mapRendezVousStatusToMobile(slot.statut),
      slotType: slot.type_creneau ?? "consultation",
      patientInitials,
      patientLabel,
      notes: slot.notes,
      color: slot.couleur,
      important: slot.important,
    };
  }

  private formatPatientName(prenom: string, nom: string): string {
    return [
      this.normalizeAgendaPlaceholderName(prenom),
      this.normalizeAgendaPlaceholderName(nom),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  private normalizeAgendaPlaceholderName(value: string | null | undefined): string {
    return (value ?? "").replace(/\s+agenda$/i, "").trim();
  }

  private mapMobileStatusToRendezVous(status: MobileSlotStatus): RendezVousStatut {
    switch (status) {
      case "booked":
        return "confirme";
      case "pending":
        return "planifie";
      case "completed":
        return "termine";
      case "blocked":
        return "bloque";
      case "cancelled":
      default:
        return "annule";
    }
  }

  private mapRendezVousStatusToMobile(status: RendezVousStatut): MobileSlotStatus {
    switch (status) {
      case "confirme":
        return "booked";
      case "planifie":
        return "pending";
      case "termine":
        return "completed";
      case "bloque":
        return "blocked";
      case "annule":
      case "non_present":
      default:
        return "cancelled";
    }
  }

  private formatDate(dateValue: Date): string {
    return dateValue.toISOString().slice(0, 10);
  }

  private addDays(dateValue: Date, days: number): Date {
    const nextDate = new Date(dateValue);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate;
  }

  private normalizeTime(value: string): string {
    return value.slice(0, 5);
  }

  private addMinutes(timeValue: string, minutes: number): string {
    const [hours = 0, mins = 0] = timeValue.split(":").map((part) => Number(part));
    const totalMinutes = hours * 60 + mins + minutes;
    const normalizedHours = Math.floor(totalMinutes / 60)
      .toString()
      .padStart(2, "0");
    const normalizedMinutes = (totalMinutes % 60).toString().padStart(2, "0");
    return `${normalizedHours}:${normalizedMinutes}`;
  }

  private validateSlotTimeWindow(startTime: string, endTime: string): void {
    if (this.toMinutes(endTime) <= this.toMinutes(startTime)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "L'heure de fin doit être après l'heure de début.",
      });
    }
  }

  private async ensureSlotWindowAvailability(
    db: DatabaseClient,
    utilisateurId: string,
    data: {
      date: string;
      startTime: string;
      endTime: string;
      excludeId?: string;
    },
  ): Promise<void> {
    const existingSlots = await agendaRepository.listMobileSlotsByDateRangeForUtilisateur(
      db,
      utilisateurId,
      data.date,
      data.date,
    );

    const hasConflict = existingSlots.some((slot) => {
      if (data.excludeId && slot.id === data.excludeId) {
        return false;
      }

      if (!this.isActiveStatut(slot.statut)) {
        return false;
      }

      const slotStart = this.toMinutes(this.normalizeTime(slot.heure));
      const slotEnd = this.toMinutes(
        this.normalizeTime(slot.heure_fin ?? this.addMinutes(slot.heure, 30)),
      );
      const candidateStart = this.toMinutes(data.startTime);
      const candidateEnd = this.toMinutes(data.endTime);

      return candidateStart < slotEnd && candidateEnd > slotStart;
    });

    if (hasConflict) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Ce créneau chevauche déjà un rendez-vous actif.",
      });
    }
  }

  private toMinutes(timeValue: string): number {
    const [hours = 0, minutes = 0] = timeValue.split(":").map((part) => Number(part));
    return hours * 60 + minutes;
  }

  private async ensureMobilePlaceholderPatient(
    db: DatabaseClient,
    utilisateur: UtilisateurRecord,
  ): Promise<string> {
    const matricule = `mobile-slot-${utilisateur.id}`;
    const [existing] = await db
      .select({ id: patients.id, nom: patients.nom, prenom: patients.prenom })
      .from(patients)
      .where(eq(patients.matricule, matricule))
      .limit(1);

    if (existing) {
      if (
        existing.nom.trim().toLowerCase() === "agenda" ||
        existing.prenom.trim().toLowerCase() === "mobile"
      ) {
        await db
          .update(patients)
          .set({
            nom: "Patient",
            prenom: "Nouveau",
          })
          .where(eq(patients.id, existing.id));
      }

      return existing.id;
    }

    const [created] = await db
      .insert(patients)
      .values({
        nom: "Patient",
        prenom: "Nouveau",
        matricule,
        date_naissance: "1970-01-01",
        cree_par_utilisateur: utilisateur.id,
      })
      .returning({ id: patients.id });

    if (!created) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Le rendez-vous n'a pas pu être préparé.",
      });
    }

    return created.id;
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
