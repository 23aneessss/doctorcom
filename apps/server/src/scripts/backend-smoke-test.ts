import "dotenv/config";

import { agendaService } from "@doctor.com/api/modules/agenda/service";
import { consultationService } from "@doctor.com/api/modules/consultation/service";
import { ordonnanceService } from "@doctor.com/api/modules/ordonnance/service";
import { patientService } from "@doctor.com/api/modules/patient/service";
import { db } from "@doctor.com/db";

const session = {
  user: {
    email: "backend-smoke@doctor.test",
    name: "Backend Smoke",
  },
};

const steps: string[] = [];

function record(step: string): void {
  steps.push(step);
}

try {
  await db.transaction(async (tx) => {
    const suffix = Date.now().toString().slice(-8);
    const patient = await patientService.createPatient({
      db: tx,
      session,
      input: {
        patient: {
          nom: "Smoke",
          prenom: "Backend",
          telephone: "0555000000",
          email: "backend.smoke@example.test",
          matricule: `SMOKE-${suffix}`,
          date_naissance: "1990-01-01",
          nss: "123456789012345",
          sexe: "Homme",
        },
      },
    });
    record(`patient.createPatient:${patient.id}`);

    await patientService.getPatientById({
      db: tx,
      session,
      id: patient.id,
    });
    record("patient.getPatient");

    const rendezVous = await agendaService.planifierRDV({
      db: tx,
      session,
      input: {
        patient_id: patient.id,
        date: "2026-05-20",
        heure: "09:00",
        heure_fin: "09:30",
        statut: "planifie",
        type_creneau: "consultation",
        important: false,
      },
    });
    record(`agenda.planifierRDV:${rendezVous.id}`);

    await agendaService.confirmerRDV({
      db: tx,
      session,
      rdv_id: rendezVous.id,
    });
    record("agenda.confirmerRDV");

    await agendaService.modifierRDV({
      db: tx,
      session,
      rdv_id: rendezVous.id,
      input: { statut: "termine" },
    });
    record("agenda.modifierRDV.termine");

    const suivi = await consultationService.createSuivi({
      db: tx,
      session,
      input: {
        patient_id: patient.id,
        symptoms: ["toux", "fievre"],
        historique: "Smoke test workflow",
        date_ouverture: "2026-05-20",
      },
    });
    record(`consultation.createSuivi:${suivi.id}`);

    const examen = await consultationService.createExamen({
      db: tx,
      session,
      input: {
        rendez_vous_id: rendezVous.id,
        suivi_id: suivi.id,
        date: "2026-05-20",
        taille: "180",
        poids: "80",
        tension_arterielle: "120/80",
        frequence_cardiaque: 72,
        temperature: 37.2,
        spo2: 98,
        description_consultation: "Smoke test consultation",
        conclusion: "RAS",
      },
    });
    record(`consultation.createExamen:${examen.id}`);

    const fullRecord = await patientService.getPatientFullRecord({
      db: tx,
      session,
      id: patient.id,
    });
    record(
      `patient.getPatientFullRecord:rdv=${fullRecord.rendez_vous.length},suivi=${fullRecord.suivi.length}`,
    );

    const clinicalProfile = await patientService.getPatientClinicalProfile({
      db: tx,
      session,
      id: patient.id,
    });
    record(`patient.getPatientClinicalProfile:imc=${clinicalProfile.imc}`);

    const slots = await agendaService.getSlots({
      db: tx,
      session,
      startDate: "2026-05-20",
      endDate: "2026-05-20",
    });
    record(`agenda.getSlots:${slots.length}`);

    await ordonnanceService.getOrdonnancesPageData({
      db: tx,
      session,
    });
    record("ordonnance.getOrdonnancesPageData");

    await ordonnanceService.listPdfTemplates({
      db: tx,
      session,
    });
    record("ordonnance.listPdfTemplates");

    throw new Error("__rollback__");
  });
} catch (error) {
  if (error instanceof Error && error.message === "__rollback__") {
    console.log(
      JSON.stringify(
        {
          ok: true,
          rollback: true,
          steps,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  console.error(
    JSON.stringify(
      {
        ok: false,
        rollback: false,
        steps,
        error: error instanceof Error ? error.message : "Backend smoke test failed.",
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
