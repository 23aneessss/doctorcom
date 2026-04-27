import "dotenv/config";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const connectionString = process.env.MEDICATIONS_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "MEDICATIONS_DATABASE_URL is required to initialize the medications PostgreSQL connection.",
  );
}

export const medicationsPool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

medicationsPool.on("error", (error) => {
  console.error("[medications-db.pool] idle client error", error);
});

export const medicationsDb = drizzle({
  client: medicationsPool,
  schema,
});

type Transaction = Parameters<Parameters<typeof medicationsDb.transaction>[0]>[0];

export async function withMedicationsTx<T>(
  callback: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return medicationsDb.transaction(async (tx) => callback(tx));
}

export * from "./schema";
