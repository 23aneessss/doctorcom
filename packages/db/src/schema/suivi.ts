import {
  boolean,
  date,
  index,
  numeric,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { rendez_vous_statut_enum } from "./enums";
import { patients } from "./patients";
import { utilisateurs } from "./utilisateurs";

export const suivi = pgTable(
  "suivi",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patient_id: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    utilisateur_id: uuid("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id),
    hypothese_diagnostic: text("hypothese_diagnostic"),
    motif: text("motif").notNull(),
    historique: text("historique"),
    date_ouverture: date("date_ouverture").notNull(),
    date_fermeture: date("date_fermeture"),
    est_actif: boolean("est_actif").notNull(),
  },
  (table) => [
    index("suivi_patient_id_idx").on(table.patient_id),
    index("suivi_utilisateur_id_idx").on(table.utilisateur_id),
  ],
);

export const rendez_vous = pgTable(
  "rendez_vous",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patient_id: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    suivi_id: uuid("suivi_id").references(() => suivi.id),
    utilisateur_id: uuid("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id),
    date: date("date").notNull(),
    heure: varchar("heure", { length: 16 }).notNull(),
    statut: rendez_vous_statut_enum("statut").notNull(),
    important: boolean("important").notNull(),
    frequence_rappel: varchar("frequence_rappel", { length: 128 }),
    periode_rappel: varchar("periode_rappel", { length: 128 }),
  },
  (table) => [
    index("rendez_vous_patient_id_idx").on(table.patient_id),
    index("rendez_vous_suivi_id_idx").on(table.suivi_id),
    index("rendez_vous_utilisateur_id_idx").on(table.utilisateur_id),
  ],
);

export const examen_consultation = pgTable(
  "examen_consultation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rendez_vous_id: uuid("rendez_vous_id")
      .notNull()
      .references(() => rendez_vous.id),
    suivi_id: uuid("suivi_id")
      .notNull()
      .references(() => suivi.id),
    date: date("date").notNull(),
    taille: numeric("taille"),
    poids: numeric("poids"),
    traitement_prescrit: text("traitement_prescrit"),
    description_consultation: text("description_consultation"),
    aspect_general: text("aspect_general"),
    examen_respiratoire: text("examen_respiratoire"),
    examen_cardiovasculaire: text("examen_cardiovasculaire"),
    examen_cutane_muqueux: text("examen_cutane_muqueux"),
    examen_orl: text("examen_orl"),
    examen_digestif: text("examen_digestif"),
    examen_neurologique: text("examen_neurologique"),
    examen_locomoteur: text("examen_locomoteur"),
    examen_genital: text("examen_genital"),
    examen_urinaire: text("examen_urinaire"),
    examen_ganglionnaire: text("examen_ganglionnaire"),
    examen_endocrinien: text("examen_endocrinien"),
    conclusion: text("conclusion"),
  },
  (table) => [
    index("examen_consultation_rendez_vous_id_idx").on(table.rendez_vous_id),
    index("examen_consultation_suivi_id_idx").on(table.suivi_id),
  ],
);
