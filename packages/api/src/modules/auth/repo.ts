import type { db as databaseClient } from "@doctor.com/db";
import { utilisateurs } from "@doctor.com/db/schema";
import { eq } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;

export interface UpdateMyProfileInput {
  nom?: string;
  prenom?: string;
  telephone?: string;
  adresse?: string;
}

export type UtilisateurProfile = typeof utilisateurs.$inferSelect;

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
}

export const authRepository = new AuthRepository();
