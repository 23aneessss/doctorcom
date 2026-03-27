/**
 * Medications database seed script for doctor.com
 *
 * Populates the medications reference database (doctor_com_medicaments)
 * with pharmaceutical data from the dataset/ folder (JSON files).
 *
 * Total: ~278,000 records across 8 tables.
 *
 * Usage: bun seed-medications.ts
 */

import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

import {
  medicaments,
  substances_actives,
  indications,
  contre_indications,
  precautions,
  interactions,
  effets_indesirables,
  presentations,
} from "./packages/medications-db/src/schema";

// ---------------------------------------------------------------------------
// Load env
// ---------------------------------------------------------------------------
dotenv.config({ path: "./apps/server/.env" });

const connectionString = process.env.MEDICATIONS_DATABASE_URL;
if (!connectionString) {
  console.error(
    "MEDICATIONS_DATABASE_URL is required. Check apps/server/.env",
  );
  process.exit(1);
}

const pool = new Pool({ connectionString });
const db = drizzle({ client: pool });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BATCH_SIZE = 500;

async function loadJSON<T>(filename: string): Promise<T[]> {
  const file = Bun.file(`./dataset/${filename}`);
  const data: T[] = JSON.parse(await file.text());
  return data;
}

async function batchInsert(
  table: any,
  data: any[],
  tableName: string,
): Promise<void> {
  const total = data.length;
  let inserted = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const chunk = data.slice(i, i + BATCH_SIZE);
    await db.insert(table).values(chunk);
    inserted += chunk.length;

    // Log progress every 10 batches or on the last batch
    if (
      Math.floor(i / BATCH_SIZE) % 10 === 0 ||
      inserted === total
    ) {
      const pct = ((inserted / total) * 100).toFixed(0);
      console.log(`  [${tableName}] ${inserted}/${total} (${pct}%)`);
    }
  }
}

async function resetSequence(tableName: string): Promise<void> {
  await db.execute(
    sql.raw(
      `SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), (SELECT COALESCE(MAX(id), 0) FROM ${tableName}), true)`,
    ),
  );
}

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------
async function seed() {
  const startTime = Date.now();
  console.log("Seeding medications database...\n");

  // =========================================================================
  // 1. Clear existing data (TRUNCATE CASCADE)
  // =========================================================================
  console.log("Truncating all medications tables...");
  await db.execute(
    sql.raw(`
    TRUNCATE TABLE
      substances_actives,
      indications,
      contre_indications,
      precautions,
      interactions,
      effets_indesirables,
      presentations,
      medicaments
    CASCADE
  `),
  );
  console.log("Done truncating.\n");

  // =========================================================================
  // 2. Load all JSON files
  // =========================================================================
  console.log("Loading JSON files from dataset/...");

  const [
    medicamentsData,
    substancesData,
    indicationsData,
    contreIndicationsData,
    precautionsData,
    interactionsData,
    effetsData,
    presentationsData,
  ] = await Promise.all([
    loadJSON<any>("medicaments.json"),
    loadJSON<any>("substances_actives.json"),
    loadJSON<any>("indications.json"),
    loadJSON<any>("contre_indications.json"),
    loadJSON<any>("precautions.json"),
    loadJSON<any>("interactions.json"),
    loadJSON<any>("effets_indesirables.json"),
    loadJSON<any>("presentations.json"),
  ]);

  console.log(
    `Loaded: ${medicamentsData.length} medicaments, ` +
      `${substancesData.length} substances, ` +
      `${indicationsData.length} indications, ` +
      `${contreIndicationsData.length} contre-indications, ` +
      `${precautionsData.length} precautions, ` +
      `${interactionsData.length} interactions, ` +
      `${effetsData.length} effets indesirables, ` +
      `${presentationsData.length} presentations`,
  );
  console.log();

  // =========================================================================
  // 3. Insert medicaments (parent table first)
  // =========================================================================
  console.log("Inserting medicaments...");
  let tableStart = Date.now();
  await batchInsert(medicaments, medicamentsData, "medicaments");
  await resetSequence("medicaments");
  console.log(`  Done in ${((Date.now() - tableStart) / 1000).toFixed(1)}s\n`);

  // =========================================================================
  // 4. Insert child tables
  // =========================================================================
  const childTables = [
    { table: substances_actives, data: substancesData, name: "substances_actives" },
    { table: indications, data: indicationsData, name: "indications" },
    { table: contre_indications, data: contreIndicationsData, name: "contre_indications" },
    { table: precautions, data: precautionsData, name: "precautions" },
    { table: interactions, data: interactionsData, name: "interactions" },
    { table: effets_indesirables, data: effetsData, name: "effets_indesirables" },
    { table: presentations, data: presentationsData, name: "presentations" },
  ];

  for (const { table, data, name } of childTables) {
    console.log(`Inserting ${name}...`);
    tableStart = Date.now();
    await batchInsert(table, data, name);
    await resetSequence(name);
    console.log(`  Done in ${((Date.now() - tableStart) / 1000).toFixed(1)}s\n`);
  }

  // =========================================================================
  // 5. Summary
  // =========================================================================
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalRecords =
    medicamentsData.length +
    substancesData.length +
    indicationsData.length +
    contreIndicationsData.length +
    precautionsData.length +
    interactionsData.length +
    effetsData.length +
    presentationsData.length;

  console.log("Seed completed successfully!");
  console.log(`Total time: ${totalTime}s`);
  console.log(`Total records inserted: ${totalRecords.toLocaleString()}`);
  console.log("Summary:");
  console.log(`  - ${medicamentsData.length.toLocaleString()} medicaments`);
  console.log(`  - ${substancesData.length.toLocaleString()} substances actives`);
  console.log(`  - ${indicationsData.length.toLocaleString()} indications`);
  console.log(`  - ${contreIndicationsData.length.toLocaleString()} contre-indications`);
  console.log(`  - ${precautionsData.length.toLocaleString()} precautions`);
  console.log(`  - ${interactionsData.length.toLocaleString()} interactions`);
  console.log(`  - ${effetsData.length.toLocaleString()} effets indesirables`);
  console.log(`  - ${presentationsData.length.toLocaleString()} presentations`);
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
