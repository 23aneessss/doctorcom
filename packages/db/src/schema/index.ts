import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const utilisateur_role_values = ["medecin", "secretaire", "admin"] as const;
export const antecedent_type_values = ["personnel", "familial"] as const;
export const rendez_vous_statut_values = [
  "planifie",
  "confirme",
  "termine",
  "annule",
  "non_present",
] as const;
export const lettre_orientation_urgence_values = [
  "normale",
  "urgente",
  "tres_urgente",
] as const;
export const certificat_medical_type_values = [
  "arret_travail",
  "aptitude",
  "scolaire",
  "grossesse",
  "deces",
] as const;
export const certificat_medical_statut_values = ["brouillon", "emis", "annule"] as const;

export const utilisateur_role_enum = pgEnum("utilisateur_role", utilisateur_role_values);
export const antecedent_type_enum = pgEnum("antecedent_type", antecedent_type_values);
export const rendez_vous_statut_enum = pgEnum(
  "rendez_vous_statut",
  rendez_vous_statut_values,
);
export const lettre_orientation_urgence_enum = pgEnum(
  "lettre_orientation_urgence",
  lettre_orientation_urgence_values,
);
export const certificat_medical_type_enum = pgEnum(
  "certificat_medical_type",
  certificat_medical_type_values,
);
export const certificat_medical_statut_enum = pgEnum(
  "certificat_medical_statut",
  certificat_medical_statut_values,
);

// TODO(DB.md ambiguity): except for obvious identifiers, enums, booleans, and foreign keys,
// DB.md does not define required-vs-optional fields. This foundation keeps core join keys
// required and leaves descriptive medical fields nullable until domain rules are confirmed.

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

// TODO(DB.md ambiguity): `logs.timestamp` is shown as a date field in DB.md even though the
// semantic name is a timestamp. `horodatage` is stored as `timestamptz` here.
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
    suivi_id: uuid("suivi_id")
      .notNull()
      .references(() => suivi.id),
    utilisateur_id: uuid("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id),
    date: date("date").notNull(),
    heure: varchar("heure", { length: 16 }).notNull(),
    statut: rendez_vous_statut_enum("statut").notNull(),
    important: boolean("important").notNull(),
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

export const medicaments = pgTable("medicaments", {
  id: uuid("id").defaultRandom().primaryKey(),
  dci: varchar("dci", { length: 255 }).notNull(),
  indication: text("indication"),
  contre_indication: text("contre_indication"),
  posologie_standard: text("posologie_standard"),
  effets_indesirables: text("effets_indesirables"),
  dosage: varchar("dosage", { length: 128 }),
});

export const historique_traitements = pgTable(
  "historique_traitements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patient_id: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    medicament_id: uuid("medicament_id")
      .notNull()
      .references(() => medicaments.id),
    posologie: text("posologie").notNull(),
    est_actif: boolean("est_actif").notNull(),
    date_prescription: date("date_prescription").notNull(),
    prescrit_par_utilisateur: uuid("prescrit_par_utilisateur")
      .notNull()
      .references(() => utilisateurs.id),
  },
  (table) => [
    index("historique_traitements_patient_id_idx").on(table.patient_id),
    index("historique_traitements_medicament_id_idx").on(table.medicament_id),
    index("historique_traitements_prescrit_par_utilisateur_idx").on(
      table.prescrit_par_utilisateur,
    ),
  ],
);

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
    remarques: text("remarques"),
    date_prescription: date("date_prescription").notNull(),
  },
  (table) => [
    index("ordonnance_rendez_vous_id_idx").on(table.rendez_vous_id),
    index("ordonnance_patient_id_idx").on(table.patient_id),
    index("ordonnance_utilisateur_id_idx").on(table.utilisateur_id),
  ],
);

export const ordonnance_medicaments = pgTable(
  "ordonnance_medicaments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ordonnance_id: uuid("ordonnance_id")
      .notNull()
      .references(() => ordonnance.id),
    medicament_id: uuid("medicament_id")
      .notNull()
      .references(() => medicaments.id),
    posologie: text("posologie").notNull(),
    duree_traitement: varchar("duree_traitement", { length: 255 }),
    instructions: text("instructions"),
  },
  (table) => [
    index("ordonnance_medicaments_ordonnance_id_idx").on(table.ordonnance_id),
    index("ordonnance_medicaments_medicament_id_idx").on(table.medicament_id),
  ],
);

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
