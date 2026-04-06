/**
 * Rich Patient Seed Script for doctor.com
 *
 * Creates a single patient with maximum data coverage for testing the patient detail page.
 * Run AFTER the main seed: bun seed.ts && bun seed-rich-patient.ts
 *
 * Usage: bun seed-rich-patient.ts
 */

import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, inArray } from "drizzle-orm";

import {
  utilisateurs,
  patients,
  voyages_recents,
  antecedents,
  antecedents_personnels,
  antecedents_familiaux,
  suivi,
  rendez_vous,
  examen_consultation,
  historique_traitements,
  ordonnance,
  ordonnance_medicaments,
  vaccinations_patient,
  categories_documents,
  documents_patient,
} from "./packages/db/src/schema";

dotenv.config({ path: "./apps/server/.env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required. Check apps/server/.env");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const db = drizzle({ client: pool });

// Doctor utilisateur ID — looked up at runtime from existing data
let UTILISATEUR_ID = "";

// Document category IDs — looked up at runtime
let CAT_LAB = "";
let CAT_IMAGING = "";
let CAT_COURRIER = "";

// Rich patient UUIDs
const PAT = "b0000000-0000-4000-a000-000000000001";
const SUIVI_1 = "b1000000-0000-4000-a000-000000000001";
const SUIVI_2 = "b1000000-0000-4000-a000-000000000002";
const SUIVI_3 = "b1000000-0000-4000-a000-000000000003";
const SUIVI_4 = "b1000000-0000-4000-a000-000000000004";
const RDV_1 = "b2000000-0000-4000-a000-000000000001";
const RDV_2 = "b2000000-0000-4000-a000-000000000002";
const RDV_3 = "b2000000-0000-4000-a000-000000000003";
const RDV_4 = "b2000000-0000-4000-a000-000000000004";
const RDV_5 = "b2000000-0000-4000-a000-000000000005";
const RDV_6 = "b2000000-0000-4000-a000-000000000006";
const EXAM_1 = "b3000000-0000-4000-a000-000000000001";
const EXAM_2 = "b3000000-0000-4000-a000-000000000002";
const EXAM_3 = "b3000000-0000-4000-a000-000000000003";
const EXAM_4 = "b3000000-0000-4000-a000-000000000004";
const ORD_1 = "b4000000-0000-4000-a000-000000000001";
const ORD_2 = "b4000000-0000-4000-a000-000000000002";
const ORD_3 = "b4000000-0000-4000-a000-000000000003";
const OM_1 = "b5000000-0000-4000-a000-000000000001";
const OM_2 = "b5000000-0000-4000-a000-000000000002";
const OM_3 = "b5000000-0000-4000-a000-000000000003";
const OM_4 = "b5000000-0000-4000-a000-000000000004";
const OM_5 = "b5000000-0000-4000-a000-000000000005";
const OM_6 = "b5000000-0000-4000-a000-000000000006";
const ANT_1 = "b6000000-0000-4000-a000-000000000001";
const ANT_2 = "b6000000-0000-4000-a000-000000000002";
const ANT_3 = "b6000000-0000-4000-a000-000000000003";
const ANT_4 = "b6000000-0000-4000-a000-000000000004";
const ANT_5 = "b6000000-0000-4000-a000-000000000005";
const DOC_1 = "b7000000-0000-4000-a000-000000000001";
const DOC_2 = "b7000000-0000-4000-a000-000000000002";
const DOC_3 = "b7000000-0000-4000-a000-000000000003";

async function seedRichPatient() {
  console.log("Seeding rich patient...\n");

  // Delete existing rich patient data (idempotent)
  await db.delete(documents_patient).where(eq(documents_patient.patient_id, PAT));
  await db.delete(vaccinations_patient).where(eq(vaccinations_patient.patient_id, PAT));
  await db.delete(historique_traitements).where(eq(historique_traitements.patient_id, PAT));
  await db.delete(ordonnance_medicaments).where(
    inArray(ordonnance_medicaments.ordonnance_id, [ORD_1, ORD_2, ORD_3])
  );
  await db.delete(ordonnance).where(eq(ordonnance.patient_id, PAT));
  await db.delete(examen_consultation).where(
    inArray(examen_consultation.suivi_id, [SUIVI_1, SUIVI_2, SUIVI_3, SUIVI_4])
  );
  await db.delete(rendez_vous).where(eq(rendez_vous.patient_id, PAT));
  await db.delete(suivi).where(eq(suivi.patient_id, PAT));
  await db.delete(antecedents_personnels).where(
    inArray(antecedents_personnels.antecedent_id, [ANT_1, ANT_2, ANT_3])
  );
  await db.delete(antecedents_familiaux).where(
    inArray(antecedents_familiaux.antecedent_id, [ANT_4, ANT_5])
  );
  await db.delete(antecedents).where(eq(antecedents.patient_id, PAT));
  await db.delete(voyages_recents).where(eq(voyages_recents.patient_id, PAT));
  await db.delete(patients).where(eq(patients.id, PAT));

  console.log("Cleared old rich patient data.");

  // --- Find or create doctor utilisateur ---
  const existingDoctor = await db
    .select({ id: utilisateurs.id })
    .from(utilisateurs)
    .where(eq(utilisateurs.email, "tbib@doctorcom.com"));

  if (existingDoctor.length > 0) {
    UTILISATEUR_ID = existingDoctor[0]!.id;
    console.log("  Found existing doctor (ID:", UTILISATEUR_ID, ").");
  } else {
    UTILISATEUR_ID = crypto.randomUUID();
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
    console.log("  Created new doctor (ID:", UTILISATEUR_ID, ").");
  }

  // --- Find or create document categories ---
  const catDefs = [
    { name: "Analyses de laboratoire", desc: "Résultats d'analyses sanguines, urinaires et biochimiques", var: "lab" as const },
    { name: "Imagerie médicale", desc: "Radiographies, échographies, IRM, scanner", var: "imaging" as const },
    { name: "Courrier médical", desc: "Lettres d'orientation, certificats médicaux, correspondance", var: "courrier" as const },
  ];
  for (const cat of catDefs) {
    const existing = await db
      .select({ id: categories_documents.id })
      .from(categories_documents)
      .where(eq(categories_documents.nom, cat.name));
    if (existing.length > 0) {
      if (cat.var === "lab") CAT_LAB = existing[0]!.id;
      else if (cat.var === "imaging") CAT_IMAGING = existing[0]!.id;
      else CAT_COURRIER = existing[0]!.id;
    } else {
      const newId = crypto.randomUUID();
      await db.insert(categories_documents).values({
        id: newId,
        nom: cat.name,
        description: cat.desc,
      });
      if (cat.var === "lab") CAT_LAB = newId;
      else if (cat.var === "imaging") CAT_IMAGING = newId;
      else CAT_COURRIER = newId;
      console.log("  Created category:", cat.name);
    }
  }
  console.log("  Document categories ensured.");

  // --- Patient ---
  await db.insert(patients).values({
    id: PAT,
    nom: "Amara",
    prenom: "Walid",
    telephone: "0551234567",
    email: "walid.amara@mail.dz",
    matricule: "PAT-2025-RICH01",
    date_naissance: "1992-06-15",
    nss: 192061501,
    lieu_naissance: "Alger",
    sexe: "masculin",
    nationalite: "Algérienne",
    groupe_sanguin: "O+",
    adresse: "12 Rue Didouche Mourad, Alger Centre",
    profession: "Médecin généraliste",
    habitudes_saines: "Course à pied 3x/semaine, alimentation méditerranéenne, 7h de sommeil",
    habitudes_toxiques: "Ex-fumeur (arrêt Janvier 2024), café 2 tasses/jour",
    nb_enfants: 1,
    situation_familiale: "Marié",
    age_circoncision: 7,
    date_admission: "2025-01-10",
    environnement_animal: "Chien Labrador, intérieur",
    revenu_mensuel: "180000",
    taille_menage: 3,
    nb_pieces: 5,
    niveau_intellectuel: "Universitaire (Doctorat)",
    activite_sexuelle: true,
    relations_environnement: "Quartier calme, bons rapports avec les voisins",
    cree_par_utilisateur: UTILISATEUR_ID,
  });
  console.log("  Patient inserted.");

  // --- Voyages récents ---
  await db.insert(voyages_recents).values([
    {
      patient_id: PAT,
      destination: "France (Paris)",
      date: "2025-08-10",
      duree_jours: 12,
      epidemies_destination: "Aucune épidémie signalée",
    },
    {
      patient_id: PAT,
      destination: "Maroc (Marrakech)",
      date: "2024-12-20",
      duree_jours: 7,
      epidemies_destination: "Grippe saisonnière en circulation",
    },
    {
      patient_id: PAT,
      destination: "Turquie (Istanbul)",
      date: "2024-06-05",
      duree_jours: 10,
      epidemies_destination: null,
    },
  ]);
  console.log("  3 voyages inserted.");

  // --- Antécédents ---
  await db.insert(antecedents).values([
    { id: ANT_1, patient_id: PAT, type: "personnel", description: "Asthme allergique depuis l'enfance" },
    { id: ANT_2, patient_id: PAT, type: "personnel", description: "Appendicectomie en 2010" },
    { id: ANT_3, patient_id: PAT, type: "personnel", description: "Hypertension artérielle diagnostiquée en 2023" },
    { id: ANT_4, patient_id: PAT, type: "familial", description: "Père: diabète de type 2, dyslipidémie" },
    { id: ANT_5, patient_id: PAT, type: "familial", description: "Mère: hypothyroïdie, polyarthrite rhumatoïde" },
  ]);
  console.log("  5 antécédents inserted.");

  await db.insert(antecedents_personnels).values([
    {
      antecedent_id: ANT_1,
      type: "Respiratoire",
      details: "Asthme allergique intermittent. Utilisation de Ventoline à la demande. Dernière crise il y a 3 mois au printemps.",
      est_actif: true,
    },
    {
      antecedent_id: ANT_2,
      type: "Chirurgical",
      details: "Appendicectomie par laparoscopie en 2010. Suites opératoires simples.",
      est_actif: false,
    },
    {
      antecedent_id: ANT_3,
      type: "Cardiovasculaire",
      details: "HTA diagnostiquée en 2023. Traitement par Amlodipine 5mg 1/j. TA bien contrôlée autour de 125/80.",
      est_actif: true,
    },
  ]);
  await db.insert(antecedents_familiaux).values([
    {
      antecedent_id: ANT_4,
      details: "Diabète de type 2 depuis 2015, sous Metformine. Dyslipidémie sous statine.",
      lien_parente: "Père",
    },
    {
      antecedent_id: ANT_5,
      details: "Hypothyroïdie sous Levothyrox. Polyarthrite rhumatoïde traitée par Methotrexate.",
      lien_parente: "Mère",
    },
  ]);
  console.log("  Antecedent details inserted.");

  // --- Suivis ---
  await db.insert(suivi).values([
    {
      id: SUIVI_1,
      patient_id: PAT,
      utilisateur_id: UTILISATEUR_ID,
      hypothese_diagnostic: "Asthme allergique avec rhinite associée",
      motif: "Suivi asthme et rhinite allergique",
      historique: "Patient suivi depuis 2024 pour asthme allergique. Exacerbations printanières.",
      date_ouverture: "2025-01-15",
      date_fermeture: null,
      est_actif: true,
    },
    {
      id: SUIVI_2,
      patient_id: PAT,
      utilisateur_id: UTILISATEUR_ID,
      hypothese_diagnostic: "HTA essentielle stade 1",
      motif: "Suivi hypertension artérielle",
      historique: "HTA diagnostiquée en 2023. Traitement par Amlodipine 5mg. Contrôle régulier tous les 3 mois.",
      date_ouverture: "2025-02-01",
      date_fermeture: null,
      est_actif: true,
    },
    {
      id: SUIVI_3,
      patient_id: PAT,
      utilisateur_id: UTILISATEUR_ID,
      hypothese_diagnostic: "Lombalgie chronique mécanique",
      motif: "Lombalgies récurrentes",
      historique: "Douleurs lombaires depuis 6 mois, aggravées par la position assise prolongée.",
      date_ouverture: "2025-03-10",
      date_fermeture: null,
      est_actif: true,
    },
    {
      id: SUIVI_4,
      patient_id: PAT,
      utilisateur_id: UTILISATEUR_ID,
      hypothese_diagnostic: "Fièvre simple avec douleurs diffuses sans signe de gravité",
      motif: "Suivi fièvre et douleurs simples",
      historique:
        "Episode aigu simple avec fièvre modérée et douleurs diffuses, sans signe de gravité ni point d'appel infectieux sévère.",
      date_ouverture: "2025-06-20",
      date_fermeture: null,
      est_actif: true,
    },
  ]);
  console.log("  4 suivis inserted.");

  // --- Rendez-vous ---
  const today = new Date();
  const futureDate1 = new Date(today);
  futureDate1.setDate(futureDate1.getDate() + 15);
  const futureDate2 = new Date(today);
  futureDate2.setDate(futureDate2.getDate() + 45);

  await db.insert(rendez_vous).values([
    {
      id: RDV_1,
      patient_id: PAT,
      suivi_id: SUIVI_1,
      utilisateur_id: UTILISATEUR_ID,
      date: "2025-01-20",
      heure: "09:00",
      statut: "termine",
      important: false,
      frequence_rappel: null,
      periode_rappel: null,
    },
    {
      id: RDV_2,
      patient_id: PAT,
      suivi_id: SUIVI_2,
      utilisateur_id: UTILISATEUR_ID,
      date: "2025-02-05",
      heure: "10:30",
      statut: "termine",
      important: true,
      frequence_rappel: "3 mois",
      periode_rappel: "trimestriel",
    },
    {
      id: RDV_3,
      patient_id: PAT,
      suivi_id: SUIVI_1,
      utilisateur_id: UTILISATEUR_ID,
      date: "2025-04-15",
      heure: "14:00",
      statut: "termine",
      important: false,
      frequence_rappel: null,
      periode_rappel: null,
    },
    {
      id: RDV_4,
      patient_id: PAT,
      suivi_id: SUIVI_3,
      utilisateur_id: UTILISATEUR_ID,
      date: futureDate1.toISOString().split("T")[0],
      heure: "11:00",
      statut: "confirme",
      important: false,
      frequence_rappel: null,
      periode_rappel: null,
    },
    {
      id: RDV_5,
      patient_id: PAT,
      suivi_id: SUIVI_2,
      utilisateur_id: UTILISATEUR_ID,
      date: futureDate2.toISOString().split("T")[0],
      heure: "09:30",
      statut: "planifie",
      important: true,
      frequence_rappel: "3 mois",
      periode_rappel: "trimestriel",
    },
    {
      id: RDV_6,
      patient_id: PAT,
      suivi_id: SUIVI_4,
      utilisateur_id: UTILISATEUR_ID,
      date: "2025-06-20",
      heure: "16:00",
      statut: "termine",
      important: false,
      frequence_rappel: null,
      periode_rappel: null,
    },
  ]);
  console.log("  6 rendez-vous inserted (4 past + 2 future).");

  // --- Examens de consultation ---
  await db.insert(examen_consultation).values([
    {
      id: EXAM_1,
      rendez_vous_id: RDV_1,
      suivi_id: SUIVI_1,
      date: "2025-01-20",
      taille: "178",
      poids: "74",
      tension_arterielle: "125/80",
      frequence_cardiaque: 72,
      temperature: "36.8",
      spo2: "98",
      imc: "23.4",
      traitement_prescrit: "Ventoline 100mcg 2 bouffées à la demande, Desloratadine 5mg 1/j",
      description_consultation: "Patient vu pour suivi asthme. Symptômes bien contrôlés. Rhinite intermittente.",
      aspect_general: "Bon état général, conscient et coopérant, bien hydraté",
      examen_respiratoire: "Poumons clairs à l'auscultation, pas de sibilants, FR 16/min, SpO2 98%",
      examen_cardiovasculaire: "BDC réguliers, 72/min, TA 125/80, pas de souffle, pas d'œdème",
      examen_cutane_muqueux: "Peau et muqueuses normo-colorées, pas de rash, pas de purpura",
      examen_orl: "Muqueuse nasale pale, rhinite allergique, tympanes normaux",
      examen_digestif: null,
      examen_neurologique: null,
      examen_locomoteur: null,
      examen_genital: null,
      examen_urinaire: null,
      examen_ganglionnaire: "Pas d'adénopathie cervicale, axillaire ou inguinale",
      examen_endocrinien: null,
      conclusion: "Asthme allergique stable sous traitement. Poursuite du traitement. Contrôle dans 3 mois.",
    },
    {
      id: EXAM_2,
      rendez_vous_id: RDV_2,
      suivi_id: SUIVI_2,
      date: "2025-02-05",
      taille: "178",
      poids: "75",
      tension_arterielle: "130/85",
      frequence_cardiaque: 76,
      temperature: "36.7",
      spo2: "97",
      imc: "23.7",
      traitement_prescrit: "Amlodipine 5mg 1/j (maintien), régime hyposodé",
      description_consultation: "Contrôle HTA. Patient signale quelques céphalées matinales occasionnelles.",
      aspect_general: "Bon état général, IMC 23.7, pas de surpoids",
      examen_respiratoire: "Normal",
      examen_cardiovasculaire: "TA 130/85 mmHg (limite). BDC réguliers 76/min, pas de souffle, pas de triple temps.",
      examen_cutane_muqueux: "Normo-coloré",
      examen_orl: null,
      examen_digestif: "Abdomen souple, non sensible, péristaltisme normal",
      examen_neurologique: "Examen neuro normal, pas de déficit focal",
      examen_locomoteur: null,
      examen_genital: null,
      examen_urinaire: null,
      examen_ganglionnaire: null,
      examen_endocrinien: null,
      conclusion: "HTA limite sous Amlodipine 5mg. Renforcement des mesures hygiéno-diététiques. Bilan lipidique et glycémique demandé. Revoir dans 3 mois.",
    },
    {
      id: EXAM_3,
      rendez_vous_id: RDV_3,
      suivi_id: SUIVI_1,
      date: "2025-04-15",
      taille: "178",
      poids: "73",
      tension_arterielle: "120/78",
      frequence_cardiaque: 70,
      temperature: "36.6",
      spo2: "99",
      imc: "23.0",
      traitement_prescrit: "Ventoline 100mcg PRN, Flixotide 250mcg 2x/j (nouveau)",
      description_consultation: "Rechute asthmatique au printemps. Épisodes nocturnes. Augmentation du traitement de fond.",
      aspect_general: "Bon état général, léger sifflement expiratoire",
      examen_respiratoire: "Sibilants expiratoires diffus bilatéraux, FR 18/min, SpO2 99%",
      examen_cardiovasculaire: "BDC réguliers, 70/min, TA 120/78",
      examen_cutane_muqueux: "Normal",
      examen_orl: "Rhinite allergique en poussée",
      examen_digestif: null,
      examen_neurologique: null,
      examen_locomoteur: null,
      examen_genital: null,
      examen_urinaire: null,
      examen_ganglionnaire: null,
      examen_endocrinien: null,
      conclusion: "Exacerbation asthmatique printanière. Ajout de Flixotide 250mcg 2x/j au traitement de fond. Contrôle dans 1 mois.",
    },
    {
      id: EXAM_4,
      rendez_vous_id: RDV_6,
      suivi_id: SUIVI_4,
      date: "2025-06-20",
      taille: "178",
      poids: "74",
      tension_arterielle: "118/76",
      frequence_cardiaque: 78,
      temperature: "38.1",
      spo2: "98",
      imc: "23.4",
      traitement_prescrit:
        "Antalgique / antipyrétique simple si besoin, hydratation, repos et surveillance clinique",
      description_consultation:
        "Patient vu pour fièvre modérée avec céphalées et douleurs diffuses depuis 24h. Pas de dyspnée, pas de douleur thoracique, pas de signe de gravité.",
      aspect_general:
        "Etat général conservé, patient conscient, stable hémodynamiquement, sans altération majeure de l'état général",
      examen_respiratoire: "Auscultation pulmonaire libre, pas de sibilants, SpO2 98%",
      examen_cardiovasculaire: "BDC réguliers, 78/min, TA 118/76, pas de signe de gravité",
      examen_cutane_muqueux: "Pas d'éruption, pas de déshydratation clinique",
      examen_orl: "Gorge discrètement congestive sans exsudat, rhinorrhée légère",
      examen_digestif: "Abdomen souple, non douloureux",
      examen_neurologique: "Pas de syndrome méningé, examen neurologique rassurant",
      examen_locomoteur: "Courbatures diffuses sans déficit focal",
      examen_genital: null,
      examen_urinaire: null,
      examen_ganglionnaire: "Pas d'adénopathie significative",
      examen_endocrinien: null,
      conclusion:
        "Fièvre simple avec douleurs diffuses sans signe de gravité. Traitement symptomatique et surveillance.",
    },
  ]);
  console.log("  4 examens inserted.");

  // --- Ordonnances ---
  await db.insert(ordonnance).values([
    {
      id: ORD_1,
      rendez_vous_id: RDV_1,
      patient_id: PAT,
      utilisateur_id: UTILISATEUR_ID,
      remarques: "Traitement continu. Renouvellement trimestriel.",
      date_prescription: "2025-01-20",
    },
    {
      id: ORD_2,
      rendez_vous_id: RDV_2,
      patient_id: PAT,
      utilisateur_id: UTILISATEUR_ID,
      remarques: "Bilan biologique de contrôle: NFS, glycémie à jeun, HbA1c, bilan lipidique, créatinine, ionogramme.",
      date_prescription: "2025-02-05",
    },
    {
      id: ORD_3,
      rendez_vous_id: RDV_3,
      patient_id: PAT,
      utilisateur_id: UTILISATEUR_ID,
      remarques: "Renforcer le traitement de fond de l'asthme. Revoir dans 1 mois.",
      date_prescription: "2025-04-15",
    },
  ]);
  console.log("  3 ordonnances inserted.");

  await db.insert(ordonnance_medicaments).values([
    // Ordonnance 1: Asthme
    {
      id: OM_1,
      ordonnance_id: ORD_1,
      medicament_externe_id: "EXT-VENT-001",
      nom_medicament: "Ventoline",
      dci: "Salbutamol",
      dosage: "100mcg",
      posologie: "2 bouffées à la demande (max 8/jour)",
      duree_traitement: "Continu (renouvellement trimestriel)",
      instructions: "Bien agiter avant usage. Espacer de 4-6h minimum entre les prises.",
    },
    {
      id: OM_2,
      ordonnance_id: ORD_1,
      medicament_externe_id: "EXT-DESL-001",
      nom_medicament: "Desloratadine",
      dci: "Desloratadine",
      dosage: "5mg",
      posologie: "1 comprimé le matin",
      duree_traitement: "30 jours",
      instructions: "Peut provoquer une somnolence. Éviter la conduite si sensation de fatigue.",
    },
    // Ordonnance 2: HTA
    {
      id: OM_3,
      ordonnance_id: ORD_2,
      medicament_externe_id: "EXT-AMLO-001",
      nom_medicament: "Amlodipine",
      dci: "Amlodipine",
      dosage: "5mg",
      posologie: "1 comprimé le matin",
      duree_traitement: "3 mois (renouvellement)",
      instructions: "Surveiller les œdèmes des chevilles. Prendre à heure régulière.",
    },
    // Ordonnance 3: Asthme renforcé
    {
      id: OM_4,
      ordonnance_id: ORD_3,
      medicament_externe_id: "EXT-VENT-001",
      nom_medicament: "Ventoline",
      dci: "Salbutamol",
      dosage: "100mcg",
      posologie: "2 bouffées à la demande",
      duree_traitement: "Continu",
      instructions: "Même posologie qu'avant.",
    },
    {
      id: OM_5,
      ordonnance_id: ORD_3,
      medicament_externe_id: "EXT-FLIX-001",
      nom_medicament: "Flixotide",
      dci: "Fluticasone",
      dosage: "250mcg",
      posologie: "2 bouffées matin et soir",
      duree_traitement: "Continu (réévaluation dans 1 mois)",
      instructions: "NOUVEAU. Se rincer la bouche après inhalation pour éviter la candidose orale.",
    },
    {
      id: OM_6,
      ordonnance_id: ORD_3,
      medicament_externe_id: "EXT-AMLO-001",
      nom_medicament: "Amlodipine",
      dci: "Amlodipine",
      dosage: "5mg",
      posologie: "1 comprimé le matin",
      duree_traitement: "3 mois (renouvellement)",
      instructions: "Poursuite du traitement antihypertenseur.",
    },
  ]);
  console.log("  6 ordonnance_medicaments inserted.");

  // --- Historique traitements ---
  await db.insert(historique_traitements).values([
    {
      patient_id: PAT,
      medicament_externe_id: "EXT-VENT-001",
      nom_medicament: "Ventoline",
      dosage: "100mcg",
      posologie: "2 bouffées à la demande",
      est_actif: true,
      date_prescription: "2025-01-20",
      prescrit_par_utilisateur: UTILISATEUR_ID,
      ordonnance_id: ORD_1,
      ordonnance_medicament_id: OM_1,
      source_type: "ordonnance",
    },
    {
      patient_id: PAT,
      medicament_externe_id: "EXT-AMLO-001",
      nom_medicament: "Amlodipine",
      dosage: "5mg",
      posologie: "1 comprimé/jour",
      est_actif: true,
      date_prescription: "2025-02-05",
      prescrit_par_utilisateur: UTILISATEUR_ID,
      ordonnance_id: ORD_2,
      ordonnance_medicament_id: OM_3,
      source_type: "ordonnance",
    },
    {
      patient_id: PAT,
      medicament_externe_id: "EXT-FLIX-001",
      nom_medicament: "Flixotide",
      dosage: "250mcg",
      posologie: "2 bouffées 2x/jour",
      est_actif: true,
      date_prescription: "2025-04-15",
      prescrit_par_utilisateur: UTILISATEUR_ID,
      ordonnance_id: ORD_3,
      ordonnance_medicament_id: OM_5,
      source_type: "ordonnance",
    },
  ]);
  console.log("  3 historique_traitements inserted.");

  // --- Vaccinations ---
  await db.insert(vaccinations_patient).values([
    {
      patient_id: PAT,
      vaccin: "Grippe saisonnière 2024-2025",
      date_vaccination: "2024-10-15",
      notes: "Vaccination annuelle. Pas d'effets secondaires.",
    },
    {
      patient_id: PAT,
      vaccin: "COVID-19 (rappel bivalent)",
      date_vaccination: "2024-05-10",
      notes: "4ème dose. Légère douleur au point d'injection pendant 24h.",
    },
    {
      patient_id: PAT,
      vaccin: "Hépatite B (rappel)",
      date_vaccination: "2023-09-20",
      notes: "Rappel effectué. Sérologie HBs positive.",
    },
    {
      patient_id: PAT,
      vaccin: "Tétanos-Diphtérie (Td)",
      date_vaccination: "2022-11-05",
      notes: "Rappel décennal. Prochain rappel en 2032.",
    },
  ]);
  console.log("  4 vaccinations inserted.");

  // --- Documents ---
  await db.insert(documents_patient).values([
    {
      id: DOC_1,
      patient_id: PAT,
      categorie_id: CAT_LAB,
      type_document: "Analyse sanguine",
      nom_document: "Bilan_sanguin_Amara_2025-02.pdf",
      chemin_fichier: "/uploads/patients/b0000001/bilan_2025_02.pdf",
      type_fichier: "application/pdf",
      taille_fichier: 320000,
      description: "Bilan biologique complet: NFS, glycémie à jeun (5.2 mmol/L), HbA1c (5.4%), créatinine (82 µmol/L), bilan lipidique (CT 4.8, LDL 3.1, HDL 1.2, TG 1.1), ionogramme normal.",
      date_upload: "2025-02-10T09:00:00+01:00",
      uploade_par_utilisateur: UTILISATEUR_ID,
      est_archive: false,
    },
    {
      id: DOC_2,
      patient_id: PAT,
      categorie_id: CAT_IMAGING,
      type_document: "Radiographie",
      nom_document: "Radio_thorax_Amara_2025-01.pdf",
      chemin_fichier: "/uploads/patients/b0000001/radio_thorax_2025_01.pdf",
      type_fichier: "application/pdf",
      taille_fichier: 2100000,
      description: "Radiographie thoracique de face: pas d'anomalie, pas d'infiltrat, médiastin normal, cœur taille normale.",
      date_upload: "2025-01-18T14:30:00+01:00",
      uploade_par_utilisateur: UTILISATEUR_ID,
      est_archive: false,
    },
    {
      id: DOC_3,
      patient_id: PAT,
      categorie_id: CAT_COURRIER,
      type_document: "Certificat médical",
      nom_document: "Certificat_medical_Amara_2025-04.pdf",
      chemin_fichier: "/uploads/patients/b0000001/certificat_2025_04.pdf",
      type_fichier: "application/pdf",
      taille_fichier: 95000,
      description: "Certificat médical de continuité de traitement pour asthme allergique et HTA.",
      date_upload: "2025-04-16T10:00:00+01:00",
      uploade_par_utilisateur: UTILISATEUR_ID,
      est_archive: false,
    },
  ]);
  console.log("  3 documents inserted.");

  console.log(`\nRich patient seed completed!`);
  console.log(`Patient ID: ${PAT}`);
  console.log(`URL: http://localhost:3001/patients/${PAT}`);
  console.log(`\nSummary:`);
  console.log(`  - 1 patient (all 28 fields filled)`);
  console.log(`  - 5 antécédents (3 personnel + 2 familial) with details`);
  console.log(`  - 4 suivis actifs`);
  console.log(`  - 6 rendez-vous (4 completed, 2 upcoming)`);
  console.log(`  - 4 examens de consultation (all vital signs filled)`);
  console.log(`  - 3 ordonnances with 6 medicaments`);
  console.log(`  - 3 historique traitements`);
  console.log(`  - 4 vaccinations`);
  console.log(`  - 3 documents`);
  console.log(`  - 3 voyages`);
}

seedRichPatient()
  .catch((error) => {
    console.error("Rich patient seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
