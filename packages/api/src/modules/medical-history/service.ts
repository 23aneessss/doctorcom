import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";
import { antecedent_type_values } from "@doctor.com/db/schema";

import type { SessionUtilisateur } from "../../trpc/context";
import {
  medicalHistoryRepository,
  type AntecedentRecord,
  type CreateAntecedentInput,
  type CreateFamilyAntecedentInput,
  type CreatePersonalAntecedentInput,
  type FamilyAntecedentRecord,
  type PersonalAntecedentRecord,
  type QueryClient,
  type UpdateAntecedentInput,
  type UpdateFamilyAntecedentInput,
  type UpdatePersonalAntecedentInput,
} from "./repo";

type DatabaseClient = typeof databaseClient;
type MedicalHistorySession = Exclude<SessionUtilisateur, null>;
type AntecedentType = (typeof antecedent_type_values)[number];

export interface RisqueGenetique {
  antecedent: string;
  niveau: "faible" | "modere" | "eleve";
  nombre_cas: number;
  proches_affectes: string[];
}

export interface AjouterAntecedentServiceInput {
  patient_id: string;
  type: AntecedentType;
  description: string;
  personnel?: {
    type: string;
    details?: string | null;
    est_actif?: boolean;
  };
  familial?: {
    details?: string | null;
    lien_parente?: string | null;
  };
}

export interface MettreAJourAntecedentServiceInput {
  type?: AntecedentType;
  description?: string;
  personnel?: {
    type?: string;
    details?: string | null;
    est_actif?: boolean;
  };
  familial?: {
    details?: string | null;
    lien_parente?: string | null;
  };
}

export class MedicalHistoryService {
  async ajouterAntecedent(data: {
    db: DatabaseClient;
    session: MedicalHistorySession;
    input: AjouterAntecedentServiceInput;
  }): Promise<AntecedentRecord> {
    this.ensureSession(data.session);

    const createInput = this.normalizeCreateAntecedentInput(data.input);

    return data.db.transaction(async (tx) => {
      const antecedent = await medicalHistoryRepository.createAntecedent(tx, createInput.base);
      await this.createTypedAntecedent(tx, antecedent.id, createInput);
      return antecedent;
    });
  }

