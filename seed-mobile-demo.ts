/**
 * Mobile demo seed for doctor.com.
 *
 * Adds today's appointments and Memory notes for the mobile app demo.
 *
 * Usage: bun seed-mobile-demo.ts
 */

import dotenv from "dotenv";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  memory_notes,
  memory_tags,
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

const DOCTOR_EMAIL = "tbib@doctorcom.com";

const WALID_PATIENT_ID = "b0000000-0000-4000-a000-000000000001";
const WALID_SIMPLE_SUIVI_ID = "b1000000-0000-4000-a000-000000000004";
const NADIA_PATIENT_ID = "c0000000-0000-4000-a000-000000000001";
const NADIA_SIMPLE_SUIVI_ID = "c1000000-0000-4000-a000-000000000002";

const MOBILE_RDV_IDS = [
  "d1000000-0000-4000-a000-000000000001",
  "d1000000-0000-4000-a000-000000000002",
  "d1000000-0000-4000-a000-000000000003",
  "d1000000-0000-4000-a000-000000000004",
];

const MOBILE_NOTE_IDS = [
  "d3000000-0000-4000-a000-000000000001",
  "d3000000-0000-4000-a000-000000000002",
  "d3000000-0000-4000-a000-000000000003",
];

function todayInAlgiers() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function atAlgiersTime(date: string, time: string) {
  return new Date(`${date}T${time}:00.000+01:00`);
}

async function resolveDoctor() {
  const [doctor] = await db
    .select({ id: utilisateurs.id })
    .from(utilisateurs)
    .where(eq(utilisateurs.email, DOCTOR_EMAIL))
    .limit(1);

  if (!doctor) {
    throw new Error(
      `Utilisateur demo introuvable (${DOCTOR_EMAIL}). Lance d'abord bun run db:seed.`,
    );
  }

  return doctor.id;
}

async function resolvePatient(patientId: string, label: string) {
  const [patient] = await db
    .select({
      id: patients.id,
      nom: patients.nom,
      prenom: patients.prenom,
    })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!patient) {
    throw new Error(
      `${label} est introuvable. Lance bun seed-rich-patient.ts et bun run db:seed:demo-female avant ce seed.`,
    );
  }

  return patient;
}

async function optionalSuiviId(suiviId: string) {
  const [row] = await db
    .select({ id: suivi.id })
    .from(suivi)
    .where(eq(suivi.id, suiviId))
    .limit(1);

  return row?.id ?? null;
}

async function seedTodayAppointments(data: {
  utilisateurId: string;
  today: string;
}) {
  const walid = await resolvePatient(WALID_PATIENT_ID, "Walid Amara");
  const nadia = await resolvePatient(NADIA_PATIENT_ID, "Nadia Saidi");
  const walidSuiviId = await optionalSuiviId(WALID_SIMPLE_SUIVI_ID);
  const nadiaSuiviId = await optionalSuiviId(NADIA_SIMPLE_SUIVI_ID);

  await db.delete(rendez_vous).where(inArray(rendez_vous.id, MOBILE_RDV_IDS));

  await db.insert(rendez_vous).values([
    {
      id: MOBILE_RDV_IDS[0],
      patient_id: nadia.id,
      suivi_id: nadiaSuiviId,
      utilisateur_id: data.utilisateurId,
      date: data.today,
      heure: "09:00",
      heure_fin: "09:30",
      statut: "confirme",
      type_creneau: "consultation",
      patient_label: `${nadia.prenom} ${nadia.nom}`,
      patient_initials: "NS",
      couleur: "#76bbdd",
      notes:
        "Contrôle fièvre et douleurs simples. Vérifier température, tolérance et besoin d'ordonnance symptomatique.",
      important: true,
      frequence_rappel: "none",
      periode_rappel: null,
    },
    {
      id: MOBILE_RDV_IDS[1],
      patient_id: walid.id,
      suivi_id: walidSuiviId,
      utilisateur_id: data.utilisateurId,
      date: data.today,
      heure: "10:30",
      heure_fin: "11:00",
      statut: "planifie",
      type_creneau: "suivi",
      patient_label: `${walid.prenom} ${walid.nom}`,
      patient_initials: "WA",
      couleur: "#052ca0",
      notes:
        "Suivi fièvre simple. Cas court prévu pour vérifier l'assistant IA et l'impression ordonnance.",
      important: false,
      frequence_rappel: "none",
      periode_rappel: null,
    },
    {
      id: MOBILE_RDV_IDS[2],
      patient_id: nadia.id,
      suivi_id: nadiaSuiviId,
      utilisateur_id: data.utilisateurId,
      date: data.today,
      heure: "14:00",
      heure_fin: "14:30",
      statut: "termine",
      type_creneau: "consultation",
      patient_label: `${nadia.prenom} ${nadia.nom}`,
      patient_initials: "NS",
      couleur: "#35b779",
      notes:
        "Consultation terminée pour alimenter les statistiques du dashboard mobile.",
      important: false,
      frequence_rappel: "none",
      periode_rappel: null,
    },
    {
      id: MOBILE_RDV_IDS[3],
      patient_id: walid.id,
      suivi_id: walidSuiviId,
      utilisateur_id: data.utilisateurId,
      date: data.today,
      heure: "16:00",
      heure_fin: "16:30",
      statut: "confirme",
      type_creneau: "controle",
      patient_label: `${walid.prenom} ${walid.nom}`,
      patient_initials: "WA",
      couleur: "#f97316",
      notes:
        "Dernier contrôle court de la journée. Montrer la timeline Agenda mobile.",
      important: false,
      frequence_rappel: "none",
      periode_rappel: null,
    },
  ]);
}

