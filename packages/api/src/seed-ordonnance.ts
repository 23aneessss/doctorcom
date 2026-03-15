import { writeFileSync } from "node:fs";

import { db } from "@doctor.com/db";
import {
  historique_traitements,
  ordonnance,
  ordonnance_medicaments,
} from "@doctor.com/db/schema/traitements";
import {
  categories_pre_rempli,
  pre_rempli_medicaments,
  pre_rempli_ordonnance,
} from "@doctor.com/db/schema/ordonnances";
import { rendez_vous, suivi } from "@doctor.com/db/schema/suivi";

const UTILISATEUR_ID = "550e8400-e29b-41d4-a716-446655440000";
const PATIENT_MEHDI = "210d047b-c28c-4208-8f96-5d50b32b2f90";
const PATIENT_FATIMA = "e939a6ad-2ad8-4368-a275-4e1275ef37fc";
const PATIENT_LYNDA = "c4d33007-ecbb-4623-9916-6c9c9091da25";

const MEDICATION_SNAPSHOTS = {
  paracetamol: {
    medicament_externe_id: "1",
    nom_medicament: "Paracetamol",
    dci: "Paracetamol",
    dosage: "1 g",
  },
  amoxicilline: {
    medicament_externe_id: "2",
    nom_medicament: "Amoxicilline",
    dci: "Amoxicilline",
    dosage: "1 g",
  },
  metformine: {
    medicament_externe_id: "3",
    nom_medicament: "Metformine",
    dci: "Metformine",
    dosage: "500 mg",
  },
  amlodipine: {
    medicament_externe_id: "4",
    nom_medicament: "Amlodipine",
    dci: "Amlodipine",
    dosage: "5 mg",
  },
} as const;