  async mettreAJourAntecedent(data: {
    db: DatabaseClient;
    session: MedicalHistorySession;
    antecedent_id: string;
    input: MettreAJourAntecedentServiceInput;
  }): Promise<AntecedentRecord> {
    this.ensureSession(data.session);

    const existingAntecedent = await medicalHistoryRepository.getAntecedentById(
      data.db,
      data.antecedent_id,
    );
    if (!existingAntecedent) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Antecedent introuvable.",
      });
    }

    const normalizedInput = this.normalizeUpdateAntecedentInput(data.input);
    if (Object.keys(normalizedInput.base).length === 0 && !normalizedInput.personnel && !normalizedInput.familial) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Aucun champ valide fourni pour mettre a jour l'antecedent.",
      });
    }

    const nextType = normalizedInput.base.type ?? existingAntecedent.type;

    return data.db.transaction(async (tx) => {
      const updatedAntecedent = await medicalHistoryRepository.updateAntecedent(
        tx,
        data.antecedent_id,
        normalizedInput.base,
      );

      if (!updatedAntecedent) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Echec de la mise a jour de l'antecedent.",
        });
      }

      await this.syncTypedAntecedent(
        tx,
        data.antecedent_id,
        existingAntecedent.type,
        nextType,
        normalizedInput.personnel,
        normalizedInput.familial,
      );

      return updatedAntecedent;
    });
  }

  async supprimerAntecedent(data: {
    db: DatabaseClient;
    session: MedicalHistorySession;
    antecedent_id: string;
  }): Promise<{ success: boolean }> {
    this.ensureSession(data.session);

    const existingAntecedent = await medicalHistoryRepository.getAntecedentById(
      data.db,
      data.antecedent_id,
    );
    if (!existingAntecedent) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Antecedent introuvable.",
      });
    }

    return data.db.transaction(async (tx) => {
      await medicalHistoryRepository.deletePersonalAntecedentsByAntecedent(
        tx,
        data.antecedent_id,
      );
      await medicalHistoryRepository.deleteFamilyAntecedentsByAntecedent(
        tx,
        data.antecedent_id,
      );

      const isDeleted = await medicalHistoryRepository.deleteAntecedent(
        tx,
        data.antecedent_id,
      );

      if (!isDeleted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Echec de suppression de l'antecedent.",
        });
      }

      return { success: true };
    });
  }

  async getAntecedentsPatient(data: {
    db: DatabaseClient;
    session: MedicalHistorySession;
    patient_id: string;
  }): Promise<AntecedentRecord[]> {
    this.ensureSession(data.session);
    return medicalHistoryRepository.getAntecedentsByPatient(data.db, data.patient_id);
  }

  async getAntecedentsPersonnels(data: {
    db: DatabaseClient;
    session: MedicalHistorySession;
    antecedent_id: string;
  }): Promise<PersonalAntecedentRecord[]> {
    this.ensureSession(data.session);
    await this.requireAntecedent(data.db, data.antecedent_id);
    return medicalHistoryRepository.getPersonalAntecedentsByAntecedent(
      data.db,
      data.antecedent_id,
    );
  }

  async getAntecedentsFamiliaux(data: {
    db: DatabaseClient;
    session: MedicalHistorySession;
    antecedent_id: string;
  }): Promise<FamilyAntecedentRecord[]> {
    this.ensureSession(data.session);
    await this.requireAntecedent(data.db, data.antecedent_id);
    return medicalHistoryRepository.getFamilyAntecedentsByAntecedent(
      data.db,
      data.antecedent_id,
    );
  }

  async verifierRisquesGenetiques(data: {
    db: DatabaseClient;
    session: MedicalHistorySession;
    patient_id: string;
  }): Promise<RisqueGenetique[]> {
    this.ensureSession(data.session);

    const antecedentsPatient = await medicalHistoryRepository.getAntecedentsByPatient(
      data.db,
      data.patient_id,
    );

    const antecedentsFamiliauxPatient = antecedentsPatient.filter(
      (antecedent) => antecedent.type === "familial",
    );

    const risques = new Map<
      string,
      { count: number; proches: Set<string> }
    >();

    for (const antecedent of antecedentsFamiliauxPatient) {
      const familiaux = await medicalHistoryRepository.getFamilyAntecedentsByAntecedent(
        data.db,
        antecedent.id,
      );

      for (const familial of familiaux) {
        const cle = familial.details?.trim().toLowerCase();
        if (!cle) {
          continue;
        }

        const current = risques.get(cle) ?? { count: 0, proches: new Set<string>() };
        current.count += 1;

        const proche = familial.lien_parente?.trim();
        if (proche) {
          current.proches.add(proche);
        }

        risques.set(cle, current);
      }
    }

    return Array.from(risques.entries()).map(([antecedent, value]) => ({
      antecedent,
      niveau: this.computeRisqueLevel(value.count, Array.from(value.proches)),
      nombre_cas: value.count,
      proches_affectes: Array.from(value.proches),
    }));
  }

  async marquerAntecedentPersonnelInactif(data: {
    db: DatabaseClient;
    session: MedicalHistorySession;
    antecedent_personnel_id: string;
  }): Promise<{ success: boolean }> {
    this.ensureSession(data.session);

    const updatedPersonalAntecedent =
      await medicalHistoryRepository.markPersonalAntecedentInactive(
        data.db,
        data.antecedent_personnel_id,
      );

    if (!updatedPersonalAntecedent) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Antecedent personnel introuvable.",
      });
    }

    return { success: true };
  }

  async mettreAJourDetailsAntecedentPersonnel(data: {
    db: DatabaseClient;
    session: MedicalHistorySession;
    antecedent_personnel_id: string;
    details: string | null;
  }): Promise<PersonalAntecedentRecord> {
    this.ensureSession(data.session);

    const updatedPersonalAntecedent = await medicalHistoryRepository.updatePersonalAntecedent(
      data.db,
      data.antecedent_personnel_id,
      {
        details: this.normalizeOptionalText(data.details),
      },
    );

    if (!updatedPersonalAntecedent) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Antecedent personnel introuvable.",
      });
    }

    return updatedPersonalAntecedent;
  }

  async mettreAJourLienParente(data: {
    db: DatabaseClient;
    session: MedicalHistorySession;
    antecedent_familial_id: string;
    lien_parente: string | null;
  }): Promise<FamilyAntecedentRecord> {
    this.ensureSession(data.session);

    const updatedFamilyAntecedent = await medicalHistoryRepository.updateFamilyAntecedent(
      data.db,
      data.antecedent_familial_id,
      {
        lien_parente: this.normalizeOptionalText(data.lien_parente),
      },
    );

    if (!updatedFamilyAntecedent) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Antecedent familial introuvable.",
      });
    }

    return updatedFamilyAntecedent;
  }

  private ensureSession(session: MedicalHistorySession): void {
    const email = session.user.email.trim();
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Session invalide.",
      });
    }
  }

  private async requireAntecedent(
    database: DatabaseClient,
    antecedentId: string,
  ): Promise<AntecedentRecord> {
    const antecedent = await medicalHistoryRepository.getAntecedentById(
      database,
      antecedentId,
    );

    if (!antecedent) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Antecedent introuvable.",
      });
    }

    return antecedent;
  }

  private normalizeCreateAntecedentInput(
    input: AjouterAntecedentServiceInput,
  ): {
    base: CreateAntecedentInput;
    personnel?: CreatePersonalAntecedentInput;
    familial?: CreateFamilyAntecedentInput;
  } {
    const description = input.description.trim();
    if (!description) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "La description de l'antecedent est obligatoire.",
      });
    }

    if (input.type === "personnel") {
      if (!input.personnel) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Les donnees d'antecedent personnel sont obligatoires.",
        });
      }

      return {
        base: {
          patient_id: input.patient_id,
          type: input.type,
          description,
        },
        personnel: {
          antecedent_id: "",
          type: this.normalizeRequiredText(
            input.personnel.type,
            "Le type de l'antecedent personnel est obligatoire.",
          ),
          details: this.normalizeOptionalText(input.personnel.details),
          est_actif: input.personnel.est_actif ?? true,
        },
      };
    }

    if (!input.familial) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Les donnees d'antecedent familial sont obligatoires.",
      });
    }

    return {
      base: {
        patient_id: input.patient_id,
        type: input.type,
        description,
      },
      familial: {
        antecedent_id: "",
        details: this.normalizeOptionalText(input.familial.details),
        lien_parente: this.normalizeOptionalText(input.familial.lien_parente),
      },
    };
  }

  private normalizeUpdateAntecedentInput(
    input: MettreAJourAntecedentServiceInput,
  ): {
    base: UpdateAntecedentInput;
    personnel?: UpdatePersonalAntecedentInput;
    familial?: UpdateFamilyAntecedentInput;
  } {
    const base: UpdateAntecedentInput = {};

    if (input.type !== undefined) {
      base.type = input.type;
    }

    if (input.description !== undefined) {
      base.description = this.normalizeRequiredText(
        input.description,
        "La description de l'antecedent ne peut pas etre vide.",
      );
    }

    let personnel: UpdatePersonalAntecedentInput | undefined;
    if (input.personnel) {
      personnel = {};

      if (input.personnel.type !== undefined) {
        personnel.type = this.normalizeRequiredText(
          input.personnel.type,
          "Le type de l'antecedent personnel ne peut pas etre vide.",
        );
      }

      if (input.personnel.details !== undefined) {
        personnel.details = this.normalizeOptionalText(input.personnel.details);
      }

      if (input.personnel.est_actif !== undefined) {
        personnel.est_actif = input.personnel.est_actif;
      }
    }

    let familial: UpdateFamilyAntecedentInput | undefined;
    if (input.familial) {
      familial = {};

      if (input.familial.details !== undefined) {
        familial.details = this.normalizeOptionalText(input.familial.details);
      }

      if (input.familial.lien_parente !== undefined) {
        familial.lien_parente = this.normalizeOptionalText(input.familial.lien_parente);
      }
    }

    return { base, personnel, familial };
  }

  private async createTypedAntecedent(
    database: QueryClient,
    antecedentId: string,
    input: {
      personnel?: CreatePersonalAntecedentInput;
      familial?: CreateFamilyAntecedentInput;
    },
  ): Promise<void> {
    if (input.personnel) {
      await medicalHistoryRepository.createPersonalAntecedent(database, {
        ...input.personnel,
        antecedent_id: antecedentId,
      });
    }

    if (input.familial) {
      await medicalHistoryRepository.createFamilyAntecedent(database, {
        ...input.familial,
        antecedent_id: antecedentId,
      });
    }
  }

  private async syncTypedAntecedent(
    database: QueryClient,
    antecedentId: string,
    currentType: AntecedentType,
    nextType: AntecedentType,
    personnel?: UpdatePersonalAntecedentInput,
    familial?: UpdateFamilyAntecedentInput,
  ): Promise<void> {
    if (currentType !== nextType) {
      await medicalHistoryRepository.deletePersonalAntecedentsByAntecedent(
        database,
        antecedentId,
      );
      await medicalHistoryRepository.deleteFamilyAntecedentsByAntecedent(database, antecedentId);

      if (nextType === "personnel") {
        if (!personnel?.type) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Le changement vers un antecedent personnel requiert un type personnel.",
          });
        }

        await medicalHistoryRepository.createPersonalAntecedent(database, {
          antecedent_id: antecedentId,
          type: personnel.type,
          details: personnel.details ?? null,
          est_actif: personnel.est_actif ?? true,
        });
        return;
      }

      if (!familial) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Le changement vers un antecedent familial requiert des donnees familiales.",
        });
      }

      await medicalHistoryRepository.createFamilyAntecedent(database, {
        antecedent_id: antecedentId,
        details: familial.details ?? null,
        lien_parente: familial.lien_parente ?? null,
      });
      return;
    }

    if (nextType === "personnel" && personnel) {
      const existingPersonalAntecedents =
        await medicalHistoryRepository.getPersonalAntecedentsByAntecedent(database, antecedentId);

      const firstPersonalAntecedent = existingPersonalAntecedents[0];
      if (!firstPersonalAntecedent) {
        if (!personnel.type) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Le type de l'antecedent personnel est obligatoire.",
          });
        }

        await medicalHistoryRepository.createPersonalAntecedent(database, {
          antecedent_id: antecedentId,
          type: personnel.type,
          details: personnel.details ?? null,
          est_actif: personnel.est_actif ?? true,
        });
        return;
      }

      await medicalHistoryRepository.updatePersonalAntecedent(
        database,
        firstPersonalAntecedent.id,
        personnel,
      );
    }

    if (nextType === "familial" && familial) {
      const existingFamilyAntecedents =
        await medicalHistoryRepository.getFamilyAntecedentsByAntecedent(database, antecedentId);

      const firstFamilyAntecedent = existingFamilyAntecedents[0];
      if (!firstFamilyAntecedent) {
        await medicalHistoryRepository.createFamilyAntecedent(database, {
          antecedent_id: antecedentId,
          details: familial.details ?? null,
          lien_parente: familial.lien_parente ?? null,
        });
        return;
      }

      await medicalHistoryRepository.updateFamilyAntecedent(
        database,
        firstFamilyAntecedent.id,
        familial,
      );
    }
  }

  private computeRisqueLevel(
    count: number,
    proches: string[],
  ): RisqueGenetique["niveau"] {
    const prochesDirects = new Set(["pere", "mere", "frere", "soeur"]);
    const directCount = proches.filter((proche) =>
      prochesDirects.has(proche.trim().toLowerCase()),
    ).length;

    if (count >= 2 || directCount >= 2) {
      return "eleve";
    }

    if (count >= 1 && directCount >= 1) {
      return "modere";
    }

    return "faible";
  }

  private normalizeRequiredText(value: string, message: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message,
      });
    }
    return trimmed;
  }

  private normalizeOptionalText(value: string | null | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
}

export const medicalHistoryService = new MedicalHistoryService();
