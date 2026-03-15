import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";

import type { SessionUtilisateur } from "../../trpc/context";
import { authRepository, type UtilisateurProfile } from "./repo";

type DatabaseClient = typeof databaseClient;
type AuthSession = Exclude<SessionUtilisateur, null>;

export interface UpdateMyProfileInput {
  nom?: string;
  prenom?: string;
  telephone?: string;
  adresse?: string;
}

export class AuthService {
  async getMyProfile(data: {
    db: DatabaseClient;
    session: AuthSession;
  }): Promise<{
    session: AuthSession;
    profile: UtilisateurProfile;
  }> {
    const email = this.resolveSessionEmail(data.session);
    const profile = await authRepository.findUtilisateurByEmail(data.db, email);

    if (!profile) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Profil utilisateur introuvable.",
      });
    }

    return {
      session: data.session,
      profile,
    };
  }

  async updateMyProfile(data: {
    db: DatabaseClient;
    session: AuthSession;
    input: UpdateMyProfileInput;
  }): Promise<{
    session: AuthSession;
    profile: UtilisateurProfile;
  }> {
    const email = this.resolveSessionEmail(data.session);

    const normalizedInput = this.normalizeUpdateInput(data.input);
    if (Object.keys(normalizedInput).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Aucun champ valide a mettre a jour.",
      });
    }

    const existingProfile = await authRepository.findUtilisateurByEmail(data.db, email);
    if (!existingProfile) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Profil utilisateur introuvable.",
      });
    }

    const profile = await authRepository.updateUtilisateurProfileByEmail(
      data.db,
      email,
      normalizedInput,
    );

    if (!profile) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de la mise a jour du profil utilisateur.",
      });
    }

    return {
      session: data.session,
      profile,
    };
  }

  private resolveSessionEmail(session: AuthSession): string {
    const email = session.user.email.trim().toLowerCase();
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Session invalide: email utilisateur manquant.",
      });
    }
    return email;
  }

  private normalizeUpdateInput(input: UpdateMyProfileInput): UpdateMyProfileInput {
    const normalized: UpdateMyProfileInput = {};

    const nom = input.nom?.trim();
    if (nom) {
      normalized.nom = nom;
    }

    const prenom = input.prenom?.trim();
    if (prenom) {
      normalized.prenom = prenom;
    }

    const telephone = input.telephone?.trim();
    if (telephone) {
      normalized.telephone = telephone;
    }

    const adresse = input.adresse?.trim();
    if (adresse) {
      normalized.adresse = adresse;
    }

    return normalized;
  }
}

export const authService = new AuthService();
