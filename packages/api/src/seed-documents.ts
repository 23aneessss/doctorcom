import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

import { db } from "@doctor.com/db";
import {
  categories_documents,
  documents_patient,
  lettres_orientation,
  certificats_medicaux,
} from "@doctor.com/db/schema/documents";
import { suivi } from "@doctor.com/db/schema/suivi";
import { eq } from "drizzle-orm";

// ── Known UUIDs from existing seed ───────────────────────────────────────────
const UTILISATEUR_ID = "550e8400-e29b-41d4-a716-446655440000";
const PATIENT_MEHDI  = "210d047b-c28c-4208-8f96-5d50b32b2f90";
const PATIENT_FATIMA = "e939a6ad-2ad8-4368-a275-4e1275ef37fc";
const PATIENT_LYNDA  = "c4d33007-ecbb-4623-9916-6c9c9091da25";

async function seedDocuments() {
  console.log("🌱 Seeding documents data...");

  // ── Resolve suivi IDs from DB ─────────────────────────────────────────────
  console.log("🔍 Resolving suivi IDs...");
  const suiviMehdi = await db
    .select({ id: suivi.id })
    .from(suivi)
    .where(eq(suivi.patient_id, PATIENT_MEHDI))
    .limit(1)
    .then((r) => r[0]?.id);

  const suiviFatima = await db
    .select({ id: suivi.id })
    .from(suivi)
    .where(eq(suivi.patient_id, PATIENT_FATIMA))
    .limit(1)
    .then((r) => r[0]?.id);

  const suiviLynda = await db
    .select({ id: suivi.id })
    .from(suivi)
    .where(eq(suivi.patient_id, PATIENT_LYNDA))
    .limit(1)
    .then((r) => r[0]?.id);

  if (!suiviMehdi || !suiviFatima || !suiviLynda) {
    throw new Error(
      "❌ Suivi rows not found. Run seed-ordonnance.ts first to create suivi data.",
    );
  }

  console.log(`   suivi Mehdi:  ${suiviMehdi}`);
  console.log(`   suivi Fatima: ${suiviFatima}`);
  console.log(`   suivi Lynda:  ${suiviLynda}`);

  // ── Cleanup (reverse FK order) ────────────────────────────────────────────
  console.log("🧹 Cleaning up documents data...");
  await db.delete(lettres_orientation);
  await db.delete(certificats_medicaux);
  await db.delete(documents_patient);
  await db.delete(categories_documents);

  // ── Categories documents ──────────────────────────────────────────────────
  console.log("📁 Inserting categories_documents...");
  const insertedCategories = await db.insert(categories_documents).values([
    { nom: "Ordonnances", description: "Prescriptions médicales" },
    { nom: "Lettres", description: "Lettres d'orientation et d'exploration" },
    { nom: "Certificats", description: "Certificats médicaux divers" },
    { nom: "Examens", description: "Résultats d'examens et bilans" },
    { nom: "Autres", description: "Documents divers" },
  ]).returning();

  const CAT_ORDONNANCES  = insertedCategories[0]!.id;
  const CAT_LETTRES      = insertedCategories[1]!.id;
  const CAT_CERTIFICATS  = insertedCategories[2]!.id;
  const CAT_EXAMENS      = insertedCategories[3]!.id;

  // ── Documents patient (base rows) ─────────────────────────────────────────
  console.log("📄 Inserting documents_patient...");
  const now = new Date().toISOString();

  const insertedDocuments = await db.insert(documents_patient).values([
    // Document for lettre Mehdi
    {
      patient_id: PATIENT_MEHDI,
      categorie_id: CAT_LETTRES,
      type_document: "lettre",
      nom_document: "Lettre orientation cardiologue - Mehdi",
      chemin_fichier: "pending",
      type_fichier: "pdf",
      taille_fichier: 0,
      description: "Lettre d'orientation vers cardiologue pour HTA",
      date_upload: now,
      uploade_par_utilisateur: UTILISATEUR_ID,
      est_archive: false,
    },
    // Document for certificat Mehdi
    {
      patient_id: PATIENT_MEHDI,
      categorie_id: CAT_CERTIFICATS,
      type_document: "certificat",
      nom_document: "Certificat aptitude - Mehdi",
      chemin_fichier: "pending",
      type_fichier: "pdf",
      taille_fichier: 0,
      description: "Certificat d'aptitude au travail",
      date_upload: now,
      uploade_par_utilisateur: UTILISATEUR_ID,
      est_archive: false,
    },
    // Document for lettre Fatima
    {
      patient_id: PATIENT_FATIMA,
      categorie_id: CAT_LETTRES,
      type_document: "lettre",
      nom_document: "Lettre exploration biologique - Fatima",
      chemin_fichier: "pending",
      type_fichier: "pdf",
      taille_fichier: 0,
      description: "Lettre pour bilan diabétologique",
      date_upload: now,
      uploade_par_utilisateur: UTILISATEUR_ID,
      est_archive: false,
    },
    // Document for certificat Lynda
    {
      patient_id: PATIENT_LYNDA,
      categorie_id: CAT_CERTIFICATS,
      type_document: "certificat",
      nom_document: "Certificat arrêt travail - Lynda",
      chemin_fichier: "pending",
      type_fichier: "pdf",
      taille_fichier: 0,
      description: "Arrêt de travail pour infection ORL",
      date_upload: now,
      uploade_par_utilisateur: UTILISATEUR_ID,
      est_archive: false,
    },
    // Standalone document (examen)
    {
      patient_id: PATIENT_MEHDI,
      categorie_id: CAT_EXAMENS,
      type_document: "examen",
      nom_document: "Bilan lipidique - Mehdi",
      chemin_fichier: "pending",
      type_fichier: "pdf",
      taille_fichier: 0,
      description: "Résultats bilan lipidique mars 2024",
      date_upload: now,
      uploade_par_utilisateur: UTILISATEUR_ID,
      est_archive: false,
    },
  ]).returning();

  const DOC_LETTRE_MEHDI    = insertedDocuments[0]!.id;
  const DOC_CERT_MEHDI      = insertedDocuments[1]!.id;
  const DOC_LETTRE_FATIMA   = insertedDocuments[2]!.id;
  const DOC_CERT_LYNDA      = insertedDocuments[3]!.id;
  const DOC_EXAMEN_MEHDI    = insertedDocuments[4]!.id;

  // ── Lettres orientation ───────────────────────────────────────────────────
  console.log("✉️  Inserting lettres_orientation...");
  const insertedLettres = await db.insert(lettres_orientation).values([
    {
      documents_patient_id: DOC_LETTRE_MEHDI,
      utilisateur_id: UTILISATEUR_ID,
      suivi_id: suiviMehdi,
      type_exploration: "Consultation spécialisée",
      examen_demande: "Échocardiographie, Holter tensionnel",
      raison: "HTA résistante au traitement, surveillance cardiovasculaire",
      destinataire: "Dr. Bensalem Cardiologue - CHU Mustapha",
      urgence: "normale",
      contenu_lettre: "Je vous adresse mon patient M. Bouzid Mehdi, 38 ans, pour prise en charge de son HTA.",
      date_creation: now,
      date_modification: now,
    },
    {
      documents_patient_id: DOC_LETTRE_FATIMA,
      utilisateur_id: UTILISATEUR_ID,
      suivi_id: suiviFatima,
      type_exploration: "Exploration biologique",
      examen_demande: "HbA1c, glycémie à jeun, bilan rénal, lipidique",
      raison: "Suivi diabète type 2, réévaluation du traitement",
      destinataire: "Laboratoire Central - CHU Bab El Oued",
      urgence: "normale",
      contenu_lettre: "Je vous adresse Mme Hadj Ahmed Fatima Zohra pour bilan diabétologique complet.",
      date_creation: now,
      date_modification: now,
    },
  ]).returning();

  const LETTRE_MEHDI_ID  = insertedLettres[0]!.id;
  const LETTRE_FATIMA_ID = insertedLettres[1]!.id;

  // ── Certificats medicaux ──────────────────────────────────────────────────
  console.log("🏅 Inserting certificats_medicaux...");
  const insertedCertificats = await db.insert(certificats_medicaux).values([
    {
      documents_patient_id: DOC_CERT_MEHDI,
      utilisateur_id: UTILISATEUR_ID,
      suivi_id: suiviMehdi,
      type_certificat: "aptitude",
      date_emission: "2024-03-01",
      date_debut: "2024-03-01",
      date_fin: null,
      diagnostic: "HTA contrôlée sous traitement",
      destinataire: "Employeur",
      notes: "Apte au travail avec surveillance tensionnelle régulière",
      statut: "emis",
      date_creation: now,
      date_modification: now,
    },
    {
      documents_patient_id: DOC_CERT_LYNDA,
      utilisateur_id: UTILISATEUR_ID,
      suivi_id: suiviLynda,
      type_certificat: "arret_travail",
      date_emission: "2024-02-10",
      date_debut: "2024-02-10",
      date_fin: "2024-02-17",
      diagnostic: "Rhinopharyngite aiguë",
      destinataire: "Employeur / CNAS",
      notes: "Repos complet recommandé pendant 7 jours",
      statut: "emis",
      date_creation: now,
      date_modification: now,
    },
  ]).returning();

  const CERT_MEHDI_ID = insertedCertificats[0]!.id;
  const CERT_LYNDA_ID = insertedCertificats[1]!.id;

  // ── Generate Postman environment JSON ─────────────────────────────────────
  console.log("📦 Generating Postman environment file...");

  const postmanEnv = {
    id: randomUUID(),
    name: "documents-module-env",
    values: [
      { key: "baseUrl",           value: "http://localhost:3000", type: "default", enabled: true },
      { key: "patientId",         value: PATIENT_MEHDI,           type: "default", enabled: true },
      { key: "patientFatimaId",   value: PATIENT_FATIMA,          type: "default", enabled: true },
      { key: "patientLyndaId",    value: PATIENT_LYNDA,           type: "default", enabled: true },
      { key: "suiviId",           value: suiviMehdi,              type: "default", enabled: true },
      { key: "suiviFatimaId",     value: suiviFatima,             type: "default", enabled: true },
      { key: "suiviLyndaId",      value: suiviLynda,              type: "default", enabled: true },
      { key: "categorieId",       value: CAT_LETTRES,             type: "default", enabled: true },
      { key: "categorieOrdId",    value: CAT_ORDONNANCES,         type: "default", enabled: true },
      { key: "categorieCertId",   value: CAT_CERTIFICATS,         type: "default", enabled: true },
      { key: "categorieExamId",   value: CAT_EXAMENS,             type: "default", enabled: true },
      { key: "documentId",        value: DOC_EXAMEN_MEHDI,        type: "default", enabled: true },
      { key: "documentLettreId",  value: DOC_LETTRE_MEHDI,        type: "default", enabled: true },
      { key: "documentCertId",    value: DOC_CERT_MEHDI,          type: "default", enabled: true },
      { key: "lettreId",          value: LETTRE_MEHDI_ID,         type: "default", enabled: true },
      { key: "lettreFatimaId",    value: LETTRE_FATIMA_ID,        type: "default", enabled: true },
      { key: "certificatId",      value: CERT_MEHDI_ID,           type: "default", enabled: true },
      { key: "certificatLyndaId", value: CERT_LYNDA_ID,           type: "default", enabled: true },
    ],
    _postman_variable_scope: "environment",
  };

  writeFileSync(
    "documents-postman-env.json",
    JSON.stringify(postmanEnv, null, 2),
  );

  console.log("✅ Documents seed completed successfully.");
  console.log("📌 Postman environment saved to: documents-postman-env.json");
  console.log("   In Postman: Environments → Import → select documents-postman-env.json");
}

seedDocuments().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});