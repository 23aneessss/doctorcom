import "dotenv/config";

import { auth } from "@doctor.com/auth";
import { env } from "@doctor.com/env/server";
import express from "express";
import { createContext } from "@doctor.com/api/context";
import { appRouter } from "@doctor.com/api/routers/index";
import { ensureBucketExists } from "@doctor.com/api/infrastructure/storage";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import multer from "multer";
import { uploadRouter } from "./routes/upload";

const app: express.Express = express();
const port = Number(process.env.PORT ?? 3000);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(
  cors({
    origin: env.CORS_ORIGIN,
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
  }),
);



app.get("/", (_req, res) => {
  res.status(200).send("server running");
});

app.listen(port, () => {
  console.log(`server running on http://localhost:${port}`);
});

ensureBucketExists();

export { app };
