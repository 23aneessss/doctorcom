import "./load-env";

import { db } from "@doctor.com/db";
import {
  patients,
  patients_femmes,
  antecedents,
  antecedents_personnels,
  antecedents_familiaux,
} from "@doctor.com/db/schema/patients";
import {
  suivi,
  rendez_vous,
  examen_consultation,
} from "@doctor.com/db/schema/suivi";
import {
  historique_traitements,
  ordonnance,
  ordonnance_medicaments,
} from "@doctor.com/db/schema/traitements";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const DOCTOR_ID = "9c9b18f8-e89a-4b32-b387-e39f96d0f9e8";

// Real medication IDs from Vidal DB
const MED = {
  DOLIPRANE: "659",
  GLUCOPHAGE: "3500",
  METFORMINE_BIOGARAN: "4596",
  TAHOR: "7148",
  AMLOR: "2491",
  AUGMENTIN: "2150",
  KARDEGIC: "5316",
  LEVOTHYROX: "4969",
  MOPRAL: "4380",
  VENTOLINE: "7946",
  SERETIDE: "7561",
  DEPAKOTE: "876",
  XANAX: "7716",
  AMLODIPINE_BIOGARAN: "2512",
};

// Today and helpers
const today = new Date();
const d = (daysAgo: number) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() - daysAgo);
  return dt.toISOString().slice(0, 10);
};

console.log("🌱 Seeding demo data...\n");

// ─── PATIENTS ────────────────────────────────────────────────────────────────
const patientData = [
  // 1 — Diabetic + hypertensive 58yo male, complex
  {
    nom: "BENALI",
    prenom: "Karim",
    telephone: "0555123456",
    email: "karim.benali@email.dz",
    matricule: "PAT-KB-001",
    date_naissance: "1966-03-14",
    nss: "166031501234567",
    lieu_naissance: "Alger",
    sexe: "Masculin",
    nationalite: "Algérienne",
    groupe_sanguin: "A+",
    adresse: "12 Rue des Oliviers, Hydra, Alger",
    profession: "Comptable",
    habitudes_saines: "Marche 20 min/jour, régime pauvre en sel",
    habitudes_toxiques: "Tabagisme sevré depuis 5 ans, ancien fumeur 20 paquets/an",
    nb_enfants: 3,
    situation_familiale: "Marié",
    date_admission: d(365),
    assure: true,
    niveau_intellectuel: "Université",
    activite_sexuelle: true,
  },
  // 2 — Asthmatic 32yo female
  {
    nom: "RAHMANI",
    prenom: "Yasmine",
    telephone: "0661234567",
    email: "yasmine.rahmani@email.dz",
    matricule: "PAT-YR-002",
    date_naissance: "1992-07-22",
    nss: "292072334512345",
    lieu_naissance: "Oran",
    sexe: "Féminin",
    nationalite: "Algérienne",
    groupe_sanguin: "O+",
    adresse: "5 Boulevard Zighout Youcef, Oran",
    profession: "Enseignante",
    habitudes_saines: "Yoga 3x/semaine, non-fumeuse",
    habitudes_toxiques: "Aucune",
    nb_enfants: 1,
    situation_familiale: "Mariée",
    date_admission: d(200),
    assure: true,
    niveau_intellectuel: "Master",
    activite_sexuelle: true,
  },
  // 3 — Hypothyroid 45yo female
  {
    nom: "MEZIANE",
    prenom: "Nadia",
    telephone: "0770987654",
    email: "nadia.meziane@email.dz",
    matricule: "PAT-NM-003",
    date_naissance: "1979-11-05",
    nss: "279112556789012",
    lieu_naissance: "Constantine",
    sexe: "Féminin",
    nationalite: "Algérienne",
    groupe_sanguin: "B+",
    adresse: "3 Rue Ibn Khaldoun, Constantine",
    profession: "Pharmacienne",
    habitudes_saines: "Natation 2x/semaine",
    habitudes_toxiques: "Café excessif (5 tasses/jour)",
    nb_enfants: 2,
    situation_familiale: "Mariée",
    date_admission: d(180),
    assure: true,
    niveau_intellectuel: "Doctorat",
    activite_sexuelle: true,
  },
  // 4 — Elderly cardiac 72yo male
  {
    nom: "BOUDERBALA",
    prenom: "Ahmed",
    telephone: "0550112233",
    email: "ahmed.bouderbala@email.dz",
    matricule: "PAT-AB-004",
    date_naissance: "1952-01-30",
    nss: "152011201234567",
    lieu_naissance: "Tlemcen",
    sexe: "Masculin",
    nationalite: "Algérienne",
    groupe_sanguin: "AB+",
    adresse: "8 Rue de l'Indépendance, Tlemcen",
    profession: "Retraité",
    habitudes_saines: "Marche légère, régime méditerranéen",
    habitudes_toxiques: "Tabagisme actif 30 cig/jour depuis 40 ans",
    nb_enfants: 5,
    situation_familiale: "Marié",
    date_admission: d(500),
    assure: true,
    niveau_intellectuel: "Lycée",
    activite_sexuelle: false,
  },
  // 5 — Young 24yo male, acute infection
  {
    nom: "KHELIFI",
    prenom: "Rami",
    telephone: "0799456789",
    email: "rami.khelifi@email.dz",
    matricule: "PAT-RK-005",
    date_naissance: "2000-09-12",
    nss: "200091501234560",
    lieu_naissance: "Sétif",
    sexe: "Masculin",
    nationalite: "Algérienne",
    groupe_sanguin: "O-",
    adresse: "22 Cité des Palmiers, Sétif",
    profession: "Étudiant en médecine",
    habitudes_saines: "Sport intensif (football, musculation)",
    habitudes_toxiques: "Aucune",
    nb_enfants: 0,
    situation_familiale: "Célibataire",
    date_admission: d(30),
    assure: false,
    niveau_intellectuel: "Université",
    activite_sexuelle: true,
  },
  // 6 — 16yo adolescent female, anxiety + migraines
  {
    nom: "DJEBBAR",
    prenom: "Sara",
    telephone: "0662345678",
    email: "sara.djebbar@email.dz",
    matricule: "PAT-SD-006",
    date_naissance: "2008-04-18",
    nss: "208041556789012",
    lieu_naissance: "Blida",
    sexe: "Féminin",
    nationalite: "Algérienne",
    groupe_sanguin: "A-",
    adresse: "17 Rue des Roses, Blida",
    profession: "Lycéenne",
    habitudes_saines: "Lecture, dessin",
    habitudes_toxiques: "Écrans 6h/jour",
    nb_enfants: 0,
    situation_familiale: "Célibataire",
    date_admission: d(60),
    assure: true,
    niveau_intellectuel: "Lycée",
    activite_sexuelle: false,
  },
];

