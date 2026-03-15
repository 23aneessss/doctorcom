notation crows-foot
title Diagramme de la Base de Données

// Authentification Utilisateur
utilisateurs [icon: user, color: blue] {
  ID int pk
  nom string
  prenom string
  email string
  adresse string
  telephone string
  mot_de_passe_hash string
  date_creation date
  role string  // 'medecin', 'secretaire', 'admin'
}

sessions [icon: key, color: blue] {
  ID int pk
  utilisateur_ID int fk
  jeton string
  date_connexion datetime
  date_expiration datetime
  est_actif boolean
  nom_appareil string
}

logs [icon: activity, color: gray] {
  ID int pk
  utilisateur_ID int fk
  action string
  horodatage datetime
}

// Patients

patients [icon: heart, color: red] {
  ID int pk
  nom string
  prenom string
  telephone string
  email string
  matricule string
  date_naissance date
  NSS int
  lieu_naissance string
  sexe string
  nationalite string
  groupe_sanguin string
  adresse string
  profession string
  habitudes_saines string
  habitudes_toxiques string
  nb_enfants int
  situation_familiale string
  age_circoncision int
  date_admission date
  environnement_animal string
  revenu_mensuel decimal
  taille_menage int
  nb_pieces int
  niveau_intellectuel string
  activite_sexuelle boolean
  relations_environnement string
  cree_par_utilisateur int fk
}

patients_femmes [icon: user, color: purple] {
  ID int pk
  patient_ID int fk
  menarche int
  regularite_cycles string
  contraception string
  nb_grossesses int
  nb_cesariennes int
  menopause boolean
  age_menopause int
  symptomes_menopause string
}

voyages_recents [icon: map-pin, color: orange] {
  ID int pk
  patient_ID int fk
  destination string
  date date
  duree_jours int
  epidemies_destination string
}

// Antécédents Médicaux

antecedents [icon: archive, color: orange] {
  ID int pk
  patient_ID int fk
  type string  // 'personnel', 'familial'
  description string
}

antecedents_personnels [icon: user-check, color: orange] {
  ID int pk
  antecedent_ID int fk
  type string
  details string
  est_actif boolean
}

antecedents_familiaux [icon: users, color: orange] {
  ID int pk
  antecedent_ID int fk
  details string
  lien_parente string  // 'pere', 'mere', 'frere', 'soeur', etc.
}

// Rendez-vous et Suivi

rendez_vous [icon: calendar, color: green] {
  ID int pk
  patient_ID int fk
  suivi_ID int fk  // nullable en implementation
  utilisateur_ID int fk
  date date
  heure string
  statut string
  important boolean
  frequence_rappel string
  periode_rappel string
    // 'planifie', 'confirme', 'termine', 'annule', 'non_present'
}

suivi [icon: clipboard, color: green] {
  ID int pk
  patient_ID int fk
  utilisateur_ID int fk
  hypothese_diagnostic string
  motif string
  historique text
  date_ouverture date
  date_fermeture date
  est_actif boolean
}

examen_consultation [icon: thermometer, color: green] {
  ID int pk
  rendez_vous_ID int fk
  suivi_ID int fk
  date date
  taille decimal
  poids decimal
  traitement_prescrit text
  description_consultation text
  aspect_general string
  examen_respiratoire string
  examen_cardiovasculaire string
  examen_cutane_muqueux string
  examen_ORL string
  examen_digestif string
  examen_neurologique string
  examen_locomoteur string
  examen_genital string
  examen_urinaire string
  examen_ganglionnaire string
  examen_endocrinien string
  conclusion string
}

// Traitements et Prescriptions
// La base principale ne contient plus la table `medicaments`.
// Les médicaments sont maintenant référencés via `medicament_externe_id`
// vers une base PostgreSQL externe dédiée.

categories_pre_rempli [icon: folder, color: purple] {
  ID int pk
  nom string
  description string
}

pre_rempli_ordonnance [icon: file-text, color: yellow] {
  ID int pk
  nom string
  description string
  specialite string
  categorie_pre_rempli_ID int fk
  est_actif boolean
  created_at datetime
  updated_at datetime
  created_by_user int fk
}

pre_rempli_medicaments [icon: list, color: yellow] {
  ID int pk
  pre_rempli_ID int fk
  medicament_externe_id string
  nom_medicament string
  dosage string
  posologie_defaut string
  duree_defaut string
  instructions_defaut string
  ordre_affichage int
  est_optionnel boolean
}

historique_traitements [icon: clock, color: yellow] {
  ID int pk
  patient_ID int fk
  medicament_externe_id string
  nom_medicament string
  dosage string
  posologie string
  est_actif boolean
  date_prescription date
  prescrit_par_utilisateur int fk
  ordonnance_ID int fk
  ordonnance_medicament_ID int fk
  source_type string // 'manuel' | 'ordonnance'
}

