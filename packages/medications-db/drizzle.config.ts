import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({
  path: "../../apps/server/.env",
});

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.MEDICATIONS_DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/doctor_com_medicaments",
  },
  strict: true,
  verbose: true,
});
