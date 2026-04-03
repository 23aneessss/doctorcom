import type { db as databaseClient } from "@doctor.com/db";
import { flow_sessions, memory_notes } from "@doctor.com/db/schema";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;

export type FlowSessionRecord = typeof flow_sessions.$inferSelect;

export interface CreateFlowSessionInput {
  utilisateur_id: string;
}

export interface EndFlowSessionInput {
  ended_at: Date;
  duration_seconds: number;
  session_notes?: string | null;
  mood?: string | null;
  focus_score?: number | null;
}

export class MobileFlowRepository {
  async getActiveSessionForUtilisateur(
    db: DatabaseClient,
    utilisateurId: string,
  ): Promise<FlowSessionRecord | null> {
    const [session] = await db
      .select()
      .from(flow_sessions)
      .where(
        and(eq(flow_sessions.utilisateur_id, utilisateurId), isNull(flow_sessions.ended_at)),
      )
      .orderBy(desc(flow_sessions.started_at))
      .limit(1);

    return session ?? null;
  }

  async createSession(
    db: DatabaseClient,
    input: CreateFlowSessionInput,
  ): Promise<FlowSessionRecord> {
    const [session] = await db
      .insert(flow_sessions)
      .values({
        utilisateur_id: input.utilisateur_id,
      })
      .returning();

    if (!session) {
      throw new Error("Echec de creation de la session Flow.");
    }

    return session;
  }

  async getSessionByIdForUtilisateur(
    db: DatabaseClient,
    sessionId: string,
    utilisateurId: string,
  ): Promise<FlowSessionRecord | null> {
    const [session] = await db
      .select()
      .from(flow_sessions)
      .where(and(eq(flow_sessions.id, sessionId), eq(flow_sessions.utilisateur_id, utilisateurId)))
      .limit(1);

    return session ?? null;
  }

  async updateSession(
    db: DatabaseClient,
    sessionId: string,
    utilisateurId: string,
    values: Partial<typeof flow_sessions.$inferInsert>,
  ): Promise<FlowSessionRecord | null> {
    const [session] = await db
      .update(flow_sessions)
      .set(values)
      .where(and(eq(flow_sessions.id, sessionId), eq(flow_sessions.utilisateur_id, utilisateurId)))
      .returning();

    return session ?? null;
  }

  async listCompletedSessionsSince(
    db: DatabaseClient,
    utilisateurId: string,
    since: Date,
  ): Promise<FlowSessionRecord[]> {
    return db
      .select()
      .from(flow_sessions)
      .where(
        and(
          eq(flow_sessions.utilisateur_id, utilisateurId),
          gte(flow_sessions.started_at, since),
          sql`${flow_sessions.ended_at} IS NOT NULL`,
        ),
      )
      .orderBy(desc(flow_sessions.started_at));
  }

  async createMemoryNoteFromFlow(
    db: DatabaseClient,
    utilisateurId: string,
    content: string,
    title: string,
  ): Promise<void> {
    await db.insert(memory_notes).values({
      utilisateur_id: utilisateurId,
      title,
      content,
      tags: ["flow", "session"],
      is_pinned: false,
    });
  }
}

export const mobileFlowRepository = new MobileFlowRepository();
