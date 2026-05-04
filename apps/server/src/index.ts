import "dotenv/config";

import { existsSync } from "node:fs";
import path from "node:path";

import { auth } from "@doctor.com/auth";
import { env } from "@doctor.com/env/server";
import express from "express";
import { createContext } from "@doctor.com/api/context";
import { appRouter } from "@doctor.com/api/routers/index";
import { ensureBucketExists, isStorageUnavailableError } from "@doctor.com/api/infrastructure/storage";
import { startScheduler } from "@doctor.com/api/infrastructure/scheduler";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import multer from "multer";
import { setStorageAvailable } from "./infrastructure/storage-state";
import { uploadRouter } from "./routes/upload";

const STORAGE_INIT_MAX_ATTEMPTS = 5;
const STORAGE_INIT_BASE_DELAY_MS = 800;
const STORAGE_RECOVERY_INTERVAL_MS = 15_000;

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
    methods: ["GET", "POST", "OPTIONS"],
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
