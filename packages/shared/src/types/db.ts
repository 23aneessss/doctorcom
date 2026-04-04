import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import {
  antecedents,
  antecedents_familiaux,
  antecedents_personnels,
  categories_documents,
  certificats_medicaux,
  documents_patient,
  examen_consultation,
  historique_traitements,
  lettres_orientation,
  logs,
  ordonnance,
  ordonnance_medicaments,
  patients,
  patients_femmes,
  rendez_vous,
  sessions,
  suivi,
  utilisateurs,
  vaccinations_patient,
  voyages_recents,
} from "@doctor.com/db/schema";

export type Utilisateur = InferSelectModel<typeof utilisateurs>;
export type NewUtilisateur = InferInsertModel<typeof utilisateurs>;
export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
export type Log = InferSelectModel<typeof logs>;
export type NewLog = InferInsertModel<typeof logs>;
export type Patient = InferSelectModel<typeof patients>;
export type NewPatient = InferInsertModel<typeof patients>;
export type PatientFemme = InferSelectModel<typeof patients_femmes>;
export type NewPatientFemme = InferInsertModel<typeof patients_femmes>;
export type VoyageRecent = InferSelectModel<typeof voyages_recents>;
export type NewVoyageRecent = InferInsertModel<typeof voyages_recents>;
export type Antecedent = InferSelectModel<typeof antecedents>;
export type NewAntecedent = InferInsertModel<typeof antecedents>;
export type AntecedentPersonnel = InferSelectModel<typeof antecedents_personnels>;
export type NewAntecedentPersonnel = InferInsertModel<typeof antecedents_personnels>;
export type AntecedentFamilial = InferSelectModel<typeof antecedents_familiaux>;
export type NewAntecedentFamilial = InferInsertModel<typeof antecedents_familiaux>;
export type Suivi = InferSelectModel<typeof suivi>;
export type NewSuivi = InferInsertModel<typeof suivi>;
export type RendezVous = InferSelectModel<typeof rendez_vous>;
export type NewRendezVous = InferInsertModel<typeof rendez_vous>;
export type ExamenConsultation = InferSelectModel<typeof examen_consultation>;
export type NewExamenConsultation = InferInsertModel<typeof examen_consultation>;
export type HistoriqueTraitement = InferSelectModel<typeof historique_traitements>;
export type NewHistoriqueTraitement = InferInsertModel<typeof historique_traitements>;
export type Ordonnance = InferSelectModel<typeof ordonnance>;
export type NewOrdonnance = InferInsertModel<typeof ordonnance>;
export type OrdonnanceMedicament = InferSelectModel<typeof ordonnance_medicaments>;
export type NewOrdonnanceMedicament = InferInsertModel<typeof ordonnance_medicaments>;
export type VaccinationPatient = InferSelectModel<typeof vaccinations_patient>;
export type NewVaccinationPatient = InferInsertModel<typeof vaccinations_patient>;
export type CategorieDocument = InferSelectModel<typeof categories_documents>;
export type NewCategorieDocument = InferInsertModel<typeof categories_documents>;
export type DocumentPatient = InferSelectModel<typeof documents_patient>;
export type NewDocumentPatient = InferInsertModel<typeof documents_patient>;
export type LettreOrientation = InferSelectModel<typeof lettres_orientation>;
export type NewLettreOrientation = InferInsertModel<typeof lettres_orientation>;
export type CertificatMedical = InferSelectModel<typeof certificats_medicaux>;
export type NewCertificatMedical = InferInsertModel<typeof certificats_medicaux>;
