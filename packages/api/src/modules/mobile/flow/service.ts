import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";

import type { SessionUtilisateur } from "../../../trpc/context";
import { resolveMobileUtilisateur } from "../shared";
import { mobileFlowRepository } from "./repo";

type DatabaseClient = typeof databaseClient;
type MobileSession = Exclude<SessionUtilisateur, null>;

function formatFlowSession(session: Awaited<ReturnType<typeof mobileFlowRepository.getSessionByIdForUtilisateur>> extends infer T ? Exclude<T, null> : never) {
  return {
    id: session.id,
    startedAt: session.started_at.toISOString(),
    endedAt: session.ended_at ? session.ended_at.toISOString() : null,
    duration: session.duration_seconds ?? null,
    sessionNotes: session.session_notes,
    mood: session.mood,
    focusScore: session.focus_score,
  };
}

export class MobileFlowService {
  async startSession(data: {
    db: DatabaseClient;
    session: MobileSession;
  }) {
    const utilisateur = await resolveMobileUtilisateur(data.db, data.session);
    const existing = await mobileFlowRepository.getActiveSessionForUtilisateur(
      data.db,
      utilisateur.id,
    );

    if (existing) {
      return formatFlowSession(existing);
    }

    const session = await mobileFlowRepository.createSession(data.db, {
      utilisateur_id: utilisateur.id,
    });

    return formatFlowSession(session);
  }

  async endSession(data: {
    db: DatabaseClient;
    session: MobileSession;
    id: string;
    sessionNotes?: string;
    mood?: "excellent" | "good" | "average" | "poor";
    focusScore?: number;
  }) {
    const utilisateur = await resolveMobileUtilisateur(data.db, data.session);
    const session = await mobileFlowRepository.getSessionByIdForUtilisateur(
      data.db,
      data.id,
      utilisateur.id,
    );

    if (!session) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "La session Flow est introuvable.",
      });
    }

    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - session.started_at.getTime()) / 1000),
    );

    const updated = await mobileFlowRepository.updateSession(data.db, data.id, utilisateur.id, {
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      session_notes: data.sessionNotes?.trim() || null,
      mood: data.mood ?? null,
      focus_score: data.focusScore ?? null,
    });

    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "La session Flow n'a pas pu être terminée.",
      });
    }

    if (data.sessionNotes?.trim()) {
      await mobileFlowRepository.createMemoryNoteFromFlow(
        data.db,
        utilisateur.id,
        data.sessionNotes.trim(),
        `Notes Flow - ${endedAt.toLocaleDateString("fr-FR")}`,
      );
    }

    return formatFlowSession(updated);
  }

  async getActiveSession(data: {
    db: DatabaseClient;
    session: MobileSession;
  }) {
    const utilisateur = await resolveMobileUtilisateur(data.db, data.session);
    const active = await mobileFlowRepository.getActiveSessionForUtilisateur(
      data.db,
      utilisateur.id,
    );

    return active ? formatFlowSession(active) : null;
  }

  async updateNotes(data: {
    db: DatabaseClient;
    session: MobileSession;
    id: string;
    sessionNotes: string;
  }) {
    const utilisateur = await resolveMobileUtilisateur(data.db, data.session);
    const updated = await mobileFlowRepository.updateSession(data.db, data.id, utilisateur.id, {
      session_notes: data.sessionNotes.trim(),
    });

    if (!updated) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "La session Flow est introuvable.",
      });
    }

    return formatFlowSession(updated);
  }

  async getStats(data: {
    db: DatabaseClient;
    session: MobileSession;
    days: number;
  }) {
    const utilisateur = await resolveMobileUtilisateur(data.db, data.session);
    const since = new Date();
    since.setDate(since.getDate() - data.days);

    const sessions = await mobileFlowRepository.listCompletedSessionsSince(
      data.db,
      utilisateur.id,
      since,
    );

    const totalDurationSeconds = sessions.reduce(
      (sum, session) => sum + (session.duration_seconds ?? 0),
      0,
    );
    const focusScores = sessions
      .map((session) => session.focus_score)
      .filter((value): value is number => typeof value === "number");

    return {
      totalSessions: sessions.length,
      totalDurationMinutes: Math.round(totalDurationSeconds / 60),
      avgDurationMinutes:
        sessions.length > 0 ? Math.round(totalDurationSeconds / sessions.length / 60) : 0,
      avgFocusScore:
        focusScores.length > 0
          ? (focusScores.reduce((sum, score) => sum + score, 0) / focusScores.length).toFixed(1)
          : "0.0",
    };
  }
}

export const mobileFlowService = new MobileFlowService();