async function seedMemory(data: { utilisateurId: string; today: string }) {
  const tags = [
    { name: "Démo jury", color: "#052ca0" },
    { name: "Consultation", color: "#76bbdd" },
    { name: "À vérifier", color: "#f97316" },
  ];

  for (const tag of tags) {
    await db
      .insert(memory_tags)
      .values({
        utilisateur_id: data.utilisateurId,
        name: tag.name,
        color: tag.color,
      })
      .onConflictDoUpdate({
        target: [memory_tags.utilisateur_id, memory_tags.name],
        set: {
          color: tag.color,
        },
      });
  }

  await db
    .delete(memory_notes)
    .where(inArray(memory_notes.id, MOBILE_NOTE_IDS));

  await db.insert(memory_notes).values([
    {
      id: MOBILE_NOTE_IDS[0],
      utilisateur_id: data.utilisateurId,
      title: "Démo mobile - points à montrer",
      content:
        "Parcours rapide : Home, rendez-vous du jour, Memory, puis assistant IA sur le patient Nadia Saidi.",
      tags: ["Démo jury", "À vérifier"],
      is_pinned: true,
      color: "#e0f2fe",
      created_at: atAlgiersTime(data.today, "08:15"),
      updated_at: atAlgiersTime(data.today, "08:15"),
    },
    {
      id: MOBILE_NOTE_IDS[1],
      utilisateur_id: data.utilisateurId,
      title: "Nadia Saidi - suivi du jour",
      content:
        "Vérifier la fièvre, les douleurs diffuses, l'absence de signes de gravité et la tolérance du traitement symptomatique.",
      tags: ["Consultation"],
      is_pinned: false,
      color: "#eff6ff",
      created_at: atAlgiersTime(data.today, "09:20"),
      updated_at: atAlgiersTime(data.today, "09:20"),
    },
    {
      id: MOBILE_NOTE_IDS[2],
      utilisateur_id: data.utilisateurId,
      title: "Questions jury",
      content:
        "Préparer une réponse simple sur le choix d'un assistant IA contextuel : utile partout, non intrusif, décision finale au médecin.",
      tags: ["Démo jury"],
      is_pinned: true,
      color: "#fff7ed",
      created_at: atAlgiersTime(data.today, "10:05"),
      updated_at: atAlgiersTime(data.today, "10:05"),
    },
  ]);
}

async function main() {
  const today = todayInAlgiers();
  const utilisateurId = await resolveDoctor();

  console.log(`Seeding mobile demo data for ${today}...`);

  await seedTodayAppointments({ utilisateurId, today });
  await seedMemory({ utilisateurId, today });

  const [appointmentsCount, notesCount, tagsCount] = await Promise.all([
    db
      .select({ id: rendez_vous.id })
      .from(rendez_vous)
      .where(inArray(rendez_vous.id, MOBILE_RDV_IDS)),
    db
      .select({ id: memory_notes.id })
      .from(memory_notes)
      .where(inArray(memory_notes.id, MOBILE_NOTE_IDS)),
    db
      .select({ id: memory_tags.id })
      .from(memory_tags)
      .where(eq(memory_tags.utilisateur_id, utilisateurId)),
  ]);

  console.log(`- Rendez-vous demo aujourd'hui: ${appointmentsCount.length}`);
  console.log(`- Notes Memory demo: ${notesCount.length}`);
  console.log(`- Tags Memory disponibles: ${tagsCount.length}`);
  console.log("Mobile demo seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
