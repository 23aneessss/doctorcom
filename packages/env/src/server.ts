import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    MEDICATIONS_DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    MISTRAL_API_KEY: z.string().min(1).optional(),
    MINIO_ENDPOINT: z.string().min(1),
    MINIO_PORT: z.coerce.number().int().positive(),
    MINIO_USE_SSL: z.string().transform((v) => v === "true"),
    MINIO_ROOT_USER: z.string().min(1),
    MINIO_ROOT_PASSWORD: z.string().min(1),
    MINIO_BUCKET: z.string().min(1),
    OPENROUTER_API_KEY: z.string().min(1).optional(),
    OPENROUTER_MODEL: z.string().min(1).default("openrouter/free"),
    MISTRAL_API_KEY: z.string().min(1).optional(),
    MISTRAL_MODEL: z.string().min(1).default("mistral-small-latest"),
    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
