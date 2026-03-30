import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

// Use any to avoid complex generic type issues with full schema
type DB = NodePgDatabase<any>;

import {
  antecedents,
  antecedents_familiaux,
  antecedents_personnels,
  certificats_medicaux,
  documents_patient,
  historique_traitements,
  lettres_orientation,
  ordonnance,
  ordonnance_medicaments,
  patients,
  patients_femmes,
  rendez_vous,
  utilisateurs,
  vaccinations_patient,
} from "@doctor.com/db/schema";

export class ExportRepository {
  async findUtilisateurByEmail(db: DB, email: string) {
    return db
      .select({
        id: utilisateurs.id,
        nom: utilisateurs.nom,
        prenom: utilisateurs.prenom,
        adresse: utilisateurs.adresse,
        telephone: utilisateurs.telephone,
        email: utilisateurs.email,
      })
      .from(utilisateurs)
      .where(eq(utilisateurs.email, email))
      .then((rows) => rows[0] ?? null);
  }

  async getOrdonnanceForExport(db: DB, id: string) {
    const ord = await db
      .select()
      .from(ordonnance)
      .where(eq(ordonnance.id, id))
      .then((rows) => rows[0]);

    if (!ord) return null;

    const medicamentsData = await db
      .select({
        id: ordonnance_medicaments.id,
        dci: ordonnance_medicaments.dci,
        posologie: ordonnance_medicaments.posologie,
        duree_traitement: ordonnance_medicaments.duree_traitement,
        instructions: ordonnance_medicaments.instructions,
      })
      .from(ordonnance_medicaments)
      .where(eq(ordonnance_medicaments.ordonnance_id, id));

    const patientData = await db
      .select({
        nom: patients.nom,
        prenom: patients.prenom,
        date_naissance: patients.date_naissance,
        matricule: patients.matricule,
      })
      .from(patients)
      .where(eq(patients.id, ord.patient_id))
      .then((rows) => rows[0]);

    const utilisateurData = await db
      .select({
        nom: utilisateurs.nom,
        prenom: utilisateurs.prenom,
        adresse: utilisateurs.adresse,
        telephone: utilisateurs.telephone,
      })
      .from(utilisateurs)
      .where(eq(utilisateurs.id, ord.utilisateur_id))
      .then((rows) => rows[0]);

    return {
      ordonnance: ord,
      medicaments: medicamentsData,
      patient: patientData,
      utilisateur: utilisateurData,
    };
  }

  async getCertificatForExport(db: DB, id: string) {
    const cert = await db
      .select()
      .from(certificats_medicaux)
      .where(eq(certificats_medicaux.id, id))
      .then((rows) => rows[0]);

    if (!cert) return null;

    const docWithPatient = await db
      .select()
      .from(documents_patient)
      .where(eq(documents_patient.id, cert.documents_patient_id))
      .then((rows) => rows[0]);

    if (!docWithPatient) return null;

    const patientData = await db
      .select({
        nom: patients.nom,
        prenom: patients.prenom,
        date_naissance: patients.date_naissance,
        matricule: patients.matricule,
      })
      .from(patients)
      .where(eq(patients.id, docWithPatient.patient_id))
      .then((rows) => rows[0]);

    const utilisateurData = await db
      .select({
        nom: utilisateurs.nom,
        prenom: utilisateurs.prenom,
        adresse: utilisateurs.adresse,
        telephone: utilisateurs.telephone,
      })
      .from(utilisateurs)
      .where(eq(utilisateurs.id, cert.utilisateur_id))
      .then((rows) => rows[0]);

    return {
      certificat: cert,
      document: { nom_document: docWithPatient.nom_document },
      patient: patientData,
      utilisateur: utilisateurData,
    };
  }

