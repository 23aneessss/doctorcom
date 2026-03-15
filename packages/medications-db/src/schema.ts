import { index, integer, pgTable, serial, text } from "drizzle-orm/pg-core";

export const medicaments = pgTable(
  "medicaments",
  {
    id: serial("id").primaryKey(),
    nom_medicament: text("nom_medicament").notNull(),
    nom_generique: text("nom_generique"),
    classe_therapeutique: text("classe_therapeutique"),
    famille_pharmacologique: text("famille_pharmacologique"),
    posologie_adulte: text("posologie_adulte"),
    posologie_enfant: text("posologie_enfant"),
    dose_maximale: text("dose_maximale"),
    frequence_administration: text("frequence_administration"),
    grossesse: text("grossesse"),
    allaitement: text("allaitement"),
  },
  (table) => [
    index("medicaments_nom_medicament_idx").on(table.nom_medicament),
    index("medicaments_nom_generique_idx").on(table.nom_generique),
    index("medicaments_classe_therapeutique_idx").on(table.classe_therapeutique),
    index("medicaments_famille_pharmacologique_idx").on(table.famille_pharmacologique),
  ],
);

export const substances_actives = pgTable(
  "substances_actives",
  {
    id: serial("id").primaryKey(),
    medicament_id: integer("medicament_id")
      .notNull()
      .references(() => medicaments.id),
    nom_substance: text("nom_substance").notNull(),
  },
  (table) => [index("substances_actives_medicament_id_idx").on(table.medicament_id)],
);

export const indications = pgTable(
  "indications",
  {
    id: serial("id").primaryKey(),
    medicament_id: integer("medicament_id")
      .notNull()
      .references(() => medicaments.id),
    indication: text("indication").notNull(),
  },
  (table) => [index("indications_medicament_id_idx").on(table.medicament_id)],
);

export const contre_indications = pgTable(
  "contre_indications",
  {
    id: serial("id").primaryKey(),
    medicament_id: integer("medicament_id")
      .notNull()
      .references(() => medicaments.id),
    description: text("description").notNull(),
  },
  (table) => [index("contre_indications_medicament_id_idx").on(table.medicament_id)],
);

export const precautions = pgTable(
  "precautions",
  {
    id: serial("id").primaryKey(),
    medicament_id: integer("medicament_id")
      .notNull()
      .references(() => medicaments.id),
    description: text("description").notNull(),
  },
  (table) => [index("precautions_medicament_id_idx").on(table.medicament_id)],
);

export const interactions = pgTable(
  "interactions",
  {
    id: serial("id").primaryKey(),
    medicament_id: integer("medicament_id")
      .notNull()
      .references(() => medicaments.id),
    medicament_interaction: text("medicament_interaction").notNull(),
  },
  (table) => [index("interactions_medicament_id_idx").on(table.medicament_id)],
);

export const effets_indesirables = pgTable(
  "effets_indesirables",
  {
    id: serial("id").primaryKey(),
    medicament_id: integer("medicament_id")
      .notNull()
      .references(() => medicaments.id),
    frequence: text("frequence"),
    effet: text("effet").notNull(),
  },
  (table) => [index("effets_indesirables_medicament_id_idx").on(table.medicament_id)],
);

export const presentations = pgTable(
  "presentations",
  {
    id: serial("id").primaryKey(),
    medicament_id: integer("medicament_id")
      .notNull()
      .references(() => medicaments.id),
    forme: text("forme"),
    dosage: text("dosage"),
  },
  (table) => [index("presentations_medicament_id_idx").on(table.medicament_id)],
);
