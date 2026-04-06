/**
 * Seed pre-rempli ordonnance templates only.
 *
 * Usage: bun seed-pre-remplis.ts
 */

import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  categories_pre_rempli,
  pre_rempli_medicaments,
  pre_rempli_ordonnance,
} from "./packages/db/src/schema/ordonnances";
import { utilisateurs } from "./packages/db/src/schema/utilisateurs";

dotenv.config({ path: "./apps/server/.env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required. Check apps/server/.env");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const db = drizzle({ client: pool });

const UTILISATEUR_ID = "9c9b18f8-e89a-4b32-b387-e39f96d0f9e8";
const UTILISATEUR_EMAIL = "tbib@doctorcom.com";

const CAT_GENERAL = "8a000000-0000-4000-a000-000000000001";
const CAT_CARDIO = "8a000000-0000-4000-a000-000000000002";
const CAT_DIABETO = "8a000000-0000-4000-a000-000000000003";
const CAT_INFECTIO = "8a000000-0000-4000-a000-000000000004";

const PRE_FEBRILE = "8b000000-0000-4000-a000-000000000001";
const PRE_HTA = "8b000000-0000-4000-a000-000000000002";
const PRE_DIABETE = "8b000000-0000-4000-a000-000000000003";
const PRE_ORL = "8b000000-0000-4000-a000-000000000004";
const PRE_GASTRITE = "8b000000-0000-4000-a000-000000000005";

async function seedPreRemplis() {
  console.log("Seeding pre-rempli ordonnances...");

  let [user] = await db
    .select({ id: utilisateurs.id })
    .from(utilisateurs)
    .where(eq(utilisateurs.id, UTILISATEUR_ID))
    .limit(1);

  if (!user) {
    [user] = await db
      .select({ id: utilisateurs.id })
      .from(utilisateurs)
      .where(eq(utilisateurs.email, UTILISATEUR_EMAIL))
      .limit(1);
  }

  if (!user) {
    console.log("Seed user not found, creating default seed user...");
    const [createdUser] = await db
      .insert(utilisateurs)
      .values({
        id: UTILISATEUR_ID,
        nom: "Benmoussa",
        prenom: "Karim",
        email: UTILISATEUR_EMAIL,
        adresse: "12 Rue Didouche Mourad, Alger",
        telephone: "0555123456",
        mot_de_passe_hash:
          "6cd52985440601603e7843477cedb8fc:5dedf7d78117fce867a08ae7eea93ff0daf8dcd5e243c481662b5e3b92e604412643f2fb801b5723fab8c886fe485545c86b2498ddc90a59a829edb0d20729ce",
        date_creation: "2024-01-15",
        role: "medecin",
      })
      .returning({ id: utilisateurs.id });

    user = createdUser;
  }

  if (!user) {
    throw new Error("Failed to ensure seed user before pre-rempli seeding.");
  }

  const createdByUserId = user.id;

  await db.delete(pre_rempli_medicaments);
  await db.delete(pre_rempli_ordonnance);
  await db.delete(categories_pre_rempli);

  await db.insert(categories_pre_rempli).values([
    {
      id: CAT_GENERAL,
      nom: "Medecine Generale",
      description: "Modeles de prescription courants en medecine generale",
    },
    {
      id: CAT_CARDIO,
      nom: "Cardiologie",
      description: "Modeles de prescription cardiovasculaire",
    },
    {
      id: CAT_DIABETO,
      nom: "Diabetologie",
      description: "Modeles de prise en charge du diabete",
    },
    {
      id: CAT_INFECTIO,
      nom: "Infectiologie",
      description: "Modeles de traitement des infections frequentes",
    },
  ]);

  await db.insert(pre_rempli_ordonnance).values([
    {
      id: PRE_FEBRILE,
      nom: "Syndrome febrile (adulte)",
      description: "Traitement symptomatique de fievre et douleurs chez l'adulte",
      specialite: "Medecine Generale",
      categorie_pre_rempli_id: CAT_GENERAL,
      est_actif: true,
      created_by_user: createdByUserId,
    },
    {
      id: PRE_HTA,
      nom: "HTA standard",
      description: "Schema initial pour hypertension arterielle non compliquee",
      specialite: "Cardiologie",
      categorie_pre_rempli_id: CAT_CARDIO,
      est_actif: true,
      created_by_user: createdByUserId,
    },
    {
      id: PRE_DIABETE,
      nom: "Diabete type 2",
      description: "Initiation et suivi d'un diabete de type 2",
      specialite: "Diabetologie",
      categorie_pre_rempli_id: CAT_DIABETO,
      est_actif: true,
      created_by_user: createdByUserId,
    },
    {
      id: PRE_ORL,
      nom: "Infection ORL",
      description: "Traitement standard des infections ORL non compliquees",
      specialite: "Infectiologie",
      categorie_pre_rempli_id: CAT_INFECTIO,
      est_actif: true,
      created_by_user: createdByUserId,
    },
    {
      id: PRE_GASTRITE,
      nom: "Syndrome dyspeptique",
      description: "Prise en charge initiale des douleurs epigastriques",
      specialite: "Medecine Generale",
      categorie_pre_rempli_id: CAT_GENERAL,
      est_actif: true,
      created_by_user: createdByUserId,
    },
  ]);

  await db.insert(pre_rempli_medicaments).values([
    {
      pre_rempli_id: PRE_FEBRILE,
      medicament_externe_id: "1",
      nom_medicament: "Paracetamol",
      dosage: "1 g",
      posologie_defaut: "1 comprime toutes les 6 heures si douleur ou fievre",
      duree_defaut: "5 jours",
      instructions_defaut: "Ne pas depasser 4 g par jour",
      ordre_affichage: 1,
      est_optionnel: false,
    },
    {
      pre_rempli_id: PRE_FEBRILE,
      medicament_externe_id: "2",
      nom_medicament: "Amoxicilline",
      dosage: "1 g",
      posologie_defaut: "1 comprime toutes les 8 heures",
      duree_defaut: "7 jours",
      instructions_defaut: "Uniquement si foyer bacterien documente",
      ordre_affichage: 2,
      est_optionnel: true,
    },
    {
      pre_rempli_id: PRE_HTA,
      medicament_externe_id: "4",
      nom_medicament: "Amlodipine",
      dosage: "5 mg",
      posologie_defaut: "1 comprime le matin",
      duree_defaut: "30 jours",
      instructions_defaut: "Controle tensionnel hebdomadaire",
      ordre_affichage: 1,
      est_optionnel: false,
    },
    {
      pre_rempli_id: PRE_DIABETE,
      medicament_externe_id: "3",
      nom_medicament: "Metformine",
      dosage: "500 mg",
      posologie_defaut: "1 comprime matin et soir pendant les repas",
      duree_defaut: "30 jours",
      instructions_defaut: "Reevaluer HbA1c au prochain suivi",
      ordre_affichage: 1,
      est_optionnel: false,
    },
    {
      pre_rempli_id: PRE_ORL,
      medicament_externe_id: "2",
      nom_medicament: "Amoxicilline",
      dosage: "1 g",
      posologie_defaut: "1 comprime toutes les 8 heures",
      duree_defaut: "7 jours",
      instructions_defaut: "Terminer le traitement complet",
      ordre_affichage: 1,
      est_optionnel: false,
    },
    {
      pre_rempli_id: PRE_ORL,
      medicament_externe_id: "1",
      nom_medicament: "Paracetamol",
      dosage: "1 g",
      posologie_defaut: "1 comprime toutes les 6 heures si douleur",
      duree_defaut: "5 jours",
      instructions_defaut: "Ne pas depasser 4 g par jour",
      ordre_affichage: 2,
      est_optionnel: true,
    },
    {
      pre_rempli_id: PRE_GASTRITE,
      medicament_externe_id: "1",
      nom_medicament: "Paracetamol",
      dosage: "500 mg",
      posologie_defaut: "1 a 2 comprimes en cas de douleur",
      duree_defaut: "3 jours",
      instructions_defaut: "Eviter les anti-inflammatoires sans avis medical",
      ordre_affichage: 1,
      est_optionnel: true,
    },
  ]);

  console.log("Pre-rempli seed completed.");
  console.log("Summary:");
  console.log("  - 4 categories pre-rempli");
  console.log("  - 5 modeles pre-remplis");
  console.log("  - 7 medicaments de modeles");
}

seedPreRemplis()
  .catch((error) => {
    console.error("Pre-rempli seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
