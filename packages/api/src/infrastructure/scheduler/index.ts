import { db } from "@doctor.com/db";
import {
  envoyerRappelMedecinRDV,
} from "@doctor.com/api/infrastructure/email/index";
import { agendaRepository } from "../../modules/agenda/repo";
import { agendaService } from "../../modules/agenda/service";

const REMINDER_INTERVAL_MS = 60_000;
const FIVE_MINUTES_MS = 5 * 60_000;
const DUE_WINDOW_MS = 60_000;

let schedulerStarted = false;

function formatDate(dateValue: Date): string {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

function getAppointmentDateTime(date: string, time: string): Date {
  return new Date(`${date}T${normalizeTime(time)}:00`);
}

function getReminderAction(type: "five-minutes" | "now", rendezVousId: string): string {
  return `rdv-reminder:${type}:${rendezVousId}`;
}

async function recordReminderIfNeeded(params: {
  type: "five-minutes" | "now";
  rendezVousId: string;
  utilisateurId: string;
  utilisateurEmail: string;
  patientEmail: string | null;
  patientNom: string;
  patientPrenom: string;
  date: string;
  heure: string;
  important: boolean;
}): Promise<boolean> {
  const action = getReminderAction(params.type, params.rendezVousId);
  const alreadySent = await agendaRepository.hasAgendaLogAction(db, {
    utilisateur_id: params.utilisateurId,
    action,
  });

  if (alreadySent) {
    return false;
  }

  await envoyerRappelMedecinRDV({
    doctorEmail: params.utilisateurEmail,
    patientNom: params.patientNom,
    patientPrenom: params.patientPrenom,
    dateRDV: params.date,
    heureRDV: normalizeTime(params.heure),
    type: params.type,
    important: params.important,
  });

  if (params.type === "five-minutes" && params.patientEmail) {
    await agendaService.envoyerRappelRDV({
      db,
      rendezVousId: params.rendezVousId,
      userEmail: params.utilisateurEmail,
    });
  }

  await agendaRepository.createAgendaLog(db, {
    utilisateur_id: params.utilisateurId,
    action,
  });

  return true;
}

export async function runAppointmentReminderTick(now = new Date()): Promise<{
  checked: number;
  sent: number;
  failed: number;
}> {
  const today = formatDate(now);
  const rendezVous = await agendaRepository.listAllRendezVousByDate(db, today);
  let sent = 0;
  let failed = 0;

  for (const item of rendezVous) {
    const startsAt = getAppointmentDateTime(item.date, item.heure).getTime();
    if (!Number.isFinite(startsAt)) {
      continue;
    }

    const diff = startsAt - now.getTime();
    const type =
      diff > 0 && diff <= FIVE_MINUTES_MS
        ? "five-minutes"
        : Math.abs(diff) <= DUE_WINDOW_MS
          ? "now"
          : null;

    if (!type) {
      continue;
    }

    try {
      const reminderSent = await recordReminderIfNeeded({
        type,
        rendezVousId: item.id,
        utilisateurId: item.utilisateur_id,
        utilisateurEmail: item.utilisateur_email,
        patientEmail: item.patient_email,
        patientNom: item.patient_nom,
        patientPrenom: item.patient_prenom,
        date: item.date,
        heure: item.heure,
        important: item.important,
      });
      if (reminderSent) {
        sent += 1;
      }
    } catch (error) {
      failed += 1;
      console.warn("[scheduler] Appointment reminder failed", {
        rendezVousId: item.id,
        type,
        error,
      });
    }
  }

  return {
    checked: rendezVous.length,
    sent,
    failed,
  };
}

export function startScheduler(): void {
  if (schedulerStarted || process.env.APPOINTMENT_REMINDER_SCHEDULER === "false") {
    return;
  }

  schedulerStarted = true;

  const tick = () => {
    void runAppointmentReminderTick().catch((error) => {
      console.warn("[scheduler] Appointment reminder tick failed", error);
    });
  };

  tick();
  setInterval(tick, REMINDER_INTERVAL_MS);
}