async function seedOrdonnance() {
  console.log("Seeding ordonnance data...");

  await db.delete(ordonnance_medicaments);
  await db.delete(ordonnance);
  await db.delete(pre_rempli_medicaments);
  await db.delete(pre_rempli_ordonnance);
  await db.delete(categories_pre_rempli);
  await db.delete(historique_traitements);
  await db.delete(rendez_vous);
  await db.delete(suivi);

  const insertedCategories = await db
    .insert(categories_pre_rempli)
    .values([
      { nom: "Medecine Generale", description: "Ordonnances types generalistes" },
      { nom: "Cardiologie", description: "Ordonnances types cardiovasculaires" },
      { nom: "Diabetologie", description: "Ordonnances types diabete" },
    ])
    .returning();

  const [catGenerale, catCardio, catDiabete] = insertedCategories;
  if (!catGenerale || !catCardio || !catDiabete) {
    throw new Error("Categories pre-remplies non creees.");
  }

  const insertedPreRemplis = await db
    .insert(pre_rempli_ordonnance)
    .values([
      {
        nom: "HTA standard",
        description: "Traitement de base pour hypertension",
        specialite: "Cardiologie",
        categorie_pre_rempli_id: catCardio.id,
        est_actif: true,
        created_by_user: UTILISATEUR_ID,
      },
      {
        nom: "Diabete type 2",
        description: "Initiation diabetologie",
        specialite: "Diabetologie",
        categorie_pre_rempli_id: catDiabete.id,
        est_actif: true,
        created_by_user: UTILISATEUR_ID,
      },
      {
        nom: "Infection ORL",
        description: "Traitement antibiotique standard",
        specialite: "Medecine Generale",
        categorie_pre_rempli_id: catGenerale.id,
        est_actif: true,
        created_by_user: UTILISATEUR_ID,
      },
    ])
    .returning();

  const [preHta, preDiabete, preInfection] = insertedPreRemplis;
  if (!preHta || !preDiabete || !preInfection) {
    throw new Error("Pre-remplis non crees.");
  }

  await db.insert(pre_rempli_medicaments).values([
    {
      pre_rempli_id: preHta.id,
      ...MEDICATION_SNAPSHOTS.amlodipine,
      posologie_defaut: "1 comprime par jour le matin",
      duree_defaut: "30 jours",
      instructions_defaut: "Prendre avec un verre d'eau",
      ordre_affichage: 1,
      est_optionnel: false,
    },
    {
      pre_rempli_id: preDiabete.id,
      ...MEDICATION_SNAPSHOTS.metformine,
      posologie_defaut: "1 comprime matin et soir",
      duree_defaut: "30 jours",
      instructions_defaut: "Prendre pendant les repas",
      ordre_affichage: 1,
      est_optionnel: false,
    },
    {
      pre_rempli_id: preInfection.id,
      ...MEDICATION_SNAPSHOTS.amoxicilline,
      posologie_defaut: "1 comprime toutes les 8h",
      duree_defaut: "7 jours",
      instructions_defaut: "Terminer le traitement complet",
      ordre_affichage: 1,
      est_optionnel: false,
    },
    {
      pre_rempli_id: preInfection.id,
      ...MEDICATION_SNAPSHOTS.paracetamol,
      posologie_defaut: "1 comprime toutes les 6h si douleur",
      duree_defaut: "5 jours",
      instructions_defaut: "Ne pas depasser 4g par jour",
      ordre_affichage: 2,
      est_optionnel: true,
    },
  ]);

  const insertedSuivis = await db
    .insert(suivi)
    .values([
      {
        patient_id: PATIENT_MEHDI,
        utilisateur_id: UTILISATEUR_ID,
        motif: "Suivi hypertension arterielle",
        hypothese_diagnostic: "HTA essentielle",
        historique: "Patient hypertendu depuis 2020",
        date_ouverture: "2024-01-10",
        est_actif: true,
      },
      {
        patient_id: PATIENT_FATIMA,
        utilisateur_id: UTILISATEUR_ID,
        motif: "Suivi diabete type 2",
        hypothese_diagnostic: "Diabete de type 2",
        historique: "Diagnostique en 2018",
        date_ouverture: "2024-01-15",
        est_actif: true,
      },
      {
        patient_id: PATIENT_LYNDA,
        utilisateur_id: UTILISATEUR_ID,
        motif: "Infection ORL",
        hypothese_diagnostic: "Rhinopharyngite",
        historique: "Episode recurrent",
        date_ouverture: "2024-02-01",
        est_actif: true,
      },
    ])
    .returning();

  const [suiviMehdi, suiviFatima, suiviLynda] = insertedSuivis;
  if (!suiviMehdi || !suiviFatima || !suiviLynda) {
    throw new Error("Suivis non crees.");
  }

  const insertedRendezVous = await db
    .insert(rendez_vous)
    .values([
      {
        patient_id: PATIENT_MEHDI,
        suivi_id: suiviMehdi.id,
        utilisateur_id: UTILISATEUR_ID,
        date: "2024-03-10",
        heure: "09:00",
        statut: "termine",
        important: true,
        frequence_rappel: "24h",
        periode_rappel: "veille",
      },
      {
        patient_id: PATIENT_FATIMA,
        suivi_id: suiviFatima.id,
        utilisateur_id: UTILISATEUR_ID,
        date: "2024-03-11",
        heure: "10:00",
        statut: "termine",
        important: false,
        frequence_rappel: "24h",
        periode_rappel: "veille",
      },
      {
        patient_id: PATIENT_LYNDA,
        suivi_id: suiviLynda.id,
        utilisateur_id: UTILISATEUR_ID,
        date: "2024-03-12",
        heure: "11:00",
        statut: "termine",
        important: false,
        frequence_rappel: "24h",
        periode_rappel: "veille",
      },
    ])
    .returning();

  const [rdvMehdi, rdvFatima, rdvLynda] = insertedRendezVous;
  if (!rdvMehdi || !rdvFatima || !rdvLynda) {
    throw new Error("Rendez-vous non crees.");
  }

  const insertedOrdonnances = await db
    .insert(ordonnance)
    .values([
      {
        rendez_vous_id: rdvMehdi.id,
        patient_id: PATIENT_MEHDI,
        utilisateur_id: UTILISATEUR_ID,
        pre_rempli_origine_id: preHta.id,
        remarques: "Controle tensionnel",
        date_prescription: "2024-03-10",
      },
      {
        rendez_vous_id: rdvFatima.id,
        patient_id: PATIENT_FATIMA,
        utilisateur_id: UTILISATEUR_ID,
        pre_rempli_origine_id: preDiabete.id,
        remarques: "Suivi glycemique",
        date_prescription: "2024-03-11",
      },
      {
        rendez_vous_id: rdvLynda.id,
        patient_id: PATIENT_LYNDA,
        utilisateur_id: UTILISATEUR_ID,
        pre_rempli_origine_id: preInfection.id,
        remarques: "Infection ORL a traiter",
        date_prescription: "2024-03-12",
      },
    ])
    .returning();

  const [ordMehdi, ordFatima, ordLynda] = insertedOrdonnances;
  if (!ordMehdi || !ordFatima || !ordLynda) {
    throw new Error("Ordonnances non creees.");
  }

  const insertedOrdonnanceMedicaments = await db
    .insert(ordonnance_medicaments)
    .values([
      {
        ordonnance_id: ordMehdi.id,
        ...MEDICATION_SNAPSHOTS.amlodipine,
        posologie: "1 comprime par jour",
        duree_traitement: "30 jours",
        instructions: "Le matin",
      },
      {
        ordonnance_id: ordFatima.id,
        ...MEDICATION_SNAPSHOTS.metformine,
        posologie: "1 comprime matin et soir",
        duree_traitement: "30 jours",
        instructions: "Pendant les repas",
      },
      {
        ordonnance_id: ordLynda.id,
        ...MEDICATION_SNAPSHOTS.amoxicilline,
        posologie: "1 comprime toutes les 8h",
        duree_traitement: "7 jours",
        instructions: "Ne pas interrompre",
      },
    ])
    .returning();

  const [ordMedMehdi, ordMedFatima, ordMedLynda] = insertedOrdonnanceMedicaments;
  if (!ordMedMehdi || !ordMedFatima || !ordMedLynda) {
    throw new Error("Medicaments d'ordonnance non crees.");
  }

  await db.insert(historique_traitements).values([
    {
      patient_id: PATIENT_MEHDI,
      ...MEDICATION_SNAPSHOTS.amlodipine,
      posologie: "1 comprime par jour",
      est_actif: true,
      date_prescription: "2024-03-10",
      prescrit_par_utilisateur: UTILISATEUR_ID,
      ordonnance_id: ordMehdi.id,
      ordonnance_medicament_id: ordMedMehdi.id,
      source_type: "ordonnance",
    },
    {
      patient_id: PATIENT_FATIMA,
      ...MEDICATION_SNAPSHOTS.metformine,
      posologie: "1 comprime matin et soir",
      est_actif: true,
      date_prescription: "2024-03-11",
      prescrit_par_utilisateur: UTILISATEUR_ID,
      ordonnance_id: ordFatima.id,
      ordonnance_medicament_id: ordMedFatima.id,
      source_type: "ordonnance",
    },
    {
      patient_id: PATIENT_LYNDA,
      ...MEDICATION_SNAPSHOTS.paracetamol,
      posologie: "1 comprime si douleur",
      est_actif: true,
      date_prescription: "2024-03-12",
      prescrit_par_utilisateur: UTILISATEUR_ID,
      source_type: "manuel",
    },
  ]);

  const summary = {
    categories: insertedCategories.map((item) => item.id),
    pre_remplis: insertedPreRemplis.map((item) => item.id),
    suivis: insertedSuivis.map((item) => item.id),
    rendez_vous: insertedRendezVous.map((item) => item.id),
    ordonnances: insertedOrdonnances.map((item) => item.id),
    ordonnance_medicaments: insertedOrdonnanceMedicaments.map((item) => item.id),
  };

  writeFileSync("ordonnance-seed-summary.json", JSON.stringify(summary, null, 2));
  console.log("Ordonnance seed completed.");
}

seedOrdonnance().catch((error) => {
  console.error(error);
  process.exit(1);
});
