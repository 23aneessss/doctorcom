import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

import { db } from "@doctor.com/db";
import { account, user } from "@doctor.com/db/schema/auth";
import {
  ordonnance,
  ordonnance_medicaments,
  patients,
  rendez_vous,
  suivi,
  utilisateurs,
} from "@doctor.com/db/schema";

const UTILISATEUR_ID = "550e8400-e29b-41d4-a716-446655440000";
const LOGIN_EMAIL = "tbib@doctorcom.com";
const LOGIN_PASSWORD = "doctor123!";

const patientRows = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    nom: "Saidi",
    prenom: "Nadia",
    matricule: "SN-2026-001",
    initials: "SN",
    date_naissance: "1995-03-12",
    sexe: "feminin",
    telephone: "0556677889",
    email: "nadia.saidi@mail.dz",
    groupe_sanguin: "A+",
    profession: "Enseignante",
    dateOffset: 0,
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    nom: "Amara",
    prenom: "Walid",
    matricule: "AW-2026-002",
    initials: "AW",
    date_naissance: "1992-06-15",
    sexe: "masculin",
    telephone: "0551234567",
    email: "walid.amara@mail.dz",
    groupe_sanguin: "O+",
    profession: "Médecin généraliste",
    dateOffset: -2,
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    nom: "Belkacem",
    prenom: "Fatima",
    matricule: "BF-2026-003",
    initials: "BF",
    date_naissance: "1990-08-21",
    sexe: "feminin",
    telephone: "0698765432",
    email: "f.belkacem@mail.dz",
    groupe_sanguin: "AB+",
    profession: "Architecte",
    dateOffset: -5,
  },
  {
    id: "11111111-1111-4111-8111-111111111104",
    nom: "Boudiaf",
    prenom: "Mohamed",
    matricule: "BM-2026-004",
    initials: "BM",
    date_naissance: "1984-11-04",
    sexe: "masculin",
    telephone: "0661234567",
    email: "m.boudiaf@mail.dz",
    groupe_sanguin: "A+",
    profession: "Commerçant",
    dateOffset: -9,
  },
  {
    id: "11111111-1111-4111-8111-111111111105",
    nom: "Hamidi",
    prenom: "Rachid",
    matricule: "HR-2026-005",
    initials: "HR",
    date_naissance: "1998-01-17",
    sexe: "masculin",
    telephone: "0550456789",
    email: "rachid.hamidi@mail.dz",
    groupe_sanguin: "B+",
    profession: "Étudiant",
    dateOffset: -13,
  },
  {
    id: "11111111-1111-4111-8111-111111111106",
    nom: "Khelifi",
    prenom: "Amina",
    matricule: "KA-2026-006",
    initials: "KA",
    date_naissance: "1964-04-09",
    sexe: "feminin",
    telephone: "0555678901",
    email: "a.khelifi@mail.dz",
    groupe_sanguin: "O-",
    profession: "Retraitée",
    dateOffset: -17,
  },
  {
    id: "11111111-1111-4111-8111-111111111107",
    nom: "Zeroual",
    prenom: "Youcef",
    matricule: "ZY-2026-007",
    initials: "ZY",
    date_naissance: "1972-12-02",
    sexe: "masculin",
    telephone: "0770987654",
    email: "y.zeroual@mail.dz",
    groupe_sanguin: "O+",
    profession: "Chauffeur",
    dateOffset: -21,
  },
] as const;

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

