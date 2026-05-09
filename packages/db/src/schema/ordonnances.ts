import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { utilisateurs } from "./utilisateurs";

export const categories_pre_rempli = pgTable("categories_pre_rempli", {
  id: uuid("id").defaultRandom().primaryKey(),
  nom: varchar("nom", { length: 255 }).notNull(),
  description: text("description"),
});

export const pre_rempli_ordonnance = pgTable(
  "pre_rempli_ordonnance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nom: varchar("nom", { length: 255 }).notNull(),
    description: text("description"),
    specialite: varchar("specialite", { length: 255 }),
    categorie_pre_rempli_id: uuid("categorie_pre_rempli_id")
      .notNull()
      .references(() => categories_pre_rempli.id),
    est_actif: boolean("est_actif").notNull().default(true),
    created_at: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    created_by_user: uuid("created_by_user")
      .notNull()
      .references(() => utilisateurs.id),
  },
  (table) => [
    index("pre_rempli_ordonnance_categorie_pre_rempli_id_idx").on(
      table.categorie_pre_rempli_id,
    ),
    index("pre_rempli_ordonnance_created_by_user_idx").on(table.created_by_user),
  ],
);

export const pre_rempli_medicaments = pgTable(
  "pre_rempli_medicaments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pre_rempli_id: uuid("pre_rempli_id")
      .notNull()
      .references(() => pre_rempli_ordonnance.id),
    medicament_externe_id: varchar("medicament_externe_id", { length: 64 }).notNull(),
    nom_medicament: varchar("nom_medicament", { length: 255 }).notNull(),
    dosage: varchar("dosage", { length: 128 }),
    posologie_defaut: varchar("posologie_defaut", { length: 255 }),
    duree_defaut: varchar("duree_defaut", { length: 255 }),
    instructions_defaut: text("instructions_defaut"),
    ordre_affichage: integer("ordre_affichage"),
    est_optionnel: boolean("est_optionnel").notNull().default(false),
  },
  (table) => [
    index("pre_rempli_medicaments_pre_rempli_id_idx").on(table.pre_rempli_id),
    index("pre_rempli_medicaments_medicament_externe_id_idx").on(
      table.medicament_externe_id,
    ),
  ],
);

export const ordonnance_pdf_templates = pgTable(
  "ordonnance_pdf_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    utilisateur_id: uuid("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id),
    nom: varchar("nom", { length: 255 }).notNull(),
    description: text("description"),
    chemin_fichier: text("chemin_fichier").notNull(),
    type_fichier: varchar("type_fichier", { length: 64 }).notNull(),
    taille_fichier: integer("taille_fichier").notNull(),
    logo_chemin_fichier: text("logo_chemin_fichier"),
    logo_type_fichier: varchar("logo_type_fichier", { length: 64 }),
    logo_taille_fichier: integer("logo_taille_fichier"),
    page_width: integer("page_width").notNull(),
    page_height: integer("page_height").notNull(),
    layout_config: jsonb("layout_config").notNull(),
    est_actif: boolean("est_actif").notNull().default(true),
    is_default_for_user: boolean("is_default_for_user").notNull().default(false),
    created_at: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ord_pdf_templates_utilisateur_id_idx").on(table.utilisateur_id),
    index("ord_pdf_templates_default_idx").on(
      table.utilisateur_id,
      table.is_default_for_user,
    ),
  ],
);
