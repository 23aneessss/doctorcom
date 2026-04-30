import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";
import { withTx } from "@doctor.com/db";
import { patients } from "@doctor.com/db/schema";
import { user as authUser } from "@doctor.com/db/schema/auth";
import { eq } from "drizzle-orm";
import {
  envoyerOrdonnanceParEmail as envoyerOrdonnanceParEmailInfrastructure,
  type ClinicInfo,
} from "@doctor.com/api/infrastructure/email/index";

import { exportService } from "../export/service";

import type { SessionUtilisateur } from "../../trpc/context";
import { medicamentsService } from "../medicaments/service";
import { treatmentRepository } from "../treatment/repo";
import {
  ordonnanceRepository,
  type AddOrdonnanceMedicamentInput,
  type AddPreRempliMedicamentInput,
  type CategoriePreRempliRecord,
  type CreateOrdonnancePdfTemplateInput,
  type CreateCategorieInput,
  type CreatePreRempliInput,
  type OrdonnancePdfTemplateRecord,
  type OrdonnanceMedicamentRecord,
  type OrdonnanceRecord,
  type PreRempliMedicamentRecord,
  type PreRempliOrdonnanceRecord,
  type UpdateCategorieInput,
  type UpdateOrdonnancePdfTemplateInput,
  type UpdateOrdonnanceInput,
  type UpdateOrdonnanceMedicamentInput,
  type UpdatePreRempliInput,
  type UpdatePreRempliMedicamentInput,
  type UtilisateurRecord,
} from "./repo";
import {
  DEFAULT_ORDONNANCE_PDF_LAYOUT,
  DEFAULT_PDF_TEMPLATE_PAGE,
  normalizeOrdonnancePdfLayout,
  type OrdonnancePdfTemplateLayoutConfig,
} from "./pdf-template-layout";

type DatabaseClient = typeof databaseClient;
type DatabaseTransaction = Parameters<Parameters<typeof withTx>[0]>[0];
type OrdonnanceSession = Exclude<SessionUtilisateur, null>;

export interface CreateOrdonnanceServiceInput {
  patient_id: string;
  rendez_vous_id: string;
  date_prescription: string;
  remarques?: string | null;
  pre_rempli_origine_id?: string | null;
  medicaments: Array<{
    medicament_externe_id: string;
    dosage?: string | null;
    posologie: string;
    duree_traitement?: string | null;
    instructions?: string | null;
  }>;
}

export interface CreateFromPreRempliModification {
  medicament_externe_id?: string;
  nom_medicament?: string;
  ignorer?: boolean;
  dosage?: string | null;
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
  medicament_externe_id: string;
  dosage?: string | null;
  posologie: string;
  duree_traitement?: string | null;
  instructions?: string | null;
}

export interface UpdateOrdonnanceMedicamentServiceInput {
  medicament_externe_id?: string;
  dosage?: string | null;
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
  medicament_externe_id: string;
  dosage?: string | null;
  posologie_defaut?: string | null;
  duree_defaut?: string | null;
  instructions_defaut?: string | null;
  ordre_affichage?: number | null;
  est_optionnel?: boolean;
}

export interface UpdatePreRempliMedicamentServiceInput {
  medicament_externe_id?: string;
  dosage?: string | null;
  posologie_defaut?: string | null;
  duree_defaut?: string | null;
  instructions_defaut?: string | null;
  ordre_affichage?: number | null;
  est_optionnel?: boolean;
}

export interface CreateOrdonnancePdfTemplateUploadInput {
  nom: string;
  description?: string | null;
  chemin_fichier: string;
  type_fichier: string;
  taille_fichier: number;
  page_width?: number | null;
  page_height?: number | null;
}

export interface UpdateOrdonnancePdfTemplateLayoutInput {
  nom?: string;
  description?: string | null;
  layout_config: OrdonnancePdfTemplateLayoutConfig;
}

