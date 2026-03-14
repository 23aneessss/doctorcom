import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

import { db } from "@doctor.com/db";
import {
  medicaments,
  ordonnance,
  ordonnance_medicaments,
  historique_traitements,
} from "@doctor.com/db/schema/traitements";
import {
  categories_pre_rempli,
  pre_rempli_ordonnance,
  pre_rempli_medicaments,
} from "@doctor.com/db/schema/ordonnances";
import { suivi, rendez_vous } from "@doctor.com/db/schema/suivi";

// ── Known UUIDs from existing seed ───────────────────────────────────────────
const UTILISATEUR_ID = "550e8400-e29b-41d4-a716-446655440000";
const PATIENT_MEHDI  = "210d047b-c28c-4208-8f96-5d50b32b2f90"; // DZ-2024-M-001
const PATIENT_FATIMA = "e939a6ad-2ad8-4368-a275-4e1275ef37fc"; // DZ-2024-F-002
const PATIENT_LYNDA  = "c4d33007-ecbb-4623-9916-6c9c9091da25"; // DZ-2024-F-003

async function seedOrdonnance() {
  console.log("🌱 Seeding ordonnance data...");

  // ── Cleanup (reverse FK order) ────────────────────────────────────────────
  console.log("🧹 Cleaning up...");
  await db.delete(ordonnance_medicaments);
  await db.delete(ordonnance);
  await db.delete(pre_rempli_medicaments);
  await db.delete(pre_rempli_ordonnance);
  await db.delete(categories_pre_rempli);
  await db.delete(historique_traitements);
  await db.delete(medicaments);
  await db.delete(rendez_vous);
  await db.delete(suivi);

  // ── Medicaments ───────────────────────────────────────────────────────────
  console.log("💊 Inserting medicaments...");
  const insertedMedicaments = await db.insert(medicaments).values([
    {
      dci: "Paracétamol",
      indication: "Douleur, fièvre",
      contre_indication: "Insuffisance hépatique sévère",
      posologie_standard: "500mg à 1g toutes les 6h",
      effets_indesirables: "Rares aux doses thérapeutiques",
      dosage: "500mg, 1g",
    },
    {
      dci: "Amoxicilline",
      indication: "Infections bactériennes",
      contre_indication: "Allergie aux pénicillines",
      posologie_standard: "1g toutes les 8h pendant 7 jours",
      effets_indesirables: "Diarrhée, réactions allergiques",
      dosage: "500mg, 1g",
    },
    {
      dci: "Metformine",
      indication: "Diabète de type 2",
      contre_indication: "Insuffisance rénale, insuffisance hépatique",
      posologie_standard: "500mg à 850mg 2-3 fois par jour",
      effets_indesirables: "Troubles digestifs",
      dosage: "500mg, 850mg, 1000mg",
    },
    {
      dci: "Amlodipine",
      indication: "Hypertension artérielle, angor",
      contre_indication: "Hypotension sévère, choc cardiogénique",
      posologie_standard: "5mg à 10mg une fois par jour",
      effets_indesirables: "Œdèmes des membres inférieurs, céphalées",
      dosage: "5mg, 10mg",
    },
    {
      dci: "Ibuprofène",
      indication: "Douleur, inflammation, fièvre",
      contre_indication: "Ulcère gastrique, insuffisance rénale",
      posologie_standard: "400mg toutes les 6-8h",
      effets_indesirables: "Troubles gastro-intestinaux",
      dosage: "200mg, 400mg, 600mg",
    },
  ]).returning();

  const MED_PARACETAMOL  = insertedMedicaments[0]!.id;
  const MED_AMOXICILLINE = insertedMedicaments[1]!.id;
  const MED_METFORMINE   = insertedMedicaments[2]!.id;
  const MED_AMLODIPINE   = insertedMedicaments[3]!.id;

  // ── Categories pre-rempli ─────────────────────────────────────────────────
  console.log("📁 Inserting categories_pre_rempli...");
  const insertedCategories = await db.insert(categories_pre_rempli).values([
    { nom: "Médecine Générale", description: "Ordonnances types pour la médecine générale" },
    { nom: "Cardiologie", description: "Ordonnances types pour les pathologies cardiovasculaires" },
    { nom: "Diabétologie", description: "Ordonnances types pour la prise en charge du diabète" },
  ]).returning();

  const CAT_GENERALE = insertedCategories[0]!.id;
  const CAT_CARDIO   = insertedCategories[1]!.id;
  const CAT_DIABETE  = insertedCategories[2]!.id;

  // ── Pre-rempli ordonnances ────────────────────────────────────────────────
  console.log("📋 Inserting pre_rempli_ordonnance...");
  const insertedPreRemplis = await db.insert(pre_rempli_ordonnance).values([
    {
      nom: "HTA standard",
      description: "Traitement de base pour l'hypertension artérielle",
      specialite: "Cardiologie",
      categorie_pre_rempli_id: CAT_CARDIO,
      est_actif: true,
      created_by_user: UTILISATEUR_ID,
    },
    {
      nom: "Diabète type 2 - débutant",
      description: "Initiation du traitement pour un diabète de type 2",
      specialite: "Diabétologie",
      categorie_pre_rempli_id: CAT_DIABETE,
      est_actif: true,
      created_by_user: UTILISATEUR_ID,
    },
    {
      nom: "Infection ORL",
      description: "Traitement antibiotique standard pour infection ORL",
      specialite: "Médecine Générale",
      categorie_pre_rempli_id: CAT_GENERALE,
      est_actif: true,
      created_by_user: UTILISATEUR_ID,
    },
  ]).returning();

  const PRE_HTA       = insertedPreRemplis[0]!.id;
  const PRE_DIABETE   = insertedPreRemplis[1]!.id;
  const PRE_INFECTION = insertedPreRemplis[2]!.id;

  // ── Pre-rempli medicaments ────────────────────────────────────────────────
  console.log("💉 Inserting pre_rempli_medicaments...");
  const insertedPreRempliMeds = await db.insert(pre_rempli_medicaments).values([
    {
      pre_rempli_id: PRE_HTA,
      medicament_nom: "Amlodipine 5mg",
      posologie_defaut: "1 comprimé par jour le matin",
      duree_defaut: "30 jours",
      instructions_defaut: "Prendre avec un verre d'eau",
      ordre_affichage: 1,
      est_optionnel: false,
    },
    {
      pre_rempli_id: PRE_DIABETE,
      medicament_nom: "Metformine 500mg",
      posologie_defaut: "1 comprimé matin et soir",
      duree_defaut: "30 jours",
      instructions_defaut: "Prendre pendant les repas",
      ordre_affichage: 1,
      est_optionnel: false,
    },
    {
      pre_rempli_id: PRE_DIABETE,
      medicament_nom: "Metformine 1000mg",
      posologie_defaut: "1 comprimé le soir",
      duree_defaut: "30 jours",
      instructions_defaut: "Prendre pendant le repas du soir",
      ordre_affichage: 2,
      est_optionnel: true,
    },
    {
      pre_rempli_id: PRE_INFECTION,
      medicament_nom: "Amoxicilline 1g",
      posologie_defaut: "1 comprimé toutes les 8h",
      duree_defaut: "7 jours",
      instructions_defaut: "Terminer le traitement complet",
      ordre_affichage: 1,
      est_optionnel: false,
    },
    {
      pre_rempli_id: PRE_INFECTION,
      medicament_nom: "Paracétamol 1g",
      posologie_defaut: "1 comprimé toutes les 6h si douleur",
      duree_defaut: "5 jours",
      instructions_defaut: "Ne pas dépasser 4g par jour",
      ordre_affichage: 2,
      est_optionnel: true,
    },
  ]).returning();

  const PRE_REMPLI_MED_ID = insertedPreRempliMeds[0]!.id;

  // ── Suivi ─────────────────────────────────────────────────────────────────
  console.log("📎 Inserting suivi...");
  const insertedSuivis = await db.insert(suivi).values([
    {
      patient_id: PATIENT_MEHDI,
      utilisateur_id: UTILISATEUR_ID,
      motif: "Suivi hypertension artérielle",
      hypothese_diagnostic: "HTA essentielle",
      historique: "Patient hypertendu depuis 2020",
      date_ouverture: "2024-01-10",
      est_actif: true,
    },
    {
      patient_id: PATIENT_FATIMA,
      utilisateur_id: UTILISATEUR_ID,
      motif: "Suivi diabète type 2",
      hypothese_diagnostic: "Diabète de type 2",
      historique: "Diagnostiqué en 2018",
      date_ouverture: "2024-01-15",
      est_actif: true,
    },
    {
      patient_id: PATIENT_LYNDA,
      utilisateur_id: UTILISATEUR_ID,
      motif: "Infection ORL récidivante",
      hypothese_diagnostic: "Rhinopharyngite",
      historique: "3ème épisode cette année",
      date_ouverture: "2024-02-01",
      est_actif: true,
    },
  ]).returning();

  const SUIVI_MEHDI  = insertedSuivis[0]!.id;
  const SUIVI_FATIMA = insertedSuivis[1]!.id;
  const SUIVI_LYNDA  = insertedSuivis[2]!.id;

  // ── Rendez-vous ───────────────────────────────────────────────────────────
  console.log("📅 Inserting rendez_vous...");
  const insertedRDVs = await db.insert(rendez_vous).values([
    {
      patient_id: PATIENT_MEHDI,
      suivi_id: SUIVI_MEHDI,
      utilisateur_id: UTILISATEUR_ID,
      date: "2024-03-01",
      heure: "09:00",
      statut: "termine",
      important: false,
    },
    {
      patient_id: PATIENT_MEHDI,
      suivi_id: SUIVI_MEHDI,
      utilisateur_id: UTILISATEUR_ID,
      date: "2024-04-01",
      heure: "10:00",
      statut: "termine",
      important: false,
    },
    {
      patient_id: PATIENT_FATIMA,
      suivi_id: SUIVI_FATIMA,
      utilisateur_id: UTILISATEUR_ID,
      date: "2024-03-05",
      heure: "11:00",
      statut: "termine",
      important: true,
    },
    {
      patient_id: PATIENT_LYNDA,
      suivi_id: SUIVI_LYNDA,
      utilisateur_id: UTILISATEUR_ID,
      date: "2024-02-10",
      heure: "14:00",
      statut: "termine",
      important: false,
    },
  ]).returning();

  const RDV_MEHDI_1  = insertedRDVs[0]!.id;
  const RDV_MEHDI_2  = insertedRDVs[1]!.id;
  const RDV_FATIMA_1 = insertedRDVs[2]!.id;
  const RDV_LYNDA_1  = insertedRDVs[3]!.id;

  // ── Ordonnances ───────────────────────────────────────────────────────────
  console.log("📄 Inserting ordonnances...");
  const insertedOrdonnances = await db.insert(ordonnance).values([
    {
      rendez_vous_id: RDV_MEHDI_1,
      patient_id: PATIENT_MEHDI,
      utilisateur_id: UTILISATEUR_ID,
      pre_rempli_origine_id: PRE_HTA,
      remarques: "Renouvellement traitement HTA",
      date_prescription: "2024-03-01",
    },
    {
      rendez_vous_id: RDV_MEHDI_2,
      patient_id: PATIENT_MEHDI,
      utilisateur_id: UTILISATEUR_ID,
      pre_rempli_origine_id: null,
      remarques: "Ajout antalgique ponctuel",
      date_prescription: "2024-04-01",
    },
    {
      rendez_vous_id: RDV_FATIMA_1,
      patient_id: PATIENT_FATIMA,
      utilisateur_id: UTILISATEUR_ID,
      pre_rempli_origine_id: PRE_DIABETE,
      remarques: "Initiation Metformine",
      date_prescription: "2024-03-05",
    },
    {
      rendez_vous_id: RDV_LYNDA_1,
      patient_id: PATIENT_LYNDA,
      utilisateur_id: UTILISATEUR_ID,
      pre_rempli_origine_id: PRE_INFECTION,
      remarques: "Traitement infection ORL",
      date_prescription: "2024-02-10",
    },
  ]).returning();

  const ORD_MEHDI_1  = insertedOrdonnances[0]!.id;
  const ORD_MEHDI_2  = insertedOrdonnances[1]!.id;
  const ORD_FATIMA_1 = insertedOrdonnances[2]!.id;

  // ── Ordonnance medicaments ────────────────────────────────────────────────
  console.log("💊 Inserting ordonnance_medicaments...");
  const insertedOrdMeds = await db.insert(ordonnance_medicaments).values([
    {
      ordonnance_id: ORD_MEHDI_1,
      medicament_id: MED_AMLODIPINE,
      posologie: "1 comprimé par jour le matin",
      duree_traitement: "30 jours",
      instructions: "Prendre avec un verre d'eau",
    },
    {
      ordonnance_id: ORD_MEHDI_2,
      medicament_id: MED_PARACETAMOL,
      posologie: "1 comprimé toutes les 6h si douleur",
      duree_traitement: "5 jours",
      instructions: "Ne pas dépasser 4g par jour",
    },
    {
      ordonnance_id: ORD_FATIMA_1,
      medicament_id: MED_METFORMINE,
      posologie: "1 comprimé matin et soir",
      duree_traitement: "30 jours",
      instructions: "Prendre pendant les repas",
    },
    {
      ordonnance_id: insertedOrdonnances[3]!.id,
      medicament_id: MED_AMOXICILLINE,
      posologie: "1 comprimé toutes les 8h",
      duree_traitement: "7 jours",
      instructions: "Terminer le traitement complet",
    },
  ]).returning();

  const ORD_MED_ID = insertedOrdMeds[0]!.id;

  // ── Generate Postman environment JSON ─────────────────────────────────────
  console.log("📦 Generating Postman environment file...");

  const postmanEnv = {
    id: randomUUID(),
    name: "ordonnance-module-env",
    values: [
      { key: "baseUrl",                value: "http://localhost:3000", type: "default", enabled: true },
      { key: "patientId",              value: PATIENT_MEHDI,           type: "default", enabled: true },
      { key: "patientFatimaId",        value: PATIENT_FATIMA,          type: "default", enabled: true },
      { key: "patientLyndaId",         value: PATIENT_LYNDA,           type: "default", enabled: true },
      { key: "rendezVousId",           value: RDV_MEHDI_1,             type: "default", enabled: true },
      { key: "rendezVousId2",          value: RDV_MEHDI_2,             type: "default", enabled: true },
      { key: "rendezVousFatimaId",     value: RDV_FATIMA_1,            type: "default", enabled: true },
      { key: "rendezVousLyndaId",      value: RDV_LYNDA_1,             type: "default", enabled: true },
      { key: "ordonnanceId",           value: ORD_MEHDI_1,             type: "default", enabled: true },
      { key: "ordonnanceId2",          value: ORD_MEHDI_2,             type: "default", enabled: true },
      { key: "ordonnanceFatimaId",     value: ORD_FATIMA_1,            type: "default", enabled: true },
      { key: "ordonnanceMedicamentId", value: ORD_MED_ID,              type: "default", enabled: true },
      { key: "medicamentId",           value: MED_PARACETAMOL,         type: "default", enabled: true },
      { key: "medicamentAmoxId",       value: MED_AMOXICILLINE,        type: "default", enabled: true },
      { key: "medicamentMetformineId", value: MED_METFORMINE,          type: "default", enabled: true },
      { key: "medicamentAmlodipineId", value: MED_AMLODIPINE,          type: "default", enabled: true },
      { key: "categorieId",            value: CAT_GENERALE,            type: "default", enabled: true },
      { key: "categorieCardioId",      value: CAT_CARDIO,              type: "default", enabled: true },
      { key: "categorieDiabeteId",     value: CAT_DIABETE,             type: "default", enabled: true },
      { key: "preRempliId",            value: PRE_HTA,                 type: "default", enabled: true },
      { key: "preRempliDiabeteId",     value: PRE_DIABETE,             type: "default", enabled: true },
      { key: "preRempliInfectionId",   value: PRE_INFECTION,           type: "default", enabled: true },
      { key: "preRempliMedicamentId",  value: PRE_REMPLI_MED_ID,       type: "default", enabled: true },
    ],
    _postman_variable_scope: "environment",
  };

  writeFileSync(
    "ordonnance-postman-env.json",
    JSON.stringify(postmanEnv, null, 2),
  );

  console.log("✅ Seed completed successfully.");
  console.log("📌 Postman environment saved to: ordonnance-postman-env.json");
  console.log("   In Postman: Environments → Import → select ordonnance-postman-env.json");
}

seedOrdonnance().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});