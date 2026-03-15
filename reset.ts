/**
 * Database reset script for doctor.com
 *
 * Truncates ALL tables (domain + Better-Auth) leaving the schema intact.
 *
 * Usage: bun reset.ts
 */

import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Load env
// ---------------------------------------------------------------------------
dotenv.config({ path: "./apps/server/.env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required. Check apps/server/.env");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const db = drizzle({ client: pool });

async function reset() {
  console.log("Resetting database...\n");

  // TRUNCATE all tables in one statement with CASCADE to handle FK constraints
  await db.execute(sql`
    TRUNCATE TABLE
      certificats_medicaux,
      lettres_orientation,
      documents_patient,
      categories_documents,
      vaccinations_patient,
      ordonnance_medicaments,
      ordonnance,
      historique_traitements,
      examen_consultation,
      rendez_vous,
      suivi,
      antecedents_personnels,
      antecedents_familiaux,
      antecedents,
      voyages_recents,
      patients_femmes,
      patients,
      medicaments,
      logs,
      sessions,
      utilisateurs,
      verification,
      account,
      session,
      "user"
    CASCADE
  `);

  console.log("All tables truncated successfully.");
}

reset()
  .then(() => {
    console.log("\nDatabase reset complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
