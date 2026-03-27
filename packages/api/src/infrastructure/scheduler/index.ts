import cron from "node-cron";
import { db } from "@doctor.com/db";
import { agendaRepository } from "../../modules/agenda/repo";
import {
  envoyerRappelRDV,
  type ClinicInfo,
} from "../email/index";

export async function sendTomorrowReminders(): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const rendezVousList = await agendaRepository.listAllRendezVousByDate(db, tomorrowStr);

  let sent = 0;
  let skipped = 0;

  for (const rdv of rendezVousList) {
    if (!rdv.patient_email) {
      skipped += 1;
      continue;
    }

    try {
      const utilisateur = await agendaRepository.getUtilisateurByEmail(
        db,
        rdv.utilisateur_email,
      );

      if (!utilisateur) {
        throw new Error("Utilisateur introuvable pour l'email du rendez-vous.");
      }

      const clinic: ClinicInfo = {
        doctorName: `Dr. ${utilisateur.prenom} ${utilisateur.nom}`,
        clinicName: `Cabinet ${utilisateur.prenom} ${utilisateur.nom}`,
        phone: utilisateur.telephone ?? "",
        address: utilisateur.adresse ?? "",
      };

      const dateStr = new Date(rdv.date).toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      await envoyerRappelRDV({
        clinic,
        patientEmail: rdv.patient_email,
        patientNom: rdv.patient_nom,
        patientPrenom: rdv.patient_prenom,
        dateRDV: dateStr,
        heureRDV: rdv.heure,
        important: rdv.important,
      });

      sent += 1;
      console.log(`✅ Rappel envoyé à ${rdv.patient_email} pour RDV du ${tomorrowStr}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Echec rappel pour ${rdv.patient_email}: ${message}`);
    }
  }

  console.log(`✅ Scheduler: ${sent} rappels envoyés, ${skipped} ignorés (pas d'email)`);
}

export function startScheduler(): void {
  cron.schedule("0 20 * * *", async () => {
    console.log("🕗 Scheduler: Envoi des rappels RDV de demain...");
    await sendTomorrowReminders();
  });

  console.log("✅ Scheduler started. Rappels RDV planifiés à 20h00 chaque jour.");
}
