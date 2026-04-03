import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { utilisateurs } from "./utilisateurs";

export const memory_notes = pgTable(
  "memory_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    utilisateur_id: uuid("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id),
    title: varchar("title", { length: 255 }),
    content: text("content").notNull(),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
    is_pinned: boolean("is_pinned").notNull().default(false),
    color: varchar("color", { length: 32 }),
    created_at: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("memory_notes_utilisateur_id_idx").on(table.utilisateur_id),
    index("memory_notes_updated_at_idx").on(table.updated_at),
  ],
);

export const memory_tags = pgTable(
  "memory_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    utilisateur_id: uuid("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id),
    name: varchar("name", { length: 128 }).notNull(),
    color: varchar("color", { length: 32 }),
    created_at: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("memory_tags_utilisateur_id_idx").on(table.utilisateur_id),
    uniqueIndex("memory_tags_utilisateur_name_unique").on(table.utilisateur_id, table.name),
  ],
);

export const flow_sessions = pgTable(
  "flow_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    utilisateur_id: uuid("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id),
    started_at: timestamp("started_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    ended_at: timestamp("ended_at", {
      mode: "date",
      withTimezone: true,
    }),
    duration_seconds: integer("duration_seconds"),
    session_notes: text("session_notes"),
    mood: varchar("mood", { length: 32 }),
    focus_score: integer("focus_score"),
    created_at: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("flow_sessions_utilisateur_id_idx").on(table.utilisateur_id),
    index("flow_sessions_started_at_idx").on(table.started_at),
  ],
);