async function ensureUser() {
  const hashedPassword = await hashPassword(LOGIN_PASSWORD);
  const [existingAuthUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, LOGIN_EMAIL))
    .limit(1);
  const [existingUtilisateur] = await db
    .select({ id: utilisateurs.id })
    .from(utilisateurs)
    .where(eq(utilisateurs.email, LOGIN_EMAIL))
    .limit(1);
  const utilisateurId = existingUtilisateur?.id ?? existingAuthUser?.id ?? UTILISATEUR_ID;

  await db
    .insert(user)
    .values({
      id: existingAuthUser?.id ?? utilisateurId,
      name: "Dr. Karim Benali",
      email: LOGIN_EMAIL,
      emailVerified: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    })
    .onConflictDoUpdate({
      target: user.id,
      set: {
        name: "Dr. Karim Benali",
        email: LOGIN_EMAIL,
        emailVerified: true,
        updatedAt: new Date(),
      },
    });

  await db
    .insert(account)
    .values({
      id: "account-tbib-dashboard",
      accountId: LOGIN_EMAIL,
      providerId: "credential",
      userId: existingAuthUser?.id ?? utilisateurId,
      password: hashedPassword,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    })
    .onConflictDoUpdate({
      target: account.id,
      set: {
        accountId: LOGIN_EMAIL,
        providerId: "credential",
        userId: existingAuthUser?.id ?? utilisateurId,
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

  await db
    .insert(utilisateurs)
    .values({
      id: utilisateurId,
      nom: "Benali",
      prenom: "Karim",
      email: LOGIN_EMAIL,
      adresse: "12 Rue Didouche Mourad, Alger Centre",
      telephone: "0561234567",
      mot_de_passe_hash: "not-used",
      date_creation: "2024-01-01",
      role: "medecin",
    })
    .onConflictDoUpdate({
      target: utilisateurs.email,
      set: {
        nom: "Benali",
        prenom: "Karim",
        email: LOGIN_EMAIL,
        adresse: "12 Rue Didouche Mourad, Alger Centre",
        telephone: "0561234567",
        role: "medecin",
      },
    });

  return utilisateurId;
}

async function seedDashboard() {
  console.log("Seeding dashboard demo data...");

  const utilisateurId = await ensureUser();

  for (const patient of patientRows) {
    await db
      .insert(patients)
      .values({
        id: patient.id,
        nom: patient.nom,
        prenom: patient.prenom,
        matricule: patient.matricule,
        date_naissance: patient.date_naissance,
        sexe: patient.sexe,
        telephone: patient.telephone,
        email: patient.email,
        groupe_sanguin: patient.groupe_sanguin,
        nationalite: "Algérienne",
        adresse: "Alger Centre",
        profession: patient.profession,
        date_admission: addDays(patient.dateOffset),
        cree_par_utilisateur: utilisateurId,
      })
      .onConflictDoUpdate({
        target: patients.id,
        set: {
          nom: patient.nom,
          prenom: patient.prenom,
          matricule: patient.matricule,
          telephone: patient.telephone,
          email: patient.email,
          date_admission: addDays(patient.dateOffset),
          cree_par_utilisateur: utilisateurId,
        },
      });
  }

  const suiviRows = patientRows.map((patient, index) => ({
    id: `22222222-2222-4222-8222-22222222210${index + 1}`,
    patient_id: patient.id,
    motif:
      index % 3 === 0
        ? "Fièvre légère et congestion nasale"
        : index % 3 === 1
          ? "Suivi douleurs articulaires"
          : "Contrôle tensionnel",
    hypothese_diagnostic:
      index % 3 === 0
        ? "Rhinopharyngite virale probable"
        : index % 3 === 1
          ? "Syndrome inflammatoire modéré"
          : "Hypertension artérielle surveillée",
    historique:
      "Dossier de démonstration enrichi pour visualiser les indicateurs du tableau de bord.",
    date_ouverture: addDays(-12 + index),
    est_actif: index < 5,
  }));

  for (const row of suiviRows) {
    await db
      .insert(suivi)
      .values({
        ...row,
        utilisateur_id: utilisateurId,
        symptoms: ["fatigue", "douleur", "suivi"],
      })
      .onConflictDoUpdate({
        target: suivi.id,
        set: {
          motif: row.motif,
          hypothese_diagnostic: row.hypothese_diagnostic,
          historique: row.historique,
          date_ouverture: row.date_ouverture,
          est_actif: row.est_actif,
        },
      });
  }

  const appointmentRows = [
    [0, "09:00", "confirme", "Consultation", true],
    [0, "10:30", "planifie", "Suivi", false],
    [0, "14:00", "confirme", "Controle", true],
    [0, "16:00", "annule", "Routine", false],
    [1, "09:30", "planifie", "Consultation", false],
    [2, "11:00", "confirme", "Routine", false],
    [4, "15:30", "planifie", "Suivi", false],
    [-3, "08:30", "termine", "Consultation", false],
    [-7, "13:30", "annule", "Controle", false],
  ] as const;

  for (const [index, appointment] of appointmentRows.entries()) {
    const patient = patientRows[index % patientRows.length]!;
    const currentSuivi = suiviRows[index % suiviRows.length]!;
    const [dateOffset, heure, statut, typeCreneau, important] = appointment;

    await db
      .insert(rendez_vous)
      .values({
        id: `33333333-3333-4333-8333-33333333310${index + 1}`,
        patient_id: patient.id,
        suivi_id: currentSuivi.id,
        utilisateur_id: utilisateurId,
        date: addDays(dateOffset),
        heure,
        heure_fin: `${String(Number(heure.slice(0, 2)) + 1).padStart(2, "0")}${heure.slice(2)}`,
        statut,
        type_creneau: typeCreneau,
        patient_label: `${patient.nom} ${patient.prenom}`,
        patient_initials: patient.initials,
        couleur: "#76bbdd",
        notes: "Rendez-vous de démonstration pour le tableau de bord.",
        important,
        frequence_rappel: "24h",
        periode_rappel: "veille",
      })
      .onConflictDoUpdate({
        target: rendez_vous.id,
        set: {
          date: addDays(dateOffset),
          heure,
          statut,
          type_creneau: typeCreneau,
          patient_label: `${patient.nom} ${patient.prenom}`,
          patient_initials: patient.initials,
          notes: "Rendez-vous de démonstration pour le tableau de bord.",
          important,
        },
      });
  }

  const ordonnanceRows = [
    {
      id: "44444444-4444-4444-8444-444444444101",
      rdvId: "33333333-3333-4333-8333-333333333101",
      patient: patientRows[0]!,
      date: addDays(0),
      meds: [
        ["1", "Paracetamol", "1 g", "1 comprimé toutes les 6 heures", "5 jours"],
        ["2", "Amoxicilline", "1 g", "1 comprimé toutes les 8 heures", "7 jours"],
      ],
    },
    {
      id: "44444444-4444-4444-8444-444444444102",
      rdvId: "33333333-3333-4333-8333-333333333102",
      patient: patientRows[1]!,
      date: addDays(0),
      meds: [
        ["3", "Ibuprofene", "400 mg", "1 comprimé matin et soir", "3 jours"],
        ["4", "Paracetamol", "1 g", "Si douleur ou fièvre", "5 jours"],
      ],
    },
    {
      id: "44444444-4444-4444-8444-444444444103",
      rdvId: "33333333-3333-4333-8333-333333333108",
      patient: patientRows[2]!,
      date: addDays(-3),
      meds: [
        ["5", "Amlodipine", "5 mg", "1 comprimé le matin", "30 jours"],
        ["6", "Metformine", "500 mg", "1 comprimé matin et soir", "30 jours"],
      ],
    },
  ] as const;

  for (const row of ordonnanceRows) {
    await db
      .insert(ordonnance)
      .values({
        id: row.id,
        rendez_vous_id: row.rdvId,
        patient_id: row.patient.id,
        utilisateur_id: utilisateurId,
        remarques: "Ordonnance de démonstration pour le tableau de bord.",
        date_prescription: row.date,
      })
      .onConflictDoUpdate({
        target: ordonnance.id,
        set: {
          remarques: "Ordonnance de démonstration pour le tableau de bord.",
          date_prescription: row.date,
        },
      });

    for (const [medIndex, med] of row.meds.entries()) {
      const [externalId, name, dosage, posologie, duree] = med;
      await db
        .insert(ordonnance_medicaments)
        .values({
          id: `55555555-5555-4555-8555-${row.id.slice(-3)}00000000${medIndex + 1}`,
          ordonnance_id: row.id,
          medicament_externe_id: externalId,
          nom_medicament: name,
          dci: name,
          dosage,
          posologie,
          duree_traitement: duree,
          instructions: "Respecter la posologie et reconsulter si aggravation.",
        })
        .onConflictDoUpdate({
          target: ordonnance_medicaments.id,
          set: {
            nom_medicament: name,
            dci: name,
            dosage,
            posologie,
            duree_traitement: duree,
            instructions: "Respecter la posologie et reconsulter si aggravation.",
          },
        });
    }
  }

  console.log("Dashboard seed completed.");
  console.log(`Login: ${LOGIN_EMAIL} / ${LOGIN_PASSWORD}`);
}

seedDashboard().catch((error) => {
  console.error("Dashboard seed failed:", error);
  process.exit(1);
});
