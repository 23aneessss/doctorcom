/**
 * Seed one extra fully populated consultation for the demo female patient.
 *
 * This gives the dossier patient a fresh, readable consultation and makes the
 * latest AI context more realistic for jury demos.
 *
 * Usage: bun seed-demo-consultation.ts
 */

import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  examen_consultation,
  patients,
  rendez_vous,
  suivi,
  utilisateurs,
} from "./packages/db/src/schema";

dotenv.config({ path: "./apps/server/.env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required. Check apps/server/.env");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const db = drizzle({ client: pool });

const PATIENT_ID = "c0000000-0000-4000-a000-000000000001";
const SUIVI_ID = "c1000000-0000-4000-a000-000000000003";
const RDV_ID = "c2000000-0000-4000-a000-000000000003";
const EXAM_ID = "c3000000-0000-4000-a000-000000000003";
const CONSULTATION_DATE = "2026-04-19";

async function resolveDoctorId() {
  const doctor = await db
    .select({ id: utilisateurs.id })
    .from(utilisateurs)
    .where(eq(utilisateurs.email, "tbib@doctorcom.com"))
    .limit(1);

  if (!doctor[0]) {
    throw new Error(
      "Médecin de démo introuvable. Lance d'abord bun run db:seed ou un seed de démo patient.",
    );
  }

  return doctor[0].id;
}

async function assertPatientExists() {
  const patient = await db
    .select({
      id: patients.id,
      nom: patients.nom,
      prenom: patients.prenom,
    })
    .from(patients)
    .where(eq(patients.id, PATIENT_ID))
    .limit(1);

  if (!patient[0]) {
    throw new Error(
      "Patiente de démo introuvable. Lance bun run db:seed:demo-female avant ce script.",
    );
  }

  return patient[0];
}

async function clearExistingConsultation() {
  await db.delete(examen_consultation).where(eq(examen_consultation.id, EXAM_ID));
  await db.delete(rendez_vous).where(eq(rendez_vous.id, RDV_ID));
  await db.delete(suivi).where(eq(suivi.id, SUIVI_ID));
}

async function seedDemoConsultation() {
  console.log("Seeding one additional demo consultation...\n");

  const doctorId = await resolveDoctorId();
  const patient = await assertPatientExists();
  await clearExistingConsultation();

  await db.insert(suivi).values({
    id: SUIVI_ID,
    patient_id: PATIENT_ID,
    utilisateur_id: doctorId,
    hypothese_diagnostic: "Rhinopharyngite aiguë simple sans signe de gravité",
    motif: "Fièvre légère, odynophagie et congestion nasale",
    historique:
      "Début depuis 48 heures d'une fièvre légère, gorge douloureuse, rhinorrhée claire, congestion nasale et toux sèche intermittente. Pas de dyspnée, pas de douleur thoracique, pas de vomissements, pas de signe de gravité.",
    date_ouverture: CONSULTATION_DATE,
    date_fermeture: null,
    est_actif: true,
  });

  await db.insert(rendez_vous).values({
    id: RDV_ID,
    patient_id: PATIENT_ID,
    suivi_id: SUIVI_ID,
    utilisateur_id: doctorId,
    date: CONSULTATION_DATE,
    heure: "11:15",
    heure_fin: "11:45",
    statut: "termine",
    type_creneau: "consultation",
    patient_label: `${patient.prenom} ${patient.nom}`,
    patient_initials: "NS",
    couleur: "#76BBDD",
    notes:
      "Consultation récente de démonstration pour syndrome ORL simple avec examen clinique complet.",
    important: false,
    frequence_rappel: "72 heures",
    periode_rappel: "ponctuel",
  });

  await db.insert(examen_consultation).values({
    id: EXAM_ID,
    rendez_vous_id: RDV_ID,
    suivi_id: SUIVI_ID,
    date: CONSULTATION_DATE,
    taille: "164",
    poids: "61",
    tension_arterielle: "114/72",
    frequence_cardiaque: 86,
    temperature: "37.9",
    spo2: "99",
    imc: "22.7",
    traitement_prescrit:
      "Paracétamol si fièvre ou douleur, lavage nasal au sérum physiologique, hydratation, repos et surveillance.",
    description_consultation:
      "Patiente revue pour fièvre légère, odynophagie, rhinorrhée claire, congestion nasale et toux sèche depuis 48 heures. Pas de dyspnée, pas de douleur thoracique, pas de vomissements et pas de signe de gravité.",
    aspect_general:
      "Etat général conservé, patiente consciente, coopérante, hydratation correcte.",
    examen_respiratoire:
      "Auscultation pulmonaire libre, pas de sibilants ni de râles, fréquence respiratoire non augmentée, SpO2 99%.",
    examen_cardiovasculaire:
      "Bruits du cœur réguliers, pas de souffle, fréquence cardiaque 86/min, TA 114/72.",
    examen_cutane_muqueux:
      "Muqueuses légèrement sèches, pas d'éruption cutanée, pas de cyanose.",
    examen_orl:
      "Oropharynx modérément inflammatoire sans exsudat, rhinorrhée claire, congestion nasale, tympans normaux.",
    examen_digestif:
      "Abdomen souple et indolore, transit conservé, pas de nausées ni vomissements.",
    examen_neurologique:
      "Patiente vigilante, pas de céphalée intense, pas de syndrome méningé, examen neurologique rassurant.",
    examen_locomoteur:
      "Myalgies diffuses légères sans déficit moteur ni douleur articulaire localisée.",
    examen_genital: null,
    examen_urinaire: "Pas de brûlures mictionnelles, pas de douleur lombaire.",
    examen_ganglionnaire:
      "Discrètes adénopathies cervicales sensibles, pas d'autres adénopathies notables.",
    examen_endocrinien: null,
    conclusion:
      "Rhinopharyngite aiguë simple sans signe de gravité. Prise en charge symptomatique, repos, hydratation et surveillance clinique.",
  });

  console.log("Consultation de démo ajoutée.\n");
  console.log(`Patient: ${patient.prenom} ${patient.nom}`);
  console.log(`Suivi: ${SUIVI_ID}`);
  console.log(`Rendez-vous: ${RDV_ID}`);
  console.log(`Examen: ${EXAM_ID}`);
  console.log(`Date: ${CONSULTATION_DATE}`);
}

try {
  await seedDemoConsultation();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Erreur inconnue pendant le seed.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
