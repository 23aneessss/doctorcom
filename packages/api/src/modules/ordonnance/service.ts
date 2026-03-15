import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";

import {
  ordonnanceRepository,
  type AddOrdonnanceMedicamentInput,
  type AddPreRempliMedicamentInput,
  type CategoriePreRempliRecord,
  type CreateCategorieInput,
  type CreateOrdonnanceInput,
  type CreatePreRempliInput,
  type MedicamentRecord,
  type OrdonnanceMedicamentRecord,
  type OrdonnanceRecord,
  type PreRempliMedicamentRecord,
  type PreRempliOrdonnanceRecord,
  type UpdateCategorieInput,
  type UpdateOrdonnanceInput,
  type UpdateOrdonnanceMedicamentInput,
  type UpdatePreRempliInput,
  type UpdatePreRempliMedicamentInput,
} from "./repo";

type DatabaseClient = typeof databaseClient;

export interface CreateOrdonnanceServiceInput {
  patient_id: string;
  rendez_vous_id: string;
  date_prescription: string;
  remarques?: string | null;
  pre_rempli_origine_id?: string | null;
  medicaments: Array<{
    medicament_id: string;
    posologie: string;
    duree_traitement?: string | null;
    instructions?: string | null;
  }>;
}

export interface CreateFromPreRempliModification {
  medicament_nom: string;
  ignorer?: boolean;
  posologie?: string;
  duree_traitement?: string | null;
  instructions?: string | null;
}

export interface UpdateOrdonnanceServiceInput {
  rendez_vous_id?: string;
  patient_id?: string;
  date_prescription?: string;
  remarques?: string | null;
  pre_rempli_origine_id?: string | null;
}

export interface AddOrdonnanceMedicamentServiceInput {
  medicament_id: string;
  posologie: string;
  duree_traitement?: string | null;
  instructions?: string | null;
}

export interface UpdateOrdonnanceMedicamentServiceInput {
  medicament_id?: string;
  posologie?: string;
  duree_traitement?: string | null;
  instructions?: string | null;
}

export interface CreateCategorieServiceInput {
  nom: string;
  description?: string | null;
}

export interface CreatePreRempliServiceInput {
  nom: string;
  description?: string | null;
  specialite?: string | null;
  categorie_pre_rempli_id: string;
  est_actif?: boolean;
}

export interface UpdatePreRempliServiceInput {
  nom?: string;
  description?: string | null;
  specialite?: string | null;
  categorie_pre_rempli_id?: string;
  est_actif?: boolean;
}

export interface AddPreRempliMedicamentServiceInput {
  medicament_nom: string;
  posologie_defaut?: string | null;
  duree_defaut?: string | null;
  instructions_defaut?: string | null;
  ordre_affichage?: number | null;
  est_optionnel?: boolean;
}

export interface UpdatePreRempliMedicamentServiceInput {
  medicament_nom?: string;
  posologie_defaut?: string | null;
  duree_defaut?: string | null;
  instructions_defaut?: string | null;
  ordre_affichage?: number | null;
  est_optionnel?: boolean;
}

export class OrdonnanceService {
  async creerOrdonnance(data: {
    db: DatabaseClient;
    userId: string;
    input: CreateOrdonnanceServiceInput;
  }): Promise<OrdonnanceRecord & { medicaments: OrdonnanceMedicamentRecord[] }> {
    await this.assertPatientExists(data.db, data.input.patient_id);
    await this.assertRendezVousTermine(data.db, data.input.rendez_vous_id);

    const ordonnancePayload: CreateOrdonnanceInput = {
      patient_id: data.input.patient_id,
      rendez_vous_id: data.input.rendez_vous_id,
      utilisateur_id: data.userId,
      pre_rempli_origine_id: data.input.pre_rempli_origine_id ?? null,
      remarques: data.input.remarques ?? null,
      date_prescription: data.input.date_prescription,
    };

    const created = await ordonnanceRepository.createOrdonnance(data.db, ordonnancePayload);

    const medicaments = await Promise.all(
      data.input.medicaments.map((item) =>
        ordonnanceRepository.addMedicamentToOrdonnance(data.db, {
          ordonnance_id: created.id,
          medicament_id: item.medicament_id,
          posologie: item.posologie.trim(),
          duree_traitement: item.duree_traitement ?? null,
          instructions: item.instructions ?? null,
        }),
      ),
    );

    return {
      ...created,
      medicaments,
    };
  }

