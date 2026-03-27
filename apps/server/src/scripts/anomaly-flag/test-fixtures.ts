import { db } from "@doctor.com/db";
import {
  antecedents,
  antecedents_familiaux,
  antecedents_personnels,
  historique_traitements,
  patients,
  patients_femmes,
  utilisateurs,
} from "@doctor.com/db/schema";
import {
  contre_indications,
  medicaments,
  medicationsDb,
  precautions,
} from "@doctor.com/medications-db";
import { and, eq, inArray, sql } from "drizzle-orm";

export interface MedicationCandidate {
  id: number;
  nom_medicament: string;
}

export interface InteractionPair {
  medicationA: MedicationCandidate;
  medicationB: MedicationCandidate;
  interactionText: string;
}

export interface MedicationCandidates {
  pregnancy: MedicationCandidate | null;
  breastfeeding: MedicationCandidate | null;
  childNoPediatricDosage: MedicationCandidate | null;
  contreIndication:
    | (MedicationCandidate & {
        triggerText: string;
      })
    | null;
  precaution:
    | (MedicationCandidate & {
        triggerText: string;
      })
    | null;
  interactionPair: InteractionPair | null;
}

export interface AnomalyTestFixtures {
  utilisateur: {
    id: string;
    email: string;
  };
  patients: {
    femaleRisk: {
      id: string;
      matricule: string;
    };
    child: {
      id: string;
      matricule: string;
    };
    chronic: {
      id: string;
      matricule: string;
    };
    semanticNegative: {
      id: string;
      matricule: string;
    };
  };
  medications: MedicationCandidates;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function keywordMatch(source: string, target: string): boolean {
  const normalizedSource = normalizeText(source);
  const normalizedTarget = normalizeText(target);
  const words = normalizedSource.split(/\s+/).filter((w) => w.length > 3);
  return words.some((word) => normalizedTarget.includes(word));
}

function chooseSemanticNegativeHistory(triggerTexts: string[]): string {
  const normalizedGuards = triggerTexts.map(normalizeText);

  for (let i = 0; i < 200; i++) {
    const candidate = `zzqxvbnm${i} qjrtplk${i} nvxkprtd${i}`;
    const overlaps = normalizedGuards.some((text) => keywordMatch(text, candidate));
    if (!overlaps) return candidate;
  }

  return "zzqxvbnm_safe qjrtplk_safe nvxkprtd_safe";
}

async function getMedicationRiskTexts(medicationId: number): Promise<string[]> {
  const [ciRows, precRows] = await Promise.all([
    medicationsDb
      .select({ description: contre_indications.description })
      .from(contre_indications)
      .where(eq(contre_indications.medicament_id, medicationId)),
    medicationsDb
      .select({ description: precautions.description })
      .from(precautions)
      .where(eq(precautions.medicament_id, medicationId)),
  ]);

  return [...ciRows, ...precRows]
    .map((row) => row.description)
    .filter((value): value is string => Boolean(value && value.trim().length > 0));
}

function containsWarningKeywords(text: string | null): boolean {
  if (!text) return false;
  const normalized = normalizeText(text);
  const keywords = [
    "contre-indique",
    "contre indique",
    "deconseille",
    "interdit",
    "risque",
    "danger",
    "eviter",
    "ne pas utiliser",
    "ne pas administrer",
    "toxique",
    "nocif",
  ];
  return keywords.some((kw) => normalized.includes(kw));
}

function containsPregnancyKeywords(text: string): boolean {
  const normalized = normalizeText(text);
  const keywords = ["grossesse", "enceinte", "femme enceinte", "gestation"];
  return keywords.some((kw) => normalized.includes(kw));
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function resolveUtilisateur(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const [byEmail] = await db
    .select({ id: utilisateurs.id, email: utilisateurs.email })
    .from(utilisateurs)
    .where(eq(utilisateurs.email, normalizedEmail))
    .limit(1);

  if (byEmail) {
    return byEmail;
  }

  const [fallback] = await db
    .select({ id: utilisateurs.id, email: utilisateurs.email })
    .from(utilisateurs)
    .limit(1);

  if (!fallback) {
    throw new Error(
      "Aucun utilisateur trouve. Executez d'abord `bun run db:seed`.",
    );
  }

  return fallback;
}

async function upsertPatient(params: {
  matricule: string;
  nom: string;
  prenom: string;
  date_naissance: string;
  sexe: "masculin" | "feminin";
  cree_par_utilisateur: string;
  email?: string;
}): Promise<{ id: string; matricule: string }> {
  const [existing] = await db
    .select({ id: patients.id, matricule: patients.matricule })
    .from(patients)
    .where(eq(patients.matricule, params.matricule))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(patients)
      .set({
        nom: params.nom,
        prenom: params.prenom,
        date_naissance: params.date_naissance,
        sexe: params.sexe,
        email: params.email ?? null,
        cree_par_utilisateur: params.cree_par_utilisateur,
      })
      .where(eq(patients.id, existing.id))
      .returning({ id: patients.id, matricule: patients.matricule });

    return updated!;
  }

  const [inserted] = await db
    .insert(patients)
    .values({
      nom: params.nom,
      prenom: params.prenom,
      matricule: params.matricule,
      date_naissance: params.date_naissance,
      sexe: params.sexe,
      email: params.email ?? null,
      cree_par_utilisateur: params.cree_par_utilisateur,
    })
    .returning({ id: patients.id, matricule: patients.matricule });

  return inserted!;
}

async function upsertFemaleProfile(patientId: string): Promise<void> {
  const [existing] = await db
    .select({ id: patients_femmes.id })
    .from(patients_femmes)
    .where(eq(patients_femmes.patient_id, patientId))
    .limit(1);

  if (existing) {
    await db
      .update(patients_femmes)
      .set({
        menopause: false,
        contraception: null,
        nb_grossesses: 2,
        nb_cesariennes: 1,
        regularite_cycles: "regulier",
      })
      .where(eq(patients_femmes.id, existing.id));
    return;
  }

  await db.insert(patients_femmes).values({
    patient_id: patientId,
    menopause: false,
    contraception: null,
    nb_grossesses: 2,
    nb_cesariennes: 1,
    regularite_cycles: "regulier",
    menarche: 13,
  });
}

async function clearAntecedents(patientId: string): Promise<void> {
  const antRows = await db
    .select({ id: antecedents.id })
    .from(antecedents)
    .where(eq(antecedents.patient_id, patientId));

  if (antRows.length === 0) return;

  const antIds = antRows.map((row) => row.id);
  await db
    .delete(antecedents_personnels)
    .where(inArray(antecedents_personnels.antecedent_id, antIds));
  await db
    .delete(antecedents_familiaux)
    .where(inArray(antecedents_familiaux.antecedent_id, antIds));
  await db.delete(antecedents).where(eq(antecedents.patient_id, patientId));
}

async function seedChronicPatientAntecedents(params: {
  patientId: string;
  contreIndicationText: string;
  precautionText: string;
}): Promise<void> {
  await clearAntecedents(params.patientId);

  const [ciAntecedent] = await db
    .insert(antecedents)
    .values({
      patient_id: params.patientId,
      type: "personnel",
      description: params.contreIndicationText,
    })
    .returning({ id: antecedents.id });

  await db.insert(antecedents_personnels).values({
    antecedent_id: ciAntecedent!.id,
    type: "pathologie chronique",
    details: params.contreIndicationText,
    est_actif: true,
  });

  const [precAntecedent] = await db
    .insert(antecedents)
    .values({
      patient_id: params.patientId,
      type: "personnel",
      description: params.precautionText,
    })
    .returning({ id: antecedents.id });

  await db.insert(antecedents_personnels).values({
    antecedent_id: precAntecedent!.id,
    type: "terrain a risque",
    details: params.precautionText,
    est_actif: true,
  });
}

async function seedActiveTreatment(params: {
  patientId: string;
  utilisateurId: string;
  medication: MedicationCandidate;
}): Promise<void> {
  await db
    .update(historique_traitements)
    .set({ est_actif: false })
    .where(eq(historique_traitements.patient_id, params.patientId));

  await db.insert(historique_traitements).values({
    patient_id: params.patientId,
    medicament_externe_id: String(params.medication.id),
    nom_medicament: params.medication.nom_medicament,
    dosage: "1 unite",
    posologie: "1 prise par jour",
    est_actif: true,
    date_prescription: toDateOnly(new Date()),
    prescrit_par_utilisateur: params.utilisateurId,
    source_type: "manuel",
  });
}

async function findPregnancyMedication(): Promise<MedicationCandidate | null> {
  const rows = await medicationsDb
    .select({
      id: medicaments.id,
      nom_medicament: medicaments.nom_medicament,
      grossesse: medicaments.grossesse,
    })
    .from(medicaments)
    .where(sql`${medicaments.grossesse} is not null and ${medicaments.grossesse} <> ''`)
    .limit(3000);

  const match = rows.find((row) => containsWarningKeywords(row.grossesse));
  return match
    ? { id: match.id, nom_medicament: match.nom_medicament }
    : null;
}

async function findBreastfeedingMedication(): Promise<MedicationCandidate | null> {
  const rows = await medicationsDb
    .select({
      id: medicaments.id,
      nom_medicament: medicaments.nom_medicament,
      allaitement: medicaments.allaitement,
    })
    .from(medicaments)
    .where(sql`${medicaments.allaitement} is not null and ${medicaments.allaitement} <> ''`)
    .limit(3000);

  const match = rows.find((row) => containsWarningKeywords(row.allaitement));
  return match
    ? { id: match.id, nom_medicament: match.nom_medicament }
    : null;
}

async function findChildNoPediatricDosageMedication(): Promise<MedicationCandidate | null> {
  const [row] = await medicationsDb
    .select({
      id: medicaments.id,
      nom_medicament: medicaments.nom_medicament,
    })
    .from(medicaments)
    .where(
      sql`(${medicaments.posologie_enfant} is null or btrim(${medicaments.posologie_enfant}) = '') and ${medicaments.posologie_adulte} is not null`,
    )
    .limit(1);

  return row ? { id: row.id, nom_medicament: row.nom_medicament } : null;
}

async function findContreIndicationCandidate(): Promise<
  | (MedicationCandidate & {
      triggerText: string;
    })
  | null
> {
  const rows = await medicationsDb
    .select({
      medicament_id: contre_indications.medicament_id,
      nom_medicament: medicaments.nom_medicament,
      description: contre_indications.description,
    })
    .from(contre_indications)
    .innerJoin(
      medicaments,
      eq(medicaments.id, contre_indications.medicament_id),
    )
    .limit(5000);

  const match = rows.find((row) => {
    if (!row.description || row.description.trim().length < 15) return false;
    if (containsPregnancyKeywords(row.description)) return false;
    return true;
  });

  if (!match) return null;
  return {
    id: match.medicament_id,
    nom_medicament: match.nom_medicament,
    triggerText: match.description,
  };
}

async function findPrecautionCandidate(): Promise<
  | (MedicationCandidate & {
      triggerText: string;
    })
  | null
> {
  const rows = await medicationsDb
    .select({
      medicament_id: precautions.medicament_id,
      nom_medicament: medicaments.nom_medicament,
      description: precautions.description,
    })
    .from(precautions)
    .innerJoin(medicaments, eq(medicaments.id, precautions.medicament_id))
    .limit(5000);

  const match = rows.find(
    (row) => row.description && row.description.trim().length >= 15,
  );

  if (!match) return null;
  return {
    id: match.medicament_id,
    nom_medicament: match.nom_medicament,
    triggerText: match.description,
  };
}

async function findInteractionPair(): Promise<InteractionPair | null> {
  const result = await medicationsDb.execute(sql<{
    id_a: number;
    name_a: string;
    id_b: number;
    name_b: string;
    interaction_text: string;
  }>`
    select
      ma.id as id_a,
      ma.nom_medicament as name_a,
      mb.id as id_b,
      mb.nom_medicament as name_b,
      i.medicament_interaction as interaction_text
    from interactions i
    join medicaments ma on ma.id = i.medicament_id
    join medicaments mb
      on mb.id <> ma.id
     and lower(i.medicament_interaction) like '%' || lower(mb.nom_medicament) || '%'
    limit 20
  `);

  const rows = result.rows as {
    id_a: number;
    name_a: string;
    id_b: number;
    name_b: string;
    interaction_text: string;
  }[];

  const match = rows.find(
    (row) =>
      row.name_a.trim().length > 2 &&
      row.name_b.trim().length > 2 &&
      row.interaction_text.trim().length > 5,
  );

  if (!match) return null;
  return {
    medicationA: { id: match.id_a, nom_medicament: match.name_a },
    medicationB: { id: match.id_b, nom_medicament: match.name_b },
    interactionText: match.interaction_text,
  };
}

export async function resolveMedicationCandidates(): Promise<MedicationCandidates> {
  const [pregnancy, breastfeeding, childNoPediatricDosage, contreIndication, precaution, interactionPair] =
    await Promise.all([
      findPregnancyMedication(),
      findBreastfeedingMedication(),
      findChildNoPediatricDosageMedication(),
      findContreIndicationCandidate(),
      findPrecautionCandidate(),
      findInteractionPair(),
    ]);

  return {
    pregnancy,
    breastfeeding,
    childNoPediatricDosage,
    contreIndication,
    precaution,
    interactionPair,
  };
}

export async function prepareAnomalyTestFixtures(options?: {
  userEmail?: string;
}): Promise<AnomalyTestFixtures> {
  const utilisateur = await resolveUtilisateur(
    options?.userEmail ?? "tbib@doctorcom.com",
  );
  const medications = await resolveMedicationCandidates();

  const femaleRisk = await upsertPatient({
    matricule: "TEST-ANOM-F-001",
    nom: "Test",
    prenom: "AnomalyFemale",
    date_naissance: "1994-04-10",
    sexe: "feminin",
    cree_par_utilisateur: utilisateur.id,
    email: "test.anomaly.female@doctor.local",
  });
  await upsertFemaleProfile(femaleRisk.id);

  const childBirthDate = toDateOnly(addYears(new Date(), -10));
  const child = await upsertPatient({
    matricule: "TEST-ANOM-C-001",
    nom: "Test",
    prenom: "AnomalyChild",
    date_naissance: childBirthDate,
    sexe: "masculin",
    cree_par_utilisateur: utilisateur.id,
    email: "test.anomaly.child@doctor.local",
  });

  const chronic = await upsertPatient({
    matricule: "TEST-ANOM-H-001",
    nom: "Test",
    prenom: "AnomalyChronic",
    date_naissance: "1981-02-20",
    sexe: "masculin",
    cree_par_utilisateur: utilisateur.id,
    email: "test.anomaly.chronic@doctor.local",
  });

  const semanticNegative = await upsertPatient({
    matricule: "TEST-ANOM-N-001",
    nom: "Test",
    prenom: "AnomalySemanticNegative",
    date_naissance: "1988-06-15",
    sexe: "masculin",
    cree_par_utilisateur: utilisateur.id,
    email: "test.anomaly.semantic-negative@doctor.local",
  });

  if (medications.contreIndication && medications.precaution) {
    await seedChronicPatientAntecedents({
      patientId: chronic.id,
      contreIndicationText: medications.contreIndication.triggerText,
      precautionText: medications.precaution.triggerText,
    });
  }

  if (medications.interactionPair) {
    await seedActiveTreatment({
      patientId: chronic.id,
      utilisateurId: utilisateur.id,
      medication: medications.interactionPair.medicationB,
    });
  }

  if (
    medications.interactionPair &&
    medications.precaution &&
    medications.contreIndication
  ) {
    await db
      .update(historique_traitements)
      .set({ est_actif: false })
      .where(
        and(
          eq(historique_traitements.patient_id, chronic.id),
          eq(
            historique_traitements.medicament_externe_id,
            String(medications.interactionPair.medicationA.id),
          ),
        ),
      );
  }

  await clearAntecedents(semanticNegative.id);

  const semanticTriggerTexts: string[] = [
    medications.contreIndication?.triggerText,
    medications.precaution?.triggerText,
  ].filter((v): v is string => Boolean(v && v.trim().length > 0));

  if (medications.contreIndication) {
    semanticTriggerTexts.push(
      ...(await getMedicationRiskTexts(medications.contreIndication.id)),
    );
  }

  if (
    medications.precaution &&
    medications.precaution.id !== medications.contreIndication?.id
  ) {
    semanticTriggerTexts.push(
      ...(await getMedicationRiskTexts(medications.precaution.id)),
    );
  }

  const semanticNegativeText = chooseSemanticNegativeHistory(semanticTriggerTexts);

  const [semanticAntecedent] = await db
    .insert(antecedents)
    .values({
      patient_id: semanticNegative.id,
      type: "personnel",
      description: semanticNegativeText,
    })
    .returning({ id: antecedents.id });

  await db.insert(antecedents_personnels).values({
    antecedent_id: semanticAntecedent!.id,
    type: "antecedent neutre",
    details: semanticNegativeText,
    est_actif: false,
  });

  await db
    .update(historique_traitements)
    .set({ est_actif: false })
    .where(eq(historique_traitements.patient_id, semanticNegative.id));

  return {
    utilisateur,
    patients: {
      femaleRisk,
      child,
      chronic,
      semanticNegative,
    },
    medications,
  };
}
