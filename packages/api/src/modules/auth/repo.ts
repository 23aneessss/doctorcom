import type { db as databaseClient } from "@doctor.com/db";
import { utilisateurs } from "@doctor.com/db/schema";
import { account } from "@doctor.com/db/schema/auth";
import { and, eq } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;

export interface UpdateMyProfileInput {
  nom?: string;
  prenom?: string;
  titre?: string;
  specialite?: string | null;
  avatar_url?: string | null;
  telephone?: string;
  adresse?: string;
}

export type UtilisateurProfile = typeof utilisateurs.$inferSelect;
export type AuthAccountRecord = typeof account.$inferSelect;

export class AuthRepository {
  async findUtilisateurByEmail(
    database: DatabaseClient,
    email: string,
  ): Promise<UtilisateurProfile | null> {
    const [utilisateur] = await database
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.email, email))
      .limit(1);

    return utilisateur ?? null;
  }

  async updateUtilisateurProfileByEmail(
    database: DatabaseClient,
    email: string,
    input: UpdateMyProfileInput,
  ): Promise<UtilisateurProfile | null> {
    const updateData: UpdateMyProfileInput = {};

    if (input.nom !== undefined) {
      updateData.nom = input.nom;
    }

    if (input.prenom !== undefined) {
      updateData.prenom = input.prenom;
    }

    if (input.telephone !== undefined) {
      updateData.telephone = input.telephone;
    }

    if (input.titre !== undefined) {
      updateData.titre = input.titre;
    }

    if (input.specialite !== undefined) {
      updateData.specialite = input.specialite;
    }

    if (input.avatar_url !== undefined) {
      updateData.avatar_url = input.avatar_url;
    }

    if (input.adresse !== undefined) {
      updateData.adresse = input.adresse;
    }

    if (Object.keys(updateData).length === 0) {
      return this.findUtilisateurByEmail(database, email);
    }

    const [updatedUtilisateur] = await database
      .update(utilisateurs)
      .set(updateData)
      .where(eq(utilisateurs.email, email))
      .returning();

    return updatedUtilisateur ?? null;
  }

  async findCredentialAccountByUserId(
    database: DatabaseClient,
    userId: string,
  ): Promise<AuthAccountRecord | null> {
    const [credentialAccount] = await database
      .select()
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
      .limit(1);

    return credentialAccount ?? null;
  }

  async updateCredentialPasswordByAccountId(
    database: DatabaseClient,
    accountId: string,
    passwordHash: string,
  ): Promise<AuthAccountRecord | null> {
    const [updatedAccount] = await database
      .update(account)
      .set({ password: passwordHash })
      .where(eq(account.id, accountId))
      .returning();

    return updatedAccount ?? null;
  }
}

export const authRepository = new AuthRepository();
