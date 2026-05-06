/**
 * Demo female patient seed for doctor.com.
 *
 * Creates an idempotent, fully populated female patient profile with rich
 * clinical data optimised for the ordonnance AI recommendation flow.
 *
 * Usage:
 *   bun seed-demo-female-patient.ts
 *   SEED_DOCTOR_EMAIL=your@email.com bun seed-demo-female-patient.ts
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
  certificats_medicaux,
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

// ── Fixed UUIDs (idempotent re-seeding) ───────────────────────────────────────
const PAT           = "c0000000-0000-4000-a000-000000000001";
const SUIVI_GYN     = "c1000000-0000-4000-a000-000000000001";
const SUIVI_FIEVRE  = "c1000000-0000-4000-a000-000000000002";
const SUIVI_ORL     = "c1000000-0000-4000-a000-000000000003";
const RDV_GYN       = "c2000000-0000-4000-a000-000000000001";
const RDV_FIEVRE    = "c2000000-0000-4000-a000-000000000002";
const RDV_ORL       = "c2000000-0000-4000-a000-000000000003";
const EXAM_GYN      = "c3000000-0000-4000-a000-000000000001";
const EXAM_FIEVRE   = "c3000000-0000-4000-a000-000000000002";
const EXAM_ORL      = "c3000000-0000-4000-a000-000000000003";
const ORD_GYN       = "c4000000-0000-4000-a000-000000000001";
const ORD_ORL       = "c4000000-0000-4000-a000-000000000002";
const OM_GYN_1      = "c5000000-0000-4000-a000-000000000001";
const OM_ORL_1      = "c5000000-0000-4000-a000-000000000002";
const OM_ORL_2      = "c5000000-0000-4000-a000-000000000003";
const OM_ORL_3      = "c5000000-0000-4000-a000-000000000004";
const ANT_MIGRAINE  = "c6000000-0000-4000-a000-000000000001";
const ANT_RHINITE   = "c6000000-0000-4000-a000-000000000002";
const ANT_APPENDICE = "c6000000-0000-4000-a000-000000000003";
const ANT_MERE      = "c6000000-0000-4000-a000-000000000004";
const ANT_PERE      = "c6000000-0000-4000-a000-000000000005";
const DOC_BILAN     = "c7000000-0000-4000-a000-000000000001";
const DOC_ECHO      = "c7000000-0000-4000-a000-000000000002";
const DOC_CERT      = "c7000000-0000-4000-a000-000000000003";

const ORD_IDS  = [ORD_GYN, ORD_ORL];
const SUIVI_IDS = [SUIVI_GYN, SUIVI_FIEVRE, SUIVI_ORL];
const ANT_IDS  = [ANT_MIGRAINE, ANT_RHINITE, ANT_APPENDICE, ANT_MERE, ANT_PERE];

let utilisateurId = "";
let catLab = "";
let catImaging = "";
let catCourrier = "";

async function resolveDoctor() {
  const targetEmail = process.env.SEED_DOCTOR_EMAIL ?? "tbib@doctorcom.com";

  // 1. Try the configured / default email first
  const byEmail = await db
    .select({ id: utilisateurs.id })
    .from(utilisateurs)
    .where(eq(utilisateurs.email, targetEmail))
    .limit(1);

  if (byEmail[0]) {
    utilisateurId = byEmail[0].id;
    console.log(`Using existing doctor: ${targetEmail}`);
    return;
  }

  // 2. Fall back to the first existing doctor in the database
  const anyDoctor = await db
    .select({ id: utilisateurs.id, email: utilisateurs.email })
    .from(utilisateurs)
    .limit(1);

  if (anyDoctor[0]) {
    utilisateurId = anyDoctor[0].id;
    console.log(`Using first existing doctor: ${anyDoctor[0].email}`);
    return;
  }

  // 3. Create the demo doctor as last resort
  utilisateurId = crypto.randomUUID();
  await db.insert(utilisateurs).values({
    id: utilisateurId,
    nom: "Benmoussa",
    prenom: "Karim",
    email: targetEmail,
    adresse: "12 Rue Didouche Mourad, Alger",
    telephone: "0555123456",
    mot_de_passe_hash:
      "6cd52985440601603e7843477cedb8fc:5dedf7d78117fce867a08ae7eea93ff0daf8dcd5e243c481662b5e3b92e604412643f2fb801b5723fab8c886fe485545c86b2498ddc90a59a829edb0d20729ce",
    date_creation: "2024-01-15",
    role: "medecin",
  });
  console.log(`Created new demo doctor: ${targetEmail}`);
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
  // Delete certificats_medicaux first (FK → documents_patient)
  const docsToDelete = await db
    .select({ id: documents_patient.id })
    .from(documents_patient)
    .where(eq(documents_patient.patient_id, PAT));
  if (docsToDelete.length > 0) {
    const docIds = docsToDelete.map((d) => d.id);
    await db.delete(certificats_medicaux).where(inArray(certificats_medicaux.documents_patient_id, docIds));
  }
  await db.delete(documents_patient).where(eq(documents_patient.patient_id, PAT));
  await db.delete(vaccinations_patient).where(eq(vaccinations_patient.patient_id, PAT));
  await db.delete(historique_traitements).where(eq(historique_traitements.patient_id, PAT));
  // Delete ALL ordonnance_medicaments for this patient's ordonnances (not just known IDs)
  const allOrdonnances = await db
    .select({ id: ordonnance.id })
    .from(ordonnance)
    .where(eq(ordonnance.patient_id, PAT));
  if (allOrdonnances.length > 0) {
    const allOrdIds = allOrdonnances.map((o) => o.id);
    await db.delete(ordonnance_medicaments).where(inArray(ordonnance_medicaments.ordonnance_id, allOrdIds));
  }
  await db.delete(ordonnance).where(eq(ordonnance.patient_id, PAT));
  // Delete ALL examen_consultation for this patient's suivis
  const allSuivis = await db
    .select({ id: suivi.id })
    .from(suivi)
    .where(eq(suivi.patient_id, PAT));
  if (allSuivis.length > 0) {
    const allSuiviIds = allSuivis.map((s) => s.id);
    await db.delete(examen_consultation).where(inArray(examen_consultation.suivi_id, allSuiviIds));
  }
  await db.delete(rendez_vous).where(eq(rendez_vous.patient_id, PAT));
  await db.delete(suivi).where(eq(suivi.patient_id, PAT));
  await db
    .delete(antecedents_personnels)
    .where(inArray(antecedents_personnels.antecedent_id, [ANT_MIGRAINE, ANT_RHINITE, ANT_APPENDICE]));
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

  // ── Patient ──────────────────────────────────────────────────────────────────
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
    // Recent admission so it appears in the dashboard trend chart (last 21 days)
    date_admission: "2026-04-20",
    environnement_animal: "Aucun animal domestique.",
    revenu_mensuel: "95000",
    taille_menage: 3,
    nb_pieces: 4,
    niveau_intellectuel: "Universitaire",
    activite_sexuelle: true,
    relations_environnement: "Cadre familial stable, bon soutien social.",
    cree_par_utilisateur: utilisateurId,
  });

  // ── Feminine health ───────────────────────────────────────────────────────────
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

  // ── Travel history ────────────────────────────────────────────────────────────
  await db.insert(voyages_recents).values([
    {
      patient_id: PAT,
      destination: "Tunisie (Tunis)",
      date: "2025-12-28",
      duree_jours: 5,
      epidemies_destination: "Aucune alerte sanitaire signalée",
    },
    {
      patient_id: PAT,
      destination: "France (Lyon)",
      date: "2026-02-14",
      duree_jours: 7,
      epidemies_destination: "Grippe saisonnière en circulation",
    },
  ]);

  // ── Antécédents ───────────────────────────────────────────────────────────────
  await db.insert(antecedents).values([
    { id: ANT_MIGRAINE,  patient_id: PAT, type: "personnel", description: "Migraines occasionnelles sans aura" },
    { id: ANT_RHINITE,   patient_id: PAT, type: "personnel", description: "Rhinite allergique saisonnière légère (printemps)" },
    { id: ANT_APPENDICE, patient_id: PAT, type: "personnel", description: "Appendicectomie en 2018" },
    { id: ANT_MERE,      patient_id: PAT, type: "familial",  description: "Mère suivie pour diabète de type 2" },
    { id: ANT_PERE,      patient_id: PAT, type: "familial",  description: "Père suivi pour hypertension artérielle" },
  ]);

  await db.insert(antecedents_personnels).values([
    {
      antecedent_id: ANT_MIGRAINE,
      type: "Neurologique",
      details: "Migraines rares, 1 à 2 épisodes par mois, calmées par paracétamol ou ibuprofène. Pas de traitement de fond.",
      est_actif: true,
    },
    {
      antecedent_id: ANT_RHINITE,
      type: "Allergique",
      details: "Rhinite allergique saisonnière au printemps. Sensibilité aux pollens. Pas d'allergie médicamenteuse connue.",
      est_actif: true,
    },
    {
      antecedent_id: ANT_APPENDICE,
      type: "Chirurgical",
      details: "Appendicectomie simple en 2018, sans complication post-opératoire.",
      est_actif: false,
    },
  ]);

  await db.insert(antecedents_familiaux).values([
    { antecedent_id: ANT_MERE, details: "Diabète de type 2 sous metformine, bien équilibré.", lien_parente: "Mère" },
    { antecedent_id: ANT_PERE, details: "Hypertension artérielle contrôlée par amlodipine 5 mg.", lien_parente: "Père" },
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Consultation 1 — Suivi gynécologique de routine (2026-04-20)
  // ─────────────────────────────────────────────────────────────────────────────
  await db.insert(suivi).values({
    id: SUIVI_GYN,
    patient_id: PAT,
    utilisateur_id: utilisateurId,
    hypothese_diagnostic: "Suivi gynécologique annuel — rhinite allergique saisonnière au printemps",
    motif: "Contrôle gynécologique annuel et gestion de la rhinite allergique printanière",
    historique:
      "Patiente porteuse d'un DIU cuivre depuis 2023, cycles réguliers, pas de plainte gynécologique. " +
      "Consulte également pour rhinorrhée persistante, éternuements et prurit nasal depuis 2 semaines. " +
      "Contexte de période pollinique. Pas d'allergie médicamenteuse connue.",
    date_ouverture: "2026-04-20",
    date_fermeture: null,
    est_actif: false,
  });

  await db.insert(rendez_vous).values({
    id: RDV_GYN,
    patient_id: PAT,
    suivi_id: SUIVI_GYN,
    utilisateur_id: utilisateurId,
    date: "2026-04-20",
    heure: "09:30",
    heure_fin: "10:00",
    statut: "termine",
    type_creneau: "consultation",
    patient_label: "Nadia Saidi",
    patient_initials: "NS",
    couleur: "#76BBDD",
    notes: "Contrôle annuel + rhinite allergique.",
    important: false,
    frequence_rappel: "12 mois",
    periode_rappel: "annuel",
  });

  await db.insert(examen_consultation).values({
    id: EXAM_GYN,
    rendez_vous_id: RDV_GYN,
    suivi_id: SUIVI_GYN,
    date: "2026-04-20",
    taille: "164",
    poids: "61",
    tension_arterielle: "112/70",
    frequence_cardiaque: 72,
    temperature: "36.7",
    spo2: "99",
    imc: "22.7",
    traitement_prescrit:
      "Desloratadine 5 mg : 1 comprimé le soir pendant 14 jours. " +
      "Spray nasal de cromoglycate de sodium si besoin. " +
      "Poursuite du suivi gynécologique annuel.",
    description_consultation:
      "Contrôle gynécologique de routine normal. DIU cuivre bien toléré, cycles réguliers 28-30 j, pas de dysménorrhée ni de métrorragie. " +
      "Rhinite allergique saisonnière au pollen : rhinorrhée claire bilatérale, éternuements fréquents, prurit nasal et oculaire. " +
      "Pas d'obstruction nasale majeure, pas d'asthme, auscultation pulmonaire libre.",
    aspect_general: "Bon état général, patiente consciente, stable.",
    examen_respiratoire: "Auscultation pulmonaire libre, SpO2 99%.",
    examen_cardiovasculaire: "BDC réguliers, TA 112/70, pas de souffle.",
    examen_cutane_muqueux: "Muqueuses normo-colorées. Légère hyperémie conjonctivale bilatérale.",
    examen_orl: "Muqueuse nasale rosée, légèrement œdématiée. Pas d'infection bactérienne. Gorge libre.",
    examen_digestif: "Abdomen souple et indolore.",
    examen_neurologique: "Normal.",
    examen_locomoteur: null,
    examen_genital: "DIU bien toléré, pas de plainte.",
    examen_urinaire: "Pas de brûlure mictionnelle.",
    examen_ganglionnaire: "Pas d'adénopathie.",
    examen_endocrinien: null,
    conclusion:
      "Contrôle gynécologique rassurant. Rhinite allergique saisonnière aux pollens sans complication. " +
      "Traitement antihistaminique de 2e génération prescrit. Suivi annuel conseillé.",
  });

  await db.insert(ordonnance).values({
    id: ORD_GYN,
    rendez_vous_id: RDV_GYN,
    patient_id: PAT,
    utilisateur_id: utilisateurId,
    remarques:
      "Rhinite allergique saisonnière — traitement antihistaminique. " +
      "Arrêter si somnolence résiduelle malgré la 2e génération.",
    date_prescription: "2026-04-20",
  });

  await db.insert(ordonnance_medicaments).values({
    id: OM_GYN_1,
    ordonnance_id: ORD_GYN,
    medicament_externe_id: "EXT-DESL-DEMO",
    nom_medicament: "Desloratadine",
    dci: "Desloratadine",
    dosage: "5 mg",
    posologie: "1 comprimé le soir",
    duree_traitement: "14 jours",
    instructions: "Ne pas dépasser 1 cp/j. Éviter l'alcool.",
  });

  await db.insert(historique_traitements).values({
    patient_id: PAT,
    medicament_externe_id: "EXT-DESL-DEMO",
    nom_medicament: "Desloratadine",
    dosage: "5 mg",
    posologie: "1 comprimé le soir",
    est_actif: false,
    date_prescription: "2026-04-20",
    prescrit_par_utilisateur: utilisateurId,
    ordonnance_id: ORD_GYN,
    ordonnance_medicament_id: OM_GYN_1,
    source_type: "ordonnance",
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Consultation 2 — Fièvre aiguë sans signe de gravité (2026-05-01)
  // ─────────────────────────────────────────────────────────────────────────────
  await db.insert(suivi).values({
    id: SUIVI_FIEVRE,
    patient_id: PAT,
    utilisateur_id: utilisateurId,
    hypothese_diagnostic: "Syndrome grippal — fièvre aiguë avec myalgies et céphalées",
    motif: "Fièvre à 38.4 °C, myalgies diffuses et céphalées depuis 48 h",
    historique:
      "Fièvre à 38.4 °C apparue il y a 48 h, avec myalgies importantes, céphalées frontales modérées et asthénie. " +
      "Pas de dyspnée, pas de douleur thoracique, pas de signes méningés. " +
      "Contact récent avec des collègues grippés. Pas de traitement en cours.",
    date_ouverture: "2026-05-01",
    date_fermeture: null,
    est_actif: false,
  });

  await db.insert(rendez_vous).values({
    id: RDV_FIEVRE,
    patient_id: PAT,
    suivi_id: SUIVI_FIEVRE,
    utilisateur_id: utilisateurId,
    date: "2026-05-01",
    heure: "15:30",
    heure_fin: "16:00",
    statut: "termine",
    type_creneau: "consultation",
    patient_label: "Nadia Saidi",
    patient_initials: "NS",
    couleur: "#F97316",
    notes: "Syndrome grippal — traitement symptomatique.",
    important: false,
    frequence_rappel: null,
    periode_rappel: null,
  });

  await db.insert(examen_consultation).values({
    id: EXAM_FIEVRE,
    rendez_vous_id: RDV_FIEVRE,
    suivi_id: SUIVI_FIEVRE,
    date: "2026-05-01",
    taille: "164",
    poids: "61",
    tension_arterielle: "110/70",
    frequence_cardiaque: 88,
    temperature: "38.4",
    spo2: "98",
    imc: "22.7",
    traitement_prescrit:
      "Paracétamol 1 g : 1 comprimé toutes les 6 h si fièvre ou douleur, max 4 g/j, pendant 5 jours. " +
      "Hydratation abondante. Repos. Surveillance.",
    description_consultation:
      "Syndrome grippal typique : fièvre à 38.4 °C depuis 48 h, myalgies diffuses cotées 6/10, céphalées frontales modérées 5/10, asthénie marquée. " +
      "Pas de dyspnée, pas de douleur thoracique, pas de vomissements, pas de signes de gravité. " +
      "Notion de contage grippal en milieu scolaire.",
    aspect_general: "État général conservé, patiente stable, consciente, bien hydratée.",
    examen_respiratoire: "Auscultation pulmonaire libre, pas de foyer, SpO2 98%.",
    examen_cardiovasculaire: "BDC réguliers, FC 88/min, TA 110/70.",
    examen_cutane_muqueux: "Pas d'éruption cutanée.",
    examen_orl: "Gorge légèrement congestive, pas d'exsudat, rhinorrhée légère.",
    examen_digestif: "Abdomen souple et indolore.",
    examen_neurologique: "Pas de syndrome méningé.",
    examen_locomoteur: "Myalgies diffuses à la palpation sans déficit moteur.",
    examen_genital: null,
    examen_urinaire: "Pas de brûlure mictionnelle.",
    examen_ganglionnaire: "Pas d'adénopathie.",
    examen_endocrinien: null,
    conclusion:
      "Syndrome grippal sans signe de gravité. Traitement antipyrétique et antalgique par paracétamol. " +
      "Repos et hydratation. Réévaluation si aggravation ou persistance au-delà de 5 jours.",
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Consultation 3 — Rhinopharyngite aiguë + angine érythémateuse (2026-05-03)
  // This is the richest case for AI ordonnance recommendation.
  // ─────────────────────────────────────────────────────────────────────────────
  await db.insert(suivi).values({
    id: SUIVI_ORL,
    patient_id: PAT,
    utilisateur_id: utilisateurId,
    hypothese_diagnostic:
      "Rhinopharyngite aiguë virale avec angine érythémateuse — score de Centor modifié ≤ 1 (origine virale probable)",
    motif:
      "Mal de gorge intense, rhinorrhée, fièvre à 37.9 °C et otalgie droite légère depuis 3 jours",
    historique:
      "Patiente de 30 ans consultante pour douleur pharyngée intense, rhinorrhée claire, fièvre modérée à 37.9 °C, " +
      "otalgie droite légère et légère dysphagie depuis 3 jours. " +
      "Pas d'adénopathies palpables, pas de difficulté respiratoire. Score de Centor modifié = 1 (fièvre). " +
      "Antécédent de rhinite allergique saisonnière. Pas d'allergie aux bêta-lactamines ni aux AINS. " +
      "Prise de paracétamol 1 g x 3/j depuis la veille avec soulagement partiel.",
    date_ouverture: "2026-05-03",
    date_fermeture: null,
    est_actif: true,
  });

  await db.insert(rendez_vous).values({
    id: RDV_ORL,
    patient_id: PAT,
    suivi_id: SUIVI_ORL,
    utilisateur_id: utilisateurId,
    date: "2026-05-03",
    heure: "11:00",
    heure_fin: "11:30",
    statut: "termine",
    type_creneau: "consultation",
    patient_label: "Nadia Saidi",
    patient_initials: "NS",
    couleur: "#10b981",
    notes: "Rhinopharyngite virale — traitement symptomatique.",
    important: false,
    frequence_rappel: null,
    periode_rappel: null,
  });

  await db.insert(examen_consultation).values({
    id: EXAM_ORL,
    rendez_vous_id: RDV_ORL,
    suivi_id: SUIVI_ORL,
    date: "2026-05-03",
    taille: "164",
    poids: "61",
    tension_arterielle: "114/72",
    frequence_cardiaque: 80,
    temperature: "37.9",
    spo2: "99",
    imc: "22.7",
    traitement_prescrit:
      "1) Paracétamol 1 g : 1 cp toutes les 6 h si douleur/fièvre, max 4 g/j, pendant 5 jours. " +
      "2) Ibuprofène 400 mg : 1 cp toutes les 8 h au cours des repas si douleur intense, max 3 j (CI si ulcère, grossesse). " +
      "3) Hexétidine solution buccale 0,1 % : bains de bouche 3×/j pendant 5 jours. " +
      "4) Oxymétazoline spray nasal 0,05 % : 2 pulvérisations par narine matin et soir, max 5 jours. " +
      "Hydratation abondante, repos, surveiller si aggravation.",
    description_consultation:
      "Rhinopharyngite aiguë virale probable. Angine érythémateuse simple sans exsudat, sans pseudo-membrane. " +
      "Score de Centor modifié à 1 (présence de fièvre uniquement) — antibiothérapie non indiquée. " +
      "Pharynx érythémateux, amygdales légèrement hypertrophiées sans dépôt, rhinorrhée claire. " +
      "Otalgie droite légère d'allure réflexe, tympan normal à l'otoscope. " +
      "Auscultation pulmonaire normale, pas de foyer de pneumopathie.",
    aspect_general: "État général conservé, patiente stable, bien hydratée, consciente.",
    examen_respiratoire: "Auscultation pulmonaire libre, pas de sibilants, SpO2 99%.",
    examen_cardiovasculaire: "BDC réguliers, FC 80/min, TA 114/72.",
    examen_cutane_muqueux: "Légère hyperhémie faciale. Pas d'éruption.",
    examen_orl:
      "Pharynx érythémateux diffus. Amygdales hypertrophiées grade II sans exsudat ni pseudo-membrane. " +
      "Rhinorrhée antérieure claire. Tympan droit rosé, non bombant, réflexe lumineux conservé. " +
      "Ganglions sous-maxillaires bilatéraux sensibles, mobiles, < 1 cm.",
    examen_digestif: "Abdomen souple, indolore.",
    examen_neurologique: "Sans particularité.",
    examen_locomoteur: null,
    examen_genital: null,
    examen_urinaire: "Sans particularité.",
    examen_ganglionnaire: "Adénopathies cervicales antérieures bilatérales sensibles, petites, réactionnelles.",
    examen_endocrinien: null,
    conclusion:
      "Rhinopharyngite aiguë virale avec angine érythémateuse — score Centor ≤ 1, pas d'indication à l'antibiothérapie. " +
      "Traitement symptomatique : antalgique/antipyrétique (paracétamol ± ibuprofène), antiseptique buccal et décongestionnant nasal. " +
      "Consulter en urgence si dyspnée, trismus, fièvre > 39 °C persistant au-delà de 5 jours.",
  });

  await db.insert(ordonnance).values({
    id: ORD_ORL,
    rendez_vous_id: RDV_ORL,
    patient_id: PAT,
    utilisateur_id: utilisateurId,
    remarques:
      "Rhinopharyngite virale — pas d'antibiothérapie. " +
      "Réévaluation si persistance > 5 j, fièvre > 39 °C, dyspnée ou trismus.",
    date_prescription: "2026-05-03",
  });

  await db.insert(ordonnance_medicaments).values([
    {
      id: OM_ORL_1,
      ordonnance_id: ORD_ORL,
      medicament_externe_id: "EXT-PARA-1G",
      nom_medicament: "Paracétamol",
      dci: "Paracétamol",
      dosage: "1 g",
      posologie: "1 comprimé toutes les 6 heures si douleur ou fièvre",
      duree_traitement: "5 jours",
      instructions: "Ne pas dépasser 4 g/j. Espacer les prises de 4 à 6 h minimum.",
    },
    {
      id: OM_ORL_2,
      ordonnance_id: ORD_ORL,
      medicament_externe_id: "EXT-IBU-400",
      nom_medicament: "Ibuprofène",
      dci: "Ibuprofène",
      dosage: "400 mg",
      posologie: "1 comprimé toutes les 8 heures au cours des repas si douleur intense",
      duree_traitement: "3 jours",
      instructions: "Prendre pendant les repas. Contre-indiqué si ulcère gastrique ou grossesse. Max 3 jours.",
    },
    {
      id: OM_ORL_3,
      ordonnance_id: ORD_ORL,
      medicament_externe_id: "EXT-HEXE-01",
      nom_medicament: "Hexétidine",
      dci: "Hexétidine",
      dosage: "0,1 %",
      posologie: "Bains de bouche 3 fois par jour après les repas",
      duree_traitement: "5 jours",
      instructions: "Ne pas avaler. Gargariser 30 secondes puis recracher.",
    },
  ]);

  await db.insert(historique_traitements).values([
    {
      patient_id: PAT,
      medicament_externe_id: "EXT-PARA-1G",
      nom_medicament: "Paracétamol",
      dosage: "1 g",
      posologie: "1 cp / 6 h si besoin",
      est_actif: true,
      date_prescription: "2026-05-03",
      prescrit_par_utilisateur: utilisateurId,
      ordonnance_id: ORD_ORL,
      ordonnance_medicament_id: OM_ORL_1,
      source_type: "ordonnance",
    },
    {
      patient_id: PAT,
      medicament_externe_id: "EXT-IBU-400",
      nom_medicament: "Ibuprofène",
      dosage: "400 mg",
      posologie: "1 cp / 8 h au cours des repas",
      est_actif: true,
      date_prescription: "2026-05-03",
      prescrit_par_utilisateur: utilisateurId,
      ordonnance_id: ORD_ORL,
      ordonnance_medicament_id: OM_ORL_2,
      source_type: "ordonnance",
    },
    {
      patient_id: PAT,
      medicament_externe_id: "EXT-HEXE-01",
      nom_medicament: "Hexétidine",
      dosage: "0,1 %",
      posologie: "Bain de bouche 3×/j",
      est_actif: true,
      date_prescription: "2026-05-03",
      prescrit_par_utilisateur: utilisateurId,
      ordonnance_id: ORD_ORL,
      ordonnance_medicament_id: OM_ORL_3,
      source_type: "ordonnance",
    },
    {
      patient_id: PAT,
      medicament_externe_id: "EXT-DESL-DEMO",
      nom_medicament: "Desloratadine",
      dosage: "5 mg",
      posologie: "1 cp le soir",
      est_actif: false,
      date_prescription: "2026-04-20",
      prescrit_par_utilisateur: utilisateurId,
      ordonnance_id: ORD_GYN,
      ordonnance_medicament_id: OM_GYN_1,
      source_type: "ordonnance",
    },
  ]);

  // ── Vaccinations ──────────────────────────────────────────────────────────────
  await db.insert(vaccinations_patient).values([
    { patient_id: PAT, vaccin: "Grippe saisonnière 2025-2026", date_vaccination: "2025-10-18", notes: "Vaccination bien tolérée." },
    { patient_id: PAT, vaccin: "COVID-19 rappel",              date_vaccination: "2025-04-15", notes: "Aucun effet secondaire notable." },
    { patient_id: PAT, vaccin: "Tétanos-Diphtérie",            date_vaccination: "2023-06-12", notes: "Rappel effectué." },
  ]);

  // ── Documents ─────────────────────────────────────────────────────────────────
  await db.insert(documents_patient).values([
    {
      id: DOC_BILAN,
      patient_id: PAT,
      categorie_id: catLab,
      type_document: "Analyse sanguine",
      nom_document: "Bilan_sanguin_Saidi_2026-04.pdf",
      chemin_fichier: "/uploads/patients/demo-femme/bilan_2026_04.pdf",
      type_fichier: "application/pdf",
      taille_fichier: 245000,
      description:
        "NFS normale, CRP normale (1.2 mg/L), glycémie à jeun 0.82 g/L, créatinine 68 µmol/L, bilan lipidique rassurant.",
      date_upload: "2026-04-21T10:00:00+01:00",
      uploade_par_utilisateur: utilisateurId,
      est_archive: false,
    },
    {
      id: DOC_ECHO,
      patient_id: PAT,
      categorie_id: catImaging,
      type_document: "Échographie pelvienne",
      nom_document: "Echo_pelvienne_Saidi_2026-04.pdf",
      chemin_fichier: "/uploads/patients/demo-femme/echo_pelvienne_2026_04.pdf",
      type_fichier: "application/pdf",
      taille_fichier: 780000,
      description: "Échographie pelvienne normale. DIU cuivre en bonne position. Pas d'anomalie annexielle.",
      date_upload: "2026-04-22T11:30:00+01:00",
      uploade_par_utilisateur: utilisateurId,
      est_archive: false,
    },
    {
      id: DOC_CERT,
      patient_id: PAT,
      categorie_id: catCourrier,
      type_document: "Certificat médical",
      nom_document: "Certificat_Saidi_2026-05.pdf",
      chemin_fichier: "/uploads/patients/demo-femme/certificat_2026_05.pdf",
      type_fichier: "application/pdf",
      taille_fichier: 93000,
      description: "Certificat de repos de 3 jours pour rhinopharyngite aiguë fébrile.",
      date_upload: "2026-05-03T12:00:00+01:00",
      uploade_par_utilisateur: utilisateurId,
      est_archive: false,
    },
  ]);

  console.log("\nDemo female patient seed completed!");
  console.log(`Patient    : Nadia Saidi (PAT-2025-FEMME01)`);
  console.log(`Patient ID : ${PAT}`);
  console.log(`Doctor ID  : ${utilisateurId}`);
  console.log(`\nConsultations:`);
  console.log(`  1. Suivi gynécologique + rhinite allergique — ${SUIVI_GYN} (2026-04-20)`);
  console.log(`  2. Syndrome grippal / fièvre                — ${SUIVI_FIEVRE} (2026-05-01)`);
  console.log(`  3. Rhinopharyngite + angine érythémateuse   — ${SUIVI_ORL}   (2026-05-03) ← AI demo`);
  console.log(`\nURL : http://localhost:3001/patients/${PAT}`);
}

seedDemoFemalePatient()
  .catch((error) => {
    console.error("Demo female patient seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
