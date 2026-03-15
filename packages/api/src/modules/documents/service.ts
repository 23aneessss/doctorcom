import { TRPCError } from "@trpc/server";
import type { db as databaseClient } from "@doctor.com/db";

import {
  documentsRepository,
  type CertificatMedicalRecord,
  type CategorieDocumentRecord,
  type CreateCategorieInput,
  type CreateDocumentInput,
  type DocumentPatientRecord,
  type LettreOrientationRecord,
  type UpdateCategorieInput,
  type UpdateCertificatInput,
  type UpdateDocumentInput,
  type UpdateLettreInput,
  type UtilisateurRecord,
} from "./repo";

type DatabaseClient = typeof databaseClient;

export interface CreateDocumentServiceInput {
  patient_id: string;
  categorie_id: string;
  type_document: string;
  nom_document: string;
  chemin_fichier: string;
  type_fichier: string;
  taille_fichier: number;
  description?: string | null;
}

export interface UpdateDocumentServiceInput {
  categorie_id?: string;
  type_document?: string;
  nom_document?: string;
  chemin_fichier?: string;
  type_fichier?: string;
  taille_fichier?: number;
  description?: string | null;
}

export interface CreateLettreServiceInput {
  document: CreateDocumentServiceInput;
  lettre: {
    suivi_id: string;
    type_exploration?: string | null;
    examen_demande?: string | null;
    raison?: string | null;
    destinataire?: string | null;
    urgence: LettreOrientationRecord["urgence"];
    contenu_lettre?: string | null;
  };
}

export interface UpdateLettreServiceInput {
  type_exploration?: string | null;
  examen_demande?: string | null;
  raison?: string | null;
  destinataire?: string | null;
  urgence?: LettreOrientationRecord["urgence"];
  contenu_lettre?: string | null;
}

export interface CreateCertificatServiceInput {
  document: CreateDocumentServiceInput;
  certificat: {
    suivi_id: string;
    type_certificat: CertificatMedicalRecord["type_certificat"];
    date_emission: string;
    date_debut?: string | null;
    date_fin?: string | null;
    diagnostic?: string | null;
    destinataire?: string | null;
    notes?: string | null;
    statut: CertificatMedicalRecord["statut"];
  };
}

export interface UpdateCertificatServiceInput {
  type_certificat?: CertificatMedicalRecord["type_certificat"];
  date_emission?: string;
  date_debut?: string | null;
  date_fin?: string | null;
  diagnostic?: string | null;
  destinataire?: string | null;
  notes?: string | null;
  statut?: CertificatMedicalRecord["statut"];
}

export class DocumentsService {
  async creerCategorie(data: {
    db: DatabaseClient;
    input: CreateCategorieInput;
  }): Promise<CategorieDocumentRecord> {
    return documentsRepository.createCategorie(data.db, {
      nom: data.input.nom.trim(),
      description: data.input.description ?? null,
    });
  }

  async mettreAJourCategorie(data: {
    db: DatabaseClient;
    id: string;
    input: UpdateCategorieInput;
  }): Promise<CategorieDocumentRecord> {
    const existing = await documentsRepository.getCategorieById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Categorie introuvable." });
    }