async function seed() {
  console.log("👤 Inserting patients...");
  const insertedPatients: Array<{ id: string; nom: string; prenom: string }> = [];

  for (const p of patientData) {
    const [inserted] = await db
      .insert(patients)
      .values({ ...p, cree_par_utilisateur: DOCTOR_ID })
      .returning({ id: patients.id, nom: patients.nom, prenom: patients.prenom })
      .onConflictDoNothing();

    if (inserted) {
      insertedPatients.push(inserted);
      console.log(`  ✅ ${inserted.nom} ${inserted.prenom} — ${inserted.id}`);
    } else {
      console.log(`  ⚠️  ${p.nom} ${p.prenom} already exists (skipped)`);
    }
  }

  if (insertedPatients.length === 0) {
    console.log("\n⚠️  All patients already exist. Run cleanup first if you want a fresh seed.");
    return;
  }

  // Helper: find inserted patient by index
  const pat = (index: number) => insertedPatients[index];
  const patId = (index: number) => insertedPatients[index]?.id;

  // ─── PATIENTS_FEMMES ───────────────────────────────────────────────────────
  console.log("\n♀️  Inserting female patient details...");
  const femaleIndices = [1, 2, 5]; // Yasmine, Nadia, Sara
  for (const i of femaleIndices) {
    const id = patId(i);
    if (!id) continue;
    const data =
      i === 1
        ? { menarche: 13, regularite_cycles: "Réguliers", contraception: "Pilule", nb_grossesses: 1, nb_cesariennes: 0, menopause: false }
        : i === 2
          ? { menarche: 14, regularite_cycles: "Cycles longs (35j)", contraception: "Stérilet DIU", nb_grossesses: 2, nb_cesariennes: 1, menopause: false }
          : { menarche: 13, regularite_cycles: "Irréguliers", contraception: "Aucune", nb_grossesses: 0, nb_cesariennes: 0, menopause: false };
    await db.insert(patients_femmes).values({ patient_id: id, ...data }).onConflictDoNothing();
  }

  // ─── ANTECEDENTS ──────────────────────────────────────────────────────────
  console.log("\n📋 Inserting antecedents...");

  // Karim — diabète + HTA personnels + cardio familial
  if (patId(0)) {
    const [ant1] = await db.insert(antecedents).values({ patient_id: patId(0)!, type: "personnel", description: "Diabète type 2 diagnostiqué en 2015" }).returning({ id: antecedents.id });
    if (ant1) await db.insert(antecedents_personnels).values({ antecedent_id: ant1.id, type: "Endocrinologique", details: "Diabète type 2 — HbA1c 7.8% en dernier bilan, traitement par metformine", est_actif: true });
    const [ant2] = await db.insert(antecedents).values({ patient_id: patId(0)!, type: "personnel", description: "Hypertension artérielle essentielle depuis 2018" }).returning({ id: antecedents.id });
    if (ant2) await db.insert(antecedents_personnels).values({ antecedent_id: ant2.id, type: "Cardiovasculaire", details: "HTA stade 2 — traité par amlodipine 10mg/j", est_actif: true });
    const [ant3] = await db.insert(antecedents).values({ patient_id: patId(0)!, type: "familial", description: "Père décédé d'un infarctus du myocarde à 62 ans" }).returning({ id: antecedents.id });
    if (ant3) await db.insert(antecedents_familiaux).values({ antecedent_id: ant3.id, details: "Infarctus du myocarde fatal à 62 ans", lien_parente: "Père" });
    const [ant4] = await db.insert(antecedents).values({ patient_id: patId(0)!, type: "familial", description: "Mère atteinte de diabète type 2" }).returning({ id: antecedents.id });
    if (ant4) await db.insert(antecedents_familiaux).values({ antecedent_id: ant4.id, details: "Diabète type 2 sous insuline depuis 10 ans", lien_parente: "Mère" });
  }

  // Yasmine — asthme personnel
  if (patId(1)) {
    const [ant] = await db.insert(antecedents).values({ patient_id: patId(1)!, type: "personnel", description: "Asthme allergique diagnostiqué à l'enfance" }).returning({ id: antecedents.id });
    if (ant) await db.insert(antecedents_personnels).values({ antecedent_id: ant.id, type: "Respiratoire", details: "Asthme allergique modéré, exacerbations printemps/automne — allergie aux acariens et aux graminées", est_actif: true });
  }

  // Nadia — hypothyroïdie personnelle
  if (patId(2)) {
    const [ant] = await db.insert(antecedents).values({ patient_id: patId(2)!, type: "personnel", description: "Hypothyroïdie primaire diagnostiquée en 2019" }).returning({ id: antecedents.id });
    if (ant) await db.insert(antecedents_personnels).values({ antecedent_id: ant.id, type: "Endocrinologique", details: "Hypothyroïdie primaire — TSH élevée, traitement par lévothyroxine 75µg/j", est_actif: true });
    const [ant2] = await db.insert(antecedents).values({ patient_id: patId(2)!, type: "familial", description: "Mère opérée d'un cancer thyroïdien" }).returning({ id: antecedents.id });
    if (ant2) await db.insert(antecedents_familiaux).values({ antecedent_id: ant2.id, details: "Carcinome papillaire thyroïdien opéré à 55 ans", lien_parente: "Mère" });
  }

  // Ahmed — coronaropathie + HTA + BPCO
  if (patId(3)) {
    const [ant1] = await db.insert(antecedents).values({ patient_id: patId(3)!, type: "personnel", description: "Coronaropathie, stent posé en 2020" }).returning({ id: antecedents.id });
    if (ant1) await db.insert(antecedents_personnels).values({ antecedent_id: ant1.id, type: "Cardiovasculaire", details: "Angor instable, angioplastie + stent IVA en 2020, sous aspirine + statine", est_actif: true });
    const [ant2] = await db.insert(antecedents).values({ patient_id: patId(3)!, type: "personnel", description: "BPCO stade II (tabagisme 40 PA)" }).returning({ id: antecedents.id });
    if (ant2) await db.insert(antecedents_personnels).values({ antecedent_id: ant2.id, type: "Respiratoire", details: "BPCO modérée GOLD II, dyspnée à l'effort, VEMS 65%", est_actif: true });
  }

  // Sara — migraines + anxiété
  if (patId(5)) {
    const [ant] = await db.insert(antecedents).values({ patient_id: patId(5)!, type: "personnel", description: "Migraines avec aura depuis l'âge de 14 ans" }).returning({ id: antecedents.id });
    if (ant) await db.insert(antecedents_personnels).values({ antecedent_id: ant.id, type: "Neurologique", details: "Migraine avec aura 2-3 crises/mois, durée 12-48h, résistante à l'ibuprofène", est_actif: true });
  }

  // ─── SUIVIS ──────────────────────────────────────────────────────────────
  console.log("\n📁 Inserting suivis...");
  const suiviIds: Record<string, string[]> = {};

  // Karim — 2 suivis (diabète actif + HTA fermé)
  if (patId(0)) {
    const [s1] = await db.insert(suivi).values({
      patient_id: patId(0)!, utilisateur_id: DOCTOR_ID,
      motif: "Suivi diabète type 2 et équilibre glycémique",
      hypothese_diagnostic: "Diabète type 2 déséquilibré — HbA1c > 7.5%",
      symptoms: ["Polyurie", "Polydipsie", "Fatigue chronique", "Vision floue occasionnelle"],
      historique: "Patient diabétique type 2 depuis 2015, traitement initial par metformine 1000mg, HbA1c fluctuante entre 7 et 9%. Antécédents familiaux de diabète et de cardiopathie.",
      date_ouverture: d(365),
      est_actif: true,
    }).returning({ id: suivi.id });
    const [s2] = await db.insert(suivi).values({
      patient_id: patId(0)!, utilisateur_id: DOCTOR_ID,
      motif: "Contrôle tension artérielle post-traitement",
      hypothese_diagnostic: "HTA stade 2 contrôlée sous traitement",
      symptoms: ["Céphalées matinales", "Vertiges"],
      historique: "HTA diagnostiquée lors du bilan diabétique 2018. Mise sous amlodipine 5mg, dosage augmenté à 10mg après 6 mois.",
      date_ouverture: d(400),
      date_fermeture: d(60),
      est_actif: false,
    }).returning({ id: suivi.id });
    if (s1) suiviIds["karim"] = [s1.id];
    if (s2) suiviIds["karim"].push(s2.id);
    console.log(`  ✅ Karim — ${suiviIds["karim"]?.length} suivis`);
  }

  // Yasmine — 1 suivi asthme actif
  if (patId(1)) {
    const [s] = await db.insert(suivi).values({
      patient_id: patId(1)!, utilisateur_id: DOCTOR_ID,
      motif: "Suivi asthme allergique — exacerbation printanière",
      hypothese_diagnostic: "Asthme allergique modéré persistant — GINA stade 3",
      symptoms: ["Dyspnée à l'effort", "Toux nocturne", "Sibilances", "Oppression thoracique"],
      historique: "Asthme allergique connu depuis l'enfance. Exacerbations saisonnières. Dernière crise sévère il y a 6 mois.",
      date_ouverture: d(200),
      est_actif: true,
    }).returning({ id: suivi.id });
    if (s) suiviIds["yasmine"] = [s.id];
    console.log(`  ✅ Yasmine — 1 suivi`);
  }

  // Nadia — 1 suivi hypothyroïdie actif
  if (patId(2)) {
    const [s] = await db.insert(suivi).values({
      patient_id: patId(2)!, utilisateur_id: DOCTOR_ID,
      motif: "Suivi hypothyroïdie — ajustement dose lévothyroxine",
      hypothese_diagnostic: "Hypothyroïdie primaire auto-immune (thyroïdite de Hashimoto probable)",
      symptoms: ["Fatigue", "Prise de poids", "Frilosité", "Constipation", "Bradycardie"],
      historique: "Découverte fortuite lors bilan de fatigue 2019. TSH à 12 mUI/L, T4L basse. Mise sous Levothyrox 75µg, titration en cours.",
      date_ouverture: d(180),
      est_actif: true,
    }).returning({ id: suivi.id });
    if (s) suiviIds["nadia"] = [s.id];
    console.log(`  ✅ Nadia — 1 suivi`);
  }

  // Ahmed — 2 suivis (coronaropathie actif + BPCO actif)
  if (patId(3)) {
    const [s1] = await db.insert(suivi).values({
      patient_id: patId(3)!, utilisateur_id: DOCTOR_ID,
      motif: "Suivi post-angioplastie coronaire — prévention secondaire",
      hypothese_diagnostic: "Coronaropathie stable post-stent IVA",
      symptoms: ["Dyspnée d'effort", "Douleur précordiale à l'effort", "Oedèmes des membres inférieurs"],
      historique: "Angioplastie + stent IVA en 2020 pour angor instable. Bonne évolution clinique, FEVG 50% en dernier écho. Sous double antiagrégation, statine, bêtabloquant.",
      date_ouverture: d(500),
      est_actif: true,
    }).returning({ id: suivi.id });
    const [s2] = await db.insert(suivi).values({
      patient_id: patId(3)!, utilisateur_id: DOCTOR_ID,
      motif: "Suivi BPCO — exacerbation infectieuse récente",
      hypothese_diagnostic: "BPCO GOLD II — exacerbation modérée à sévère",
      symptoms: ["Toux productive", "Expectoration purulente", "Dyspnée de repos", "Cyanose des lèvres"],
      historique: "BPCO diagnostiquée 2018 sur tabagisme 40 PA. 2 exacerbations/an en moyenne. EFR: VEMS 65%. Traitement de fond: LAMA + LABA.",
      date_ouverture: d(90),
      est_actif: true,
    }).returning({ id: suivi.id });
    if (s1) suiviIds["ahmed"] = [s1.id];
    if (s2) suiviIds["ahmed"].push(s2.id);
    console.log(`  ✅ Ahmed — ${suiviIds["ahmed"]?.length} suivis`);
  }

  // Rami — 1 suivi infection ORL
  if (patId(4)) {
    const [s] = await db.insert(suivi).values({
      patient_id: patId(4)!, utilisateur_id: DOCTOR_ID,
      motif: "Consultation angine bactérienne — évaluation et traitement",
      hypothese_diagnostic: "Angine bactérienne à streptocoque groupe A (score de McIsaac: 4)",
      symptoms: ["Odynophagie intense", "Fièvre 39.5°C", "Adénopathies cervicales", "Absence de toux"],
      historique: "Pas d'antécédents médicaux notables. Premier épisode d'angine depuis 3 ans.",
      date_ouverture: d(10),
      est_actif: true,
    }).returning({ id: suivi.id });
    if (s) suiviIds["rami"] = [s.id];
    console.log(`  ✅ Rami — 1 suivi`);
  }

  // Sara — 1 suivi migraines + anxiété
  if (patId(5)) {
    const [s] = await db.insert(suivi).values({
      patient_id: patId(5)!, utilisateur_id: DOCTOR_ID,
      motif: "Migraines récurrentes et syndrome anxieux chez adolescente",
      hypothese_diagnostic: "Migraine avec aura + trouble anxieux généralisé débutant",
      symptoms: ["Céphalées pulsatiles unilatérales", "Photophobie", "Phonophobie", "Nausées", "Anxiété", "Insomnie"],
      historique: "Migraines avec aura depuis 14 ans, 2-3 crises/mois. Traitement abortif par ibuprofène insuffisant. Stress scolaire important, trouble du sommeil.",
      date_ouverture: d(60),
      est_actif: true,
    }).returning({ id: suivi.id });
    if (s) suiviIds["sara"] = [s.id];
    console.log(`  ✅ Sara — 1 suivi`);
  }

  // ─── RDV + EXAMENS ────────────────────────────────────────────────────────
  console.log("\n📅 Inserting rendez-vous and examens...");

  async function createRdvWithExamen(params: {
    patientIdx: number;
    suiviKey: string;
    suiviIdx?: number;
    daysAgo: number;
    heure: string;
    statut: "termine" | "planifie" | "confirme";
    type_creneau?: string;
    examen: {
      poids?: string; taille?: string; tension?: string; fc?: number;
      temp?: string; spo2?: string; imc?: string;
      description: string; conclusion: string;
      traitement_prescrit?: string;
      aspect_general?: string; respiratoire?: string; cardiovasculaire?: string;
    };
  }) {
    const pid = patId(params.patientIdx);
    const sid = suiviIds[params.suiviKey]?.[params.suiviIdx ?? 0];
    if (!pid || !sid) return null;

    const p = insertedPatients[params.patientIdx]!;
    const nameParts = `${p.nom} ${p.prenom}`;
    const initials = `${p.nom[0]}${p.prenom[0]}`;
    const dateStr = d(params.daysAgo);

    const [rdv] = await db.insert(rendez_vous).values({
      patient_id: pid,
      suivi_id: sid,
      utilisateur_id: DOCTOR_ID,
      date: dateStr,
      heure: params.heure,
      heure_fin: `${String(parseInt(params.heure.split(":")[0]!) + 1).padStart(2, "0")}:${params.heure.split(":")[1]}`,
      statut: params.statut,
      type_creneau: params.type_creneau ?? "Consultation",
      patient_label: nameParts,
      patient_initials: initials,
      couleur: "#4f86f7",
      important: false,
    }).returning({ id: rendez_vous.id });

    if (!rdv) return null;

    await db.insert(examen_consultation).values({
      rendez_vous_id: rdv.id,
      suivi_id: sid,
      date: dateStr,
      poids: params.examen.poids,
      taille: params.examen.taille,
      tension_arterielle: params.examen.tension,
      frequence_cardiaque: params.examen.fc,
      temperature: params.examen.temp,
      spo2: params.examen.spo2,
      imc: params.examen.imc,
      description_consultation: params.examen.description,
      conclusion: params.examen.conclusion,
      traitement_prescrit: params.examen.traitement_prescrit,
      aspect_general: params.examen.aspect_general,
      examen_respiratoire: params.examen.respiratoire,
      examen_cardiovasculaire: params.examen.cardiovasculaire,
    });

    return rdv.id;
  }

  // Karim — 4 consultations diabète (+ 1 futur)
  const karimRdv1 = await createRdvWithExamen({
    patientIdx: 0, suiviKey: "karim", daysAgo: 300, heure: "09:00", statut: "termine",
    examen: {
      poids: "92", taille: "178", tension: "155/95", fc: 82, temp: "37.0", spo2: "97", imc: "29.1",
      aspect_general: "Patient en léger surpoids, pas de détresse aiguë",
      cardiovasculaire: "Rythme régulier, pas de souffle auscultatoire, pouls périphériques présents",
      description: "Première consultation pour bilan diabète. Glycémie à jeun 1.82 g/L, HbA1c 8.2%. Patient peu observant au traitement. Poids stable. Tension élevée.",
      conclusion: "Diabète type 2 déséquilibré. Renforcement conseils hygiéno-diététiques. Augmentation metformine à 2000mg/j. Ajout amlodipine 5mg pour HTA.",
      traitement_prescrit: "Metformine 1000mg x2/j — Amlodipine 5mg x1/j",
    },
  });

  const karimRdv2 = await createRdvWithExamen({
    patientIdx: 0, suiviKey: "karim", daysAgo: 180, heure: "10:30", statut: "termine",
    examen: {
      poids: "90", taille: "178", tension: "145/88", fc: 78, temp: "36.8", spo2: "98", imc: "28.4",
      cardiovasculaire: "TA améliorée, rythme régulier, pas de signes d'insuffisance cardiaque",
      description: "Consultation de suivi. HbA1c 7.6% en amélioration. Tension partiellement contrôlée. Patient plus observant. Bilan rénal normal. Microalbuminurie légère.",
      conclusion: "Amélioration de l'équilibre glycémique. HTA partiellement contrôlée, augmentation amlodipine à 10mg. Surveillance rénale à 3 mois.",
      traitement_prescrit: "Metformine 1000mg x2/j — Amlodipine 10mg x1/j — Kardégic 75mg x1/j (cardioprotection)",
    },
  });

  const karimRdv3 = await createRdvWithExamen({
    patientIdx: 0, suiviKey: "karim", daysAgo: 90, heure: "11:00", statut: "termine",
    examen: {
      poids: "88", taille: "178", tension: "138/84", fc: 75, temp: "36.9", spo2: "98", imc: "27.8",
      cardiovasculaire: "TA bien contrôlée. Pas d'oedèmes. Souffle non ausculté.",
      description: "Suivi trimestriel. HbA1c 7.1% — objectif presque atteint. Bilan lipidique: LDL 1.45 g/L, introduction statine discutée. Tension bien contrôlée. Perte de 4kg.",
      conclusion: "Bonne évolution. Ajout atorvastatine (Tahor) 20mg pour dyslipidémie. Objectif LDL < 1.0 g/L. Prochain contrôle dans 3 mois.",
      traitement_prescrit: "Metformine 1000mg x2/j — Amlodipine 10mg x1/j — Kardégic 75mg x1/j — Tahor 20mg x1/j le soir",
    },
  });

  const karimRdv4 = await createRdvWithExamen({
    patientIdx: 0, suiviKey: "karim", daysAgo: 7, heure: "09:30", statut: "termine",
    examen: {
      poids: "87", taille: "178", tension: "132/80", fc: 72, temp: "36.8", spo2: "99", imc: "27.5",
      cardiovasculaire: "TA normalisée. Pas de signes de complications cardiovasculaires.",
      description: "Bilan semestriel complet. HbA1c 6.9% — objectif atteint. LDL 0.92 g/L. Fonction rénale stable DFG 75 mL/min. ECG normal. Fond d'oeil sans rétinopathie.",
      conclusion: "Excellent contrôle du diabète et de l'HTA. Poursuite du traitement actuel. Prochain bilan dans 6 mois. Surveillance ophtalmologique annuelle.",
      traitement_prescrit: "Metformine 1000mg x2/j — Amlodipine 10mg x1/j — Kardégic 75mg x1/j — Tahor 40mg x1/j le soir",
    },
  });

  // Karim futur RDV
  await db.insert(rendez_vous).values({
    patient_id: patId(0)!,
    suivi_id: suiviIds["karim"]![0]!,
    utilisateur_id: DOCTOR_ID,
    date: d(-30), // 30 days in the future
    heure: "10:00",
    heure_fin: "11:00",
    statut: "planifie",
    type_creneau: "Bilan de contrôle",
    patient_label: "BENALI Karim",
    patient_initials: "BK",
    couleur: "#4f86f7",
    important: false,
    notes: "Bilan HbA1c + lipidique + fonction rénale",
  });

  // Yasmine — 3 consultations asthme
  await createRdvWithExamen({
    patientIdx: 1, suiviKey: "yasmine", daysAgo: 180, heure: "14:00", statut: "termine",
    examen: {
      poids: "58", taille: "165", tension: "112/70", fc: 88, temp: "37.2", spo2: "94", imc: "21.3",
      respiratoire: "Sibilances diffuses à l'auscultation, expiration prolongée, tirage intercostal léger",
      description: "Exacerbation asthmatique modérée. SpO2 à 94%. Débit de pointe 65% du théorique. Allergies aux acariens confirmées. RAST positif graminées.",
      conclusion: "Exacerbation asthme GINA 3. Renforcement traitement: Séretide 500/50 x2/j. Ventoline à la demande. Éviction des allergènes conseillée.",
      traitement_prescrit: "Séretide 500/50 x2/j — Ventoline 100µg si besoin — Antihistaminique",
    },
  });

  await createRdvWithExamen({
    patientIdx: 1, suiviKey: "yasmine", daysAgo: 90, heure: "15:30", statut: "termine",
    examen: {
      poids: "58", taille: "165", tension: "110/68", fc: 76, temp: "36.9", spo2: "97", imc: "21.3",
      respiratoire: "Murmure vésiculaire symétrique, légers sibilances en fin d'expiration forcée",
      description: "Contrôle post-exacerbation. Bonne réponse au traitement. Débit de pointe 78% du théorique. Moins d'éveils nocturnes. Technique d'inhalation vérifiée et corrigée.",
      conclusion: "Amélioration significative. Maintien Séretide 500/50. Spirométrie à programmer. Consultation en allergologie pour désensibilisation.",
      traitement_prescrit: "Séretide 500/50 x2/j — Ventoline si besoin",
    },
  });

  await createRdvWithExamen({
    patientIdx: 1, suiviKey: "yasmine", daysAgo: 5, heure: "09:00", statut: "termine",
    examen: {
      poids: "59", taille: "165", tension: "115/72", fc: 74, temp: "36.7", spo2: "98", imc: "21.7",
      respiratoire: "Auscultation pulmonaire normale. Pas de sibilances au repos. Murmure vésiculaire bien perçu bilatéralement.",
      description: "Consultation de suivi printemps. Spirométrie VEMS 82%. Symptômes bien contrôlés. Utilisation ventoline 1x/semaine. Début saison pollinique dans 15 jours.",
      conclusion: "Asthme bien contrôlé. Maintien traitement. Antihistaminique systématique à la saison pollinique. Revoir dans 3 mois.",
      traitement_prescrit: "Séretide 500/50 x2/j — Ventoline si besoin — Cétirizine 10mg x1/j (avril-juin)",
    },
  });

  // Nadia — 3 consultations hypothyroïdie
  await createRdvWithExamen({
    patientIdx: 2, suiviKey: "nadia", daysAgo: 150, heure: "11:00", statut: "termine",
    examen: {
      poids: "72", taille: "162", tension: "118/74", fc: 58, temp: "36.4", spo2: "99", imc: "27.4",
      description: "Suivi hypothyroïdie. TSH à 4.2 mUI/L (légèrement élevée). T4L limite basse. Plainte de fatigue persistante, frilosité, constipation. Prise de poids 3kg en 6 mois.",
      conclusion: "Hypothyroïdie insuffisamment traitée. Augmentation lévothyroxine à 100µg. Contrôle TSH dans 6 semaines.",
      traitement_prescrit: "Levothyrox 100µg le matin à jeun",
    },
  });

  await createRdvWithExamen({
    patientIdx: 2, suiviKey: "nadia", daysAgo: 90, heure: "10:00", statut: "termine",
    examen: {
      poids: "70", taille: "162", tension: "120/76", fc: 65, temp: "36.7", spo2: "99", imc: "26.7",
      description: "TSH à 2.1 mUI/L — dans la norme. T4L normale. Amélioration de la fatigue. Perte de 2kg. Constipation toujours présente. Dépistage anti-TPO positif — Hashimoto confirmé.",
      conclusion: "Équilibre thyroïdien satisfaisant. Maintien Levothyrox 100µg. Ajout magnésium pour constipation. Échographie thyroïdienne demandée.",
      traitement_prescrit: "Levothyrox 100µg x1/j — Magnésium 300mg x1/j",
    },
  });

  await createRdvWithExamen({
    patientIdx: 2, suiviKey: "nadia", daysAgo: 14, heure: "09:30", statut: "termine",
    examen: {
      poids: "69", taille: "162", tension: "118/72", fc: 68, temp: "36.8", spo2: "99", imc: "26.3",
      description: "Résultats écho thyroïde: goître hétérogène, aspect compatible avec Hashimoto. TSH 1.8 mUI/L. Asymptomatique. Perte de poids progressive (+3kg total). Patiente satisfaite.",
      conclusion: "Thyroïdite de Hashimoto confirmée échographiquement. Très bonne évolution. Maintien traitement. Surveillance annuelle.",
      traitement_prescrit: "Levothyrox 100µg x1/j",
    },
  });

  // Ahmed — 5 consultations cardio + BPCO
  await createRdvWithExamen({
    patientIdx: 3, suiviKey: "ahmed", daysAgo: 450, heure: "08:30", statut: "termine",
    examen: {
      poids: "78", taille: "170", tension: "148/92", fc: 84, temp: "36.9", spo2: "92", imc: "27.0",
      cardiovasculaire: "Rythme régulier, souffle systolique 2/6 foyer mitral, oedèmes des chevilles++",
      respiratoire: "Ronchi diffus, tirage intercostal discret, MV diminué aux bases",
      description: "Post-hospitalisation angioplastie. Premier suivi en ville. Essoufflement à la marche. TA mal contrôlée. Tabagisme actif malgré conseils répétés.",
      conclusion: "Suivi post-stent à 1 mois. Traitement de fond introduit: double antiagrégation, statine, bêtabloquant, IEC. Arrêt tabac impératif — orientation tabacologie.",
      traitement_prescrit: "Kardégic 75mg — Tahor 40mg — Bisoprolol 5mg — Lisinopril 5mg",
    },
  });

  await createRdvWithExamen({
    patientIdx: 3, suiviKey: "ahmed", daysAgo: 300, heure: "09:00", statut: "termine",
    examen: {
      poids: "76", taille: "170", tension: "138/85", fc: 68, temp: "37.1", spo2: "94", imc: "26.3",
      cardiovasculaire: "TA améliorée, rythme régulier, oedèmes régressés",
      respiratoire: "Sibilances expiratoires bilatérales, toux productive matinale",
      description: "Suivi à 3 mois post-stent. Bonne tolérance traitement cardio. Exacerbation BPCO légère. Expectoration purulente depuis 5 jours. SpO2 94%.",
      conclusion: "Stabilité cardiaque. Exacerbation BPCO traitée: Augmentin 1g x2 7j + renforcement bronchodilatateurs. SpO2 à surveiller.",
      traitement_prescrit: "Kardégic 75mg — Tahor 40mg — Bisoprolol 5mg — Augmentin 1g x2/j 7j — Ventoline 4 bouffées x4/j",
    },
  });

  await createRdvWithExamen({
    patientIdx: 3, suiviKey: "ahmed", daysAgo: 180, heure: "10:00", statut: "termine",
    examen: {
      poids: "75", taille: "170", tension: "135/82", fc: 65, temp: "36.8", spo2: "95", imc: "26.0",
      cardiovasculaire: "Bon contrôle tensionnel, rythme sinusal, pas d'oedèmes",
      respiratoire: "Ronchi persistants, VEMS stable à 65%. Hors exacerbation.",
      description: "Bilan semestriel. Écho cardiaque: FEVG 52% (améliorée). LDL 0.88 g/L — objectif atteint. HbA1c normale. ECG rythme sinusal régulier. Patient refuse toujours d'arrêter le tabac.",
      conclusion: "Bonne évolution cardiaque. Poursuite traitement. Ajout MOPRAL pour gastrite sous aspirine. Orientation pneumologue pour réévaluation BPCO.",
      traitement_prescrit: "Kardégic 75mg — Tahor 40mg — Bisoprolol 5mg — Mopral 20mg x1/j",
    },
  });

  await createRdvWithExamen({
    patientIdx: 3, suiviKey: "ahmed", suiviIdx: 1, daysAgo: 60, heure: "08:00", statut: "termine",
    examen: {
      poids: "74", taille: "170", tension: "132/80", fc: 70, temp: "38.1", spo2: "89", imc: "25.6",
      respiratoire: "Ronchi diffus, sibilances, tirage intercostal, MV très diminué bilatéral",
      cardiovasculaire: "TA stable, tachycardie légère",
      description: "Exacerbation sévère BPCO. Fièvre 38.1°C, SpO2 89% en air ambiant, expectoration jaune-vert abondante. Tabagisme: 3 cigarettes/jour (réduction). Nécessite hospitalisation discutée, refusée par patient.",
      conclusion: "Exacerbation BPCO sévère traitée en ambulatoire renforcé: antibiothérapie large spectre, bronchodilatateurs intensifiés, corticothérapie courte. Réévaluation à 48h.",
      traitement_prescrit: "Augmentin 1g x3/j 10j — Prednisone 40mg x1/j 5j — Ventoline x6/j — SpO2 à surveiller",
    },
  });

  await createRdvWithExamen({
    patientIdx: 3, suiviKey: "ahmed", daysAgo: 2, heure: "11:00", statut: "termine",
    examen: {
      poids: "74", taille: "170", tension: "130/78", fc: 68, temp: "36.9", spo2: "93", imc: "25.6",
      respiratoire: "MV amélioré, ronchi persistants mais diminués, pas de tirage",
      cardiovasculaire: "TA excellente, rythme sinusal",
      description: "Consultation urgente aujourd'hui. Douleur précordiale légère à l'effort depuis ce matin. ECG: modifications ST minimes. Troponine à dosser. SpO2 93% stable.",
      conclusion: "Douleur précordiale à investiguer. ECG de contrôle demandé. Troponine. Si positif: hospitalisation urgente. Maintien traitement. RDV demain matin impératif.",
      traitement_prescrit: "Maintien traitement actuel — Trinitrine sublinguale si douleur",
    },
  });

  // Rami — 2 consultations angine
  await createRdvWithExamen({
    patientIdx: 4, suiviKey: "rami", daysAgo: 8, heure: "16:00", statut: "termine",
    examen: {
      poids: "75", taille: "182", tension: "122/76", fc: 96, temp: "39.5", spo2: "99", imc: "22.7",
      aspect_general: "Patient en bonne forme générale, fébrile, odynophagie intense",
      description: "Angine rouge vive bilatérale avec exsudat. Adénopathies cervicales sensibles. TDR streptocoque positif. Score McIsaac 4. Absence de toux.",
      conclusion: "Angine bactérienne streptococcique confirmée (TDR+). Antibiothérapie par amoxicilline/acide clavulanique 7 jours. Repos, antalgiques. Réévaluation si non amélioration à J3.",
      traitement_prescrit: "Augmentin 1g x2/j 7j — Doliprane 1g x3/j si fièvre/douleur",
    },
  });

  await createRdvWithExamen({
    patientIdx: 4, suiviKey: "rami", daysAgo: 1, heure: "17:00", statut: "termine",
    examen: {
      poids: "75", taille: "182", tension: "120/74", fc: 78, temp: "37.2", spo2: "100", imc: "22.7",
      aspect_general: "Apyrétique, douleurs gorge nettement améliorées, bien général",
      description: "Contrôle J7 angine streptococcique. Apyrétique. Odynophagie disparue. Amygdales de taille normale, pas d'exsudat. Traitement bien toléré.",
      conclusion: "Guérison complète. Pas de complication. Arrêt antibiothérapie demain (fin J7). Pas de suivi nécessaire sauf rechute.",
      traitement_prescrit: "Fin Augmentin demain — Doliprane si besoin",
    },
  });

  // Sara — 3 consultations migraines
  await createRdvWithExamen({
    patientIdx: 5, suiviKey: "sara", daysAgo: 55, heure: "14:30", statut: "termine",
    examen: {
      poids: "52", taille: "162", tension: "108/65", fc: 88, temp: "36.8", spo2: "99", imc: "19.8",
      description: "Migraines avec aura 3x/mois depuis 2 ans. Aura visuelle (scotome scintillant). Céphalées pulsatiles 8/10, durée 24-48h. Photophobie, phonophobie, nausées. Ibuprofène insuffisant. Stress scolaire important, bac dans 2 ans.",
      conclusion: "Migraine avec aura confirmée. Introduction traitement de fond: propranolol 40mg x2/j. Traitement de crise: triptan. Consultation psychologue pour anxiety.",
      traitement_prescrit: "Propranolol 40mg x2/j — Sumatriptan 50mg à la crise — Magnésium 300mg x1/j",
    },
  });

  await createRdvWithExamen({
    patientIdx: 5, suiviKey: "sara", daysAgo: 25, heure: "15:00", statut: "termine",
    examen: {
      poids: "52", taille: "162", tension: "105/62", fc: 72, temp: "36.7", spo2: "100", imc: "19.8",
      description: "Suivi migraine J30 sous propranolol. Réduction migraines à 1x/mois. Trimatriptan efficace sur les crises. Anxiété toujours présente, insomnie. Commence suivi psychologique.",
      conclusion: "Bonne réponse au traitement de fond. Maintien propranolol. Insomnie: ajout mélatonine. Anxiété suivie en psychologie. Contrôle dans 2 mois.",
      traitement_prescrit: "Propranolol 40mg x2/j — Sumatriptan 50mg si crise — Mélatonine 1mg au coucher",
    },
  });

  await db.insert(rendez_vous).values({
    patient_id: patId(5)!,
    suivi_id: suiviIds["sara"]![0]!,
    utilisateur_id: DOCTOR_ID,
    date: d(-14),
    heure: "14:00",
    heure_fin: "15:00",
    statut: "planifie",
    type_creneau: "Consultation",
    patient_label: "DJEBBAR Sara",
    patient_initials: "DS",
    couleur: "#f7a84f",
    important: true,
    notes: "Bilan 2 mois — évaluation propranolol + état anxiété",
  });

  console.log("  ✅ All RDVs and examens inserted");

  // ─── TRAITEMENTS ACTIFS ───────────────────────────────────────────────────
  console.log("\n💊 Inserting historique_traitements...");

  type TraitementInsert = {
    patient_id: string;
    medicament_externe_id: string;
    nom_medicament: string;
    dosage: string;
    posologie: string;
    est_actif: boolean;
    date_prescription: string;
    prescrit_par_utilisateur: string;
    source_type: "manuel";
  };

  const traitements: TraitementInsert[] = [
    // Karim — 4 traitements actifs
    { patient_id: patId(0)!, medicament_externe_id: MED.GLUCOPHAGE, nom_medicament: "GLUCOPHAGE", dosage: "1000mg", posologie: "1 comprimé matin et soir pendant les repas", est_actif: true, date_prescription: d(90), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },
    { patient_id: patId(0)!, medicament_externe_id: MED.AMLODIPINE_BIOGARAN, nom_medicament: "AMLODIPINE BIOGARAN", dosage: "10mg", posologie: "1 comprimé le matin", est_actif: true, date_prescription: d(180), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },
    { patient_id: patId(0)!, medicament_externe_id: MED.KARDEGIC, nom_medicament: "KARDEGIC", dosage: "75mg", posologie: "1 sachet par jour pendant le repas", est_actif: true, date_prescription: d(180), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },
    { patient_id: patId(0)!, medicament_externe_id: MED.TAHOR, nom_medicament: "TAHOR", dosage: "40mg", posologie: "1 comprimé le soir", est_actif: true, date_prescription: d(7), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },
    // Karim — ancien traitement (non actif)
    { patient_id: patId(0)!, medicament_externe_id: MED.MOPRAL, nom_medicament: "MOPRAL", dosage: "20mg", posologie: "1 gélule le matin à jeun", est_actif: false, date_prescription: d(300), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },

    // Yasmine — 2 traitements actifs
    { patient_id: patId(1)!, medicament_externe_id: MED.SERETIDE, nom_medicament: "SERETIDE", dosage: "500/50µg", posologie: "1 inhalation matin et soir — rincer la bouche après", est_actif: true, date_prescription: d(90), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },
    { patient_id: patId(1)!, medicament_externe_id: MED.VENTOLINE, nom_medicament: "VENTOLINE", dosage: "100µg", posologie: "2 bouffées si dyspnée (max 8 bouffées/j)", est_actif: true, date_prescription: d(200), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },

    // Nadia — 1 traitement actif
    { patient_id: patId(2)!, medicament_externe_id: MED.LEVOTHYROX, nom_medicament: "LEVOTHYROX", dosage: "100µg", posologie: "1 comprimé le matin à jeun 30 min avant le repas", est_actif: true, date_prescription: d(90), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },
    { patient_id: patId(2)!, medicament_externe_id: MED.MOPRAL, nom_medicament: "MOPRAL", dosage: "20mg", posologie: "1 gélule le soir", est_actif: true, date_prescription: d(90), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },

    // Ahmed — 4 traitements actifs
    { patient_id: patId(3)!, medicament_externe_id: MED.KARDEGIC, nom_medicament: "KARDEGIC", dosage: "75mg", posologie: "1 sachet pendant le repas", est_actif: true, date_prescription: d(450), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },
    { patient_id: patId(3)!, medicament_externe_id: MED.TAHOR, nom_medicament: "TAHOR", dosage: "40mg", posologie: "1 comprimé le soir", est_actif: true, date_prescription: d(300), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },
    { patient_id: patId(3)!, medicament_externe_id: MED.MOPRAL, nom_medicament: "MOPRAL", dosage: "20mg", posologie: "1 gélule le matin à jeun", est_actif: true, date_prescription: d(180), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },
    { patient_id: patId(3)!, medicament_externe_id: MED.VENTOLINE, nom_medicament: "VENTOLINE", dosage: "100µg", posologie: "2-4 bouffées x3/j", est_actif: true, date_prescription: d(60), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },
    // Ahmed — traitements récents antibiothérapie (terminés)
    { patient_id: patId(3)!, medicament_externe_id: MED.AUGMENTIN, nom_medicament: "AUGMENTIN", dosage: "1g", posologie: "1 comprimé x3/j pendant 10 jours", est_actif: false, date_prescription: d(60), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },
    { patient_id: patId(3)!, medicament_externe_id: MED.DOLIPRANE, nom_medicament: "DOLIPRANE", dosage: "1000mg", posologie: "1 comprimé x3/j si fièvre ou douleur", est_actif: false, date_prescription: d(60), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },

    // Rami — antibiothérapie terminée
    { patient_id: patId(4)!, medicament_externe_id: MED.AUGMENTIN, nom_medicament: "AUGMENTIN", dosage: "1g", posologie: "1 comprimé matin et soir pendant 7 jours", est_actif: false, date_prescription: d(8), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },
    { patient_id: patId(4)!, medicament_externe_id: MED.DOLIPRANE, nom_medicament: "DOLIPRANE", dosage: "1000mg", posologie: "1 comprimé x3/j si douleur ou fièvre", est_actif: false, date_prescription: d(8), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },

    // Sara — traitements actifs
    { patient_id: patId(5)!, medicament_externe_id: MED.DEPAKOTE, nom_medicament: "PROPRANOLOL (générique)", dosage: "40mg", posologie: "1 comprimé matin et soir — ne pas arrêter brutalement", est_actif: true, date_prescription: d(55), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },
    { patient_id: patId(5)!, medicament_externe_id: MED.DOLIPRANE, nom_medicament: "DOLIPRANE", dosage: "500mg", posologie: "1-2 comprimés toutes les 6h si céphalées (max 4g/j)", est_actif: true, date_prescription: d(55), prescrit_par_utilisateur: DOCTOR_ID, source_type: "manuel" },
  ];

  // Filter out entries for patients that weren't inserted
  const validTraitements = traitements.filter((t) => t.patient_id !== undefined);
  await db.insert(historique_traitements).values(validTraitements);
  console.log(`  ✅ ${validTraitements.length} traitements inserted`);

  // ─── AGENDA RDVs (today + this week) ─────────────────────────────────────
  console.log("\n📆 Inserting agenda RDVs for this week...");
  const weekRdvs = [
    { patientIdx: 1, label: "RAHMANI Yasmine", initials: "RY", date: d(0), heure: "08:30", type: "Consultation", notes: "Suivi asthme saisonnier" },
    { patientIdx: 3, label: "BOUDERBALA Ahmed", initials: "BA", date: d(0), heure: "09:30", type: "Urgence", notes: "Douleur précordiale à investiguer — ECG + troponine" },
    { patientIdx: 2, label: "MEZIANE Nadia", initials: "MN", date: d(-1), heure: "10:00", type: "Bilan de contrôle", notes: "TSH + bilan thyroïde" },
    { patientIdx: 0, label: "BENALI Karim", initials: "BK", date: d(-2), heure: "11:00", type: "Consultation", notes: "Contrôle HbA1c post-titration" },
    { patientIdx: 4, label: "KHELIFI Rami", initials: "KR", date: d(-3), heure: "17:00", type: "Consultation", notes: "Réévaluation post-antibiothérapie" },
  ];

  for (const rdv of weekRdvs) {
    const pid = patId(rdv.patientIdx);
    const sid = suiviIds[["karim", "yasmine", "nadia", "ahmed", "rami", "sara"][rdv.patientIdx]!]?.[0];
    if (!pid || !sid) continue;

    await db.insert(rendez_vous).values({
      patient_id: pid,
      suivi_id: sid,
      utilisateur_id: DOCTOR_ID,
      date: rdv.date,
      heure: rdv.heure,
      heure_fin: `${String(parseInt(rdv.heure.split(":")[0]!) + 1).padStart(2, "0")}:${rdv.heure.split(":")[1]}`,
      statut: "confirme",
      type_creneau: rdv.type,
      patient_label: rdv.label,
      patient_initials: rdv.initials,
      couleur: rdv.type === "Urgence" ? "#f74f4f" : "#4f86f7",
      important: rdv.type === "Urgence",
      notes: rdv.notes,
    });
  }

  console.log(`  ✅ ${weekRdvs.length} agenda RDVs inserted`);

  console.log("\n✅ Demo seed complete!");
  console.log("─────────────────────────────────────────");
  console.log("Patients: BENALI Karim (58, diabète+HTA), RAHMANI Yasmine (32, asthme),");
  console.log("          MEZIANE Nadia (45, hypothyroïdie), BOUDERBALA Ahmed (72, cardio+BPCO),");
  console.log("          KHELIFI Rami (24, angine), DJEBBAR Sara (16, migraines)");
  console.log("─────────────────────────────────────────");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
