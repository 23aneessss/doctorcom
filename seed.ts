/**
 * Database seed script for doctor.com
 *
 * Populates all domain tables with realistic test data.
 * Does NOT touch Better-Auth tables (user, session, account, verification).
 *
 * Usage: bun seed.ts
 */

import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

import {
  utilisateurs,
  sessions,
  logs,
  patients,
  patients_femmes,
  voyages_recents,
  antecedents,
  antecedents_personnels,
  antecedents_familiaux,
  suivi,
  rendez_vous,
  examen_consultation,
  medicaments,
  historique_traitements,
  ordonnance,
  ordonnance_medicaments,
  vaccinations_patient,
  categories_documents,
  documents_patient,
  lettres_orientation,
  certificats_medicaux,
} from "./packages/db/src/schema";

// ---------------------------------------------------------------------------
// Load env
// ---------------------------------------------------------------------------
dotenv.config({ path: "./apps/server/.env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required. Check apps/server/.env");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const db = drizzle({ client: pool });

// ---------------------------------------------------------------------------
// Hardcoded UUIDs for deterministic FK cross-references
// ---------------------------------------------------------------------------

// Utilisateur (the doctor)
const UTILISATEUR_ID = "9c9b18f8-e89a-4b32-b387-e39f96d0f9e8";

// Patients
const PATIENT_1 = "a0000000-0000-4000-a000-000000000001"; // M
const PATIENT_2 = "a0000000-0000-4000-a000-000000000002"; // M
const PATIENT_3 = "a0000000-0000-4000-a000-000000000003"; // M
const PATIENT_4 = "a0000000-0000-4000-a000-000000000004"; // F
const PATIENT_5 = "a0000000-0000-4000-a000-000000000005"; // F

// Medicaments
const MED_1 = "b0000000-0000-4000-a000-000000000001";
const MED_2 = "b0000000-0000-4000-a000-000000000002";
const MED_3 = "b0000000-0000-4000-a000-000000000003";
const MED_4 = "b0000000-0000-4000-a000-000000000004";
const MED_5 = "b0000000-0000-4000-a000-000000000005";

// Categories documents
const CAT_1 = "c0000000-0000-4000-a000-000000000001";
const CAT_2 = "c0000000-0000-4000-a000-000000000002";
const CAT_3 = "c0000000-0000-4000-a000-000000000003";

// Antecedents
const ANT_1 = "d0000000-0000-4000-a000-000000000001"; // personnel
const ANT_2 = "d0000000-0000-4000-a000-000000000002"; // personnel
const ANT_3 = "d0000000-0000-4000-a000-000000000003"; // personnel
const ANT_4 = "d0000000-0000-4000-a000-000000000004"; // familial
const ANT_5 = "d0000000-0000-4000-a000-000000000005"; // familial
const ANT_6 = "d0000000-0000-4000-a000-000000000006"; // familial

// Suivi
const SUIVI_1 = "e0000000-0000-4000-a000-000000000001";
const SUIVI_2 = "e0000000-0000-4000-a000-000000000002";
const SUIVI_3 = "e0000000-0000-4000-a000-000000000003";
const SUIVI_4 = "e0000000-0000-4000-a000-000000000004";

// Rendez-vous
const RDV_1 = "f0000000-0000-4000-a000-000000000001";
const RDV_2 = "f0000000-0000-4000-a000-000000000002";
const RDV_3 = "f0000000-0000-4000-a000-000000000003";
const RDV_4 = "f0000000-0000-4000-a000-000000000004";
const RDV_5 = "f0000000-0000-4000-a000-000000000005";
const RDV_6 = "f0000000-0000-4000-a000-000000000006";

// Examens
const EXAM_1 = "10000000-0000-4000-a000-000000000001";
const EXAM_2 = "10000000-0000-4000-a000-000000000002";
const EXAM_3 = "10000000-0000-4000-a000-000000000003";
const EXAM_4 = "10000000-0000-4000-a000-000000000004";

// Ordonnances
const ORD_1 = "20000000-0000-4000-a000-000000000001";
const ORD_2 = "20000000-0000-4000-a000-000000000002";
const ORD_3 = "20000000-0000-4000-a000-000000000003";

// Documents patient
const DOC_1 = "30000000-0000-4000-a000-000000000001";
const DOC_2 = "30000000-0000-4000-a000-000000000002";
const DOC_3 = "30000000-0000-4000-a000-000000000003";

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------
async function seed() {
  console.log("Seeding database...\n");

  // =========================================================================
  // 1. Delete all domain data in reverse FK order
  // =========================================================================
  console.log("Clearing existing domain data...");

  await db.delete(certificats_medicaux);
  await db.delete(lettres_orientation);
  await db.delete(documents_patient);
  await db.delete(categories_documents);
  await db.delete(vaccinations_patient);
  await db.delete(ordonnance_medicaments);
  await db.delete(ordonnance);
  await db.delete(historique_traitements);
  await db.delete(examen_consultation);
  await db.delete(rendez_vous);
  await db.delete(suivi);
  await db.delete(antecedents_personnels);
  await db.delete(antecedents_familiaux);
  await db.delete(antecedents);
  await db.delete(voyages_recents);
  await db.delete(patients_femmes);
  await db.delete(patients);
  await db.delete(medicaments);
  await db.delete(logs);
  await db.delete(sessions);
  await db.delete(utilisateurs);

  console.log("Done clearing.\n");

  // =========================================================================
  // 2. Insert in FK order
  // =========================================================================

  // --- Utilisateurs (1 doctor) ---
  console.log("Inserting utilisateurs...");
  await db.insert(utilisateurs).values({
    id: UTILISATEUR_ID,
    nom: "Benmoussa",
    prenom: "Karim",
    email: "tbib@doctorcom.com",
    adresse: "12 Rue Didouche Mourad, Alger",
    telephone: "0555123456",
    mot_de_passe_hash:
      "6cd52985440601603e7843477cedb8fc:5dedf7d78117fce867a08ae7eea93ff0daf8dcd5e243c481662b5e3b92e604412643f2fb801b5723fab8c886fe485545c86b2498ddc90a59a829edb0d20729ce",
    date_creation: "2024-01-15",
    role: "medecin",
  });

  // --- Medicaments (5) ---
  console.log("Inserting medicaments...");
  await db.insert(medicaments).values([
    {
      id: MED_1,
      dci: "Amoxicilline",
      indication: "Infections bacteriennes ORL, respiratoires, urinaires",
      contre_indication: "Allergie aux penicillines",
      posologie_standard: "1g toutes les 8h pendant 7 jours",
      effets_indesirables: "Diarrhee, nausees, eruptions cutanees",
      dosage: "1g",
    },
    {
      id: MED_2,
      dci: "Metformine",
      indication: "Diabete de type 2",
      contre_indication: "Insuffisance renale severe, acidose metabolique",
      posologie_standard: "500mg 2 fois par jour au cours des repas",
      effets_indesirables: "Troubles digestifs, acidose lactique (rare)",
      dosage: "500mg",
    },
    {
      id: MED_3,
      dci: "Amlodipine",
      indication: "Hypertension arterielle, angor stable",
      contre_indication: "Choc cardiogenique, stenose aortique severe",
      posologie_standard: "5mg une fois par jour",
      effets_indesirables: "Oedemes des chevilles, cephalees, flush",
      dosage: "5mg",
    },
    {
      id: MED_4,
      dci: "Omeprazole",
      indication: "Reflux gastro-oesophagien, ulcere gastrique",
      contre_indication: "Hypersensibilite aux IPP",
      posologie_standard: "20mg une fois par jour avant le petit-dejeuner",
      effets_indesirables: "Cephalees, douleurs abdominales, diarrhee",
      dosage: "20mg",
    },
    {
      id: MED_5,
      dci: "Paracetamol",
      indication: "Douleurs, fievre",
      contre_indication: "Insuffisance hepatique severe",
      posologie_standard: "1g toutes les 6h, max 4g par jour",
      effets_indesirables: "Hepatotoxicite en cas de surdosage",
      dosage: "1g",
    },
  ]);

  // --- Categories documents (3) ---
  console.log("Inserting categories_documents...");
  await db.insert(categories_documents).values([
    {
      id: CAT_1,
      nom: "Analyses de laboratoire",
      description: "Resultats d'analyses sanguines, urinaires et biochimiques",
    },
    {
      id: CAT_2,
      nom: "Imagerie medicale",
      description: "Radiographies, echographies, IRM, scanner",
    },
    {
      id: CAT_3,
      nom: "Courrier medical",
      description: "Lettres d'orientation, certificats medicaux, correspondance",
    },
  ]);

  // --- Patients (5: 3M, 2F) ---
  console.log("Inserting patients...");
  await db.insert(patients).values([
    {
      id: PATIENT_1,
      nom: "Boudiaf",
      prenom: "Mohamed",
      telephone: "0661234567",
      email: "m.boudiaf@mail.dz",
      matricule: "PAT-2024-001",
      date_naissance: "1985-03-12",
      nss: 185031234,
      lieu_naissance: "Alger",
      sexe: "masculin",
      nationalite: "Algerienne",
      groupe_sanguin: "A+",
      adresse: "45 Cite des Oliviers, Bab El Oued, Alger",
      profession: "Ingenieur informatique",
      habitudes_saines: "Marche quotidienne 30 min, alimentation equilibree",
      habitudes_toxiques: "Non-fumeur, consommation occasionnelle de cafe",
      nb_enfants: 2,
      situation_familiale: "Marie",
      age_circoncision: 5,
      date_admission: "2024-02-10",
      environnement_animal: "Chat domestique",
      revenu_mensuel: "120000",
      taille_menage: 4,
      nb_pieces: 4,
      niveau_intellectuel: "Universitaire",
      activite_sexuelle: true,
      relations_environnement: "Bon voisinage, quartier calme",
      cree_par_utilisateur: UTILISATEUR_ID,
    },
    {
      id: PATIENT_2,
      nom: "Zeroual",
      prenom: "Youcef",
      telephone: "0770987654",
      email: "y.zeroual@mail.dz",
      matricule: "PAT-2024-002",
      date_naissance: "1972-08-25",
      nss: 172081234,
      lieu_naissance: "Oran",
      sexe: "masculin",
      nationalite: "Algerienne",
      groupe_sanguin: "O+",
      adresse: "8 Boulevard Hammou Boutlelis, Oran",
      profession: "Commercant",
      habitudes_saines: "Natation 2 fois par semaine",
      habitudes_toxiques: "Ancien fumeur (arret 2020), cafe 3 tasses/jour",
      nb_enfants: 4,
      situation_familiale: "Marie",
      age_circoncision: 7,
      date_admission: "2024-03-05",
      environnement_animal: null,
      revenu_mensuel: "85000",
      taille_menage: 6,
      nb_pieces: 5,
      niveau_intellectuel: "Secondaire",
      activite_sexuelle: true,
      relations_environnement: "Zone urbaine bruyante",
      cree_par_utilisateur: UTILISATEUR_ID,
    },
    {
      id: PATIENT_3,
      nom: "Hamidi",
      prenom: "Rachid",
      telephone: "0550456789",
      email: null,
      matricule: "PAT-2024-003",
      date_naissance: "1998-11-30",
      nss: 198111234,
      lieu_naissance: "Constantine",
      sexe: "masculin",
      nationalite: "Algerienne",
      groupe_sanguin: "B+",
      adresse: "22 Rue Abane Ramdane, Constantine",
      profession: "Etudiant en medecine",
      habitudes_saines: "Football 3 fois par semaine",
      habitudes_toxiques: "Non-fumeur",
      nb_enfants: 0,
      situation_familiale: "Celibataire",
      age_circoncision: 4,
      date_admission: "2024-06-20",
      environnement_animal: null,
      revenu_mensuel: null,
      taille_menage: 1,
      nb_pieces: 2,
      niveau_intellectuel: "Universitaire",
      activite_sexuelle: false,
      relations_environnement: "Cite universitaire",
      cree_par_utilisateur: UTILISATEUR_ID,
    },
    {
      id: PATIENT_4,
      nom: "Belkacem",
      prenom: "Fatima",
      telephone: "0698765432",
      email: "f.belkacem@mail.dz",
      matricule: "PAT-2024-004",
      date_naissance: "1990-05-18",
      nss: 290051234,
      lieu_naissance: "Tlemcen",
      sexe: "feminin",
      nationalite: "Algerienne",
      groupe_sanguin: "AB+",
      adresse: "3 Rue de la Paix, Tlemcen",
      profession: "Enseignante",
      habitudes_saines: "Yoga 2 fois par semaine, regime mediteraneen",
      habitudes_toxiques: "Non-fumeuse",
      nb_enfants: 1,
      situation_familiale: "Mariee",
      age_circoncision: null,
      date_admission: "2024-04-15",
      environnement_animal: null,
      revenu_mensuel: "75000",
      taille_menage: 3,
      nb_pieces: 3,
      niveau_intellectuel: "Universitaire",
      activite_sexuelle: true,
      relations_environnement: "Quartier residentiel calme",
      cree_par_utilisateur: UTILISATEUR_ID,
    },
    {
      id: PATIENT_5,
      nom: "Khelifi",
      prenom: "Amina",
      telephone: "0555678901",
      email: "a.khelifi@mail.dz",
      matricule: "PAT-2024-005",
      date_naissance: "1965-12-03",
      nss: 265121234,
      lieu_naissance: "Setif",
      sexe: "feminin",
      nationalite: "Algerienne",
      groupe_sanguin: "O-",
      adresse: "17 Cite El Hidhab, Setif",
      profession: "Retraitee (ancienne sage-femme)",
      habitudes_saines: "Marche matinale, jardinage",
      habitudes_toxiques: "Non-fumeuse",
      nb_enfants: 5,
      situation_familiale: "Veuve",
      age_circoncision: null,
      date_admission: "2024-01-20",
      environnement_animal: "Deux chats",
      revenu_mensuel: "35000",
      taille_menage: 2,
      nb_pieces: 3,
      niveau_intellectuel: "Universitaire",
      activite_sexuelle: false,
      relations_environnement: "Vit avec sa fille ainee",
      cree_par_utilisateur: UTILISATEUR_ID,
    },
  ]);

  // --- Patients femmes (2: for PATIENT_4 and PATIENT_5) ---
  console.log("Inserting patients_femmes...");
  await db.insert(patients_femmes).values([
    {
      patient_id: PATIENT_4,
      menarche: 13,
      regularite_cycles: "Reguliers, 28 jours",
      contraception: "Pilule oestroprogestative",
      nb_grossesses: 1,
      nb_cesariennes: 0,
      menopause: false,
      age_menopause: null,
      symptomes_menopause: null,
    },
    {
      patient_id: PATIENT_5,
      menarche: 12,
      regularite_cycles: "Menopausee",
      contraception: null,
      nb_grossesses: 5,
      nb_cesariennes: 1,
      menopause: true,
      age_menopause: 52,
      symptomes_menopause: "Bouffees de chaleur, troubles du sommeil, secheresse vaginale",
    },
  ]);

  // --- Voyages recents (3) ---
  console.log("Inserting voyages_recents...");
  await db.insert(voyages_recents).values([
    {
      patient_id: PATIENT_1,
      destination: "Tunisie (Tunis)",
      date: "2024-07-15",
      duree_jours: 10,
      epidemies_destination: "Aucune epidemie signalee",
    },
    {
      patient_id: PATIENT_2,
      destination: "Turquie (Istanbul)",
      date: "2024-09-01",
      duree_jours: 14,
      epidemies_destination: null,
    },
    {
      patient_id: PATIENT_4,
      destination: "France (Paris)",
      date: "2025-01-10",
      duree_jours: 7,
      epidemies_destination: "Grippe saisonniere",
    },
  ]);

  // --- Antecedents (6: 3 personnel, 3 familial) ---
  console.log("Inserting antecedents...");
  await db.insert(antecedents).values([
    // Personnel
    {
      id: ANT_1,
      patient_id: PATIENT_1,
      type: "personnel",
      description: "Asthme diagnostique a l'age de 10 ans",
    },
    {
      id: ANT_2,
      patient_id: PATIENT_2,
      type: "personnel",
      description: "Diabete de type 2 diagnostique en 2018",
    },
    {
      id: ANT_3,
      patient_id: PATIENT_5,
      type: "personnel",
      description: "Hypertension arterielle diagnostiquee en 2015, arthrose du genou droit",
    },
    // Familial
    {
      id: ANT_4,
      patient_id: PATIENT_1,
      type: "familial",
      description: "Pere decede d'un infarctus du myocarde a 62 ans",
    },
    {
      id: ANT_5,
      patient_id: PATIENT_2,
      type: "familial",
      description: "Mere diabetique de type 2, frere hypertendu",
    },
    {
      id: ANT_6,
      patient_id: PATIENT_4,
      type: "familial",
      description: "Grand-mere maternelle: cancer du sein a 65 ans",
    },
  ]);

  // --- Antecedents personnels (3, linked to ANT_1, ANT_2, ANT_3) ---
  console.log("Inserting antecedents_personnels...");
  await db.insert(antecedents_personnels).values([
    {
      antecedent_id: ANT_1,
      type: "Respiratoire",
      details:
        "Asthme allergique intermittent. Utilisation de Ventoline a la demande. Derniere crise il y a 6 mois.",
      est_actif: true,
    },
    {
      antecedent_id: ANT_2,
      type: "Endocrinien",
      details:
        "Diabete de type 2, HbA1c derniere valeur 7.2%. Sous Metformine 500mg x2/j. Suivi regulier.",
      est_actif: true,
    },
    {
      antecedent_id: ANT_3,
      type: "Cardiovasculaire / Rhumatologique",
      details:
        "HTA equilibree sous Amlodipine 5mg. Arthrose du genou droit avec douleur a la marche prolongee.",
      est_actif: true,
    },
  ]);

  // --- Antecedents familiaux (3, linked to ANT_4, ANT_5, ANT_6) ---
  console.log("Inserting antecedents_familiaux...");
  await db.insert(antecedents_familiaux).values([
    {
      antecedent_id: ANT_4,
      details: "Infarctus du myocarde a 62 ans, deces brutal",
      lien_parente: "Pere",
    },
    {
      antecedent_id: ANT_5,
      details: "Diabete de type 2, hypertension arterielle",
      lien_parente: "Mere et frere",
    },
    {
      antecedent_id: ANT_6,
      details: "Cancer du sein diagnostique a 65 ans, en remission apres traitement",
      lien_parente: "Grand-mere maternelle",
    },
  ]);

  // --- Suivi (4) ---
  console.log("Inserting suivi...");
  await db.insert(suivi).values([
    {
      id: SUIVI_1,
      patient_id: PATIENT_1,
      utilisateur_id: UTILISATEUR_ID,
      hypothese_diagnostic: "Asthme allergique avec composante saisonniere",
      motif: "Suivi pneumologique regulier",
      historique: "Patient suivi depuis 2024 pour exacerbations asthmatiques printanieres",
      date_ouverture: "2024-03-01",
      date_fermeture: null,
      est_actif: true,
    },
    {
      id: SUIVI_2,
      patient_id: PATIENT_2,
      utilisateur_id: UTILISATEUR_ID,
      hypothese_diagnostic: "Diabete de type 2 avec suspicion de neuropathie peripherique debutante",
      motif: "Equilibre glycemique et depistage de complications",
      historique: "Diabete connu depuis 2018, HbA1c fluctuante entre 7 et 8%",
      date_ouverture: "2024-04-10",
      date_fermeture: null,
      est_actif: true,
    },
    {
      id: SUIVI_3,
      patient_id: PATIENT_4,
      utilisateur_id: UTILISATEUR_ID,
      hypothese_diagnostic: "Migraine sans aura",
      motif: "Cephalees recurrentes invalidantes",
      historique: "Cephalees depuis 6 mois, 3-4 episodes par mois",
      date_ouverture: "2024-09-15",
      date_fermeture: null,
      est_actif: true,
    },
    {
      id: SUIVI_4,
      patient_id: PATIENT_5,
      utilisateur_id: UTILISATEUR_ID,
      hypothese_diagnostic: "Gonarthrose droite stade III",
      motif: "Douleurs chroniques du genou droit avec limitation fonctionnelle",
      historique:
        "Arthrose progressive depuis 2020, aggravation recente avec difficulte a monter les escaliers",
      date_ouverture: "2024-02-01",
      date_fermeture: "2025-01-15",
      est_actif: false,
    },
  ]);

  // --- Rendez-vous (6) ---
  console.log("Inserting rendez_vous...");
  await db.insert(rendez_vous).values([
    {
      id: RDV_1,
      patient_id: PATIENT_1,
      suivi_id: SUIVI_1,
      utilisateur_id: UTILISATEUR_ID,
      date: "2024-03-15",
      heure: "09:00",
      statut: "termine",
      important: false,
      frequence_rappel: null,
      periode_rappel: null,
    },
    {
      id: RDV_2,
      patient_id: PATIENT_1,
      suivi_id: SUIVI_1,
      utilisateur_id: UTILISATEUR_ID,
      date: "2024-06-15",
      heure: "10:30",
      statut: "termine",
      important: false,
      frequence_rappel: "3 mois",
      periode_rappel: "trimestriel",
    },
    {
      id: RDV_3,
      patient_id: PATIENT_2,
      suivi_id: SUIVI_2,
      utilisateur_id: UTILISATEUR_ID,
      date: "2024-04-20",
      heure: "11:00",
      statut: "termine",
      important: true,
      frequence_rappel: null,
      periode_rappel: null,
    },
    {
      id: RDV_4,
      patient_id: PATIENT_2,
      suivi_id: SUIVI_2,
      utilisateur_id: UTILISATEUR_ID,
      date: "2024-10-20",
      heure: "09:30",
      statut: "termine",
      important: false,
      frequence_rappel: "6 mois",
      periode_rappel: "semestriel",
    },
    {
      id: RDV_5,
      patient_id: PATIENT_4,
      suivi_id: SUIVI_3,
      utilisateur_id: UTILISATEUR_ID,
      date: "2024-09-20",
      heure: "14:00",
      statut: "termine",
      important: false,
      frequence_rappel: null,
      periode_rappel: null,
    },
    {
      id: RDV_6,
      patient_id: PATIENT_5,
      suivi_id: SUIVI_4,
      utilisateur_id: UTILISATEUR_ID,
      date: "2025-01-10",
      heure: "08:30",
      statut: "termine",
      important: true,
      frequence_rappel: null,
      periode_rappel: null,
    },
  ]);

  // --- Examen consultation (4) ---
  console.log("Inserting examen_consultation...");
  await db.insert(examen_consultation).values([
    {
      id: EXAM_1,
      rendez_vous_id: RDV_1,
      suivi_id: SUIVI_1,
      date: "2024-03-15",
      taille: "175",
      poids: "78",
      traitement_prescrit: "Ventoline 100mcg 2 bouffees a la demande, Singulair 10mg 1/j",
      description_consultation:
        "Patient vu pour suivi pneumologique. Se plaint de toux seche nocturne depuis 2 semaines.",
      aspect_general: "Bon etat general, patient conscient et cooperant",
      examen_respiratoire:
        "Sibilants expiratoires bilateraux, SpO2 97%, FR 18/min. Pas de signes de detresse.",
      examen_cardiovasculaire: "BDC reguliers, pas de souffle, TA 125/80 mmHg",
      examen_cutane_muqueux: null,
      examen_orl: "Rhinite allergique, muqueuse nasale pale",
      examen_digestif: null,
      examen_neurologique: null,
      examen_locomoteur: null,
      examen_genital: null,
      examen_urinaire: null,
      examen_ganglionnaire: null,
      examen_endocrinien: null,
      conclusion:
        "Exacerbation asthmatique legere sur terrain allergique. Poursuite du traitement de fond.",
    },
    {
      id: EXAM_2,
      rendez_vous_id: RDV_3,
      suivi_id: SUIVI_2,
      date: "2024-04-20",
      taille: "170",
      poids: "92",
      traitement_prescrit: "Metformine 500mg x2/j, Amlodipine 5mg 1/j",
      description_consultation:
        "Premiere consultation de suivi diabetologique. Patient adresse pour desequilibre glycemique.",
      aspect_general: "Surpoids, IMC 31.8, patient en bon etat general",
      examen_respiratoire: "Auscultation pulmonaire claire, pas de sibilants",
      examen_cardiovasculaire: "TA 145/90 mmHg, pouls 76/min regulier, pas de souffle",
      examen_cutane_muqueux: "Peau seche aux extremites, pas de lesion",
      examen_orl: null,
      examen_digestif: "Abdomen souple, pas de hepatomegalie",
      examen_neurologique:
        "Reflexes osteotendineux presents et symetriques, sensibilite conservee aux pieds",
      examen_locomoteur: null,
      examen_genital: null,
      examen_urinaire: null,
      examen_ganglionnaire: null,
      examen_endocrinien: "Thyroide non palpable, pas de goitre",
      conclusion:
        "Diabete de type 2 desequilibre avec HTA associee. Renforcement du traitement et bilan de complications demande.",
    },
    {
      id: EXAM_3,
      rendez_vous_id: RDV_5,
      suivi_id: SUIVI_3,
      date: "2024-09-20",
      taille: "163",
      poids: "58",
      traitement_prescrit: "Paracetamol 1g en cas de crise, repos au calme",
      description_consultation:
        "Patiente vue pour cephalees recurrentes. Decrit des douleurs pulsatiles hemicraniales droites.",
      aspect_general: "Bonne mine, patiente non algique lors de l'examen",
      examen_respiratoire: null,
      examen_cardiovasculaire: "TA 115/70 mmHg, pouls 68/min regulier",
      examen_cutane_muqueux: null,
      examen_orl: null,
      examen_digestif: null,
      examen_neurologique:
        "Examen neurologique normal. Paires craniennes normales. Pas de signes de focalisation.",
      examen_locomoteur: null,
      examen_genital: null,
      examen_urinaire: null,
      examen_ganglionnaire: null,
      examen_endocrinien: null,
      conclusion:
        "Tableau compatible avec migraine sans aura. Surveillance clinique et traitement symptomatique.",
    },
    {
      id: EXAM_4,
      rendez_vous_id: RDV_6,
      suivi_id: SUIVI_4,
      date: "2025-01-10",
      taille: "158",
      poids: "72",
      traitement_prescrit:
        "Paracetamol 1g x3/j, seances de kinesitherapie 2 fois/semaine pendant 6 semaines",
      description_consultation:
        "Patiente agee vue pour bilan de gonarthrose. Se plaint de douleurs majorees a la descente des escaliers.",
      aspect_general: "Patiente de 60 ans, en surpoids modere, marche avec une legere boiterie",
      examen_respiratoire: "Auscultation claire",
      examen_cardiovasculaire: "TA 140/85 mmHg, pouls 72/min",
      examen_cutane_muqueux: null,
      examen_orl: null,
      examen_digestif: null,
      examen_neurologique: null,
      examen_locomoteur:
        "Genou droit: epanchement modere, craquements a la flexion, limitation de la flexion a 110 degres. Genou gauche normal.",
      examen_genital: null,
      examen_urinaire: null,
      examen_ganglionnaire: null,
      examen_endocrinien: null,
      conclusion:
        "Gonarthrose droite evoluee. Orientation vers kinesitherapie et avis chirurgical si echec du traitement conservateur.",
    },
  ]);

  // --- Ordonnances (3) ---
  console.log("Inserting ordonnances...");
  await db.insert(ordonnance).values([
    {
      id: ORD_1,
      rendez_vous_id: RDV_1,
      patient_id: PATIENT_1,
      utilisateur_id: UTILISATEUR_ID,
      remarques: "Renouvellement trimestriel. Verifier la technique d'inhalation au prochain RDV.",
      date_prescription: "2024-03-15",
    },
    {
      id: ORD_2,
      rendez_vous_id: RDV_3,
      patient_id: PATIENT_2,
      utilisateur_id: UTILISATEUR_ID,
      remarques: "Bilan sanguin de controle dans 3 mois (HbA1c, bilan lipidique, creatinine).",
      date_prescription: "2024-04-20",
    },
    {
      id: ORD_3,
      rendez_vous_id: RDV_6,
      patient_id: PATIENT_5,
      utilisateur_id: UTILISATEUR_ID,
      remarques: "Kinesitherapie a debuter des que possible. Revoir dans 6 semaines.",
      date_prescription: "2025-01-10",
    },
  ]);

  // --- Ordonnance medicaments (5) ---
  console.log("Inserting ordonnance_medicaments...");
  await db.insert(ordonnance_medicaments).values([
    {
      ordonnance_id: ORD_1,
      medicament_id: MED_5,
      posologie: "1g toutes les 6 heures si douleur ou fievre",
      duree_traitement: "7 jours",
      instructions: "Ne pas depasser 4g par jour",
    },
    {
      ordonnance_id: ORD_2,
      medicament_id: MED_2,
      posologie: "500mg matin et soir au cours des repas",
      duree_traitement: "3 mois (renouvellement)",
      instructions: "Prendre avec de la nourriture pour reduire les effets digestifs",
    },
    {
      ordonnance_id: ORD_2,
      medicament_id: MED_3,
      posologie: "5mg une fois par jour le matin",
      duree_traitement: "3 mois (renouvellement)",
      instructions: "Surveiller les oedemes des chevilles",
    },
    {
      ordonnance_id: ORD_3,
      medicament_id: MED_5,
      posologie: "1g trois fois par jour",
      duree_traitement: "6 semaines",
      instructions: "Prendre a heures regulieres, espacer de 6h minimum",
    },
    {
      ordonnance_id: ORD_3,
      medicament_id: MED_4,
      posologie: "20mg le matin a jeun",
      duree_traitement: "4 semaines",
      instructions: "Prendre 30 minutes avant le petit-dejeuner",
    },
  ]);

  // --- Historique traitements (4) ---
  console.log("Inserting historique_traitements...");
  await db.insert(historique_traitements).values([
    {
      patient_id: PATIENT_1,
      medicament_id: MED_5,
      posologie: "1g x3/jour si douleur",
      est_actif: false,
      date_prescription: "2024-03-15",
      prescrit_par_utilisateur: UTILISATEUR_ID,
    },
    {
      patient_id: PATIENT_2,
      medicament_id: MED_2,
      posologie: "500mg x2/jour",
      est_actif: true,
      date_prescription: "2024-04-20",
      prescrit_par_utilisateur: UTILISATEUR_ID,
    },
    {
      patient_id: PATIENT_2,
      medicament_id: MED_3,
      posologie: "5mg x1/jour",
      est_actif: true,
      date_prescription: "2024-04-20",
      prescrit_par_utilisateur: UTILISATEUR_ID,
    },
    {
      patient_id: PATIENT_5,
      medicament_id: MED_5,
      posologie: "1g x3/jour",
      est_actif: true,
      date_prescription: "2025-01-10",
      prescrit_par_utilisateur: UTILISATEUR_ID,
    },
  ]);

  // --- Vaccinations patient (4) ---
  console.log("Inserting vaccinations_patient...");
  await db.insert(vaccinations_patient).values([
    {
      patient_id: PATIENT_1,
      vaccin: "Grippe saisonniere 2024-2025",
      date_vaccination: "2024-10-15",
      notes: "Vaccination annuelle, pas d'effets secondaires",
    },
    {
      patient_id: PATIENT_2,
      vaccin: "COVID-19 (rappel bivalent)",
      date_vaccination: "2024-03-10",
      notes: "4eme dose, legere douleur au point d'injection pendant 24h",
    },
    {
      patient_id: PATIENT_3,
      vaccin: "Hepatite B (rappel)",
      date_vaccination: "2024-08-20",
      notes: "Rappel dans le cadre des stages hospitaliers",
    },
    {
      patient_id: PATIENT_5,
      vaccin: "Pneumocoque (Prevenar 13)",
      date_vaccination: "2024-11-05",
      notes: "Recommande en raison de l'age et des comorbidites",
    },
  ]);

  // --- Documents patient (3) ---
  console.log("Inserting documents_patient...");
  await db.insert(documents_patient).values([
    {
      id: DOC_1,
      patient_id: PATIENT_1,
      categorie_id: CAT_1,
      type_document: "Analyse sanguine",
      nom_document: "Bilan_sanguin_Boudiaf_2024-03.pdf",
      chemin_fichier: "/uploads/patients/a0000001/bilan_sanguin_2024-03.pdf",
      type_fichier: "application/pdf",
      taille_fichier: 245000,
      description: "Bilan sanguin complet: NFS, glycemie, bilan lipidique, fonction renale",
      date_upload: "2024-03-16T10:30:00+01:00",
      uploade_par_utilisateur: UTILISATEUR_ID,
      est_archive: false,
    },
    {
      id: DOC_2,
      patient_id: PATIENT_2,
      categorie_id: CAT_2,
      type_document: "Radiographie",
      nom_document: "Radio_thorax_Zeroual_2024-04.pdf",
      chemin_fichier: "/uploads/patients/a0000002/radio_thorax_2024-04.pdf",
      type_fichier: "application/pdf",
      taille_fichier: 1520000,
      description: "Radiographie thoracique de face et de profil",
      date_upload: "2024-04-21T14:00:00+01:00",
      uploade_par_utilisateur: UTILISATEUR_ID,
      est_archive: false,
    },
    {
      id: DOC_3,
      patient_id: PATIENT_5,
      categorie_id: CAT_3,
      type_document: "Courrier",
      nom_document: "Lettre_orientation_Khelifi_2025-01.pdf",
      chemin_fichier: "/uploads/patients/a0000005/lettre_orientation_2025-01.pdf",
      type_fichier: "application/pdf",
      taille_fichier: 89000,
      description: "Lettre d'orientation vers chirurgien orthopediste",
      date_upload: "2025-01-10T16:00:00+01:00",
      uploade_par_utilisateur: UTILISATEUR_ID,
      est_archive: false,
    },
  ]);

  // --- Lettres orientation (1) ---
  console.log("Inserting lettres_orientation...");
  await db.insert(lettres_orientation).values({
    documents_patient_id: DOC_3,
    utilisateur_id: UTILISATEUR_ID,
    suivi_id: SUIVI_4,
    type_exploration: "Consultation specialisee",
    examen_demande: "Avis chirurgical pour prothese totale du genou droit",
    raison:
      "Echec du traitement conservateur, gonarthrose stade III avec limitation fonctionnelle importante",
    destinataire: "Dr. Hamdani - Service d'Orthopedie, CHU Setif",
    urgence: "normale",
    contenu_lettre:
      "Cher confrere, je vous adresse Mme Khelifi Amina, 60 ans, pour avis chirurgical concernant une gonarthrose droite evoluee stade III. La patiente presente des douleurs chroniques avec limitation fonctionnelle malgre un traitement conservateur bien conduit (antalgiques, kinesitherapie). L'examen clinique retrouve un epanchement modere et une limitation de la flexion. Merci de votre avis.",
    date_creation: "2025-01-10T16:30:00+01:00",
    date_modification: "2025-01-10T16:30:00+01:00",
  });

  // --- Certificats medicaux (1) ---
  console.log("Inserting certificats_medicaux...");
  await db.insert(certificats_medicaux).values({
    documents_patient_id: DOC_2,
    utilisateur_id: UTILISATEUR_ID,
    suivi_id: SUIVI_2,
    type_certificat: "aptitude",
    date_emission: "2024-04-21",
    date_debut: "2024-04-21",
    date_fin: "2025-04-20",
    diagnostic: "Diabete de type 2 equilibre, apte a l'exercice de son activite professionnelle",
    destinataire: "Medecine du travail",
    notes: "Certificat d'aptitude annuel pour activite commerciale",
    statut: "emis",
    date_creation: "2024-04-21T15:00:00+01:00",
    date_modification: "2024-04-21T15:00:00+01:00",
  });

  console.log("\nSeed completed successfully!");
  console.log("Summary:");
  console.log("  - 1 utilisateur (medecin)");
  console.log("  - 5 medicaments");
  console.log("  - 3 categories de documents");
  console.log("  - 5 patients (3M, 2F)");
  console.log("  - 2 fiches patients femmes");
  console.log("  - 3 voyages recents");
  console.log("  - 6 antecedents (3 personnels, 3 familiaux)");
  console.log("  - 3 antecedents personnels details");
  console.log("  - 3 antecedents familiaux details");
  console.log("  - 4 suivis");
  console.log("  - 6 rendez-vous");
  console.log("  - 4 examens de consultation");
  console.log("  - 3 ordonnances");
  console.log("  - 5 ordonnance medicaments");
  console.log("  - 4 historique traitements");
  console.log("  - 4 vaccinations");
  console.log("  - 3 documents patient");
  console.log("  - 1 lettre d'orientation");
  console.log("  - 1 certificat medical");
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
