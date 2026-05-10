import "dotenv/config";

import { existsSync } from "node:fs";
import path from "node:path";

import { auth } from "@doctor.com/auth";
import { db, pool } from "@doctor.com/db";
import { env } from "@doctor.com/env/server";
import express from "express";
import { createContext } from "@doctor.com/api/context";
import { verifyEmailTransport } from "@doctor.com/api/infrastructure/email/index";
import { aiSettingsService } from "@doctor.com/api/modules/ai/settings/service";
import { appRouter } from "@doctor.com/api/routers/index";
import {
  checkStorageAccess,
  ensureBucketExists,
  isStorageUnavailableError,
} from "@doctor.com/api/infrastructure/storage";
import { startScheduler } from "@doctor.com/api/infrastructure/scheduler";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import multer from "multer";
import { isStorageAvailable, setStorageAvailable } from "./infrastructure/storage-state";
import { uploadRouter } from "./routes/upload";

const STORAGE_INIT_MAX_ATTEMPTS = 5;
const STORAGE_INIT_BASE_DELAY_MS = 800;
const STORAGE_RECOVERY_INTERVAL_MS = 15_000;

const ORD_TEMPLATE_COMPAT_SQL = `
CREATE TABLE IF NOT EXISTS "ordonnance_pdf_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "utilisateur_id" uuid NOT NULL,
  "nom" varchar(255) NOT NULL,
  "description" text,
  "chemin_fichier" text NOT NULL,
  "type_fichier" varchar(64) NOT NULL,
  "taille_fichier" integer NOT NULL,
  "page_width" integer DEFAULT 595 NOT NULL,
  "page_height" integer DEFAULT 842 NOT NULL,
  "layout_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "est_actif" boolean DEFAULT true NOT NULL,
  "is_default_for_user" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN IF NOT EXISTS "logo_chemin_fichier" text;
ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN IF NOT EXISTS "logo_type_fichier" varchar(64);
ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN IF NOT EXISTS "logo_taille_fichier" integer;
ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN IF NOT EXISTS "page_width" integer DEFAULT 595 NOT NULL;
ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN IF NOT EXISTS "page_height" integer DEFAULT 842 NOT NULL;
ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN IF NOT EXISTS "layout_config" jsonb DEFAULT '{}'::jsonb NOT NULL;
DO $$ BEGIN
 ALTER TABLE "ordonnance_pdf_templates" ADD CONSTRAINT "ord_pdf_templates_utilisateur_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "ord_pdf_templates_utilisateur_id_idx" ON "ordonnance_pdf_templates" USING btree ("utilisateur_id");
CREATE INDEX IF NOT EXISTS "ord_pdf_templates_default_idx" ON "ordonnance_pdf_templates" USING btree ("utilisateur_id","is_default_for_user");
CREATE TABLE IF NOT EXISTS "app_settings" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "ai_provider" varchar(16) DEFAULT 'gemini' NOT NULL,
  "gemini_api_key" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
`;

const PATIENT_COMPAT_SQL = `
ALTER TABLE "patients" ALTER COLUMN "nss" TYPE varchar(32) USING "nss"::text;
`;

const REQUIRED_ORD_TEMPLATE_COLUMNS = [
  "id",
  "utilisateur_id",
  "nom",
  "description",
  "chemin_fichier",
  "type_fichier",
  "taille_fichier",
  "page_width",
  "page_height",
  "layout_config",
  "est_actif",
  "is_default_for_user",
  "logo_chemin_fichier",
  "logo_type_fichier",
  "logo_taille_fichier",
  "created_at",
  "updated_at",
] as const;

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function ensureStorageWithRetry(): Promise<boolean> {
  for (let attempt = 1; attempt <= STORAGE_INIT_MAX_ATTEMPTS; attempt += 1) {
    try {
      await ensureBucketExists();
      setStorageAvailable(true);
      return true;
    } catch (error) {
      const isLastAttempt = attempt === STORAGE_INIT_MAX_ATTEMPTS;

      if (isLastAttempt) {
        setStorageAvailable(false);
        console.warn(
          "MinIO is unavailable at startup. Server will continue, but storage-dependent features may fail until MinIO is back.",
          error,
        );
        return false;
      }

      const shouldRetry = isStorageUnavailableError(error);
      if (!shouldRetry) {
        setStorageAvailable(false);
        console.warn(
          "Storage bucket initialization failed with a non-network error. Server will continue in degraded mode.",
          error,
        );
        return false;
      }

      const jitterMs = Math.floor(Math.random() * 200);
      const delayMs = STORAGE_INIT_BASE_DELAY_MS * attempt + jitterMs;
      console.warn(
        `MinIO startup check failed (attempt ${attempt}/${STORAGE_INIT_MAX_ATTEMPTS}). Retrying in ${delayMs}ms...`,
      );
      await sleep(delayMs);
    }
  }

  return false;
}

function startStorageRecoveryLoop(): void {
  const interval = setInterval(async () => {
    try {
      await ensureBucketExists();
      setStorageAvailable(true);
      console.log("✅ MinIO recovered. Storage-dependent features are available again.");
      clearInterval(interval);
    } catch (error) {
      setStorageAvailable(false);
      if (!isStorageUnavailableError(error)) {
        console.warn("Storage recovery check failed with a non-network error:", error);
      }
    }
  }, STORAGE_RECOVERY_INTERVAL_MS);
}

async function ensureOrdonnanceTemplateSchema(): Promise<void> {
  await pool.query(ORD_TEMPLATE_COMPAT_SQL);
  await pool.query(PATIENT_COMPAT_SQL);
}