    const updated = await documentsRepository.updateCategorie(data.db, data.id, {
      nom: data.input.nom?.trim(),
      description: data.input.description,
    });

    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de mise a jour de la categorie.",
      });
    }

    return updated;
  }

  async supprimerCategorie(data: { db: DatabaseClient; id: string }): Promise<{ success: true }> {
    const existing = await documentsRepository.getCategorieById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Categorie introuvable." });
    }

    const relatedDocuments = await documentsRepository.getDocumentsByCategorie(data.db, data.id);
    if (relatedDocuments.length > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Impossible de supprimer cette catégorie : des documents y sont associés.",
      });
    }

    const deleted = await documentsRepository.deleteCategorie(data.db, data.id);
    if (!deleted) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de suppression de la categorie.",
      });
    }

    return { success: true };
  }

  async getToutesCategories(data: { db: DatabaseClient }): Promise<CategorieDocumentRecord[]> {
    return documentsRepository.getAllCategories(data.db);
  }

  async creerDocument(data: {
    db: DatabaseClient;
    input: CreateDocumentServiceInput;
    userEmail: string;
  }): Promise<DocumentPatientRecord> {
    await this.assertPatientExists(data.db, data.input.patient_id);
    const utilisateur = await this.resolveUtilisateur(data.db, data.userEmail);

    const payload: CreateDocumentInput = {
      patient_id: data.input.patient_id,
      categorie_id: data.input.categorie_id,
      type_document: data.input.type_document,
      nom_document: data.input.nom_document,
      chemin_fichier: data.input.chemin_fichier,
      type_fichier: data.input.type_fichier,
      taille_fichier: data.input.taille_fichier,
      description: data.input.description ?? null,
      date_upload: this.nowIsoDate(),
      uploade_par_utilisateur: utilisateur.id,
      est_archive: false,
    };

    return documentsRepository.createDocument(data.db, payload);
  }

  async mettreAJourDocument(data: {
    db: DatabaseClient;
    id: string;
    input: UpdateDocumentServiceInput;
  }): Promise<DocumentPatientRecord> {
    const existing = await documentsRepository.getDocumentById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Document introuvable." });
    }

    const payload: UpdateDocumentInput = {
      categorie_id: data.input.categorie_id,
      type_document: data.input.type_document,
      nom_document: data.input.nom_document,
      chemin_fichier: data.input.chemin_fichier,
      type_fichier: data.input.type_fichier,
      taille_fichier: data.input.taille_fichier,
      description: data.input.description,
    };

    const updated = await documentsRepository.updateDocument(data.db, data.id, payload);
    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de mise a jour du document.",
      });
    }

    return updated;
  }

  async supprimerDocument(data: { db: DatabaseClient; id: string }): Promise<{ success: true }> {
    const existing = await documentsRepository.getDocumentById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Document introuvable." });
    }

    const deleted = await documentsRepository.deleteDocument(data.db, data.id);
    if (!deleted) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de suppression du document.",
      });
    }

    return { success: true };
  }

  async getDocumentById(data: { db: DatabaseClient; id: string }): Promise<DocumentPatientRecord> {
    const item = await documentsRepository.getDocumentById(data.db, data.id);
    if (!item) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Document introuvable." });
    }

    return item;
  }

  async getDocumentsByPatient(data: {
    db: DatabaseClient;
    patientId: string;
  }): Promise<DocumentPatientRecord[]> {
    return documentsRepository.getDocumentsByPatient(data.db, data.patientId);
  }

  async getDocumentsByType(data: {
    db: DatabaseClient;
    patientId: string;
    typeDocument: string;
  }): Promise<DocumentPatientRecord[]> {
    return documentsRepository.getDocumentsByType(data.db, data.patientId, data.typeDocument);
  }

  async archiverDocument(data: { db: DatabaseClient; id: string }): Promise<DocumentPatientRecord> {
    const existing = await documentsRepository.getDocumentById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Document introuvable." });
    }

    const archived = await documentsRepository.archiverDocument(data.db, data.id);
    if (!archived) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de l'archivage du document.",
      });
    }

    return archived;
  }

  async restaurerDocument(data: { db: DatabaseClient; id: string }): Promise<DocumentPatientRecord> {
    const existing = await documentsRepository.getDocumentById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Document introuvable." });
    }

    const restored = await documentsRepository.restaurerDocument(data.db, data.id);
    if (!restored) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de la restauration du document.",
      });
    }

    return restored;
  }

  async creerLettre(data: {
    db: DatabaseClient;
    input: CreateLettreServiceInput;
    userEmail: string;
  }): Promise<{ document: DocumentPatientRecord; lettre: LettreOrientationRecord }> {
    await this.assertPatientExists(data.db, data.input.document.patient_id);
    await this.assertSuiviExists(data.db, data.input.lettre.suivi_id);
    const utilisateur = await this.resolveUtilisateur(data.db, data.userEmail);

    const now = this.nowIsoDate();

    return documentsRepository.createLettre(
      data.db,
      {
        patient_id: data.input.document.patient_id,
        categorie_id: data.input.document.categorie_id,
        type_document: data.input.document.type_document,
        nom_document: data.input.document.nom_document,
        chemin_fichier: data.input.document.chemin_fichier,
        type_fichier: data.input.document.type_fichier,
        taille_fichier: data.input.document.taille_fichier,
        description: data.input.document.description ?? null,
        date_upload: now,
        uploade_par_utilisateur: utilisateur.id,
        est_archive: false,
      },
      {
        utilisateur_id: utilisateur.id,
        suivi_id: data.input.lettre.suivi_id,
        type_exploration: data.input.lettre.type_exploration ?? null,
        examen_demande: data.input.lettre.examen_demande ?? null,
        raison: data.input.lettre.raison ?? null,
        destinataire: data.input.lettre.destinataire ?? null,
        urgence: data.input.lettre.urgence,
        contenu_lettre: data.input.lettre.contenu_lettre ?? null,
        date_creation: now,
        date_modification: now,
      },
    );
  }

  async mettreAJourLettre(data: {
    db: DatabaseClient;
    id: string;
    input: UpdateLettreServiceInput;
    userEmail: string;
  }): Promise<LettreOrientationRecord> {
    const existing = await documentsRepository.getLettreById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Lettre introuvable." });
    }
    const utilisateur = await this.resolveUtilisateur(data.db, data.userEmail);

    const payload: UpdateLettreInput = {
      utilisateur_id: utilisateur.id,
      type_exploration: data.input.type_exploration,
      examen_demande: data.input.examen_demande,
      raison: data.input.raison,
      destinataire: data.input.destinataire,
      urgence: data.input.urgence,
      contenu_lettre: data.input.contenu_lettre,
      date_modification: this.nowIsoDate(),
    };

    const updated = await documentsRepository.updateLettre(data.db, data.id, payload);
    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de mise a jour de la lettre.",
      });
    }

    return updated;
  }

  async supprimerLettre(data: { db: DatabaseClient; id: string }): Promise<{ success: true }> {
    const existing = await documentsRepository.getLettreById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Lettre introuvable." });
    }

    const deleted = await documentsRepository.deleteLettre(data.db, data.id);
    if (!deleted) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de suppression de la lettre.",
      });
    }

    return { success: true };
  }

  async getLettreById(data: {
    db: DatabaseClient;
    id: string;
  }): Promise<{ lettre: LettreOrientationRecord; document: DocumentPatientRecord }> {
    const lettre = await documentsRepository.getLettreById(data.db, data.id);
    if (!lettre) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Lettre introuvable." });
    }

    const document = await documentsRepository.getDocumentById(data.db, lettre.documents_patient_id);
    if (!document) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Document parent introuvable pour cette lettre.",
      });
    }

    return { lettre, document };
  }

  async getLettresByPatient(data: {
    db: DatabaseClient;
    patientId: string;
  }): Promise<LettreOrientationRecord[]> {
    return documentsRepository.getLettresByPatient(data.db, data.patientId);
  }

  async getLettresBySuivi(data: {
    db: DatabaseClient;
    suiviId: string;
  }): Promise<LettreOrientationRecord[]> {
    return documentsRepository.getLettresBySuivi(data.db, data.suiviId);
  }

  async creerCertificat(data: {
    db: DatabaseClient;
    input: CreateCertificatServiceInput;
    userEmail: string;
  }): Promise<{ document: DocumentPatientRecord; certificat: CertificatMedicalRecord }> {
    await this.assertPatientExists(data.db, data.input.document.patient_id);
    await this.assertSuiviExists(data.db, data.input.certificat.suivi_id);
    const utilisateur = await this.resolveUtilisateur(data.db, data.userEmail);

    const now = this.nowIsoDate();

    return documentsRepository.createCertificat(
      data.db,
      {
        patient_id: data.input.document.patient_id,
        categorie_id: data.input.document.categorie_id,
        type_document: data.input.document.type_document,
        nom_document: data.input.document.nom_document,
        chemin_fichier: data.input.document.chemin_fichier,
        type_fichier: data.input.document.type_fichier,
        taille_fichier: data.input.document.taille_fichier,
        description: data.input.document.description ?? null,
        date_upload: now,
        uploade_par_utilisateur: utilisateur.id,
        est_archive: false,
      },
      {
        utilisateur_id: utilisateur.id,
        suivi_id: data.input.certificat.suivi_id,
        type_certificat: data.input.certificat.type_certificat,
        date_emission: data.input.certificat.date_emission,
        date_debut: data.input.certificat.date_debut ?? null,
        date_fin: data.input.certificat.date_fin ?? null,
        diagnostic: data.input.certificat.diagnostic ?? null,
        destinataire: data.input.certificat.destinataire ?? null,
        notes: data.input.certificat.notes ?? null,
        statut: data.input.certificat.statut,
        date_creation: now,
        date_modification: now,
      },
    );
  }

  async mettreAJourCertificat(data: {
    db: DatabaseClient;
    id: string;
    input: UpdateCertificatServiceInput;
    userEmail: string;
  }): Promise<CertificatMedicalRecord> {
    const existing = await documentsRepository.getCertificatById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Certificat introuvable." });
    }
    const utilisateur = await this.resolveUtilisateur(data.db, data.userEmail);

    const payload: UpdateCertificatInput = {
      utilisateur_id: utilisateur.id,
      type_certificat: data.input.type_certificat,
      date_emission: data.input.date_emission,
      date_debut: data.input.date_debut,
      date_fin: data.input.date_fin,
      diagnostic: data.input.diagnostic,
      destinataire: data.input.destinataire,
      notes: data.input.notes,
      statut: data.input.statut,
      date_modification: this.nowIsoDate(),
    };

    const updated = await documentsRepository.updateCertificat(data.db, data.id, payload);
    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de mise a jour du certificat.",
      });
    }

    return updated;
  }

  async supprimerCertificat(data: {
    db: DatabaseClient;
    id: string;
  }): Promise<{ success: true }> {
    const existing = await documentsRepository.getCertificatById(data.db, data.id);
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Certificat introuvable." });
    }

    const deleted = await documentsRepository.deleteCertificat(data.db, data.id);
    if (!deleted) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Echec de suppression du certificat.",
      });
    }

    return { success: true };
  }

  async getCertificatById(data: {
    db: DatabaseClient;
    id: string;
  }): Promise<{ certificat: CertificatMedicalRecord; document: DocumentPatientRecord }> {
    const certificat = await documentsRepository.getCertificatById(data.db, data.id);
    if (!certificat) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Certificat introuvable." });
    }

    const document = await documentsRepository.getDocumentById(
      data.db,
      certificat.documents_patient_id,
    );
    if (!document) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Document parent introuvable pour ce certificat.",
      });
    }

    return { certificat, document };
  }

  async getCertificatsByPatient(data: {
    db: DatabaseClient;
    patientId: string;
  }): Promise<CertificatMedicalRecord[]> {
    return documentsRepository.getCertificatsByPatient(data.db, data.patientId);
  }

  async getCertificatsBySuivi(data: {
    db: DatabaseClient;
    suiviId: string;
  }): Promise<CertificatMedicalRecord[]> {
    return documentsRepository.getCertificatsBySuivi(data.db, data.suiviId);
  }

  async getCertificatsByType(data: {
    db: DatabaseClient;
    patientId: string;
    typeCertificat: CertificatMedicalRecord["type_certificat"];
  }): Promise<CertificatMedicalRecord[]> {
    return documentsRepository.getCertificatsByType(
      data.db,
      data.patientId,
      data.typeCertificat,
    );
  }

  async getCertificatsActifs(data: {
    db: DatabaseClient;
    patientId: string;
  }): Promise<CertificatMedicalRecord[]> {
    return documentsRepository.getCertificatsActifs(data.db, data.patientId);
  }

  private async assertPatientExists(database: DatabaseClient, patientId: string): Promise<void> {
    const patient = await documentsRepository.getPatientById(database, patientId);
    if (!patient) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Patient introuvable." });
    }
  }

  private async assertSuiviExists(database: DatabaseClient, suiviId: string): Promise<void> {
    const suiviItem = await documentsRepository.getSuiviById(database, suiviId);
    if (!suiviItem) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Suivi introuvable." });
    }
  }

  private async resolveUtilisateur(
    database: DatabaseClient,
    userEmail: string,
  ): Promise<UtilisateurRecord> {
    const email = userEmail.trim().toLowerCase();
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Session invalide: email utilisateur manquant.",
      });
    }

    const utilisateur = await documentsRepository.findUtilisateurByEmail(database, email);
    if (!utilisateur) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Utilisateur introuvable pour la session courante.",
      });
    }

    return utilisateur;
  }

  private nowIsoDate(): string {
    return new Date().toISOString();
  }
}

export const documentsService = new DocumentsService();
