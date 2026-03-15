import {
  boolean,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { utilisateur_role_enum } from "./enums";

export const utilisateurs = pgTable(
  "utilisateurs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nom: varchar("nom", { length: 255 }).notNull(),
    prenom: varchar("prenom", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    adresse: text("adresse"),
    telephone: varchar("telephone", { length: 32 }),
    mot_de_passe_hash: text("mot_de_passe_hash").notNull(),
    date_creation: date("date_creation").notNull(),
    role: utilisateur_role_enum("role").notNull(),
  },
  (table) => [uniqueIndex("utilisateurs_email_unique").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    utilisateur_id: uuid("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id),
    jeton: text("jeton").notNull(),
    date_connexion: timestamp("date_connexion", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    date_expiration: timestamp("date_expiration", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    est_actif: boolean("est_actif").notNull(),
    nom_appareil: varchar("nom_appareil", { length: 255 }),
  },
  (table) => [index("sessions_utilisateur_id_idx").on(table.utilisateur_id)],
);

// TODO(DB.md ambiguity): `logs.timestamp` was initially shown as a date field in DB.md.
// `horodatage` is stored as `timestamptz` here.
export const logs = pgTable(
  "logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    utilisateur_id: uuid("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id),
    action: text("action").notNull(),
    horodatage: timestamp("horodatage", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [index("logs_utilisateur_id_idx").on(table.utilisateur_id)],
);
