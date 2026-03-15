import type { db as databaseClient } from "@doctor.com/db";
import {
  categories_documents,
  certificats_medicaux,
  documents_patient,
  lettres_orientation,
  patients,
  suivi,
  utilisateurs,
} from "@doctor.com/db/schema";
import { and, desc, eq } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;

type NewCategorieDocumentRecord = typeof categories_documents.$inferInsert;
type NewDocumentPatientRecord = typeof documents_patient.$inferInsert;
type NewLettreOrientationRecord = typeof lettres_orientation.$inferInsert;
type NewCertificatMedicalRecord = typeof certificats_medicaux.$inferInsert;

export type CategorieDocumentRecord = typeof categories_documents.$inferSelect;
export type DocumentPatientRecord = typeof documents_patient.$inferSelect;
export type LettreOrientationRecord = typeof lettres_orientation.$inferSelect;
export type CertificatMedicalRecord = typeof certificats_medicaux.$inferSelect;
export type UtilisateurRecord = typeof utilisateurs.$inferSelect;

export type CreateCategorieInput = Omit<NewCategorieDocumentRecord, "id">;
export type UpdateCategorieInput = Partial<CreateCategorieInput>;

export type CreateDocumentInput = Omit<NewDocumentPatientRecord, "id">;
export type UpdateDocumentInput = Partial<
  Omit<
    NewDocumentPatientRecord,
    "id" | "patient_id" | "uploade_par_utilisateur" | "date_upload"
  >
>;

export type CreateLettreInput = Omit<NewLettreOrientationRecord, "id">;
export type UpdateLettreInput = Partial<
  Omit<NewLettreOrientationRecord, "id" | "documents_patient_id" | "suivi_id">
>;

export type CreateCertificatInput = Omit<NewCertificatMedicalRecord, "id">;
export type UpdateCertificatInput = Partial<
  Omit<NewCertificatMedicalRecord, "id" | "documents_patient_id" | "suivi_id">
>;

