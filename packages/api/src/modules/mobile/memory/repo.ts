import type { db as databaseClient } from "@doctor.com/db";
import { memory_notes, memory_tags } from "@doctor.com/db/schema";
import { and, desc, eq } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;

export type MemoryNoteRecord = typeof memory_notes.$inferSelect;
export type MemoryTagRecord = typeof memory_tags.$inferSelect;

export interface CreateMemoryNoteInput {
  title?: string | null;
  content: string;
  tags: string[];
  is_pinned?: boolean;
  color?: string | null;
}

export interface UpdateMemoryNoteInput {
  title?: string | null;
  content?: string;
  tags?: string[];
  is_pinned?: boolean;
  color?: string | null;
}

export class MobileMemoryRepository {
  async listNotesByUtilisateur(
    db: DatabaseClient,
    utilisateurId: string,
  ): Promise<MemoryNoteRecord[]> {
    return db
      .select()
      .from(memory_notes)
      .where(eq(memory_notes.utilisateur_id, utilisateurId))
      .orderBy(desc(memory_notes.is_pinned), desc(memory_notes.updated_at));
  }

  async getNoteByIdForUtilisateur(
    db: DatabaseClient,
    noteId: string,
    utilisateurId: string,
  ): Promise<MemoryNoteRecord | null> {
    const [note] = await db
      .select()
      .from(memory_notes)
      .where(and(eq(memory_notes.id, noteId), eq(memory_notes.utilisateur_id, utilisateurId)))
      .limit(1);

    return note ?? null;
  }

  async createNote(
    db: DatabaseClient,
    utilisateurId: string,
    input: CreateMemoryNoteInput,
  ): Promise<MemoryNoteRecord> {
    const [note] = await db
      .insert(memory_notes)
      .values({
        utilisateur_id: utilisateurId,
        title: input.title ?? null,
        content: input.content,
        tags: input.tags,
        is_pinned: input.is_pinned ?? false,
        color: input.color ?? null,
      })
      .returning();

    if (!note) {
      throw new Error("Echec de creation de la note.");
    }

    return note;
  }

  async updateNote(
    db: DatabaseClient,
    noteId: string,
    utilisateurId: string,
    input: UpdateMemoryNoteInput,
  ): Promise<MemoryNoteRecord | null> {
    const [note] = await db
      .update(memory_notes)
      .set(input)
      .where(and(eq(memory_notes.id, noteId), eq(memory_notes.utilisateur_id, utilisateurId)))
      .returning();

    return note ?? null;
  }

  async deleteNote(
    db: DatabaseClient,
    noteId: string,
    utilisateurId: string,
  ): Promise<boolean> {
    const [deleted] = await db
      .delete(memory_notes)
      .where(and(eq(memory_notes.id, noteId), eq(memory_notes.utilisateur_id, utilisateurId)))
      .returning({ id: memory_notes.id });

    return Boolean(deleted);
  }

  async togglePin(
    db: DatabaseClient,
    noteId: string,
    utilisateurId: string,
  ): Promise<MemoryNoteRecord | null> {
    const note = await this.getNoteByIdForUtilisateur(db, noteId, utilisateurId);
    if (!note) {
      return null;
    }

    return this.updateNote(db, noteId, utilisateurId, {
      is_pinned: !note.is_pinned,
    });
  }

  async listTagsByUtilisateur(
    db: DatabaseClient,
    utilisateurId: string,
  ): Promise<MemoryTagRecord[]> {
    return db
      .select()
      .from(memory_tags)
      .where(eq(memory_tags.utilisateur_id, utilisateurId))
      .orderBy(memory_tags.name);
  }

  async upsertTag(
    db: DatabaseClient,
    utilisateurId: string,
    name: string,
    color: string | null,
  ): Promise<void> {
    const existing = await db
      .select({ id: memory_tags.id })
      .from(memory_tags)
      .where(and(eq(memory_tags.utilisateur_id, utilisateurId), eq(memory_tags.name, name)))
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      return;
    }

    await db.insert(memory_tags).values({
      utilisateur_id: utilisateurId,
      name,
      color,
    });
  }
}

export const mobileMemoryRepository = new MobileMemoryRepository();