export class OrdonnanceService {
  async creerOrdonnance(data: {
    db: DatabaseClient;
    session: OrdonnanceSession;
    input: CreateOrdonnanceServiceInput;
  }): Promise<OrdonnanceRecord & { medicaments: OrdonnanceMedicamentRecord[] }> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    await this.assertPatientExists(data.db, data.input.patient_id);
    await this.assertRendezVousTermine(data.db, data.input.rendez_vous_id);

    const medicamentPayloads = await Promise.all(
      data.input.medicaments.map((item) => this.buildOrdonnanceMedicamentPayload(item)),
    );

    return withTx(async (tx) => {
      const created = await ordonnanceRepository.createOrdonnance(tx, {
        patient_id: data.input.patient_id,
        rendez_vous_id: data.input.rendez_vous_id,
        utilisateur_id: utilisateur.id,
        pre_rempli_origine_id: data.input.pre_rempli_origine_id ?? null,
        remarques: data.input.remarques ?? null,
        date_prescription: data.input.date_prescription,
      });

      const medicaments = await Promise.all(
        medicamentPayloads.map(async (payload) => {
          const createdMedicament = await ordonnanceRepository.addMedicamentToOrdonnance(tx, {
            ordonnance_id: created.id,
            ...payload,
          });

          await this.syncDerivedTreatmentForOrdonnanceMedicament(tx, {
            patient_id: created.patient_id,
            utilisateur_id: utilisateur.id,
            date_prescription: created.date_prescription,
            ordonnance_id: created.id,
            ordonnance_medicament: createdMedicament,
          });

          return createdMedicament;
        }),
      );

      return {
        ...created,
        medicaments,
      };
    });
  }

  async creerOrdonnanceDepuisPreRempli(data: {
    db: DatabaseClient;
    session: OrdonnanceSession;
    preRempliId: string;
    patientId: string;
    rendezVousId: string;
    modifications?: CreateFromPreRempliModification[];
  }): Promise<OrdonnanceRecord & { medicaments: OrdonnanceMedicamentRecord[] }> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
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

    return withTx(async (tx) => {
      const created = await ordonnanceRepository.createOrdonnance(tx, {
        patient_id: data.patientId,
        rendez_vous_id: data.rendezVousId,
        utilisateur_id: utilisateur.id,
        pre_rempli_origine_id: preRempli.id,
        remarques: null,
        date_prescription: this.todayIsoDate(),
      });

      const createdMedicaments: OrdonnanceMedicamentRecord[] = [];

      for (const templateItem of medicamentsTemplate) {
        const modification = this.findPreRempliModification(
          data.modifications ?? [],
          templateItem,
        );

        if (modification?.ignorer) {
          continue;
        }

        const createdMedicament = await ordonnanceRepository.addMedicamentToOrdonnance(tx, {
          ordonnance_id: created.id,
          medicament_externe_id: templateItem.medicament_externe_id,
          nom_medicament: templateItem.nom_medicament,
          dci: null,
          dosage: modification?.dosage ?? templateItem.dosage ?? null,
          posologie:
            (modification?.posologie ?? templateItem.posologie_defaut ?? "").trim(),
          duree_traitement: modification?.duree_traitement ?? templateItem.duree_defaut ?? null,
          instructions:
            modification?.instructions ?? templateItem.instructions_defaut ?? null,
        });

        await this.syncDerivedTreatmentForOrdonnanceMedicament(tx, {
          patient_id: created.patient_id,
          utilisateur_id: utilisateur.id,
          date_prescription: created.date_prescription,
          ordonnance_id: created.id,
          ordonnance_medicament: createdMedicament,
        });

        createdMedicaments.push(createdMedicament);
      }

      return {
        ...created,
        medicaments: createdMedicaments,
      };
    });
  }

  async modifierOrdonnance(data: {
    db: DatabaseClient;
    session: OrdonnanceSession;
    id: string;
    input: UpdateOrdonnanceServiceInput;
  }): Promise<OrdonnanceRecord> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
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

    return withTx(async (tx) => {
      const updated = await ordonnanceRepository.updateOrdonnance(tx, data.id, payload);
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Echec de mise a jour de l'ordonnance.",
        });
      }

      await treatmentRepository.updateTreatmentsByOrdonnanceId(tx, updated.id, {
        patient_id: updated.patient_id,
        date_prescription: updated.date_prescription,
        prescrit_par_utilisateur: utilisateur.id,
      });

      return updated;
    });
  }

  async supprimerOrdonnance(data: {
    db: DatabaseClient;
    id: string;
  }): Promise<{ success: true }> {
    const existing = await ordonnanceRepository.getOrdonnanceById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ordonnance introuvable.",
      });
    }

    await withTx(async (tx) => {
      await treatmentRepository.detachTreatmentsByOrdonnanceId(tx, data.id);
      const deleted = await ordonnanceRepository.deleteOrdonnance(tx, data.id);
      if (!deleted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Echec de suppression de l'ordonnance.",
        });
      }
    });

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
    session: OrdonnanceSession;
    ordonnanceId: string;
    input: AddOrdonnanceMedicamentServiceInput;
  }): Promise<OrdonnanceMedicamentRecord> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const existing = await ordonnanceRepository.getOrdonnanceById(data.db, data.ordonnanceId);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ordonnance introuvable.",
      });
    }

    const payload = await this.buildOrdonnanceMedicamentPayload(data.input);

    return withTx(async (tx) => {
      const created = await ordonnanceRepository.addMedicamentToOrdonnance(tx, {
        ordonnance_id: data.ordonnanceId,
        ...payload,
      });

      await this.syncDerivedTreatmentForOrdonnanceMedicament(tx, {
        patient_id: existing.patient_id,
        utilisateur_id: utilisateur.id,
        date_prescription: existing.date_prescription,
        ordonnance_id: existing.id,
        ordonnance_medicament: created,
      });

      return created;
    });
  }

  async modifierMedicament(data: {
    db: DatabaseClient;
    session: OrdonnanceSession;
    ordonnanceMedicamentId: string;
    input: UpdateOrdonnanceMedicamentServiceInput;
  }): Promise<OrdonnanceMedicamentRecord> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
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

    const ordonnanceRecord = await ordonnanceRepository.getOrdonnanceById(
      data.db,
      existing.ordonnance_id,
    );
    if (!ordonnanceRecord) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ordonnance parente introuvable.",
      });
    }

    const payload = await this.buildOrdonnanceMedicamentUpdatePayload(existing, data.input);

    return withTx(async (tx) => {
      const updated = await ordonnanceRepository.updateOrdonnanceMedicament(
        tx,
        data.ordonnanceMedicamentId,
        payload,
      );
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Echec de mise a jour du medicament.",
        });
      }

      await this.syncDerivedTreatmentForOrdonnanceMedicament(tx, {
        patient_id: ordonnanceRecord.patient_id,
        utilisateur_id: utilisateur.id,
        date_prescription: ordonnanceRecord.date_prescription,
        ordonnance_id: ordonnanceRecord.id,
        ordonnance_medicament: updated,
      });

      return updated;
    });
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

    await withTx(async (tx) => {
      await treatmentRepository.detachTreatmentByOrdonnanceMedicamentId(
        tx,
        data.ordonnanceMedicamentId,
      );

      const removed = await ordonnanceRepository.removeMedicamentFromOrdonnance(
        tx,
        data.ordonnanceMedicamentId,
      );
      if (!removed) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Echec de suppression du medicament.",
        });
      }
    });

    return { success: true };
  }

  async rechercherMedicaments(data: { query: string }) {
    const result = await medicamentsService.rechercherMedicaments({
      query: data.query.trim(),
      page: 1,
      page_size: 25,
    });

    return result.items;
  }

  async renouvelerOrdonnance(data: {
    db: DatabaseClient;
    session: OrdonnanceSession;
    id: string;
    newRendezVousId: string;
  }): Promise<OrdonnanceRecord & { medicaments: OrdonnanceMedicamentRecord[] }> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
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

    return withTx(async (tx) => {
      const created = await ordonnanceRepository.createOrdonnance(tx, {
        patient_id: source.patient_id,
        rendez_vous_id: data.newRendezVousId,
        utilisateur_id: utilisateur.id,
        pre_rempli_origine_id: source.pre_rempli_origine_id,
        remarques: source.remarques,
        date_prescription: this.todayIsoDate(),
      });

      const copiedMedicaments = await Promise.all(
        sourceMedicaments.map(async (item) => {
          const createdMedicament = await ordonnanceRepository.addMedicamentToOrdonnance(tx, {
            ordonnance_id: created.id,
            medicament_externe_id: item.medicament_externe_id,
            nom_medicament: item.nom_medicament,
            dci: item.dci,
            dosage: item.dosage,
            posologie: item.posologie,
            duree_traitement: item.duree_traitement,
            instructions: item.instructions,
          });

          await this.syncDerivedTreatmentForOrdonnanceMedicament(tx, {
            patient_id: created.patient_id,
            utilisateur_id: utilisateur.id,
            date_prescription: created.date_prescription,
            ordonnance_id: created.id,
            ordonnance_medicament: createdMedicament,
          });

          return createdMedicament;
        }),
      );

      return {
        ...created,
        medicaments: copiedMedicaments,
      };
    });
  }

  async creerCategorie(data: {
    db: DatabaseClient;
    input: CreateCategorieServiceInput;
  }): Promise<CategoriePreRempliRecord> {
    const payload: CreateCategorieInput = {
      nom: data.input.nom.trim(),
      description: data.input.description?.trim() || null,
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
      description: data.input.description?.trim() || null,
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
    session: OrdonnanceSession;
    input: CreatePreRempliServiceInput;
  }): Promise<PreRempliOrdonnanceRecord> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const payload: CreatePreRempliInput = {
      nom: data.input.nom.trim(),
      description: data.input.description?.trim() || null,
      specialite: data.input.specialite?.trim() || null,
      categorie_pre_rempli_id: data.input.categorie_pre_rempli_id,
      est_actif: data.input.est_actif ?? true,
      created_by_user: utilisateur.id,
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
      description: data.input.description?.trim() || data.input.description || null,
      specialite: data.input.specialite?.trim() || data.input.specialite || null,
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
          medicament_externe_id: item.medicament_externe_id,
          nom_medicament: item.nom_medicament,
          dosage: item.dosage,
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

    const snapshot = await this.resolveMedicamentSnapshot(data.input.medicament_externe_id);

    const payload: AddPreRempliMedicamentInput = {
      pre_rempli_id: data.preRempliId,
      medicament_externe_id: snapshot.medicament_externe_id,
      nom_medicament: snapshot.nom_medicament,
      dosage: data.input.dosage?.trim() || null,
      posologie_defaut: data.input.posologie_defaut?.trim() || null,
      duree_defaut: data.input.duree_defaut?.trim() || null,
      instructions_defaut: data.input.instructions_defaut?.trim() || null,
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
      dosage: data.input.dosage?.trim() || data.input.dosage || null,
      posologie_defaut: data.input.posologie_defaut?.trim() || data.input.posologie_defaut || null,
      duree_defaut: data.input.duree_defaut?.trim() || data.input.duree_defaut || null,
      instructions_defaut:
        data.input.instructions_defaut?.trim() || data.input.instructions_defaut || null,
      ordre_affichage: data.input.ordre_affichage,
      est_optionnel: data.input.est_optionnel,
    };

    if (data.input.medicament_externe_id !== undefined) {
      const snapshot = await this.resolveMedicamentSnapshot(data.input.medicament_externe_id);
      payload.medicament_externe_id = snapshot.medicament_externe_id;
      payload.nom_medicament = snapshot.nom_medicament;
    }

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

  async creerPdfTemplateFromUpload(data: {
    db: DatabaseClient;
    session: OrdonnanceSession;
    input: CreateOrdonnancePdfTemplateUploadInput;
  }): Promise<OrdonnancePdfTemplateRecord> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const nom = data.input.nom.trim();

    if (!nom) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Le nom du template PDF est obligatoire.",
      });
    }

    const payload: CreateOrdonnancePdfTemplateInput = {
      utilisateur_id: utilisateur.id,
      nom,
      description: data.input.description?.trim() || null,
      chemin_fichier: data.input.chemin_fichier,
      type_fichier: data.input.type_fichier,
      taille_fichier: data.input.taille_fichier,
      page_width: data.input.page_width ?? DEFAULT_PDF_TEMPLATE_PAGE.width,
      page_height: data.input.page_height ?? DEFAULT_PDF_TEMPLATE_PAGE.height,
      layout_config: DEFAULT_ORDONNANCE_PDF_LAYOUT,
      est_actif: true,
      is_default_for_user: false,
    };

    return ordonnanceRepository.createPdfTemplate(data.db, payload);
  }

  async listPdfTemplates(data: {
    db: DatabaseClient;
    session: OrdonnanceSession;
  }): Promise<OrdonnancePdfTemplateRecord[]> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    return ordonnanceRepository.getPdfTemplatesByUtilisateur(
      data.db,
      utilisateur.id,
    );
  }

  async getPdfTemplate(data: {
    db: DatabaseClient;
    session: OrdonnanceSession;
    id: string;
  }): Promise<OrdonnancePdfTemplateRecord> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const template = await ordonnanceRepository.getPdfTemplateById(
      data.db,
      data.id,
    );

    return this.ensureOwnedPdfTemplate(template, utilisateur.id);
  }

  async updatePdfTemplateLayout(data: {
    db: DatabaseClient;
    session: OrdonnanceSession;
    id: string;
    input: UpdateOrdonnancePdfTemplateLayoutInput;
  }): Promise<OrdonnancePdfTemplateRecord> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const existing = await ordonnanceRepository.getPdfTemplateById(
      data.db,
      data.id,
    );
    this.ensureOwnedPdfTemplate(existing, utilisateur.id);

    const payload: UpdateOrdonnancePdfTemplateInput = {
      nom: data.input.nom?.trim(),
      description:
        data.input.description === undefined
          ? undefined
          : data.input.description?.trim() || null,
      layout_config: normalizeOrdonnancePdfLayout(data.input.layout_config),
    };

    const updated = await ordonnanceRepository.updatePdfTemplate(
      data.db,
      data.id,
      payload,
    );

    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de mise a jour du template PDF.",
      });
    }

    return updated;
  }

  async deletePdfTemplate(data: {
    db: DatabaseClient;
    session: OrdonnanceSession;
    id: string;
  }): Promise<{ success: true }> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);
    const existing = await ordonnanceRepository.getPdfTemplateById(
      data.db,
      data.id,
    );
    this.ensureOwnedPdfTemplate(existing, utilisateur.id);

    const deleted = await ordonnanceRepository.softDeletePdfTemplate(
      data.db,
      data.id,
    );

    if (!deleted) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de suppression du template PDF.",
      });
    }

    return { success: true };
  }

  async setDefaultPdfTemplate(data: {
    db: DatabaseClient;
    session: OrdonnanceSession;
    id: string | null;
  }): Promise<{ success: true }> {
    const utilisateur = await this.resolveUtilisateur(data.db, data.session);

    if (data.id) {
      const template = await ordonnanceRepository.getPdfTemplateById(
        data.db,
        data.id,
      );
      this.ensureOwnedPdfTemplate(template, utilisateur.id);
    }

    await withTx(async (tx) => {
      await ordonnanceRepository.clearDefaultPdfTemplates(tx, utilisateur.id);

      if (data.id) {
        const updated = await ordonnanceRepository.updatePdfTemplate(tx, data.id, {
          is_default_for_user: true,
        });
        if (!updated) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Echec de configuration du template PDF par defaut.",
          });
        }
      }
    });

    return { success: true };
  }

  async genererPDF(): Promise<never> {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "La generation PDF n'est pas encore implemente dans ce module.",
    });
  }

  async envoyerOrdonnanceParEmail(data: {
    db: DatabaseClient;
    ordonnanceId: string;
    userEmail?: string;
    userId?: string;
  }): Promise<{ success: true; message: string }> {
    const ordonnance = await ordonnanceRepository.getOrdonnanceById(data.db, data.ordonnanceId);
    if (!ordonnance) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ordonnance introuvable.",
      });
    }

    const medicaments = await ordonnanceRepository.getMedicamentsByOrdonnance(
      data.db,
      ordonnance.id,
    );

    const medicamentsAvecDetails = medicaments.map((medicament) => ({
      nom: medicament.dci ?? "Médicament",
      posologie: medicament.posologie,
      duree: medicament.duree_traitement,
      instructions: medicament.instructions,
    }));

    const patient = await data.db
      .select({
        nom: patients.nom,
        prenom: patients.prenom,
        email: patients.email,
      })
      .from(patients)
      .where(eq(patients.id, ordonnance.patient_id))
      .then((rows) => rows[0]);

    if (!patient) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Patient introuvable.",
      });
    }

    if (!patient.email) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Le patient n'a pas d'adresse email.",
      });
    }

    const sessionEmail = await this.resolveSessionUserEmail(data);
    const utilisateur = await ordonnanceRepository.getUtilisateurByEmail(data.db, sessionEmail);

    if (!utilisateur) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Utilisateur introuvable.",
      });
    }

    const clinic: ClinicInfo = {
      doctorName: `Dr. ${utilisateur.prenom} ${utilisateur.nom}`,
      clinicName: `Cabinet ${utilisateur.prenom} ${utilisateur.nom}`,
      phone: utilisateur.telephone ?? "",
      address: utilisateur.adresse ?? "",
    };

    const pdfBuffer = await exportService.exporterOrdonnance(data.db, data.ordonnanceId);

    await envoyerOrdonnanceParEmailInfrastructure({
      clinic,
      patientEmail: patient.email,
      patientNom: patient.nom,
      patientPrenom: patient.prenom,
      datePrescription: ordonnance.date_prescription,
      medicaments: medicamentsAvecDetails,
      remarques: ordonnance.remarques,
      attachments: [
        {
          filename: `ordonnance-${ordonnance.date_prescription}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    } as any);

    return { success: true, message: "Email envoyé avec succès." };
  }

  private async resolveUtilisateur(
    database: DatabaseClient,
    session: OrdonnanceSession,
  ): Promise<UtilisateurRecord> {
    const email = this.resolveSessionEmail(session);
    const utilisateur = await ordonnanceRepository.findUtilisateurByEmail(database, email);

    if (!utilisateur) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Le compte associé à cette session est introuvable.",
      });
    }

    return utilisateur;
  }

  private ensureOwnedPdfTemplate(
    template: OrdonnancePdfTemplateRecord | null | undefined,
    utilisateurId: string,
  ): OrdonnancePdfTemplateRecord {
    if (!template || !template.est_actif) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Template PDF introuvable.",
      });
    }

    if (template.utilisateur_id !== utilisateurId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Vous n'avez pas acces a ce template PDF.",
      });
    }

    return template;
  }

  private resolveSessionEmail(session: OrdonnanceSession): string {
    const email = session.user.email.trim().toLowerCase();
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "La session a expiré. Reconnectez-vous.",
      });
    }
    return email;
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

  private async resolveMedicamentSnapshot(medicamentExterneId: string) {
    const parsedId = Number.parseInt(medicamentExterneId.trim(), 10);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "medicament_externe_id invalide.",
      });
    }

    return medicamentsService.getMedicamentSnapshot(parsedId);
  }

  private async buildOrdonnanceMedicamentPayload(
    input: AddOrdonnanceMedicamentServiceInput,
  ): Promise<Omit<AddOrdonnanceMedicamentInput, "ordonnance_id">> {
    const snapshot = await this.resolveMedicamentSnapshot(input.medicament_externe_id);
    const posologie = input.posologie.trim();

    if (!posologie) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "La posologie est obligatoire.",
      });
    }

    return {
      medicament_externe_id: snapshot.medicament_externe_id,
      nom_medicament: snapshot.nom_medicament,
      dci: snapshot.dci,
      dosage: input.dosage?.trim() || null,
      posologie,
      duree_traitement: input.duree_traitement?.trim() || null,
      instructions: input.instructions?.trim() || null,
    };
  }

  private async buildOrdonnanceMedicamentUpdatePayload(
    existing: OrdonnanceMedicamentRecord,
    input: UpdateOrdonnanceMedicamentServiceInput,
  ): Promise<UpdateOrdonnanceMedicamentInput> {
    const payload: UpdateOrdonnanceMedicamentInput = {
      dosage: input.dosage?.trim() || input.dosage || null,
      posologie: input.posologie?.trim(),
      duree_traitement: input.duree_traitement?.trim() || input.duree_traitement || null,
      instructions: input.instructions?.trim() || input.instructions || null,
    };

    if (input.medicament_externe_id !== undefined) {
      const snapshot = await this.resolveMedicamentSnapshot(input.medicament_externe_id);
      payload.medicament_externe_id = snapshot.medicament_externe_id;
      payload.nom_medicament = snapshot.nom_medicament;
      payload.dci = snapshot.dci;
    } else {
      payload.medicament_externe_id = existing.medicament_externe_id;
      payload.nom_medicament = existing.nom_medicament;
      payload.dci = existing.dci;
    }

    return payload;
  }

  private findPreRempliModification(
    modifications: CreateFromPreRempliModification[],
    templateItem: PreRempliMedicamentRecord,
  ): CreateFromPreRempliModification | undefined {
    const byExternalId = modifications.find(
      (item) => item.medicament_externe_id?.trim() === templateItem.medicament_externe_id,
    );
    if (byExternalId) {
      return byExternalId;
    }

    const normalizedName = templateItem.nom_medicament.trim().toLowerCase();
    return modifications.find(
      (item) => item.nom_medicament?.trim().toLowerCase() === normalizedName,
    );
  }

  private async syncDerivedTreatmentForOrdonnanceMedicament(
    database: DatabaseTransaction,
    params: {
      patient_id: string;
      utilisateur_id: string;
      date_prescription: string;
      ordonnance_id: string;
      ordonnance_medicament: OrdonnanceMedicamentRecord;
    },
  ): Promise<void> {
    await treatmentRepository.deactivateActiveDerivedTreatmentsForPatientMedication(database, {
      patient_id: params.patient_id,
      medicament_externe_id: params.ordonnance_medicament.medicament_externe_id,
      exclude_ordonnance_medicament_id: params.ordonnance_medicament.id,
    });

    const existingTreatment = await treatmentRepository.getTreatmentByOrdonnanceMedicamentId(
      database,
      params.ordonnance_medicament.id,
    );

    const payload = {
      patient_id: params.patient_id,
      medicament_externe_id: params.ordonnance_medicament.medicament_externe_id,
      nom_medicament: params.ordonnance_medicament.nom_medicament,
      dosage: params.ordonnance_medicament.dosage,
      posologie: params.ordonnance_medicament.posologie,
      date_prescription: params.date_prescription,
      prescrit_par_utilisateur: params.utilisateur_id,
      est_actif: true,
      source_type: "ordonnance" as const,
      ordonnance_id: params.ordonnance_id,
      ordonnance_medicament_id: params.ordonnance_medicament.id,
    };

    if (existingTreatment) {
      await treatmentRepository.updateTreatment(database, existingTreatment.id, payload);
      return;
    }

    await treatmentRepository.createTreatment(database, payload);
  }

  private todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async resolveSessionUserEmail(data: {
    db: DatabaseClient;
    userEmail?: string;
    userId?: string;
  }): Promise<string> {
    const directEmail = data.userEmail?.trim().toLowerCase();
    if (directEmail) {
      return directEmail;
    }

    if (!data.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Email utilisateur manquant dans la session.",
      });
    }

    const [sessionUser] = await data.db
      .select({ email: authUser.email })
      .from(authUser)
      .where(eq(authUser.id, data.userId))
      .limit(1);

    if (!sessionUser?.email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Email utilisateur introuvable dans la session.",
      });
    }

    return sessionUser.email.trim().toLowerCase();
  }
}

export const ordonnanceService = new OrdonnanceService();
