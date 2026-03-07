import type { db as databaseClient } from "@doctor.com/db";
import { utilisateurs } from "@doctor.com/db/schema";

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
    const result = await database.$client.query<UtilisateurProfile>(
      `
        SELECT
          id,
          nom,
          prenom,
          email,
          adresse,
          telephone,
          mot_de_passe_hash,
          date_creation,
          role
        FROM utilisateurs
        WHERE email = $1
        LIMIT 1
      `,
      [email],
    );

    const utilisateur = result.rows[0];

    return utilisateur ?? null;
  }

  async updateUtilisateurProfileByEmail(
    database: DatabaseClient,
    email: string,
    input: UpdateMyProfileInput,
  ): Promise<UtilisateurProfile | null> {
    const assignments: string[] = [];
    const values: string[] = [];
    let index = 1;

    if (input.nom !== undefined) {
      assignments.push(`nom = $${index++}`);
      values.push(input.nom);
    }

    if (input.prenom !== undefined) {
      assignments.push(`prenom = $${index++}`);
      values.push(input.prenom);
    }

    if (input.telephone !== undefined) {
      assignments.push(`telephone = $${index++}`);
      values.push(input.telephone);
    }

    if (input.adresse !== undefined) {
      assignments.push(`adresse = $${index++}`);
      values.push(input.adresse);
    }

    if (assignments.length === 0) {
      return this.findUtilisateurByEmail(database, email);
    }

    values.push(email);
    const emailIndex = index;

    const result = await database.$client.query<UtilisateurProfile>(
      `
        UPDATE utilisateurs
        SET ${assignments.join(", ")}
        WHERE email = $${emailIndex}
        RETURNING
          id,
          nom,
          prenom,
          email,
          adresse,
          telephone,
          mot_de_passe_hash,
          date_creation,
          role
      `,
      values,
    );

    const updatedUtilisateur = result.rows[0];

    return updatedUtilisateur ?? null;
  }
}

export const authRepository = new AuthRepository();
