import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";
import { hashPassword, verifyPassword } from "better-auth/crypto";

import type { SessionUtilisateur } from "../../trpc/context";
import { authRepository, type UtilisateurProfile } from "./repo";

type DatabaseClient = typeof databaseClient;
type AuthSession = Exclude<SessionUtilisateur, null>;

export interface UpdateMyProfileInput {
  nom?: string;
  prenom?: string;
  titre?: string;
  specialite?: string | null;
  avatar_url?: string | null;
  telephone?: string;
  adresse?: string;
}

export class AuthService {
  async getMobileProfile(data: {
    db: DatabaseClient;
    session: AuthSession;
  }): Promise<{
    id: string;
    email: string;
    name: string;
    title: string;
    specialty: string | null;
    avatar_url: string | null;
    telephone: string | null;
    adresse: string | null;
    nom: string;
    prenom: string;
  }> {
    const email = this.resolveSessionEmail(data.session);
    const profile = await authRepository.findUtilisateurByEmail(data.db, email);

    if (!profile) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Profil utilisateur introuvable.",
      });
    }

    return this.toMobileProfile(profile);
  }

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

  async updateMobileProfile(data: {
    db: DatabaseClient;
    session: AuthSession;
    input: {
      name?: string;
      title?: string;
      specialty?: string | null;
      avatar_url?: string | null;
      telephone?: string;
      adresse?: string;
    };
  }) {
    const name = data.input.name?.trim();
    const splitName = name ? this.splitFullName(name) : null;

    const result = await this.updateMyProfile({
      db: data.db,
      session: data.session,
      input: {
        nom: splitName?.nom,
        prenom: splitName?.prenom,
        titre: data.input.title?.trim(),
        specialite: data.input.specialty?.trim() || null,
        avatar_url: data.input.avatar_url?.trim() || null,
        telephone: data.input.telephone?.trim(),
        adresse: data.input.adresse?.trim(),
      },
    });

    return this.toMobileProfile(result.profile);
  }

  async changePassword(data: {
    db: DatabaseClient;
    session: AuthSession;
    input: {
      currentPassword: string;
      newPassword: string;
    };
  }): Promise<{ success: true }> {
    const userId = data.session.user.id?.trim();
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "La session a expiré. Reconnectez-vous.",
      });
    }

    const currentPassword = data.input.currentPassword.trim();
    const newPassword = data.input.newPassword.trim();

    if (!currentPassword || !newPassword) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Les champs du mot de passe sont requis.",
      });
    }

    if (newPassword.length < 6) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Le nouveau mot de passe doit contenir au moins 6 caractères.",
      });
    }

    if (currentPassword === newPassword) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Le nouveau mot de passe doit être différent de l'ancien.",
      });
    }

    const credentialAccount = await authRepository.findCredentialAccountByUserId(
      data.db,
      userId,
    );

    if (!credentialAccount?.password) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Le changement de mot de passe n'est pas disponible pour ce compte.",
      });
    }

    const isCurrentPasswordValid = await verifyPassword({
      hash: credentialAccount.password,
      password: currentPassword,
    });

    if (!isCurrentPasswordValid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Le mot de passe actuel est incorrect.",
      });
    }

    const passwordHash = await hashPassword(newPassword);
    const updatedAccount = await authRepository.updateCredentialPasswordByAccountId(
      data.db,
      credentialAccount.id,
      passwordHash,
    );

    if (!updatedAccount) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Le mot de passe n'a pas pu être mis à jour.",
      });
    }

    return { success: true };
  }

  private resolveSessionEmail(session: AuthSession): string {
    const email = session.user.email.trim().toLowerCase();
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "La session a expiré. Reconnectez-vous.",
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

    const titre = input.titre?.trim();
    if (titre) {
      normalized.titre = titre;
    }

    if (input.specialite !== undefined) {
      normalized.specialite = input.specialite?.trim() || null;
    }

    if (input.avatar_url !== undefined) {
      normalized.avatar_url = input.avatar_url?.trim() || null;
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

  private toMobileProfile(profile: UtilisateurProfile) {
    return {
      id: profile.id,
      email: profile.email,
      name: `${profile.prenom} ${profile.nom}`.trim(),
      title: profile.titre ?? "Dr.",
      specialty: profile.specialite ?? null,
      avatar_url: profile.avatar_url ?? null,
      telephone: profile.telephone ?? null,
      adresse: profile.adresse ?? null,
      nom: profile.nom,
      prenom: profile.prenom,
    };
  }

  private splitFullName(name: string): { prenom: string; nom: string } {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
      return {
        prenom: parts[0] ?? name.trim(),
        nom: parts[0] ?? name.trim(),
      };
    }

    return {
      prenom: parts.slice(0, -1).join(" "),
      nom: parts[parts.length - 1] ?? parts[0] ?? name.trim(),
    };
  }
}

export const authService = new AuthService();
