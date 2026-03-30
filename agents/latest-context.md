# Contexte technique — Migration de la base de données des médicaments

## Objectif

Le système backend a évolué d’un modèle simple contenant une **table `medicaments` dans la base principale** vers une **architecture avec une base de données médicale dédiée aux médicaments**.

L’objectif de cette migration est :

- améliorer la structuration des données médicales
- permettre la gestion des interactions médicamenteuses
- stocker des informations pharmaceutiques détaillées
- séparer les données métier de l’application des données médicales

Cette évolution permet également d’étendre facilement le système vers des fonctionnalités médicales plus avancées.

---

# Architecture globale

Le système utilise maintenant **deux bases de données séparées**.

## 1️⃣ Base de données principale (Application)

Contient les données métier de l’application :

- utilisateurs
- patients
- rendez_vous
- suivi
- ordonnances
- documents
- historique des traitements
- modèles d’ordonnances

Cette base **ne contient plus la table `medicaments`**.

---

## 2️⃣ Base de données médicale (Médicaments)

Base dédiée contenant les informations pharmaceutiques.

Tables principales :

- medicaments
- substances_actives
- indications
- contre_indications
- interactions
- effets_indesirables
- precautions
- presentations

Ces tables permettent de stocker toutes les informations liées aux médicaments.

---

# Communication entre les bases

Les deux bases **ne sont pas reliées par des clés étrangères SQL**.

La communication se fait uniquement via le backend de l’application.

Dans la base principale, les médicaments sont référencés avec :

medicament_externe_id

Cet identifiant correspond à l’identifiant du médicament dans la base médicale.

---

# Changements dans la base principale

## Suppression de la table

La table suivante a été supprimée de la base principale :

medicaments

Toutes les relations SQL vers cette table ont été supprimées.

---

# Nouvelles références aux médicaments

Les médicaments sont maintenant référencés via :

medicament_externe_id

Ce champ est utilisé pour identifier un médicament présent dans la base médicale.

---

# Tables modifiées

## pre_rempli_medicaments

Avant :

medicament_ID int fk

Après :

medicament_externe_id string  
nom_medicament string

Le nom du médicament est stocké pour garder une copie du médicament utilisé dans le modèle d’ordonnance.

---

## ordonnance_medicaments

Avant :

medicament_ID int fk

Après :

medicament_externe_id string  
nom_medicament string  
DCI string  
dosage string  

Ces champs permettent de conserver un **snapshot du médicament prescrit**.

Cela garantit que les ordonnances restent identiques même si la base médicale évolue.

---

## historique_traitements

Avant :

medicament_ID int fk

Après :

medicament_externe_id string  
nom_medicament string

---

# Relations restantes dans la base principale

## Relations utilisateurs

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
utilisateurs.ID < journal_emails.utilisateur_id  
utilisateurs.ID < pre_rempli_ordonnance.created_by_user  

---

## Relations patients

patients.ID - patients_femmes.patient_ID  
patients.ID < voyages_recents.patient_ID  
patients.ID < rendez_vous.patient_ID  
patients.ID < historique_traitements.patient_ID  
patients.ID < antecedents.patient_ID  
patients.ID < vaccinations_patient.patient_ID  
patients.ID < documents_patient.patient_ID  
patients.ID < suivi.patient_ID  
patients.ID < ordonnance.patient_ID  
patients.ID < journal_emails.patient_id  

---

## Relations suivi médical

suivi.ID < rendez_vous.suivi_ID  
suivi.ID < examen_consultation.suivi_ID  
suivi.ID < lettres_orientation.suivi_ID  
suivi.ID < certificats_medicaux.suivi_ID  

---

## Relations rendez-vous

rendez_vous.ID < examen_consultation.rendez_vous_ID  
rendez_vous.ID < ordonnance.rendez_vous_ID  

---

## Relations ordonnances

ordonnance.ID < ordonnance_medicaments.ordonnance_ID  
ordonnance.pre_rempli_origine_ID < pre_rempli_ordonnance.ID  

---

## Relations modèles d’ordonnances

categories_pre_rempli.ID < pre_rempli_ordonnance.categorie_pre_rempli_ID  
pre_rempli_ordonnance.ID < pre_rempli_medicaments.pre_rempli_ID  

---

## Relations antécédents

antecedents.ID < antecedents_personnels.antecedent_ID  
antecedents.ID < antecedents_familiaux.antecedent_ID  

---

## Relations documents

categories_documents.ID < documents_patient.categorie_ID  
documents_patient.ID - lettres_orientation.documents_patient_ID  
documents_patient.ID - certificats_medicaux.documents_patient_ID  

---

# Workflow de prescription

1. Le médecin recherche un médicament via le backend.

2. Le backend interroge la base de données médicale.

3. Le médecin sélectionne un médicament.

4. Les informations du médicament sont enregistrées dans :

ordonnance_medicaments

Les champs enregistrés sont :

medicament_externe_id  
nom_medicament  
DCI  
dosage  
posologie  
duree_traitement  

Cela permet de conserver une copie exacte du médicament prescrit.

---

# Avantages de cette architecture

- séparation claire entre données médicales et données applicatives
- meilleure organisation des informations pharmaceutiques
- possibilité d’ajouter facilement de nouvelles informations médicales
- conservation fiable de l’historique des prescriptions
- préparation du système pour des fonctionnalités avancées comme :

  - détection d’interactions médicamenteuses
  - vérification des contre-indications
  - aide à la prescription
  