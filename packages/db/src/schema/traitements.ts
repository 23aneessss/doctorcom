import { boolean, date, index, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";

import { historique_traitement_source_enum } from "./enums";
import { patients } from "./patients";
import { pre_rempli_ordonnance } from "./ordonnances";
import { rendez_vous } from "./suivi";
import { utilisateurs } from "./utilisateurs";

export const ordonnance = pgTable(
  "ordonnance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rendez_vous_id: uuid("rendez_vous_id")
      .notNull()
      .references(() => rendez_vous.id),
    patient_id: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    utilisateur_id: uuid("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id),
    pre_rempli_origine_id: uuid("pre_rempli_origine_id").references(
      () => pre_rempli_ordonnance.id,
    ),
    remarques: text("remarques"),
    date_prescription: date("date_prescription").notNull(),
  },
  (table) => [
    index("ordonnance_rendez_vous_id_idx").on(table.rendez_vous_id),
    index("ordonnance_patient_id_idx").on(table.patient_id),
    index("ordonnance_utilisateur_id_idx").on(table.utilisateur_id),
    index("ordonnance_pre_rempli_origine_id_idx").on(
      table.pre_rempli_origine_id,
    ),
  ],
);

export const ordonnance_medicaments = pgTable(
  "ordonnance_medicaments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ordonnance_id: uuid("ordonnance_id")
      .notNull()
      .references(() => ordonnance.id),
    medicament_externe_id: varchar("medicament_externe_id", { length: 64 }).notNull(),
    nom_medicament: varchar("nom_medicament", { length: 255 }).notNull(),
    dci: varchar("dci", { length: 255 }),
    dosage: varchar("dosage", { length: 128 }),
    posologie: text("posologie").notNull(),
    duree_traitement: varchar("duree_traitement", { length: 255 }),
    instructions: text("instructions"),
  },
  (table) => [
    index("ordonnance_medicaments_ordonnance_id_idx").on(table.ordonnance_id),
    index("ordonnance_medicaments_medicament_externe_id_idx").on(
      table.medicament_externe_id,
    ),
  ],
);

export const historique_traitements = pgTable(
  "historique_traitements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patient_id: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    medicament_externe_id: varchar("medicament_externe_id", { length: 64 }).notNull(),
    nom_medicament: varchar("nom_medicament", { length: 255 }).notNull(),
    dosage: varchar("dosage", { length: 128 }),
    posologie: text("posologie").notNull(),
    est_actif: boolean("est_actif").notNull(),
    date_prescription: date("date_prescription").notNull(),
    prescrit_par_utilisateur: uuid("prescrit_par_utilisateur")
      .notNull()
      .references(() => utilisateurs.id),
    ordonnance_id: uuid("ordonnance_id").references(() => ordonnance.id),
    ordonnance_medicament_id: uuid("ordonnance_medicament_id").references(
      () => ordonnance_medicaments.id,
    ),
    source_type: historique_traitement_source_enum("source_type")
      .notNull()
      .default("manuel"),
  },
  (table) => [
    index("historique_traitements_patient_id_idx").on(table.patient_id),
    index("historique_traitements_medicament_externe_id_idx").on(
      table.medicament_externe_id,
    ),
    index("historique_traitements_prescrit_par_utilisateur_idx").on(
      table.prescrit_par_utilisateur,
    ),
    index("historique_traitements_ordonnance_id_idx").on(table.ordonnance_id),
    index("historique_traitements_ordonnance_medicament_id_idx").on(
      table.ordonnance_medicament_id,
    ),
    index("historique_traitements_source_type_idx").on(table.source_type),
  ],
);
