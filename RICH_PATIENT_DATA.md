# Rich Patient Data Snapshot

This file documents the exact seeded dataset from `seed-rich-patient.ts` for manual QA.

## Seed Context

- Seed script: `seed-rich-patient.ts`
- Patient route: `http://localhost:3001/patients/b0000000-0000-4000-a000-000000000001`
- Static patient ID: `b0000000-0000-4000-a000-000000000001`
- Runtime-resolved IDs:
  - `UTILISATEUR_ID`: resolved from `utilisateurs` by email `tbib@doctorcom.com`
  - `CAT_LAB`, `CAT_IMAGING`, `CAT_COURRIER`: resolved by category names in `categories_documents`

## Patient (All Core Fields)

- `id`: `b0000000-0000-4000-a000-000000000001`
- `nom`: `Amara`
- `prenom`: `Walid`
- `telephone`: `0551234567`
- `email`: `walid.amara@mail.dz`
- `matricule`: `AW-2025-001`
- `date_naissance`: `1992-06-15`
- `nss`: `192061501`
- `lieu_naissance`: `Alger`
- `sexe`: `masculin`
- `nationalite`: `Algérienne`
- `groupe_sanguin`: `O+`
- `adresse`: `12 Rue Didouche Mourad, Alger Centre`
- `profession`: `Médecin généraliste`
- `habitudes_saines`: `Course à pied 3x/semaine, alimentation méditerranéenne, 7h de sommeil`
- `habitudes_toxiques`: `Ex-fumeur (arrêt Janvier 2024), café 2 tasses/jour`
- `nb_enfants`: `1`
- `situation_familiale`: `Marié`
- `age_circoncision`: `7`
- `date_admission`: `2025-01-10`
- `environnement_animal`: `Chien Labrador, intérieur`
- `revenu_mensuel`: `180000`
- `taille_menage`: `3`
- `nb_pieces`: `5`
- `niveau_intellectuel`: `Universitaire (Doctorat)`
- `activite_sexuelle`: `true`
- `relations_environnement`: `Quartier calme, bons rapports avec les voisins`
- `cree_par_utilisateur`: `UTILISATEUR_ID (runtime)`

## Doctor Utilisateur

- Lookup key: email `tbib@doctorcom.com`
- If found: reuse existing `utilisateurs.id`
- If missing: create with
  - `nom`: `Benmoussa`
  - `prenom`: `Karim`
  - `email`: `tbib@doctorcom.com`
  - `adresse`: `12 Rue Didouche Mourad, Alger`
  - `telephone`: `0555123456`
  - `date_creation`: `2024-01-15`
  - `role`: `medecin`

## Document Categories

- `Analyses de laboratoire` -> `CAT_LAB` (runtime)
- `Imagerie médicale` -> `CAT_IMAGING` (runtime)
- `Courrier médical` -> `CAT_COURRIER` (runtime)

## Voyages Recents (3)

1. `France (Paris)` - date `2025-08-10` - `12` jours - epidemies: `Aucune épidémie signalée`
2. `Maroc (Marrakech)` - date `2024-12-20` - `7` jours - epidemies: `Grippe saisonnière en circulation`
3. `Turquie (Istanbul)` - date `2024-06-05` - `10` jours - epidemies: `null`

## Antecedents (5)

- `ANT_1` `b6000000-0000-4000-a000-000000000001` - personnel - `Asthme allergique depuis l'enfance`
- `ANT_2` `b6000000-0000-4000-a000-000000000002` - personnel - `Appendicectomie en 2010`
- `ANT_3` `b6000000-0000-4000-a000-000000000003` - personnel - `Hypertension artérielle diagnostiquée en 2023`
- `ANT_4` `b6000000-0000-4000-a000-000000000004` - familial - `Père: diabète de type 2, dyslipidémie`
- `ANT_5` `b6000000-0000-4000-a000-000000000005` - familial - `Mère: hypothyroïdie, polyarthrite rhumatoïde`

### Antecedents Personnels

