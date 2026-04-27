import "dotenv/config";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to initialize the PostgreSQL connection.");
}

export const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

pool.on("error", (error) => {
  console.error("[db.pool] idle client error", error);
});

export const db = drizzle({
  client: pool,
  schema,
});

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function withTx<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => callback(tx));
}
