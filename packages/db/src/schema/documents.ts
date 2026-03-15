import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  certificat_medical_statut_enum,
  certificat_medical_type_enum,
  lettre_orientation_urgence_enum,
} from "./enums";
import { patients } from "./patients";
import { suivi } from "./suivi";
import { utilisateurs } from "./utilisateurs";

export const vaccinations_patient = pgTable(
  "vaccinations_patient",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patient_id: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    vaccin: varchar("vaccin", { length: 255 }).notNull(),
    date_vaccination: date("date_vaccination").notNull(),
    notes: text("notes"),
  },
  (table) => [index("vaccinations_patient_patient_id_idx").on(table.patient_id)],
);

export const categories_documents = pgTable("categories_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  nom: varchar("nom", { length: 255 }).notNull(),
  description: text("description"),
});

export const documents_patient = pgTable(
  "documents_patient",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patient_id: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    categorie_id: uuid("categorie_id")
      .notNull()
      .references(() => categories_documents.id),
    type_document: varchar("type_document", { length: 128 }).notNull(),
    nom_document: varchar("nom_document", { length: 255 }).notNull(),
    chemin_fichier: text("chemin_fichier").notNull(),
    type_fichier: varchar("type_fichier", { length: 64 }).notNull(),
    taille_fichier: integer("taille_fichier").notNull(),
    description: text("description"),
    date_upload: timestamp("date_upload", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    uploade_par_utilisateur: uuid("uploade_par_utilisateur")
      .notNull()
      .references(() => utilisateurs.id),
    est_archive: boolean("est_archive").notNull(),
  },
  (table) => [
    index("documents_patient_patient_id_idx").on(table.patient_id),
    index("documents_patient_categorie_id_idx").on(table.categorie_id),
    index("documents_patient_uploade_par_utilisateur_idx").on(
      table.uploade_par_utilisateur,
    ),
  ],
);

export const lettres_orientation = pgTable(
  "lettres_orientation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documents_patient_id: uuid("documents_patient_id")
      .notNull()
      .references(() => documents_patient.id),
    utilisateur_id: uuid("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id),
    suivi_id: uuid("suivi_id")
      .notNull()
      .references(() => suivi.id),
    type_exploration: varchar("type_exploration", { length: 255 }),
    examen_demande: text("examen_demande"),
    raison: text("raison"),
    destinataire: varchar("destinataire", { length: 255 }),
    urgence: lettre_orientation_urgence_enum("urgence").notNull(),
    contenu_lettre: text("contenu_lettre"),
    date_creation: timestamp("date_creation", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    date_modification: timestamp("date_modification", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("lettres_orientation_documents_patient_id_unique").on(
      table.documents_patient_id,
    ),
    index("lettres_orientation_documents_patient_id_idx").on(table.documents_patient_id),
    index("lettres_orientation_utilisateur_id_idx").on(table.utilisateur_id),
    index("lettres_orientation_suivi_id_idx").on(table.suivi_id),
  ],
);

export const certificats_medicaux = pgTable(
  "certificats_medicaux",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documents_patient_id: uuid("documents_patient_id")
      .notNull()
      .references(() => documents_patient.id),
    utilisateur_id: uuid("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id),
    suivi_id: uuid("suivi_id")
      .notNull()
      .references(() => suivi.id),
    type_certificat: certificat_medical_type_enum("type_certificat").notNull(),
    date_emission: date("date_emission").notNull(),
    date_debut: date("date_debut"),
    date_fin: date("date_fin"),
    diagnostic: text("diagnostic"),
    destinataire: varchar("destinataire", { length: 255 }),
    notes: text("notes"),
    statut: certificat_medical_statut_enum("statut").notNull(),
    date_creation: timestamp("date_creation", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    date_modification: timestamp("date_modification", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("certificats_medicaux_documents_patient_id_unique").on(
      table.documents_patient_id,
    ),
    index("certificats_medicaux_documents_patient_id_idx").on(table.documents_patient_id),
    index("certificats_medicaux_utilisateur_id_idx").on(table.utilisateur_id),
    index("certificats_medicaux_suivi_id_idx").on(table.suivi_id),
  ],
);