  async creerOrdonnanceDepuisPreRempli(data: {
    db: DatabaseClient;
    preRempliId: string;
    patientId: string;
    rendezVousId: string;
    userId: string;
    modifications?: CreateFromPreRempliModification[];
  }): Promise<OrdonnanceRecord & { medicaments: OrdonnanceMedicamentRecord[] }> {
    const preRempli = await ordonnanceRepository.getPreRempliById(data.db, data.preRempliId);
    if (!preRempli || !preRempli.est_actif) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Pre-rempli introuvable ou inactif.",
      });
    }

    await this.assertPatientExists(data.db, data.patientId);
    await this.assertRendezVousTermine(data.db, data.rendezVousId);

    const medicamentsTemplate = await ordonnanceRepository.getMedicamentsByPreRempli(
      data.db,
      data.preRempliId,
    );

    const created = await ordonnanceRepository.createOrdonnance(data.db, {
      patient_id: data.patientId,
      rendez_vous_id: data.rendezVousId,
      utilisateur_id: data.userId,
      pre_rempli_origine_id: preRempli.id,
      remarques: null,
      date_prescription: this.todayIsoDate(),
    });

    const modificationByName = new Map(
      (data.modifications ?? []).map((modification) => [
        modification.medicament_nom.trim().toLowerCase(),
        modification,
      ]),
    );

    const createdMedicaments: OrdonnanceMedicamentRecord[] = [];

    for (const templateItem of medicamentsTemplate) {
      const key = templateItem.medicament_nom.trim().toLowerCase();
      const modification = modificationByName.get(key);
      if (modification?.ignorer) {
        continue;
      }

      const medicament = await this.resolveMedicamentByNom(data.db, templateItem.medicament_nom);

      const createdMedicament = await ordonnanceRepository.addMedicamentToOrdonnance(data.db, {
        ordonnance_id: created.id,
        medicament_id: medicament.id,
        posologie: (modification?.posologie ?? templateItem.posologie_defaut ?? "").trim(),
        duree_traitement: modification?.duree_traitement ?? templateItem.duree_defaut ?? null,
        instructions: modification?.instructions ?? templateItem.instructions_defaut ?? null,
      });

      createdMedicaments.push(createdMedicament);
    }

    return {
      ...created,
      medicaments: createdMedicaments,
    };
  }

  async modifierOrdonnance(data: {
    db: DatabaseClient;
    id: string;
    input: UpdateOrdonnanceServiceInput;
  }): Promise<OrdonnanceRecord> {
    const existing = await ordonnanceRepository.getOrdonnanceById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ordonnance introuvable.",
      });
    }

    if (data.input.patient_id !== undefined) {
      await this.assertPatientExists(data.db, data.input.patient_id);
    }
    if (data.input.rendez_vous_id !== undefined) {
      await this.assertRendezVousTermine(data.db, data.input.rendez_vous_id);
    }

    const payload: UpdateOrdonnanceInput = {
      rendez_vous_id: data.input.rendez_vous_id,
      patient_id: data.input.patient_id,
      date_prescription: data.input.date_prescription,
      remarques: data.input.remarques,
      pre_rempli_origine_id: data.input.pre_rempli_origine_id,
    };

    const updated = await ordonnanceRepository.updateOrdonnance(data.db, data.id, payload);
    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de mise a jour de l'ordonnance.",
      });
    }

    return updated;
  }

  async supprimerOrdonnance(data: { db: DatabaseClient; id: string }): Promise<{ success: true }> {
    const existing = await ordonnanceRepository.getOrdonnanceById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ordonnance introuvable.",
      });
    }

    const deleted = await ordonnanceRepository.deleteOrdonnance(data.db, data.id);
    if (!deleted) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de suppression de l'ordonnance.",
      });
    }

    return { success: true };
  }

  async getOrdonnanceById(data: {
    db: DatabaseClient;
    id: string;
  }): Promise<OrdonnanceRecord & { medicaments: OrdonnanceMedicamentRecord[] }> {
    const item = await ordonnanceRepository.getOrdonnanceById(data.db, data.id);
    if (!item) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ordonnance introuvable.",
      });
    }

    const medicaments = await ordonnanceRepository.getMedicamentsByOrdonnance(data.db, item.id);

    return {
      ...item,
      medicaments,
    };
  }

  async getOrdonnancesByPatient(data: {
    db: DatabaseClient;
    patientId: string;
  }): Promise<Array<OrdonnanceRecord & { medicaments: OrdonnanceMedicamentRecord[] }>> {
    const ordonnances = await ordonnanceRepository.getOrdonnancesByPatient(data.db, data.patientId);

    return Promise.all(
      ordonnances.map(async (item) => ({
        ...item,
        medicaments: await ordonnanceRepository.getMedicamentsByOrdonnance(data.db, item.id),
      })),
    );
  }

  async getOrdonnancesByRendezVous(data: {
    db: DatabaseClient;
    rendezVousId: string;
  }): Promise<Array<OrdonnanceRecord & { medicaments: OrdonnanceMedicamentRecord[] }>> {
    const ordonnances = await ordonnanceRepository.getOrdonnancesByRendezVous(
      data.db,
      data.rendezVousId,
    );

    return Promise.all(
      ordonnances.map(async (item) => ({
        ...item,
        medicaments: await ordonnanceRepository.getMedicamentsByOrdonnance(data.db, item.id),
      })),
    );
  }

  async ajouterMedicament(data: {
    db: DatabaseClient;
    ordonnanceId: string;
    input: AddOrdonnanceMedicamentServiceInput;
  }): Promise<OrdonnanceMedicamentRecord> {
    const existing = await ordonnanceRepository.getOrdonnanceById(data.db, data.ordonnanceId);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ordonnance introuvable.",
      });
    }

    const payload: AddOrdonnanceMedicamentInput = {
      ordonnance_id: data.ordonnanceId,
      medicament_id: data.input.medicament_id,
      posologie: data.input.posologie.trim(),
      duree_traitement: data.input.duree_traitement ?? null,
      instructions: data.input.instructions ?? null,
    };

    return ordonnanceRepository.addMedicamentToOrdonnance(data.db, payload);
  }

  async modifierMedicament(data: {
    db: DatabaseClient;
    ordonnanceMedicamentId: string;
    input: UpdateOrdonnanceMedicamentServiceInput;
  }): Promise<OrdonnanceMedicamentRecord> {
    const existing = await ordonnanceRepository.getOrdonnanceMedicamentById(
      data.db,
      data.ordonnanceMedicamentId,
    );
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Medicament d'ordonnance introuvable.",
      });
    }

    const payload: UpdateOrdonnanceMedicamentInput = {
      medicament_id: data.input.medicament_id,
      posologie: data.input.posologie?.trim(),
      duree_traitement: data.input.duree_traitement,
      instructions: data.input.instructions,
    };

    const updated = await ordonnanceRepository.updateOrdonnanceMedicament(
      data.db,
      data.ordonnanceMedicamentId,
      payload,
    );
    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de mise a jour du medicament.",
      });
    }

    return updated;
  }

  async retirerMedicament(data: {
    db: DatabaseClient;
    ordonnanceMedicamentId: string;
  }): Promise<{ success: true }> {
    const existing = await ordonnanceRepository.getOrdonnanceMedicamentById(
      data.db,
      data.ordonnanceMedicamentId,
    );
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Medicament d'ordonnance introuvable.",
      });
    }

    const removed = await ordonnanceRepository.removeMedicamentFromOrdonnance(
      data.db,
      data.ordonnanceMedicamentId,
    );
    if (!removed) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de suppression du medicament.",
      });
    }

    return { success: true };
  }

  async rechercherMedicaments(data: { db: DatabaseClient; query: string }): Promise<MedicamentRecord[]> {
    return ordonnanceRepository.searchMedicaments(data.db, data.query.trim());
  }

  async renouvelerOrdonnance(data: {
    db: DatabaseClient;
    id: string;
    newRendezVousId: string;
    userId: string;
  }): Promise<OrdonnanceRecord & { medicaments: OrdonnanceMedicamentRecord[] }> {
    const source = await ordonnanceRepository.getOrdonnanceById(data.db, data.id);
    if (!source) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ordonnance source introuvable.",
      });
    }

    await this.assertRendezVousTermine(data.db, data.newRendezVousId);

    const sourceMedicaments = await ordonnanceRepository.getMedicamentsByOrdonnance(
      data.db,
      source.id,
    );

    const created = await ordonnanceRepository.createOrdonnance(data.db, {
      patient_id: source.patient_id,
      rendez_vous_id: data.newRendezVousId,
      utilisateur_id: data.userId,
      pre_rempli_origine_id: source.pre_rempli_origine_id,
      remarques: source.remarques,
      date_prescription: this.todayIsoDate(),
    });

    const copiedMedicaments = await Promise.all(
      sourceMedicaments.map((item) =>
        ordonnanceRepository.addMedicamentToOrdonnance(data.db, {
          ordonnance_id: created.id,
          medicament_id: item.medicament_id,
          posologie: item.posologie,
          duree_traitement: item.duree_traitement,
          instructions: item.instructions,
        }),
      ),
    );

    return {
      ...created,
      medicaments: copiedMedicaments,
    };
  }

  async creerCategorie(data: {
    db: DatabaseClient;
    input: CreateCategorieServiceInput;
  }): Promise<CategoriePreRempliRecord> {
    const payload: CreateCategorieInput = {
      nom: data.input.nom.trim(),
      description: data.input.description ?? null,
    };

    return ordonnanceRepository.createCategorie(data.db, payload);
  }

  async mettreAJourCategorie(data: {
    db: DatabaseClient;
    id: string;
    input: CreateCategorieServiceInput;
  }): Promise<CategoriePreRempliRecord> {
    const existing = await ordonnanceRepository.getCategorieById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Categorie introuvable.",
      });
    }

    const payload: UpdateCategorieInput = {
      nom: data.input.nom.trim(),
      description: data.input.description ?? null,
    };

    const updated = await ordonnanceRepository.updateCategorie(data.db, data.id, payload);
    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de mise a jour de la categorie.",
      });
    }

    return updated;
  }

  async supprimerCategorie(data: { db: DatabaseClient; id: string }): Promise<{ success: true }> {
    const existing = await ordonnanceRepository.getCategorieById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Categorie introuvable.",
      });
    }

    const deleted = await ordonnanceRepository.deleteCategorie(data.db, data.id);
    if (!deleted) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de suppression de la categorie.",
      });
    }

    return { success: true };
  }

  async getToutesCategories(data: { db: DatabaseClient }): Promise<CategoriePreRempliRecord[]> {
    return ordonnanceRepository.getAllCategories(data.db);
  }

  async creerPreRempli(data: {
    db: DatabaseClient;
    input: CreatePreRempliServiceInput;
    userId: string;
  }): Promise<PreRempliOrdonnanceRecord> {
    const payload: CreatePreRempliInput = {
      nom: data.input.nom.trim(),
      description: data.input.description ?? null,
      specialite: data.input.specialite ?? null,
      categorie_pre_rempli_id: data.input.categorie_pre_rempli_id,
      est_actif: data.input.est_actif ?? true,
      created_by_user: data.userId,
    };

    return ordonnanceRepository.createPreRempli(data.db, payload);
  }

  async mettreAJourPreRempli(data: {
    db: DatabaseClient;
    id: string;
    input: UpdatePreRempliServiceInput;
  }): Promise<PreRempliOrdonnanceRecord> {
    const existing = await ordonnanceRepository.getPreRempliById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Pre-rempli introuvable.",
      });
    }

    const payload: UpdatePreRempliInput = {
      nom: data.input.nom?.trim(),
      description: data.input.description,
      specialite: data.input.specialite,
      categorie_pre_rempli_id: data.input.categorie_pre_rempli_id,
      est_actif: data.input.est_actif,
    };

    const updated = await ordonnanceRepository.updatePreRempli(data.db, data.id, payload);
    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de mise a jour du pre-rempli.",
      });
    }

    return updated;
  }

  async desactiverPreRempli(data: {
    db: DatabaseClient;
    id: string;
  }): Promise<PreRempliOrdonnanceRecord> {
    const existing = await ordonnanceRepository.getPreRempliById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Pre-rempli introuvable.",
      });
    }

    const updated = await ordonnanceRepository.updatePreRempli(data.db, data.id, {
      est_actif: false,
    });
    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de desactivation du pre-rempli.",
      });
    }

    return updated;
  }

  async dupliquerPreRempli(data: {
    db: DatabaseClient;
    id: string;
    nouveauNom: string;
  }): Promise<PreRempliOrdonnanceRecord & { medicaments: PreRempliMedicamentRecord[] }> {
    const source = await ordonnanceRepository.getPreRempliById(data.db, data.id);
    if (!source) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Pre-rempli introuvable.",
      });
    }

    const duplicated = await ordonnanceRepository.dupliquerPreRempli(
      data.db,
      data.id,
      data.nouveauNom.trim(),
    );

    const sourceMedicaments = await ordonnanceRepository.getMedicamentsByPreRempli(
      data.db,
      source.id,
    );

    const copiedMedicaments = await Promise.all(
      sourceMedicaments.map((item) =>
        ordonnanceRepository.addMedicamentToPreRempli(data.db, {
          pre_rempli_id: duplicated.id,
          medicament_nom: item.medicament_nom,
          posologie_defaut: item.posologie_defaut,
          duree_defaut: item.duree_defaut,
          instructions_defaut: item.instructions_defaut,
          ordre_affichage: item.ordre_affichage,
          est_optionnel: item.est_optionnel,
        }),
      ),
    );

    return {
      ...duplicated,
      medicaments: copiedMedicaments,
    };
  }

  async getPreRempliById(data: {
    db: DatabaseClient;
    id: string;
  }): Promise<PreRempliOrdonnanceRecord & { medicaments: PreRempliMedicamentRecord[] }> {
    const item = await ordonnanceRepository.getPreRempliById(data.db, data.id);
    if (!item) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Pre-rempli introuvable.",
      });
    }

    const medicaments = await ordonnanceRepository.getMedicamentsByPreRempli(data.db, item.id);

    return {
      ...item,
      medicaments,
    };
  }

  async getPreRemplisByCategorie(data: {
    db: DatabaseClient;
    categorieId: string;
  }): Promise<PreRempliOrdonnanceRecord[]> {
    return ordonnanceRepository.getPreRemplisByCategorie(data.db, data.categorieId);
  }

  async getPreRemplisBySpecialite(data: {
    db: DatabaseClient;
    specialite: string;
  }): Promise<PreRempliOrdonnanceRecord[]> {
    return ordonnanceRepository.getPreRemplisBySpecialite(data.db, data.specialite.trim());
  }

  async ajouterMedicamentAuPreRempli(data: {
    db: DatabaseClient;
    preRempliId: string;
    input: AddPreRempliMedicamentServiceInput;
  }): Promise<PreRempliMedicamentRecord> {
    const existing = await ordonnanceRepository.getPreRempliById(data.db, data.preRempliId);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Pre-rempli introuvable.",
      });
    }

    const payload: AddPreRempliMedicamentInput = {
      pre_rempli_id: data.preRempliId,
      medicament_nom: data.input.medicament_nom.trim(),
      posologie_defaut: data.input.posologie_defaut ?? null,
      duree_defaut: data.input.duree_defaut ?? null,
      instructions_defaut: data.input.instructions_defaut ?? null,
      ordre_affichage: data.input.ordre_affichage ?? null,
      est_optionnel: data.input.est_optionnel ?? false,
    };

    return ordonnanceRepository.addMedicamentToPreRempli(data.db, payload);
  }

  async mettreAJourMedicamentDuPreRempli(data: {
    db: DatabaseClient;
    id: string;
    input: UpdatePreRempliMedicamentServiceInput;
  }): Promise<PreRempliMedicamentRecord> {
    const existing = await ordonnanceRepository.getPreRempliMedicamentById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Medicament de pre-rempli introuvable.",
      });
    }

    const payload: UpdatePreRempliMedicamentInput = {
      medicament_nom: data.input.medicament_nom?.trim(),
      posologie_defaut: data.input.posologie_defaut,
      duree_defaut: data.input.duree_defaut,
      instructions_defaut: data.input.instructions_defaut,
      ordre_affichage: data.input.ordre_affichage,
      est_optionnel: data.input.est_optionnel,
    };

    const updated = await ordonnanceRepository.updatePreRempliMedicament(data.db, data.id, payload);
    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de mise a jour du medicament de pre-rempli.",
      });
    }

    return updated;
  }

  async retirerMedicamentDuPreRempli(data: {
    db: DatabaseClient;
    id: string;
  }): Promise<{ success: true }> {
    const existing = await ordonnanceRepository.getPreRempliMedicamentById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Medicament de pre-rempli introuvable.",
      });
    }

    const removed = await ordonnanceRepository.removeMedicamentFromPreRempli(data.db, data.id);
    if (!removed) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de suppression du medicament de pre-rempli.",
      });
    }

    return { success: true };
  }

  async genererPDF(): Promise<never> {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "La generation PDF n'est pas encore implemente dans ce module.",
    });
  }

  private async assertPatientExists(database: DatabaseClient, patientId: string): Promise<void> {
    const patient = await ordonnanceRepository.getPatientById(database, patientId);
    if (!patient) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Patient introuvable.",
      });
    }
  }

  private async assertRendezVousTermine(
    database: DatabaseClient,
    rendezVousId: string,
  ): Promise<void> {
    const rendezVous = await ordonnanceRepository.getRendezVousById(database, rendezVousId);
    if (!rendezVous) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Rendez-vous introuvable.",
      });
    }

    if (rendezVous.statut !== "termine") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Une ordonnance ne peut etre creee que pour un rendez-vous termine.",
      });
    }
  }

  private async resolveMedicamentByNom(
    database: DatabaseClient,
    nom: string,
  ): Promise<MedicamentRecord> {
    const exact = await ordonnanceRepository.getMedicamentByNom(database, nom.trim());
    if (exact) {
      return exact;
    }

    const matches = await ordonnanceRepository.searchMedicaments(database, nom.trim());
    const match = matches[0];
    if (!match) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Medicament introuvable dans la table de reference: ${nom}.`,
      });
    }

    return match;
  }

  private todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }
}

export const ordonnanceService = new OrdonnanceService();