  async getLettreForExport(db: DB, id: string) {
    const lettre = await db
      .select()
      .from(lettres_orientation)
      .where(eq(lettres_orientation.id, id))
      .then((rows) => rows[0]);

    if (!lettre) return null;

    const doc = await db
      .select()
      .from(documents_patient)
      .where(eq(documents_patient.id, lettre.documents_patient_id))
      .then((rows) => rows[0]);

    if (!doc) return null;

    const patientData = await db
      .select({
        nom: patients.nom,
        prenom: patients.prenom,
        date_naissance: patients.date_naissance,
        matricule: patients.matricule,
      })
      .from(patients)
      .where(eq(patients.id, doc.patient_id))
      .then((rows) => rows[0]);

    const utilisateurData = await db
      .select({
        nom: utilisateurs.nom,
        prenom: utilisateurs.prenom,
        adresse: utilisateurs.adresse,
        telephone: utilisateurs.telephone,
      })
      .from(utilisateurs)
      .where(eq(utilisateurs.id, lettre.utilisateur_id))
      .then((rows) => rows[0]);

    return {
      lettre,
      document: doc,
      patient: patientData,
      utilisateur: utilisateurData,
    };
  }

  async getDossierPatientForExport(db: DB, patientId: string) {
    const patient = await db
      .select()
      .from(patients)
      .where(eq(patients.id, patientId))
      .then((rows) => rows[0]);

    if (!patient) return null;

    const patientFemme = await db
      .select()
      .from(patients_femmes)
      .where(eq(patients_femmes.patient_id, patientId))
      .then((rows) => rows[0]);

    const antecedentsPersonnels = await db
      .select({
        type: antecedents_personnels.type,
        details: antecedents_personnels.details,
      })
      .from(antecedents_personnels)
      .innerJoin(
        antecedents,
        eq(antecedents_personnels.antecedent_id, antecedents.id),
      )
      .where(eq(antecedents.patient_id, patientId));

    const antecedentsFamiliaux = await db
      .select({
        details: antecedents_familiaux.details,
        lien_parente: antecedents_familiaux.lien_parente,
      })
      .from(antecedents_familiaux)
      .innerJoin(
        antecedents,
        eq(antecedents_familiaux.antecedent_id, antecedents.id),
      )
      .where(eq(antecedents.patient_id, patientId));

    const vaccinations = await db
      .select()
      .from(vaccinations_patient)
      .where(eq(vaccinations_patient.patient_id, patientId));

    const historiqueTraitements = await db
      .select({
        id: historique_traitements.id,
        dci: historique_traitements.nom_medicament,
        posologie: historique_traitements.posologie,
        date_prescription: historique_traitements.date_prescription,
      })
      .from(historique_traitements)
      .where(
        and(
          eq(historique_traitements.patient_id, patientId),
          eq(historique_traitements.est_actif, true),
        ),
      );

    const dernierOrdonnances = await db
      .select()
      .from(ordonnance)
      .where(eq(ordonnance.patient_id, patientId))
      .orderBy(desc(ordonnance.date_prescription))
      .limit(5);

    const dernierRendezVous = await db
      .select()
      .from(rendez_vous)
      .where(eq(rendez_vous.patient_id, patientId))
      .orderBy(desc(rendez_vous.date))
      .limit(5);

    return {
      patient,
      patientFemme,
      antecedentsPersonnels,
      antecedentsFamiliaux,
      vaccinations,
      historiqueTraitements,
      dernierOrdonnances,
      dernierRendezVous,
    };
  }

  async getAgendaForExport(
    db: DB,
    utilisateurId: string,
    date: string,
  ) {
    const rendezVousData = await db
      .select({
        heure: rendez_vous.heure,
        statut: rendez_vous.statut,
        important: rendez_vous.important,
        prenom: patients.prenom,
        nom: patients.nom,
      })
      .from(rendez_vous)
      .innerJoin(patients, eq(rendez_vous.patient_id, patients.id))
      .where(
        and(
          eq(rendez_vous.utilisateur_id, utilisateurId),
          eq(rendez_vous.date, date),
        ),
      )
      .orderBy(rendez_vous.heure);

    const utilisateurData = await db
      .select({
        nom: utilisateurs.nom,
        prenom: utilisateurs.prenom,
        adresse: utilisateurs.adresse,
        telephone: utilisateurs.telephone,
      })
      .from(utilisateurs)
      .where(eq(utilisateurs.id, utilisateurId))
      .then((rows) => rows[0]);

    return {
      rendezVous: rendezVousData,
      utilisateur: utilisateurData,
    };
  }

  async getUtilisateurById(db: DB, id: string) {
    return db
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.id, id))
      .then((rows) => rows[0] || null);
  }
}

export const exportRepository = new ExportRepository();
