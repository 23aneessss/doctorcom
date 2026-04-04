import nodemailer from "nodemailer";
import { env } from "@doctor.com/env/server";

export interface ClinicInfo {
  doctorName: string;
  clinicName: string;
  phone: string;
  address: string;
}

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      attachments: params.attachments,
    });

    console.info(`✅ Email sent to ${params.to}: ${params.subject}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Email failed to ${params.to}: ${errorMessage}`);
    throw error;
  }
}

function buildEmailHtml(content: string, clinic: ClinicInfo): string {
  return `
  <div style="font-family: Arial, sans-serif; background-color: #f5f7fb; margin: 0; padding: 24px; color: #1f2937;">
    <div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #f3f4f6; padding: 20px; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #111827; font-weight: 700;">${clinic.clinicName}</h2>
        <p style="margin: 0 0 4px 0; font-size: 14px;"><strong>Médecin:</strong> ${clinic.doctorName}</p>
        <p style="margin: 0 0 4px 0; font-size: 14px;"><strong>Adresse:</strong> ${clinic.address}</p>
        <p style="margin: 0; font-size: 14px;"><strong>Téléphone:</strong> ${clinic.phone}</p>
      </div>
      <div style="padding: 24px; line-height: 1.6; font-size: 15px;">${content}</div>
      <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; background-color: #fafafa; font-size: 12px; color: #6b7280;">
        <p style="margin: 0 0 6px 0;">Ce message est confidentiel et destiné uniquement à son destinataire.</p>
        <p style="margin: 0;">Pour toute question, contactez-nous au ${clinic.phone}</p>
      </div>
    </div>
  </div>`;
}

export async function envoyerRappelRDV(params: {
  clinic: ClinicInfo;
  patientEmail: string;
  patientNom: string;
  patientPrenom: string;
  dateRDV: string;
  heureRDV: string;
  important?: boolean;
}): Promise<void> {
  const importantBlock = params.important
    ? '<p style="margin: 12px 0; padding: 10px; border: 1px solid #ef4444; background-color: #fee2e2; color: #991b1b;"><strong>⚠️ Rendez-vous IMPORTANT</strong></p>'
    : "";

  const content = `
    <p>Cher(e) ${params.patientPrenom} ${params.patientNom},</p>
    <p>Nous vous rappelons votre rendez-vous prévu le <strong>${params.dateRDV}</strong> à <strong>${params.heureRDV}</strong>.</p>
    <p><strong>Adresse du cabinet:</strong> ${params.clinic.address}</p>
    ${importantBlock}
    <p>Merci de vous présenter 10 minutes avant l'heure prévue.</p>
    <p>Pour annuler ou modifier, contactez-nous au ${params.clinic.phone}.</p>
  `;

  await sendEmail({
    to: params.patientEmail,
    subject: `Rappel de votre rendez-vous - ${params.dateRDV}`,
    html: buildEmailHtml(content, params.clinic),
  });
}

export async function envoyerOrdonnanceParEmail(params: {
  clinic: ClinicInfo;
  patientEmail: string;
  patientNom: string;
  patientPrenom: string;
  datePrescription: string;
  medicaments: Array<{
    nom: string;
    posologie: string;
    duree?: string | null;
    instructions?: string | null;
  }>;
  remarques?: string | null;
}): Promise<void> {
  const medicamentsHtml = params.medicaments
    .map((medicament) => {
      const details = [
        `<strong>Posologie:</strong> ${medicament.posologie}`,
        medicament.duree ? `<strong>Durée:</strong> ${medicament.duree}` : null,
        medicament.instructions ? `<strong>Instructions:</strong> ${medicament.instructions}` : null,
      ]
        .filter(Boolean)
        .join("<br />");

      return `<li style="margin-bottom: 10px;"><strong>${medicament.nom}</strong><br />${details}</li>`;
    })
    .join("");

  const remarquesHtml = params.remarques
    ? `<p><strong>Remarques:</strong> ${params.remarques}</p>`
    : "";

  const content = `
    <p>Cher(e) ${params.patientPrenom} ${params.patientNom},</p>
    <p>Veuillez trouver ci-dessous le détail de votre ordonnance du <strong>${params.datePrescription}</strong>.</p>
    <ul style="padding-left: 20px;">${medicamentsHtml}</ul>
    ${remarquesHtml}
    <p>Cette ordonnance vous est transmise à titre informatif.<br />
    Veuillez vous munir de l'original lors de votre passage en pharmacie.</p>
  `;

  await sendEmail({
    to: params.patientEmail,
    subject: `Votre ordonnance du ${params.datePrescription}`,
    html: buildEmailHtml(content, params.clinic),
  });
}

