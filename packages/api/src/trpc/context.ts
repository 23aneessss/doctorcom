import { randomUUID } from "node:crypto";

import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

import { auth } from "@doctor.com/auth";
import { db } from "@doctor.com/db";
import { fromNodeHeaders } from "better-auth/node";

export type SessionUtilisateur = Awaited<ReturnType<typeof auth.api.getSession>>;

export interface TRPCContext {
  db: typeof db;
  request_id: string;
  session: SessionUtilisateur;
}

export async function createTRPCContext(
  options: CreateExpressContextOptions,
): Promise<TRPCContext> {
  const requestIdHeader = options.req.header("x-request-id");
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(options.req.headers),
  });

  return {
    db,
    request_id: requestIdHeader ?? randomUUID(),
    session,
  };
}
