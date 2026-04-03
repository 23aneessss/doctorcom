import type { db as databaseClient } from "@doctor.com/db";

import type { SessionUtilisateur } from "../../../trpc/context";
import { agendaService } from "../../agenda/service";
import { mobileFlowRepository } from "../flow/repo";
import { mobileMemoryRepository } from "../memory/repo";
import { resolveMobileUtilisateur } from "../shared";

type DatabaseClient = typeof databaseClient;
type MobileSession = Exclude<SessionUtilisateur, null>;

export class MobileTodayService {
  async getSummary(data: {
    db: DatabaseClient;
    session: MobileSession;
    date: string;
  }) {
    const utilisateur = await resolveMobileUtilisateur(data.db, data.session);
    const appointments = await agendaService.getDaySlots({
      db: data.db,
      session: data.session,
      date: data.date,
    });

    const totalAppointments = appointments.length;
    const completedAppointments = appointments.filter((slot) => slot.status === "completed").length;
    const cancelledAppointments = appointments.filter((slot) => slot.status === "cancelled").length;
    const pendingAppointments = appointments.filter(
      (slot) => slot.status === "pending" || slot.status === "booked",
    ).length;
    const blockedAppointments = appointments.filter((slot) => slot.status === "blocked").length;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const upcomingAppointments = appointments.filter((slot) => {
      const [hours = 0, minutes = 0] = slot.startTime.split(":").map(Number);
      return hours * 60 + minutes >= currentMinutes && ["pending", "booked"].includes(slot.status);
    });

    const [nextAppointment] = upcomingAppointments;
    const todayStart = new Date(`${data.date}T00:00:00.000Z`);
    const tomorrowStart = new Date(`${data.date}T23:59:59.999Z`);

    const flowSessions = await mobileFlowRepository.listCompletedSessionsSince(
      data.db,
      utilisateur.id,
      todayStart,
    );

    const totalFlowTime = flowSessions
      .filter((session) => session.started_at <= tomorrowStart)
      .reduce((sum, session) => sum + (session.duration_seconds ?? 0), 0);

    const notes = await mobileMemoryRepository.listNotesByUtilisateur(data.db, utilisateur.id);
    const notesCreated = notes.filter((note) => {
      const createdAt = note.created_at.toISOString().slice(0, 10);
      return createdAt === data.date;
    }).length;

    return {
      date: data.date,
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      pendingAppointments,
      freeSlots: 0,
      blockedAppointments,
      nextAppointment: nextAppointment ?? null,
      upcomingCount: upcomingAppointments.length,
      totalFlowTimeMinutes: Math.round(totalFlowTime / 60),
      notesCreated,
      delayMinutes: 0,
      appointments,
    };
  }

  async getQuickStats(data: {
    db: DatabaseClient;
    session: MobileSession;
  }) {
    const utilisateur = await resolveMobileUtilisateur(data.db, data.session);
    const today = new Date().toISOString().slice(0, 10);
    const todaySummary = await this.getSummary({
      db: data.db,
      session: data.session,
      date: today,
    });

    const weekStart = new Date();
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    const weekStartString = weekStart.toISOString().slice(0, 10);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    const weekEndString = weekEnd.toISOString().slice(0, 10);

    const weeklyAppointments = await agendaService.getSlots({
      db: data.db,
      session: data.session,
      startDate: weekStartString,
      endDate: weekEndString,
    });

    const flowSessions = await mobileFlowRepository.listCompletedSessionsSince(
      data.db,
      utilisateur.id,
      weekStart,
    );

    const totalFlowMinutes = Math.round(
      flowSessions.reduce((sum, session) => sum + (session.duration_seconds ?? 0), 0) / 60,
    );

    const notes = await mobileMemoryRepository.listNotesByUtilisateur(data.db, utilisateur.id);

    return {
      today: {
        total: todaySummary.totalAppointments,
        completed: todaySummary.completedAppointments,
        cancelled: todaySummary.cancelledAppointments,
        pending: todaySummary.pendingAppointments,
      },
      week: {
        totalAppointments: weeklyAppointments.length,
        totalFlowMinutes,
      },
      totalNotes: notes.length,
    };
  }
}

export const mobileTodayService = new MobileTodayService();