export async function envoyerCertificatMedical(params: {
  clinic: ClinicInfo;
  patientEmail: string;
  patientNom: string;
  patientPrenom: string;
  typeCertificat: string;
  dateEmission: string;
  dateDebut?: string | null;
  dateFin?: string | null;
  statut: string;
}): Promise<void> {
  const periodeHtml =
    params.dateDebut && params.dateFin
      ? `<p><strong>Période:</strong> ${params.dateDebut} → ${params.dateFin}</p>`
      : "";

  const content = `
    <p>Cher(e) ${params.patientPrenom} ${params.patientNom},</p>
    <p>Votre certificat médical de type <strong>${params.typeCertificat}</strong> a été émis le <strong>${params.dateEmission}</strong>.</p>
    ${periodeHtml}
    <p><strong>Statut:</strong> ${params.statut}</p>
    <p>Ce document vous est transmis à titre informatif.<br />
    L'original vous sera remis lors de votre prochaine visite.</p>
  `;

  await sendEmail({
    to: params.patientEmail,
    subject: `Votre certificat médical - ${params.typeCertificat}`,
    html: buildEmailHtml(content, params.clinic),
  });
}

export async function envoyerLettreOrientation(params: {
  clinic: ClinicInfo;
  patientEmail: string;
  patientNom: string;
  patientPrenom: string;
  destinataire: string;
  typeExploration?: string | null;
  examenDemande?: string | null;
  urgence: string;
  dateCreation: string;
}): Promise<void> {
  const urgenceNormalisee = params.urgence.toLowerCase();
  const urgenceHtml = ["urgente", "tres_urgente"].includes(urgenceNormalisee)
    ? `<p style="color: #dc2626; font-weight: 700;"><strong>Urgence:</strong> ${params.urgence}</p>`
    : `<p><strong>Urgence:</strong> ${params.urgence}</p>`;
  const explorationHtml = params.typeExploration
    ? `<p><strong>Type d'exploration:</strong> ${params.typeExploration}</p>`
    : "";
  const examenHtml = params.examenDemande
    ? `<p><strong>Examen demandé:</strong> ${params.examenDemande}</p>`
    : "";

  const content = `
    <p>Cher(e) ${params.patientPrenom} ${params.patientNom},</p>
    <p><strong>Destinataire:</strong> ${params.destinataire}</p>
    ${explorationHtml}
    ${examenHtml}
    ${urgenceHtml}
    <p><strong>Date de création:</strong> ${params.dateCreation}</p>
    <p>Veuillez vous présenter avec ce document lors de votre consultation.</p>
  `;

  await sendEmail({
    to: params.patientEmail,
    subject: `Lettre d'orientation - ${params.destinataire}`,
    html: buildEmailHtml(content, params.clinic),
  });
}

export async function envoyerEmailPatient(params: {
  clinic: ClinicInfo;
  patientEmail: string;
  patientNom: string;
  patientPrenom: string;
  sujet: string;
  contenu: string;
}): Promise<void> {
  const content = `
    <p>Cher(e) ${params.patientPrenom} ${params.patientNom},</p>
    <div>${params.contenu}</div>
  `;

  await sendEmail({
    to: params.patientEmail,
    subject: params.sujet,
    html: buildEmailHtml(content, params.clinic),
  });
}
