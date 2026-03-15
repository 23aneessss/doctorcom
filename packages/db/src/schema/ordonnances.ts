import {
  boolean,
  index,
  integer,
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
    medicament_nom: varchar("medicament_nom", { length: 255 }).notNull(),
    posologie_defaut: varchar("posologie_defaut", { length: 255 }),
    duree_defaut: varchar("duree_defaut", { length: 255 }),
    instructions_defaut: text("instructions_defaut"),
    ordre_affichage: integer("ordre_affichage"),
    est_optionnel: boolean("est_optionnel").notNull().default(false),
  },
  (table) => [
    index("pre_rempli_medicaments_pre_rempli_id_idx").on(table.pre_rempli_id),
  ],
);