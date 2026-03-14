import { hashPassword } from "better-auth/crypto";

import { db } from "@doctor.com/db";
import { utilisateurs } from "@doctor.com/db/schema/utilisateurs";
import { patients, patients_femmes } from "@doctor.com/db/schema/patients";
import { user, account, session } from "@doctor.com/db/schema/auth";

// ── Single source of truth ────────────────────────────────────────────────────
// This UUID is used in BOTH the Better-Auth user table AND the utilisateurs table
// so that ctx.session.user.id matches a valid utilisateurs FK on every INSERT.
const UTILISATEUR_ID = "550e8400-e29b-41d4-a716-446655440000";

async function seed() {
  console.log("🌱 Seeding base data...");

  // ── Cleanup (reverse FK order) ──────────────────────────────────────────────
  console.log("🧹 Cleaning up...");
  await db.delete(patients_femmes);
  await db.delete(patients);
  await db.delete(utilisateurs);
  await db.delete(session);
  await db.delete(account);
  await db.delete(user);

  const hashedPassword = await hashPassword("doctor123!");

  // ── Better-Auth user table ───────────────────────────────────────────────────
  console.log("👤 Inserting Better-Auth user...");
  await db.insert(user).values([
    {
      id: UTILISATEUR_ID,
      name: "Dr. Karim Benali",
      email: "tbib@doctorcom.com",
      emailVerified: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
  ]).onConflictDoNothing();

  // ── Better-Auth account table (stores password) ──────────────────────────────
  console.log("🔐 Inserting Better-Auth account...");
  await db.insert(account).values([
    {
      id: "account-tbib-550e8400",
      accountId: "tbib@doctorcom.com",
      providerId: "credential",
      userId: UTILISATEUR_ID,
      password: hashedPassword,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
  ]).onConflictDoNothing();

  // ── utilisateurs table (domain user, same ID as Better-Auth user) ────────────
  console.log("👨‍⚕️ Inserting utilisateurs...");
  await db.insert(utilisateurs).values([
    {
      id: UTILISATEUR_ID,
      nom: "Benali",
      prenom: "Karim",
      email: "tbib@doctorcom.com",
      adresse: "12 Rue Didouche Mourad, Alger Centre",
      telephone: "0561234567",
      mot_de_passe_hash: "not-used",
      date_creation: "2024-01-01",
      role: "medecin",
    },
  ]).onConflictDoNothing();

  // ── Patients ─────────────────────────────────────────────────────────────────
  console.log("🏥 Inserting patients...");
  const insertedPatients = await db.insert(patients).values([
    {
      nom: "Bouzid",
      prenom: "Mehdi",
      matricule: "DZ-2024-M-001",
      date_naissance: "1985-06-15",
      sexe: "masculin",
      telephone: "0550123456",
      email: "mehdi.bouzid@email.com",
      groupe_sanguin: "A+",
      nationalite: "Algérienne",
      cree_par_utilisateur: UTILISATEUR_ID,
    },
    {
      nom: "Hadj Ahmed",
      prenom: "Fatima Zohra",
      matricule: "DZ-2024-F-002",
      date_naissance: "1972-03-22",
      sexe: "feminin",
      telephone: "0661234567",
      email: "fatima.hadjahmed@email.com",
      groupe_sanguin: "O+",
      nationalite: "Algérienne",
      cree_par_utilisateur: UTILISATEUR_ID,
    },
    {
      nom: "Meziani",
      prenom: "Lynda",
      matricule: "DZ-2024-F-003",
      date_naissance: "1995-11-08",
      sexe: "feminin",
      telephone: "0770987654",
      email: "lynda.meziani@email.com",
      groupe_sanguin: "B+",
      nationalite: "Algérienne",
      cree_par_utilisateur: UTILISATEUR_ID,
    },
  ]).returning();

  const PATIENT_FATIMA = insertedPatients[1]!.id;
  const PATIENT_LYNDA  = insertedPatients[2]!.id;

  // ── Patients femmes ──────────────────────────────────────────────────────────
  console.log("👩 Inserting patients_femmes...");
  await db.insert(patients_femmes).values([
    {
      patient_id: PATIENT_FATIMA,
      menarche: 13,
      regularite_cycles: "regulier",
      contraception: "pilule",
      nb_grossesses: 3,
      nb_cesariennes: 1,
      menopause: false,
    },
    {
      patient_id: PATIENT_LYNDA,
      menarche: 14,
      regularite_cycles: "irregulier",
      contraception: "aucune",
      nb_grossesses: 0,
      nb_cesariennes: 0,
      menopause: false,
    },
  ]).onConflictDoNothing();

  console.log("✅ Base seed completed successfully.");
  console.log("");
  console.log("📌 Key values:");
  console.log(`   UTILISATEUR_ID (utilisateurs + Better-Auth): ${UTILISATEUR_ID}`);
  console.log(`   Login: tbib@doctorcom.com / doctor123!`);
  console.log(`   Patient Mehdi:  ${insertedPatients[0]!.id}`);
  console.log(`   Patient Fatima: ${PATIENT_FATIMA}`);
  console.log(`   Patient Lynda:  ${PATIENT_LYNDA}`);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});