async function getBackendHealthDetails(options?: { deepStorage?: boolean }): Promise<{
  database: "ok" | "error";
  ordonnanceTemplates: "ok" | "error";
  patientNss: "ok" | "error";
  storage: "ok" | "degraded";
  storageAccess: "ok" | "error";
  email: "ok" | "error";
  ai: "ok" | "degraded" | "error";
  missingOrdonnanceTemplateColumns: string[];
  errors: Record<string, string>;
}> {
  const details = {
    database: "error" as "ok" | "error",
    ordonnanceTemplates: "error" as "ok" | "error",
    patientNss: "error" as "ok" | "error",
    storage: isStorageAvailable() ? ("ok" as const) : ("degraded" as const),
    storageAccess: "error" as "ok" | "error",
    email: "error" as "ok" | "error",
    ai: "error" as "ok" | "degraded" | "error",
    missingOrdonnanceTemplateColumns: [] as string[],
    errors: {} as Record<string, string>,
  };

  await pool.query("select 1");
  details.database = "ok";

  const columnsResult = await pool.query<{ column_name: string }>(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'ordonnance_pdf_templates'
    `,
  );
  const existingColumns = new Set(columnsResult.rows.map((row) => row.column_name));
  details.missingOrdonnanceTemplateColumns = REQUIRED_ORD_TEMPLATE_COLUMNS.filter(
    (column) => !existingColumns.has(column),
  );
  details.ordonnanceTemplates =
    details.missingOrdonnanceTemplateColumns.length === 0 ? "ok" : "error";

  const patientNssResult = await pool.query<{
    data_type: string;
    character_maximum_length: number | null;
  }>(
    `
      select data_type, character_maximum_length
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'patients'
        and column_name = 'nss'
      limit 1
    `,
  );
  const patientNssColumn = patientNssResult.rows[0];
  details.patientNss =
    patientNssColumn?.data_type === "character varying" ? "ok" : "error";

  try {
    await checkStorageAccess({ deep: options?.deepStorage });
    details.storageAccess = "ok";
  } catch (error) {
    details.errors.storageAccess =
      error instanceof Error ? error.message : "Storage access check failed.";
  }

  try {
    await verifyEmailTransport();
    details.email = "ok";
  } catch (error) {
    details.errors.email =
      error instanceof Error ? error.message : "SMTP verification failed.";
  }

  details.ai = getAiHealthStatus(details.errors);

  return details;
}

function getAiHealthStatus(errors: Record<string, string>): "ok" | "degraded" | "error" {
  if (env.AI_PROVIDER === "gemini") {
    if (env.GEMINI_API_KEY) {
      return "ok";
    }

    errors.ai = "GEMINI_API_KEY is missing while AI_PROVIDER=gemini.";
    return "error";
  }

  if (env.AI_PROVIDER === "ollama") {
    if (env.OLLAMA_BASE_URL && env.OLLAMA_MODEL) {
      return "degraded";
    }

    errors.ai = "OLLAMA_BASE_URL or OLLAMA_MODEL is missing while AI_PROVIDER=ollama.";
    return "error";
  }

  errors.ai = `Unsupported AI_PROVIDER: ${env.AI_PROVIDER}.`;
  return "error";
}

const app: express.Express = express();
const port = Number(process.env.PORT ?? 3000);
const corsOrigin = env.CORS_ORIGIN.replace(/\/+$/, "");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(
  cors({
    origin: corsOrigin,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.all("/api/auth{/*path}", toNodeHandler(auth));
app.use("/api/upload", uploadRouter);
app.use("/trpc", upload.single("file"));

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, path, type, ctx }) {
      console.error("tRPC request failed", {
        path,
        type,
        request_id: ctx?.request_id,
        code: error.code,
        message: error.message,
        cause: error.cause,
      });
    },
  }),
);
app.get("/healthz", (_req, res) => {
  res.status(200).send("server running");
});

app.get("/healthz/backend", async (req, res) => {
  try {
    const details = await getBackendHealthDetails({
      deepStorage: req.query.deep === "1",
    });
    const healthy =
      details.database === "ok" &&
      details.ordonnanceTemplates === "ok" &&
      details.patientNss === "ok" &&
      details.storage === "ok" &&
      details.storageAccess === "ok" &&
      details.email === "ok" &&
      details.ai !== "error";

    res.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      ...details,
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      database: "error",
      ordonnanceTemplates: "unknown",
      patientNss: "unknown",
      storage: isStorageAvailable() ? "ok" : "degraded",
      storageAccess: "unknown",
      email: "unknown",
      ai: "unknown",
      error: error instanceof Error ? error.message : "Backend health check failed.",
    });
  }
});

const webDistDir = process.env.WEB_DIST_DIR;
const webIndexFile = webDistDir ? path.join(webDistDir, "index.html") : null;

if (webDistDir && webIndexFile && existsSync(webIndexFile)) {
  app.use(express.static(webDistDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/") || req.path.startsWith("/trpc")) {
      next();
      return;
    }

    res.sendFile(webIndexFile);
  });
}

async function startServer(): Promise<void> {
  try {
    await ensureOrdonnanceTemplateSchema();
    console.log("✅ Ordonnance template database schema is ready.");
  } catch (error) {
    console.error(
      "Ordonnance template database schema could not be prepared. PDF template import may fail.",
      error,
    );
  }

  try {
    await aiSettingsService.initializeRuntimeSettings(db);
  } catch (error) {
    console.warn(
      "AI settings could not be initialized. Falling back to environment configuration.",
      error,
    );
  }

  setStorageAvailable(true);
  const storageReady = await ensureStorageWithRetry();
  if (!storageReady) {
    startStorageRecoveryLoop();
  }

  startScheduler();

  app.listen(port, () => {
    console.log(`server running on http://localhost:${port}`);
  });
}

void startServer();

export { app };
