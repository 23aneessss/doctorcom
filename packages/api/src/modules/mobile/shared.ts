import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";
import { utilisateurs } from "@doctor.com/db/schema";
import { eq } from "drizzle-orm";

import type { SessionUtilisateur } from "../../trpc/context";

type DatabaseClient = typeof databaseClient;
type MobileSession = Exclude<SessionUtilisateur, null>;

export async function resolveMobileUtilisateur(
  db: DatabaseClient,
  session: MobileSession,
): Promise<{
  id: string;
  nom: string;
  prenom: string;
  email: string;
}> {
  const email = session.user.email?.trim().toLowerCase();

  if (!email) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "La session a expiré. Reconnectez-vous.",
    });
  }

  const [utilisateur] = await db
    .select({
      id: utilisateurs.id,
      nom: utilisateurs.nom,
      prenom: utilisateurs.prenom,
      email: utilisateurs.email,
    })
    .from(utilisateurs)
    .where(eq(utilisateurs.email, email))
    .limit(1);

  if (!utilisateur) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Le profil médecin est introuvable.",
    });
  }

  return utilisateur;
}
