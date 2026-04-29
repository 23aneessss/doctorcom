import {
  customType,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 3072})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
});

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

export const medicament_embeddings = pgTable(
  "medicament_embeddings",
  {
    medicament_id: integer("medicament_id")
      .notNull()
      .references(() => medicaments.id, { onDelete: "cascade" })
      .primaryKey(),
    embedding: vector("embedding", { dimensions: 3072 }).notNull(),
    embedding_model: varchar("embedding_model", { length: 120 }).notNull(),
    embedding_content_hash: varchar("embedding_content_hash", { length: 128 }).notNull(),
    embedding_payload_preview: text("embedding_payload_preview"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("medicament_embeddings_updated_at_idx").on(table.updated_at),
    uniqueIndex("medicament_embeddings_content_hash_idx").on(
      table.medicament_id,
      table.embedding_content_hash,
    ),
  ],
);