ordonnance [icon: file-text, color: yellow] {
  ID int pk
  rendez_vous_ID int fk
  patient_ID int fk
  utilisateur_ID int fk
  pre_rempli_origine_ID int fk
  remarques string
  date_prescription date
}

ordonnance_medicaments [icon: list, color: yellow] {
  ID int pk
  ordonnance_ID int fk
  medicament_externe_id string
  nom_medicament string
  DCI string
  dosage string
  posologie string
  duree_traitement string
  instructions string
}

// Vaccinations

vaccinations_patient [icon: check-circle, color: purple] {
  ID int pk
  patient_ID int fk
  vaccin string
  date_vaccination date
  notes string
}

// Catégories de Documents

categories_documents [icon: folder, color: purple] {
  ID int pk
  nom string
  description string
}

// Documents Patients (Table de Base)

documents_patient [icon: folder, color: gray] {
  ID int pk
  patient_ID int fk
  categorie_ID int fk
  type_document string  // 'certificat', 'ordonnance', 'lettre', 'examen', etc.
  nom_document string
  chemin_fichier string
  type_fichier string  // 'pdf', 'jpg', 'png', etc.
  taille_fichier int
  description string
  date_upload datetime
  uploade_par_utilisateur int fk
  est_archive boolean
}

// Lettres et Certificats (Héritent de documents_patient)

lettres_orientation [icon: send, color: gray] {
  ID int pk
  documents_patient_ID int fk  // Héritage de documents_patient
  utilisateur_ID int fk
  suivi_ID int fk
  type_exploration string
  examen_demande string
  raison text
  destinataire string
  urgence string  // 'normale', 'urgente', 'tres_urgente'
  contenu_lettre text
  date_creation datetime
  date_modification datetime
}

certificats_medicaux [icon: award, color: gray] {
  ID int pk
  documents_patient_ID int fk  // Héritage de documents_patient
  utilisateur_ID int fk
  suivi_ID int fk
  type_certificat string  // 'arret_travail', 'aptitude', 'scolaire', 'grossesse', 'deces'
  date_emission date
  date_debut date
  date_fin date
  diagnostic text
  destinataire string
  notes text
  statut string  // 'brouillon', 'emis', 'annule'
  date_creation datetime
  date_modification datetime
}

// Relations

// Relations Utilisateur
utilisateurs.ID < sessions.utilisateur_ID
utilisateurs.ID < logs.utilisateur_ID
utilisateurs.ID < patients.cree_par_utilisateur
utilisateurs.ID < rendez_vous.utilisateur_ID
utilisateurs.ID < suivi.utilisateur_ID
utilisateurs.ID < historique_traitements.prescrit_par_utilisateur
utilisateurs.ID < ordonnance.utilisateur_ID
utilisateurs.ID < lettres_orientation.utilisateur_ID
utilisateurs.ID < certificats_medicaux.utilisateur_ID
utilisateurs.ID < documents_patient.uploade_par_utilisateur

// Relations Patient
patients.ID - patients_femmes.patient_ID
patients.ID < voyages_recents.patient_ID
patients.ID < rendez_vous.patient_ID
patients.ID < historique_traitements.patient_ID
patients.ID < antecedents.patient_ID
patients.ID < vaccinations_patient.patient_ID
patients.ID < documents_patient.patient_ID
patients.ID < suivi.patient_ID
patients.ID < ordonnance.patient_ID

// Relations Suivi
suivi.ID < rendez_vous.suivi_ID
suivi.ID < examen_consultation.suivi_ID
suivi.ID < lettres_orientation.suivi_ID
suivi.ID < certificats_medicaux.suivi_ID

// Relations Rendez-vous
rendez_vous.ID < examen_consultation.rendez_vous_ID
rendez_vous.ID < ordonnance.rendez_vous_ID

// Relations Ordonnance
ordonnance.ID < ordonnance_medicaments.ordonnance_ID
ordonnance.ID < historique_traitements.ordonnance_ID
ordonnance_medicaments.ID < historique_traitements.ordonnance_medicament_ID
categories_pre_rempli.ID < pre_rempli_ordonnance.categorie_pre_rempli_ID
pre_rempli_ordonnance.ID < pre_rempli_medicaments.pre_rempli_ID
pre_rempli_ordonnance.ID < ordonnance.pre_rempli_origine_ID

// Relations Antécédents
antecedents.ID < antecedents_personnels.antecedent_ID
antecedents.ID < antecedents_familiaux.antecedent_ID

// Relations Catégories Documents
categories_documents.ID < documents_patient.categorie_ID

// Héritage Documents (liaison avec la table de base)
documents_patient.ID - lettres_orientation.documents_patient_ID
documents_patient.ID - certificats_medicaux.documents_patient_ID
