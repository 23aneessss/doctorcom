import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { antecedent_type_enum } from "./enums";
import { utilisateurs } from "./utilisateurs";

// TODO(DB.md ambiguity): except for obvious identifiers, enums, booleans, and foreign keys,
// DB.md does not define required-vs-optional fields. This foundation keeps core join keys
// required and leaves descriptive medical fields nullable until domain rules are confirmed.
export const patients = pgTable(
  "patients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nom: varchar("nom", { length: 255 }).notNull(),
    prenom: varchar("prenom", { length: 255 }).notNull(),
    telephone: varchar("telephone", { length: 32 }),
    email: varchar("email", { length: 255 }),
    matricule: varchar("matricule", { length: 128 }).notNull(),
    date_naissance: date("date_naissance").notNull(),
    nss: integer("nss"),
    lieu_naissance: varchar("lieu_naissance", { length: 255 }),
    sexe: varchar("sexe", { length: 64 }),
    nationalite: varchar("nationalite", { length: 128 }),
    groupe_sanguin: varchar("groupe_sanguin", { length: 16 }),
    adresse: text("adresse"),
    profession: varchar("profession", { length: 255 }),
    habitudes_saines: text("habitudes_saines"),
    habitudes_toxiques: text("habitudes_toxiques"),
    nb_enfants: integer("nb_enfants"),
    situation_familiale: varchar("situation_familiale", { length: 128 }),
    age_circoncision: integer("age_circoncision"),
    date_admission: date("date_admission"),
    environnement_animal: text("environnement_animal"),
    revenu_mensuel: numeric("revenu_mensuel"),
    taille_menage: integer("taille_menage"),
    nb_pieces: integer("nb_pieces"),
    niveau_intellectuel: varchar("niveau_intellectuel", { length: 128 }),
    activite_sexuelle: boolean("activite_sexuelle"),
    relations_environnement: text("relations_environnement"),
    cree_par_utilisateur: uuid("cree_par_utilisateur")
      .notNull()
      .references(() => utilisateurs.id),
  },
  (table) => [
    uniqueIndex("patients_matricule_unique").on(table.matricule),
    index("patients_cree_par_utilisateur_idx").on(table.cree_par_utilisateur),
  ],
);

export const patients_femmes = pgTable(
  "patients_femmes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patient_id: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    menarche: integer("menarche"),
    regularite_cycles: varchar("regularite_cycles", { length: 255 }),
    contraception: text("contraception"),
    nb_grossesses: integer("nb_grossesses"),
    nb_cesariennes: integer("nb_cesariennes"),
    menopause: boolean("menopause"),
    age_menopause: integer("age_menopause"),
    symptomes_menopause: text("symptomes_menopause"),
  },
  (table) => [
    uniqueIndex("patients_femmes_patient_id_unique").on(table.patient_id),
    index("patients_femmes_patient_id_idx").on(table.patient_id),
  ],
);

export const voyages_recents = pgTable(
  "voyages_recents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patient_id: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    destination: varchar("destination", { length: 255 }).notNull(),
    date: date("date").notNull(),
    duree_jours: integer("duree_jours"),
    epidemies_destination: text("epidemies_destination"),
  },
  (table) => [index("voyages_recents_patient_id_idx").on(table.patient_id)],
);

export const antecedents = pgTable(
  "antecedents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patient_id: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    type: antecedent_type_enum("type").notNull(),
    description: text("description").notNull(),
  },
  (table) => [index("antecedents_patient_id_idx").on(table.patient_id)],
);

export const antecedents_personnels = pgTable(
  "antecedents_personnels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    antecedent_id: uuid("antecedent_id")
      .notNull()
      .references(() => antecedents.id),
    type: varchar("type", { length: 255 }).notNull(),
    details: text("details"),
    est_actif: boolean("est_actif").notNull(),
  },
  (table) => [index("antecedents_personnels_antecedent_id_idx").on(table.antecedent_id)],
);

export const antecedents_familiaux = pgTable(
  "antecedents_familiaux",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    antecedent_id: uuid("antecedent_id")
      .notNull()
      .references(() => antecedents.id),
    details: text("details"),
    lien_parente: varchar("lien_parente", { length: 128 }),
  },
  (table) => [index("antecedents_familiaux_antecedent_id_idx").on(table.antecedent_id)],
);