export class DocumentsRepository {
  async findUtilisateurByEmail(
    database: DatabaseClient,
    email: string,
  ): Promise<UtilisateurRecord | null> {
    const [item] = await database
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.email, email))
      .limit(1);

    return item ?? null;
  }

  async createCategorie(
    database: DatabaseClient,
    data: CreateCategorieInput,
  ): Promise<CategorieDocumentRecord> {
    const [created] = await database
      .insert(categories_documents)
      .values(data)
      .returning();

    if (!created) {
      throw new Error("Echec de creation de la categorie document.");
    }

    return created;
  }

  async updateCategorie(
    database: DatabaseClient,
    id: string,
    data: UpdateCategorieInput,
  ): Promise<CategorieDocumentRecord | null> {
    if (Object.keys(data).length === 0) {
      return this.getCategorieById(database, id);
    }

    const [updated] = await database
      .update(categories_documents)
      .set(data)
      .where(eq(categories_documents.id, id))
      .returning();

    return updated ?? null;
  }

  async deleteCategorie(database: DatabaseClient, id: string): Promise<boolean> {
    const [deleted] = await database
      .delete(categories_documents)
      .where(eq(categories_documents.id, id))
      .returning({ id: categories_documents.id });

    return Boolean(deleted);
  }

  async getAllCategories(database: DatabaseClient): Promise<CategorieDocumentRecord[]> {
    return database.select().from(categories_documents).orderBy(categories_documents.nom);
  }

  async getCategorieById(
    database: DatabaseClient,
    id: string,
  ): Promise<CategorieDocumentRecord | null> {
    const [item] = await database
      .select()
      .from(categories_documents)
      .where(eq(categories_documents.id, id))
      .limit(1);

    return item ?? null;
  }

  async createDocument(
    database: DatabaseClient,
    data: CreateDocumentInput,
  ): Promise<DocumentPatientRecord> {
    const [created] = await database
      .insert(documents_patient)
      .values(data)
      .returning();

    if (!created) {
      throw new Error("Echec de creation du document patient.");
    }

    return created;
  }

  async updateDocument(
    database: DatabaseClient,
    id: string,
    data: UpdateDocumentInput,
  ): Promise<DocumentPatientRecord | null> {
    if (Object.keys(data).length === 0) {
      return this.getDocumentById(database, id);
    }

    const [updated] = await database
      .update(documents_patient)
      .set(data)
      .where(eq(documents_patient.id, id))
      .returning();

    return updated ?? null;
  }

  async deleteDocument(database: DatabaseClient, id: string): Promise<boolean> {
    const [deleted] = await database
      .delete(documents_patient)
      .where(eq(documents_patient.id, id))
      .returning({ id: documents_patient.id });

    return Boolean(deleted);
  }

  async getDocumentById(database: DatabaseClient, id: string): Promise<DocumentPatientRecord | null> {
    const [item] = await database
      .select()
      .from(documents_patient)
      .where(eq(documents_patient.id, id))
      .limit(1);

    return item ?? null;
  }

  async getDocumentsByPatient(
    database: DatabaseClient,
    patientId: string,
  ): Promise<DocumentPatientRecord[]> {
    return database
      .select()
      .from(documents_patient)
      .where(eq(documents_patient.patient_id, patientId))
      .orderBy(desc(documents_patient.date_upload));
  }

  async getDocumentsByCategorie(
    database: DatabaseClient,
    categorieId: string,
  ): Promise<DocumentPatientRecord[]> {
    return database
      .select()
      .from(documents_patient)
      .where(eq(documents_patient.categorie_id, categorieId))
      .orderBy(desc(documents_patient.date_upload));
  }

  async getDocumentsByType(
    database: DatabaseClient,
    patientId: string,
    typeDocument: string,
  ): Promise<DocumentPatientRecord[]> {
    return database
      .select()
      .from(documents_patient)
      .where(
        and(
          eq(documents_patient.patient_id, patientId),
          eq(documents_patient.type_document, typeDocument),
        ),
      )
      .orderBy(desc(documents_patient.date_upload));
  }

  async archiverDocument(
    database: DatabaseClient,
    id: string,
  ): Promise<DocumentPatientRecord | null> {
    const [updated] = await database
      .update(documents_patient)
      .set({ est_archive: true })
      .where(eq(documents_patient.id, id))
      .returning();

    return updated ?? null;
  }

  async restaurerDocument(
    database: DatabaseClient,
    id: string,
  ): Promise<DocumentPatientRecord | null> {
    const [updated] = await database
      .update(documents_patient)
      .set({ est_archive: false })
      .where(eq(documents_patient.id, id))
      .returning();

    return updated ?? null;
  }

  async createLettre(
    database: DatabaseClient,
    documentData: CreateDocumentInput,
    lettreData: Omit<CreateLettreInput, "documents_patient_id">,
  ): Promise<{ document: DocumentPatientRecord; lettre: LettreOrientationRecord }> {
    return database.transaction(async (tx) => {
      const [document] = await tx.insert(documents_patient).values(documentData).returning();
      if (!document) {
        throw new Error("Echec de creation du document pour la lettre.");
      }

      const [lettre] = await tx
        .insert(lettres_orientation)
        .values({
          ...lettreData,
          documents_patient_id: document.id,
        })
        .returning();

      if (!lettre) {
        throw new Error("Echec de creation de la lettre d'orientation.");
      }

      return { document, lettre };
    });
  }

  async updateLettre(
    database: DatabaseClient,
    id: string,
    data: UpdateLettreInput,
  ): Promise<LettreOrientationRecord | null> {
    if (Object.keys(data).length === 0) {
      return this.getLettreById(database, id);
    }

    const [updated] = await database
      .update(lettres_orientation)
      .set(data)
      .where(eq(lettres_orientation.id, id))
      .returning();

    return updated ?? null;
  }

  async deleteLettre(database: DatabaseClient, id: string): Promise<boolean> {
    return database.transaction(async (tx) => {
      const [lettre] = await tx
        .delete(lettres_orientation)
        .where(eq(lettres_orientation.id, id))
        .returning({ documentId: lettres_orientation.documents_patient_id });

      if (!lettre) {
        return false;
      }

      await tx
        .delete(documents_patient)
        .where(eq(documents_patient.id, lettre.documentId));

      return true;
    });
  }

  async getLettreById(
    database: DatabaseClient,
    id: string,
  ): Promise<LettreOrientationRecord | null> {
    const [item] = await database
      .select()
      .from(lettres_orientation)
      .where(eq(lettres_orientation.id, id))
      .limit(1);

    return item ?? null;
  }

  async getLettreByDocumentId(
    database: DatabaseClient,
    documentPatientId: string,
  ): Promise<LettreOrientationRecord | null> {
    const [item] = await database
      .select()
      .from(lettres_orientation)
      .where(eq(lettres_orientation.documents_patient_id, documentPatientId))
      .limit(1);

    return item ?? null;
  }

  async getLettresByPatient(
    database: DatabaseClient,
    patientId: string,
  ): Promise<LettreOrientationRecord[]> {
    return database
      .select({
        id: lettres_orientation.id,
        documents_patient_id: lettres_orientation.documents_patient_id,
        utilisateur_id: lettres_orientation.utilisateur_id,
        suivi_id: lettres_orientation.suivi_id,
        type_exploration: lettres_orientation.type_exploration,
        examen_demande: lettres_orientation.examen_demande,
        raison: lettres_orientation.raison,
        destinataire: lettres_orientation.destinataire,
        urgence: lettres_orientation.urgence,
        contenu_lettre: lettres_orientation.contenu_lettre,
        date_creation: lettres_orientation.date_creation,
        date_modification: lettres_orientation.date_modification,
      })
      .from(lettres_orientation)
      .innerJoin(
        documents_patient,
        eq(lettres_orientation.documents_patient_id, documents_patient.id),
      )
      .where(eq(documents_patient.patient_id, patientId))
      .orderBy(desc(lettres_orientation.date_creation));
  }

  async getLettresBySuivi(
    database: DatabaseClient,
    suiviId: string,
  ): Promise<LettreOrientationRecord[]> {
    return database
      .select()
      .from(lettres_orientation)
      .where(eq(lettres_orientation.suivi_id, suiviId))
      .orderBy(desc(lettres_orientation.date_creation));
  }

  async createCertificat(
    database: DatabaseClient,
    documentData: CreateDocumentInput,
    certificatData: Omit<CreateCertificatInput, "documents_patient_id">,
  ): Promise<{ document: DocumentPatientRecord; certificat: CertificatMedicalRecord }> {
    return database.transaction(async (tx) => {
      const [document] = await tx.insert(documents_patient).values(documentData).returning();
      if (!document) {
        throw new Error("Echec de creation du document pour le certificat.");
      }

      const [certificat] = await tx
        .insert(certificats_medicaux)
        .values({
          ...certificatData,
          documents_patient_id: document.id,
        })
        .returning();

      if (!certificat) {
        throw new Error("Echec de creation du certificat medical.");
      }

      return { document, certificat };
    });
  }

  async updateCertificat(
    database: DatabaseClient,
    id: string,
    data: UpdateCertificatInput,
  ): Promise<CertificatMedicalRecord | null> {
    if (Object.keys(data).length === 0) {
      return this.getCertificatById(database, id);
    }

    const [updated] = await database
      .update(certificats_medicaux)
      .set(data)
      .where(eq(certificats_medicaux.id, id))
      .returning();

    return updated ?? null;
  }

  async deleteCertificat(database: DatabaseClient, id: string): Promise<boolean> {
    return database.transaction(async (tx) => {
      const [certificat] = await tx
        .delete(certificats_medicaux)
        .where(eq(certificats_medicaux.id, id))
        .returning({ documentId: certificats_medicaux.documents_patient_id });

      if (!certificat) {
        return false;
      }

      await tx
        .delete(documents_patient)
        .where(eq(documents_patient.id, certificat.documentId));

      return true;
    });
  }

  async getCertificatById(
    database: DatabaseClient,
    id: string,
  ): Promise<CertificatMedicalRecord | null> {
    const [item] = await database
      .select()
      .from(certificats_medicaux)
      .where(eq(certificats_medicaux.id, id))
      .limit(1);

    return item ?? null;
  }

  async getCertificatByDocumentId(
    database: DatabaseClient,
    documentPatientId: string,
  ): Promise<CertificatMedicalRecord | null> {
    const [item] = await database
      .select()
      .from(certificats_medicaux)
      .where(eq(certificats_medicaux.documents_patient_id, documentPatientId))
      .limit(1);

    return item ?? null;
  }

  async getCertificatsByPatient(
    database: DatabaseClient,
    patientId: string,
  ): Promise<CertificatMedicalRecord[]> {
    return database
      .select({
        id: certificats_medicaux.id,
        documents_patient_id: certificats_medicaux.documents_patient_id,
        utilisateur_id: certificats_medicaux.utilisateur_id,
        suivi_id: certificats_medicaux.suivi_id,
        type_certificat: certificats_medicaux.type_certificat,
        date_emission: certificats_medicaux.date_emission,
        date_debut: certificats_medicaux.date_debut,
        date_fin: certificats_medicaux.date_fin,
        diagnostic: certificats_medicaux.diagnostic,
        destinataire: certificats_medicaux.destinataire,
        notes: certificats_medicaux.notes,
        statut: certificats_medicaux.statut,
        date_creation: certificats_medicaux.date_creation,
        date_modification: certificats_medicaux.date_modification,
      })
      .from(certificats_medicaux)
      .innerJoin(
        documents_patient,
        eq(certificats_medicaux.documents_patient_id, documents_patient.id),
      )
      .where(eq(documents_patient.patient_id, patientId))
      .orderBy(desc(certificats_medicaux.date_creation));
  }

  async getCertificatsBySuivi(
    database: DatabaseClient,
    suiviId: string,
  ): Promise<CertificatMedicalRecord[]> {
    return database
      .select()
      .from(certificats_medicaux)
      .where(eq(certificats_medicaux.suivi_id, suiviId))
      .orderBy(desc(certificats_medicaux.date_creation));
  }

  async getCertificatsByType(
    database: DatabaseClient,
    patientId: string,
    typeCertificat: CertificatMedicalRecord["type_certificat"],
  ): Promise<CertificatMedicalRecord[]> {
    return database
      .select({
        id: certificats_medicaux.id,
        documents_patient_id: certificats_medicaux.documents_patient_id,
        utilisateur_id: certificats_medicaux.utilisateur_id,
        suivi_id: certificats_medicaux.suivi_id,
        type_certificat: certificats_medicaux.type_certificat,
        date_emission: certificats_medicaux.date_emission,
        date_debut: certificats_medicaux.date_debut,
        date_fin: certificats_medicaux.date_fin,
        diagnostic: certificats_medicaux.diagnostic,
        destinataire: certificats_medicaux.destinataire,
        notes: certificats_medicaux.notes,
        statut: certificats_medicaux.statut,
        date_creation: certificats_medicaux.date_creation,
        date_modification: certificats_medicaux.date_modification,
      })
      .from(certificats_medicaux)
      .innerJoin(
        documents_patient,
        eq(certificats_medicaux.documents_patient_id, documents_patient.id),
      )
      .where(
        and(
          eq(documents_patient.patient_id, patientId),
          eq(certificats_medicaux.type_certificat, typeCertificat),
        ),
      )
      .orderBy(desc(certificats_medicaux.date_creation));
  }

  async getCertificatsActifs(
    database: DatabaseClient,
    patientId: string,
  ): Promise<CertificatMedicalRecord[]> {
    return database
      .select({
        id: certificats_medicaux.id,
        documents_patient_id: certificats_medicaux.documents_patient_id,
        utilisateur_id: certificats_medicaux.utilisateur_id,
        suivi_id: certificats_medicaux.suivi_id,
        type_certificat: certificats_medicaux.type_certificat,
        date_emission: certificats_medicaux.date_emission,
        date_debut: certificats_medicaux.date_debut,
        date_fin: certificats_medicaux.date_fin,
        diagnostic: certificats_medicaux.diagnostic,
        destinataire: certificats_medicaux.destinataire,
        notes: certificats_medicaux.notes,
        statut: certificats_medicaux.statut,
        date_creation: certificats_medicaux.date_creation,
        date_modification: certificats_medicaux.date_modification,
      })
      .from(certificats_medicaux)
      .innerJoin(
        documents_patient,
        eq(certificats_medicaux.documents_patient_id, documents_patient.id),
      )
      .where(
        and(
          eq(documents_patient.patient_id, patientId),
          eq(certificats_medicaux.statut, "emis"),
        ),
      )
      .orderBy(desc(certificats_medicaux.date_creation));
  }

  async getPatientById(database: DatabaseClient, id: string): Promise<{ id: string } | null> {
    const [item] = await database
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);

    return item ?? null;
  }

  async getSuiviById(database: DatabaseClient, id: string): Promise<{ id: string } | null> {
    const [item] = await database
      .select({ id: suivi.id })
      .from(suivi)
      .where(eq(suivi.id, id))
      .limit(1);

    return item ?? null;
  }
}

export const documentsRepository = new DocumentsRepository();
