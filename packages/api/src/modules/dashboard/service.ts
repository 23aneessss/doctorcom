import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";

import type { SessionUtilisateur } from "../../trpc/context";
import {
  dashboardRepository,
  type DashboardRendezVousRecord,
  type DashboardUtilisateurRecord,
} from "./repo";

type DatabaseClient = typeof databaseClient;
type DashboardSession = Exclude<SessionUtilisateur, null>;

export interface DashboardOverview {
  metrics: {
    todayAppointments: number;
    totalPatients: number;
    newPatients: number;
    cancelledAppointments: number;
  };
  patientTrend: Array<{
    label: string;
    value: number;
  }>;
  topMedications: Array<{
    name: string;
    count: number;
  }>;
  rdvTypes: Array<{
    label: string;
    value: number;
  }>;
  upcomingAppointments: Array<{
    id: string;
    patientLabel: string;
    time: string;
    date: string;
    status: string;
    type: string;
    patientInitials: string;
  }>;
  calendarDays: Array<{
    day: string;
    weekday: string;
    isoDate: string;
    isActive: boolean;
  }>;
}

export class DashboardService {
  async getOverview(data: {
    db: DatabaseClient;
    session: DashboardSession;
  }): Promise<DashboardOverview> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const today = this.formatDate(new Date());
    const monthStart = this.startOfMonth(new Date());
    const trendStart = this.addDays(new Date(), -21);
    const futureEnd = this.addDays(new Date(), 30);

    const [patients, rdvs, medications] = await Promise.all([
      dashboardRepository.listPatientsForUtilisateur(data.db, utilisateur.id),
      dashboardRepository.listRendezVousByDateRangeForUtilisateur(
        data.db,
        utilisateur.id,
        this.formatDate(trendStart),
        this.formatDate(futureEnd),
      ),
      dashboardRepository.listPrescribedMedicationsForUtilisateur(
        data.db,
        utilisateur.id,
        this.formatDate(monthStart),
        today,
      ),
    ]);

    const todayRdvs = rdvs.filter((rdv) => rdv.date === today);
    const cancelledAppointments = rdvs.filter((rdv) => rdv.statut === "annule").length;
    const newPatients = patients.filter((patient) => {
      if (!patient.date_admission) return false;
      return patient.date_admission >= this.formatDate(monthStart) && patient.date_admission <= today;
    }).length;

    return {
      metrics: {
        todayAppointments: todayRdvs.length,
        totalPatients: patients.length,
        newPatients,
        cancelledAppointments,
      },
      patientTrend: this.buildPatientTrend(patients),
      topMedications: this.buildTopMedications(medications),
      rdvTypes: this.buildRdvTypes(rdvs),
      upcomingAppointments: this.buildUpcomingAppointments(rdvs, today),
      calendarDays: this.buildCalendarDays(),
    };
  }

  private async resolveUtilisateur(
    database: DatabaseClient,
    session: DashboardSession,
  ): Promise<DashboardUtilisateurRecord> {
    const email = session.user.email.trim().toLowerCase();
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "La session a expire. Reconnectez-vous.",
      });
    }

    const utilisateur = await dashboardRepository.findUtilisateurByEmail(database, email);
    if (!utilisateur) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Le compte associe a cette session est introuvable.",
      });
    }

    return utilisateur;
  }

  private buildPatientTrend(
    patients: Array<{ date_admission: string | null }>,
  ): DashboardOverview["patientTrend"] {
    const days = Array.from({ length: 22 }, (_, index) => this.addDays(new Date(), index - 21));

    return days.map((dateValue) => {
      const isoDate = this.formatDate(dateValue);
      const value = patients.filter((patient) => patient.date_admission === isoDate).length;

      return {
        label: dateValue.getDate().toString().padStart(2, "0"),
        value,
      };
    });
  }

  private buildTopMedications(
    medications: Array<{ nom_medicament: string }>,
  ): DashboardOverview["topMedications"] {
    const counts = new Map<string, number>();

    for (const medication of medications) {
      const name = medication.nom_medicament.trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));
  }

  private buildRdvTypes(
    rdvs: DashboardRendezVousRecord[],
  ): DashboardOverview["rdvTypes"] {
    const labels = ["Routine", "Consultation", "Suivi", "Controle"];
    const counts = new Map(labels.map((label) => [label, 0]));

    for (const rdv of rdvs) {
      const normalized = this.normalizeTypeLabel(rdv.type_creneau);
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }

    return labels.map((label) => ({
      label,
      value: counts.get(label) ?? 0,
    }));
  }

  private buildUpcomingAppointments(
    rdvs: DashboardRendezVousRecord[],
    today: string,
  ): DashboardOverview["upcomingAppointments"] {
    return rdvs
      .filter((rdv) => rdv.date >= today && rdv.statut !== "annule")
      .sort((a, b) => `${a.date} ${a.heure}`.localeCompare(`${b.date} ${b.heure}`))
      .slice(0, 5)
      .map((rdv) => {
        const patientLabel = rdv.patient_label?.trim() || "Patient";
        return {
          id: rdv.id,
          patientLabel,
          time: rdv.heure.slice(0, 5),
          date: rdv.date,
          status: rdv.statut,
          type: rdv.type_creneau ?? "Consultation",
          patientInitials: rdv.patient_initials?.trim() || this.getInitials(patientLabel),
        };
      });
  }

  private buildCalendarDays(): DashboardOverview["calendarDays"] {
    return Array.from({ length: 7 }, (_, index) => {
      const dateValue = this.addDays(new Date(), index);
      return {
        day: dateValue.getDate().toString(),
        weekday: this.formatWeekday(dateValue),
        isoDate: this.formatDate(dateValue),
        isActive: index === 0,
      };
    });
  }

  private normalizeTypeLabel(value: string | null): string {
    const normalized = value?.trim().toLowerCase() ?? "";
    if (normalized.includes("routine")) return "Routine";
    if (normalized.includes("suivi")) return "Suivi";
    if (normalized.includes("controle") || normalized.includes("contrôle")) return "Controle";
    return "Consultation";
  }

  private formatDate(dateValue: Date): string {
    return dateValue.toISOString().slice(0, 10);
  }

  private startOfMonth(dateValue: Date): Date {
    return new Date(Date.UTC(dateValue.getUTCFullYear(), dateValue.getUTCMonth(), 1));
  }

  private addDays(dateValue: Date, days: number): Date {
    const nextDate = new Date(dateValue);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate;
  }

  private formatWeekday(dateValue: Date): string {
    const labels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    return labels[dateValue.getDay()] ?? "";
  }

  private getInitials(value: string): string {
    const initials = value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");

    return initials || "P";
  }
}

export const dashboardService = new DashboardService();
