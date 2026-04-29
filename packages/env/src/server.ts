import { existsSync } from "node:fs";

import dotenv from "dotenv";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

for (const envPath of ["./apps/server/.env", "../../apps/server/.env", "./.env"]) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, quiet: true });
    break;
  }
}

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    MEDICATIONS_DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    MINIO_ENDPOINT: z.string().min(1),
    MINIO_PORT: z.coerce.number().int().positive(),
    MINIO_USE_SSL: z.string().transform((v) => v === "true"),
    MINIO_ROOT_USER: z.string().min(1),
    MINIO_ROOT_PASSWORD: z.string().min(1),
    MINIO_BUCKET: z.string().min(1),
    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().positive(),
    SMTP_USER: z.string().min(1),
    SMTP_PASS: z.string().min(1),
    SMTP_FROM: z.string().email(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
