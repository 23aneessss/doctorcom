/**
 * Demo female patient seed for doctor.com.
 *
 * Creates an idempotent, fully populated female patient profile with a simple
 * latest consultation that is easy for the ordonnance AI flow to handle.
 *
 * Usage: bun seed-demo-female-patient.ts
 */

import dotenv from "dotenv";
import { inArray, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  antecedents,
  antecedents_familiaux,
  antecedents_personnels,
  categories_documents,
  documents_patient,
  examen_consultation,
  historique_traitements,
  ordonnance,
  ordonnance_medicaments,
  patients,
  patients_femmes,
  rendez_vous,
  suivi,
  utilisateurs,
  vaccinations_patient,
  voyages_recents,
} from "./packages/db/src/schema";

dotenv.config({ path: "./apps/server/.env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required. Check apps/server/.env");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const db = drizzle({ client: pool });

const PAT = "c0000000-0000-4000-a000-000000000001";
const SUIVI_ROUTINE = "c1000000-0000-4000-a000-000000000001";
const SUIVI_SIMPLE = "c1000000-0000-4000-a000-000000000002";
const RDV_ROUTINE = "c2000000-0000-4000-a000-000000000001";
const RDV_SIMPLE = "c2000000-0000-4000-a000-000000000002";
const EXAM_ROUTINE = "c3000000-0000-4000-a000-000000000001";
const EXAM_SIMPLE = "c3000000-0000-4000-a000-000000000002";
const ORD_ROUTINE = "c4000000-0000-4000-a000-000000000001";
const OM_ROUTINE = "c5000000-0000-4000-a000-000000000001";
const ANT_MIGRAINE = "c6000000-0000-4000-a000-000000000001";
const ANT_RHINITE = "c6000000-0000-4000-a000-000000000002";
const ANT_APPENDICE = "c6000000-0000-4000-a000-000000000003";
const ANT_MERE = "c6000000-0000-4000-a000-000000000004";
const ANT_PERE = "c6000000-0000-4000-a000-000000000005";
const DOC_BILAN = "c7000000-0000-4000-a000-000000000001";
const DOC_ECHO = "c7000000-0000-4000-a000-000000000002";
const DOC_CERT = "c7000000-0000-4000-a000-000000000003";

const ORD_IDS = [ORD_ROUTINE];
const SUIVI_IDS = [SUIVI_ROUTINE, SUIVI_SIMPLE];
const ANT_IDS = [ANT_MIGRAINE, ANT_RHINITE, ANT_APPENDICE, ANT_MERE, ANT_PERE];

let utilisateurId = "";
let catLab = "";
let catImaging = "";
let catCourrier = "";

async function resolveDoctor() {
  const existingDoctor = await db
    .select({ id: utilisateurs.id })
    .from(utilisateurs)
    .where(eq(utilisateurs.email, "tbib@doctorcom.com"));

  if (existingDoctor[0]) {
    utilisateurId = existingDoctor[0].id;
    return;
  }

  utilisateurId = crypto.randomUUID();
  await db.insert(utilisateurs).values({
    id: utilisateurId,
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
}

async function ensureDocumentCategories() {
  const definitions = [
    {
      key: "lab",
      name: "Analyses de laboratoire",
      desc: "Résultats d'analyses sanguines, urinaires et biochimiques",
    },
    {
      key: "imaging",
      name: "Imagerie médicale",
      desc: "Radiographies, échographies, IRM, scanner",
    },
    {
      key: "courrier",
      name: "Courrier médical",
      desc: "Lettres d'orientation, certificats médicaux, correspondance",
    },
  ] as const;

  for (const category of definitions) {
    const existing = await db
      .select({ id: categories_documents.id })
      .from(categories_documents)
      .where(eq(categories_documents.nom, category.name));
    const id = existing[0]?.id ?? crypto.randomUUID();

    if (!existing[0]) {
      await db.insert(categories_documents).values({
        id,
        nom: category.name,
        description: category.desc,
      });
    }

    if (category.key === "lab") catLab = id;
    if (category.key === "imaging") catImaging = id;
    if (category.key === "courrier") catCourrier = id;
  }
}

async function clearExistingDemoPatient() {
  await db
    .delete(documents_patient)
    .where(eq(documents_patient.patient_id, PAT));
  await db
    .delete(vaccinations_patient)
    .where(eq(vaccinations_patient.patient_id, PAT));
  await db
    .delete(historique_traitements)
    .where(eq(historique_traitements.patient_id, PAT));
  await db
    .delete(ordonnance_medicaments)
    .where(inArray(ordonnance_medicaments.ordonnance_id, ORD_IDS));
  await db.delete(ordonnance).where(eq(ordonnance.patient_id, PAT));
  await db
    .delete(examen_consultation)
    .where(inArray(examen_consultation.suivi_id, SUIVI_IDS));
  await db.delete(rendez_vous).where(eq(rendez_vous.patient_id, PAT));
  await db.delete(suivi).where(eq(suivi.patient_id, PAT));
  await db
    .delete(antecedents_personnels)
    .where(
      inArray(antecedents_personnels.antecedent_id, [
        ANT_MIGRAINE,
        ANT_RHINITE,
        ANT_APPENDICE,
      ]),
    );
  await db
    .delete(antecedents_familiaux)
    .where(inArray(antecedents_familiaux.antecedent_id, [ANT_MERE, ANT_PERE]));
  await db.delete(antecedents).where(inArray(antecedents.id, ANT_IDS));
  await db.delete(voyages_recents).where(eq(voyages_recents.patient_id, PAT));
  await db.delete(patients_femmes).where(eq(patients_femmes.patient_id, PAT));
  await db.delete(patients).where(eq(patients.id, PAT));
}

async function seedDemoFemalePatient() {
  console.log("Seeding demo female patient...\n");
  await resolveDoctor();
  await ensureDocumentCategories();
  await clearExistingDemoPatient();

  await db.insert(patients).values({
    id: PAT,
    nom: "Saidi",
    prenom: "Nadia",
    telephone: "0556677889",
    email: "nadia.saidi@mail.dz",
    matricule: "PAT-2025-FEMME01",
    date_naissance: "1996-04-12",
    nss: 296041201,
    lieu_naissance: "Blida",
    sexe: "feminin",
    nationalite: "Algérienne",
    groupe_sanguin: "A+",
    adresse: "24 Rue Hassiba Ben Bouali, Alger Centre",
    profession: "Enseignante",
    habitudes_saines:
      "Marche 30 minutes 4 fois par semaine, alimentation équilibrée, sommeil régulier.",
    habitudes_toxiques: "Non fumeuse, pas d'alcool, café 1 tasse/jour.",
    nb_enfants: 1,
    situation_familiale: "Mariée",
    age_circoncision: null,
    date_admission: "2025-03-12",
    environnement_animal: "Aucun animal domestique.",
    revenu_mensuel: "95000",
    taille_menage: 3,
    nb_pieces: 4,
    niveau_intellectuel: "Universitaire",
    activite_sexuelle: true,
    relations_environnement: "Cadre familial stable, bon soutien social.",
    cree_par_utilisateur: utilisateurId,
  });

  await db.insert(patients_femmes).values({
    patient_id: PAT,
    menarche: 13,
    regularite_cycles: "Cycles réguliers de 28 à 30 jours",
    contraception: "DIU cuivre posé en 2023",
    nb_grossesses: 1,
    nb_cesariennes: 0,
    menopause: false,
    age_menopause: null,
    symptomes_menopause: null,
  });

  await db.insert(voyages_recents).values([
    {
      patient_id: PAT,
      destination: "Tunisie (Tunis)",
      date: "2024-12-28",
      duree_jours: 5,
      epidemies_destination: "Aucune alerte sanitaire signalée",
    },
    {
      patient_id: PAT,
      destination: "France (Lyon)",
      date: "2025-02-14",
      duree_jours: 7,
      epidemies_destination: "Grippe saisonnière en circulation",
    },
  ]);

  await db.insert(antecedents).values([
    {
      id: ANT_MIGRAINE,
      patient_id: PAT,
      type: "personnel",
      description: "Migraines occasionnelles sans aura",
    },
    {
      id: ANT_RHINITE,
      patient_id: PAT,
      type: "personnel",
      description: "Rhinite allergique saisonnière légère",
    },
    {
      id: ANT_APPENDICE,
      patient_id: PAT,
      type: "personnel",
      description: "Appendicectomie en 2018",
    },
    {
      id: ANT_MERE,
      patient_id: PAT,
      type: "familial",
      description: "Mère suivie pour diabète de type 2",
    },
    {
      id: ANT_PERE,
      patient_id: PAT,
      type: "familial",
      description: "Père suivi pour hypertension artérielle",
    },
  ]);

  await db.insert(antecedents_personnels).values([
    {
      antecedent_id: ANT_MIGRAINE,
      type: "Neurologique",
      details:
        "Migraines rares, 1 à 2 épisodes par mois, calmées par repos et antalgique simple.",
      est_actif: true,
    },
    {
      antecedent_id: ANT_RHINITE,
      type: "Allergique",
      details:
        "Rhinite saisonnière au printemps. Pas d'allergie médicamenteuse connue.",
      est_actif: true,
    },
    {
      antecedent_id: ANT_APPENDICE,
      type: "Chirurgical",
      details: "Appendicectomie simple en 2018, sans complication.",
      est_actif: false,
    },
  ]);

  await db.insert(antecedents_familiaux).values([
    {
      antecedent_id: ANT_MERE,
      details: "Diabète de type 2 sous traitement oral, bien équilibré.",
      lien_parente: "Mère",
    },
    {
      antecedent_id: ANT_PERE,
      details: "Hypertension artérielle contrôlée par monothérapie.",
      lien_parente: "Père",
    },
  ]);

  await db.insert(suivi).values([
    {
      id: SUIVI_ROUTINE,
      patient_id: PAT,
      utilisateur_id: utilisateurId,
      hypothese_diagnostic: "Suivi gynécologique de routine",
      motif: "Suivi gynécologique et contraception",
      historique:
        "Patiente porteuse d'un DIU cuivre depuis 2023, cycles réguliers, pas de plainte gynécologique actuelle.",
      date_ouverture: "2025-04-02",
      date_fermeture: null,
      est_actif: true,
    },
    {
      id: SUIVI_SIMPLE,
      patient_id: PAT,
      utilisateur_id: utilisateurId,
      hypothese_diagnostic:
        "Fièvre simple avec douleurs diffuses sans signe de gravité",
      motif: "Fièvre modérée et douleurs diffuses",
      historique:
        "Episode aigu de fièvre modérée avec courbatures depuis 24h, sans dyspnée, sans douleur thoracique, sans vomissements et sans signe de gravité.",
      date_ouverture: "2025-07-05",
      date_fermeture: null,
      est_actif: true,
    },
  ]);

  await db.insert(rendez_vous).values([
    {
      id: RDV_ROUTINE,
      patient_id: PAT,
      suivi_id: SUIVI_ROUTINE,
      utilisateur_id: utilisateurId,
      date: "2025-04-02",
      heure: "09:30",
      heure_fin: "10:00",
      statut: "termine",
      type_creneau: "consultation",
      patient_label: "Nadia Saidi",
      patient_initials: "NS",
      couleur: "#76BBDD",
      notes: "Contrôle annuel, pas de plainte particulière.",
      important: false,
      frequence_rappel: "12 mois",
      periode_rappel: "annuel",
    },
    {
      id: RDV_SIMPLE,
      patient_id: PAT,
      suivi_id: SUIVI_SIMPLE,
      utilisateur_id: utilisateurId,
      date: "2025-07-05",
      heure: "15:30",
      heure_fin: "16:00",
      statut: "termine",
      type_creneau: "consultation",
      patient_label: "Nadia Saidi",
      patient_initials: "NS",
      couleur: "#F97316",
      notes: "Consultation aiguë simple pour fièvre et douleurs.",
      important: false,
      frequence_rappel: null,
      periode_rappel: null,
    },
  ]);

  await db.insert(examen_consultation).values([
    {
      id: EXAM_ROUTINE,
      rendez_vous_id: RDV_ROUTINE,
      suivi_id: SUIVI_ROUTINE,
      date: "2025-04-02",
      taille: "164",
      poids: "61",
      tension_arterielle: "112/70",
      frequence_cardiaque: 72,
      temperature: "36.7",
      spo2: "99",
      imc: "22.7",
      traitement_prescrit:
        "Aucun traitement nouveau. Poursuite du suivi annuel.",
      description_consultation:
        "Contrôle gynécologique de routine. DIU bien toléré, cycles réguliers, pas de douleurs pelviennes.",
      aspect_general:
        "Bon état général, patiente consciente, stable, bien hydratée.",
      examen_respiratoire: "Normal.",
      examen_cardiovasculaire: "BDC réguliers, TA 112/70, pas de souffle.",
      examen_cutane_muqueux: "Muqueuses normo-colorées.",
      examen_orl: null,
      examen_digestif: "Abdomen souple et indolore.",
      examen_neurologique: "Normal.",
      examen_locomoteur: null,
      examen_genital: "Pas de plainte, DIU bien toléré selon interrogatoire.",
      examen_urinaire: "Pas de brûlure mictionnelle.",
      examen_ganglionnaire: "Pas d'adénopathie.",
      examen_endocrinien: null,
      conclusion: "Contrôle rassurant. Suivi annuel conseillé.",
    },
    {
      id: EXAM_SIMPLE,
      rendez_vous_id: RDV_SIMPLE,
      suivi_id: SUIVI_SIMPLE,
      date: "2025-07-05",
      taille: "164",
      poids: "61",
      tension_arterielle: "110/70",
      frequence_cardiaque: 84,
      temperature: "38.2",
      spo2: "98",
      imc: "22.7",
      traitement_prescrit:
        "Antalgique / antipyrétique simple si besoin, hydratation, repos et surveillance.",
      description_consultation:
        "Patiente vue pour fièvre modérée, céphalées légères et douleurs diffuses depuis 24h. Pas de dyspnée, pas de douleur thoracique, pas de vomissements, pas de signe de gravité.",
      aspect_general:
        "Etat général conservé, patiente stable, consciente, hydratation correcte.",
      examen_respiratoire:
        "Auscultation pulmonaire libre, SpO2 98%, pas de dyspnée.",
      examen_cardiovasculaire: "BDC réguliers, FC 84/min, TA 110/70.",
      examen_cutane_muqueux: "Pas d'éruption cutanée, pas de purpura.",
      examen_orl:
        "Gorge discrètement inflammatoire sans exsudat, rhinorrhée légère.",
      examen_digestif: "Abdomen souple, non douloureux, pas de vomissements.",
      examen_neurologique:
        "Pas de syndrome méningé, examen neurologique rassurant.",
      examen_locomoteur: "Courbatures diffuses sans déficit.",
      examen_genital: null,
      examen_urinaire: "Pas de brûlure mictionnelle.",
      examen_ganglionnaire: "Pas d'adénopathie significative.",
      examen_endocrinien: null,
      conclusion:
        "Fièvre simple avec douleurs diffuses sans signe de gravité. Traitement symptomatique, repos, hydratation et surveillance.",
    },
  ]);

  await db.insert(ordonnance).values({
    id: ORD_ROUTINE,
    rendez_vous_id: RDV_ROUTINE,
    patient_id: PAT,
    utilisateur_id: utilisateurId,
    remarques:
      "Traitement ponctuel en cas de symptômes allergiques saisonniers.",
    date_prescription: "2025-04-02",
  });

  await db.insert(ordonnance_medicaments).values({
    id: OM_ROUTINE,
    ordonnance_id: ORD_ROUTINE,
    medicament_externe_id: "EXT-DESL-DEMO",
    nom_medicament: "Desloratadine",
    dci: "Desloratadine",
    dosage: "5mg",
    posologie: "1 comprimé le soir si symptômes allergiques",
    duree_traitement: "7 jours si besoin",
    instructions:
      "Arrêter si somnolence importante. Ne pas dépasser 1 comprimé par jour.",
  });

  await db.insert(historique_traitements).values({
    patient_id: PAT,
    medicament_externe_id: "EXT-DESL-DEMO",
    nom_medicament: "Desloratadine",
    dosage: "5mg",
    posologie: "1 comprimé le soir si symptômes allergiques",
    est_actif: false,
    date_prescription: "2025-04-02",
    prescrit_par_utilisateur: utilisateurId,
    ordonnance_id: ORD_ROUTINE,
    ordonnance_medicament_id: OM_ROUTINE,
    source_type: "ordonnance",
  });

  await db.insert(vaccinations_patient).values([
    {
      patient_id: PAT,
      vaccin: "Grippe saisonnière 2024-2025",
      date_vaccination: "2024-10-20",
      notes: "Vaccination bien tolérée.",
    },
    {
      patient_id: PAT,
      vaccin: "COVID-19 rappel",
      date_vaccination: "2024-04-18",
      notes: "Aucun effet secondaire notable.",
    },
    {
      patient_id: PAT,
      vaccin: "Tétanos-Diphtérie",
      date_vaccination: "2023-06-12",
      notes: "Rappel effectué.",
    },
  ]);

  await db.insert(documents_patient).values([
    {
      id: DOC_BILAN,
      patient_id: PAT,
      categorie_id: catLab,
      type_document: "Analyse sanguine",
      nom_document: "Bilan_sanguin_Saidi_2025-04.pdf",
      chemin_fichier: "/uploads/patients/demo-femme/bilan_2025_04.pdf",
      type_fichier: "application/pdf",
      taille_fichier: 245000,
      description:
        "NFS normale, CRP normale, glycémie à jeun normale, créatinine normale, bilan lipidique rassurant.",
      date_upload: "2025-04-03T10:00:00+01:00",
      uploade_par_utilisateur: utilisateurId,
      est_archive: false,
    },
    {
      id: DOC_ECHO,
      patient_id: PAT,
      categorie_id: catImaging,
      type_document: "Échographie pelvienne",
      nom_document: "Echo_pelvienne_Saidi_2025-04.pdf",
      chemin_fichier: "/uploads/patients/demo-femme/echo_pelvienne_2025_04.pdf",
      type_fichier: "application/pdf",
      taille_fichier: 780000,
      description:
        "Échographie pelvienne rassurante, DIU en place, pas d'anomalie.",
      date_upload: "2025-04-04T11:30:00+01:00",
      uploade_par_utilisateur: utilisateurId,
      est_archive: false,
    },
    {
      id: DOC_CERT,
      patient_id: PAT,
      categorie_id: catCourrier,
      type_document: "Certificat médical",
      nom_document: "Certificat_Saidi_2025-07.pdf",
      chemin_fichier: "/uploads/patients/demo-femme/certificat_2025_07.pdf",
      type_fichier: "application/pdf",
      taille_fichier: 93000,
      description: "Certificat de repos court lié à un épisode fébrile simple.",
      date_upload: "2025-07-05T16:20:00+01:00",
      uploade_par_utilisateur: utilisateurId,
      est_archive: false,
    },
  ]);

  console.log("Demo female patient seed completed!");
  console.log(`Patient: Nadia Saidi`);
  console.log(`Patient ID: ${PAT}`);
  console.log(`Latest suivi: ${SUIVI_SIMPLE}`);
  console.log(`Latest examen: ${EXAM_SIMPLE}`);
  console.log(`URL: http://localhost:3001/patients/${PAT}`);
}

seedDemoFemalePatient()
  .catch((error) => {
    console.error("Demo female patient seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