- `ANT_1` - type `Respiratoire` - actif `true`
- `ANT_2` - type `Chirurgical` - actif `false`
- `ANT_3` - type `Cardiovasculaire` - actif `true`

### Antecedents Familiaux

- `ANT_4` - parente `Père`
- `ANT_5` - parente `Mère`

## Suivis (3 actifs)

- `SUIVI_1` `b1000000-0000-4000-a000-000000000001`
  - motif: `Suivi asthme et rhinite allergique`
  - date_ouverture: `2025-01-15`
- `SUIVI_2` `b1000000-0000-4000-a000-000000000002`
  - motif: `Suivi hypertension artérielle`
  - date_ouverture: `2025-02-01`
- `SUIVI_3` `b1000000-0000-4000-a000-000000000003`
  - motif: `Lombalgies récurrentes`
  - date_ouverture: `2025-03-10`

## Rendez-vous (5)

- `RDV_1` `b2000000-0000-4000-a000-000000000001` - `2025-01-20` `09:00` - statut `termine`
- `RDV_2` `b2000000-0000-4000-a000-000000000002` - `2025-02-05` `10:30` - statut `termine`
- `RDV_3` `b2000000-0000-4000-a000-000000000003` - `2025-04-15` `14:00` - statut `termine`
- `RDV_4` `b2000000-0000-4000-a000-000000000004` - date dynamique (`today + 15j`) `11:00` - statut `confirme`
- `RDV_5` `b2000000-0000-4000-a000-000000000005` - date dynamique (`today + 45j`) `09:30` - statut `planifie`

## Examens Consultation (3)

- `EXAM_1` `b3000000-0000-4000-a000-000000000001` (RDV_1)
  - TA `125/80`, FC `72`, Temp `36.8`, SpO2 `98`, poids `74`, taille `178`, IMC `23.4`
- `EXAM_2` `b3000000-0000-4000-a000-000000000002` (RDV_2)
  - TA `130/85`, FC `76`, Temp `36.7`, SpO2 `97`, poids `75`, taille `178`, IMC `23.7`
- `EXAM_3` `b3000000-0000-4000-a000-000000000003` (RDV_3)
  - TA `120/78`, FC `70`, Temp `36.6`, SpO2 `99`, poids `73`, taille `178`, IMC `23.0`

## Ordonnances (3)

- `ORD_1` `b4000000-0000-4000-a000-000000000001` - date `2025-01-20`
- `ORD_2` `b4000000-0000-4000-a000-000000000002` - date `2025-02-05`
- `ORD_3` `b4000000-0000-4000-a000-000000000003` - date `2025-04-15`

### Ordonnance Medicaments (6)

- `OM_1` Ventoline 100mcg
- `OM_2` Desloratadine 5mg
- `OM_3` Amlodipine 5mg
- `OM_4` Ventoline 100mcg
- `OM_5` Flixotide 250mcg
- `OM_6` Amlodipine 5mg

## Historique Traitements (3)

- Ventoline (`EXT-VENT-001`) actif `true`
- Amlodipine (`EXT-AMLO-001`) actif `true`
- Flixotide (`EXT-FLIX-001`) actif `true`

## Vaccinations (4)

- Grippe saisonnière 2024-2025 - `2024-10-15`
- COVID-19 (rappel bivalent) - `2024-05-10`
- Hépatite B (rappel) - `2023-09-20`
- Tétanos-Diphtérie (Td) - `2022-11-05`

## Documents (3)

- `DOC_1` `b7000000-0000-4000-a000-000000000001`
  - categorie: `CAT_LAB`
  - type: `Analyse sanguine`
  - fichier: `Bilan_sanguin_Amara_2025-02.pdf`
- `DOC_2` `b7000000-0000-4000-a000-000000000002`
  - categorie: `CAT_IMAGING`
  - type: `Radiographie`
  - fichier: `Radio_thorax_Amara_2025-01.pdf`
- `DOC_3` `b7000000-0000-4000-a000-000000000003`
  - categorie: `CAT_COURRIER`
  - type: `Certificat médical`
  - fichier: `Certificat_medical_Amara_2025-04.pdf`
