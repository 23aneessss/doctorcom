import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";

import type { SessionUtilisateur } from "../../../trpc/context";
import { resolveMobileUtilisateur } from "../shared";
import {
  mobileMemoryRepository,
  type MemoryNoteRecord,
  type MemoryTagRecord,
} from "./repo";

type DatabaseClient = typeof databaseClient;
type MobileSession = Exclude<SessionUtilisateur, null>;

const DEFAULT_TAG_COLORS: Record<string, string> = {
  diagnostic: "#0891B2",
  rappel: "#F97316",
  protocole: "#10B981",
  traitement: "#8B5CF6",
  formation: "#EC4899",
  idee: "#EAB308",
  flow: "#1E3A5F",
  session: "#64748B",
};

function formatNote(note: MemoryNoteRecord) {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    tags: note.tags,
    isPinned: note.is_pinned,
    color: note.color,
    createdAt: note.created_at.toISOString(),
    updatedAt: note.updated_at.toISOString(),
  };
}

function formatTag(tag: MemoryTagRecord) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
  };
}

export class MobileMemoryService {
  async getNotes(data: {
    db: DatabaseClient;
    session: MobileSession;
    search?: string;
    tags?: string[];
    limit: number;
    offset: number;
  }) {
    const utilisateur = await resolveMobileUtilisateur(data.db, data.session);
    const notes = await mobileMemoryRepository.listNotesByUtilisateur(data.db, utilisateur.id);

    const normalizedSearch = data.search?.trim().toLowerCase();
    const normalizedTags = (data.tags ?? []).map((tag) => tag.trim().toLowerCase());

    const filtered = notes.filter((note) => {
      const matchesSearch =
        !normalizedSearch ||
        note.title?.toLowerCase().includes(normalizedSearch) ||
        note.content.toLowerCase().includes(normalizedSearch);

      const matchesTags =
        normalizedTags.length === 0 ||
        normalizedTags.every((tag) =>
          note.tags.some((noteTag) => noteTag.toLowerCase() === tag),
        );

      return matchesSearch && matchesTags;
    });

    return filtered.slice(data.offset, data.offset + data.limit).map(formatNote);
  }

  async getNote(data: {
    db: DatabaseClient;
    session: MobileSession;
    id: string;
  }) {
    const utilisateur = await resolveMobileUtilisateur(data.db, data.session);
    const note = await mobileMemoryRepository.getNoteByIdForUtilisateur(
      data.db,
      data.id,
      utilisateur.id,
    );

    if (!note) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Cette note est introuvable.",
      });
    }

    return formatNote(note);
  }

  async createNote(data: {
    db: DatabaseClient;
    session: MobileSession;
    input: {
      title?: string;
      content: string;
      tags: string[];
      isPinned?: boolean;
      color?: string | null;
    };
  }) {
    const utilisateur = await resolveMobileUtilisateur(data.db, data.session);
    const tags = this.normalizeTags(data.input.tags);
    const note = await mobileMemoryRepository.createNote(data.db, utilisateur.id, {
      title: data.input.title?.trim() || null,
      content: data.input.content.trim(),
      tags,
      is_pinned: data.input.isPinned,
      color: data.input.color ?? null,
    });

    await this.syncTags(data.db, utilisateur.id, tags);
    return formatNote(note);
  }

  async updateNote(data: {
    db: DatabaseClient;
    session: MobileSession;
    id: string;
    input: {
      title?: string;
      content?: string;
      tags?: string[];
      isPinned?: boolean;
      color?: string | null;
    };
  }) {
    const utilisateur = await resolveMobileUtilisateur(data.db, data.session);
    const note = await mobileMemoryRepository.getNoteByIdForUtilisateur(
      data.db,
      data.id,
      utilisateur.id,
    );

    if (!note) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Cette note est introuvable.",
      });
    }

    const nextTags = data.input.tags ? this.normalizeTags(data.input.tags) : undefined;
    const updated = await mobileMemoryRepository.updateNote(data.db, data.id, utilisateur.id, {
      title: data.input.title?.trim() || null,
      content: data.input.content?.trim(),
      tags: nextTags,
      is_pinned: data.input.isPinned,
      color: data.input.color ?? null,
    });

    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "La note n'a pas pu être mise à jour.",
      });
    }

    if (nextTags) {
      await this.syncTags(data.db, utilisateur.id, nextTags);
    }

    return formatNote(updated);
  }

  async deleteNote(data: {
    db: DatabaseClient;
    session: MobileSession;
    id: string;
  }) {
    const utilisateur = await resolveMobileUtilisateur(data.db, data.session);
    const deleted = await mobileMemoryRepository.deleteNote(data.db, data.id, utilisateur.id);

    if (!deleted) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Cette note est introuvable.",
      });
    }

    return { success: true };
  }

  async togglePin(data: {
    db: DatabaseClient;
    session: MobileSession;
    id: string;
  }) {
    const utilisateur = await resolveMobileUtilisateur(data.db, data.session);
    const note = await mobileMemoryRepository.togglePin(data.db, data.id, utilisateur.id);

    if (!note) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Cette note est introuvable.",
      });
    }

    return formatNote(note);
  }

  async getTags(data: {
    db: DatabaseClient;
    session: MobileSession;
  }) {
    const utilisateur = await resolveMobileUtilisateur(data.db, data.session);
    const tags = await mobileMemoryRepository.listTagsByUtilisateur(data.db, utilisateur.id);
    return tags.map(formatTag);
  }

  private normalizeTags(tags: string[]): string[] {
    return Array.from(
      new Set(
        tags
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
      ),
    );
  }

  private async syncTags(
    db: DatabaseClient,
    utilisateurId: string,
    tags: string[],
  ): Promise<void> {
    for (const tag of tags) {
      await mobileMemoryRepository.upsertTag(
        db,
        utilisateurId,
        tag,
        DEFAULT_TAG_COLORS[tag.toLowerCase()] ?? null,
      );
    }
  }
}

export const mobileMemoryService = new MobileMemoryService();
