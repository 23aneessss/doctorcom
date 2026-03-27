import PDFDocument from "pdfkit";
import { TRPCError } from "@trpc/server";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { exportRepository } from "./repo";

type DB = NodePgDatabase<any>;

export class ExportService {
  private createPDFHeader(
    doc: PDFKit.PDFDocument,
    doctorName: string,
    address: string,
    phone: string,
  ) {
    doc.fontSize(14).font("Helvetica-Bold").text(doctorName, 50, 40);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Adresse: ${address}`, 50, 60);
    doc.text(`Téléphone: ${phone}`, 50, 75);
    doc.moveTo(50, 95).lineTo(550, 95).stroke();
    return 110;
  }

  private createPDFFooter(
    doc: PDFKit.PDFDocument,
    currentPage: number,
    totalPages: number,
  ) {
    const now = new Date();
    const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    doc.moveTo(50, doc.page.height - 60).lineTo(550, doc.page.height - 60).stroke();
    doc.fontSize(9).font("Helvetica");
    doc.text(
      `Page ${currentPage} / ${totalPages}`,
      50,
      doc.page.height - 50,
    );
    doc.text(
      `Document généré le ${dateStr}`,
      50,
      doc.page.height - 35,
    );
  }

  async exporterOrdonnance(db: DB, ordonnanceId: string): Promise<Buffer> {
    const data = await exportRepository.getOrdonnanceForExport(db, ordonnanceId);
    if (!data) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ordonnance not found.",
      });
    }

    const { ordonnance: ord, medicaments, patient, utilisateur } = data;

    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));

    if (!utilisateur) throw new Error("Utilisateur not found");
    if (!patient) throw new Error("Patient not found");

    const doctorName = `Dr. ${utilisateur.prenom} ${utilisateur.nom}`;
    let yPos = this.createPDFHeader(
      doc,
      doctorName,
      utilisateur.adresse || "",
      utilisateur.telephone || "",
    );

    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("ORDONNANCE MÉDICALE", { align: "center" });
    yPos += 30;

    const prescDate = new Date(ord.date_prescription);
    const dateStr = `${prescDate.getDate()}/${prescDate.getMonth() + 1}/${prescDate.getFullYear()}`;
    doc.fontSize(11).font("Helvetica").text(`Alger, le ${dateStr}`, 50, yPos);
    yPos += 25;

    doc.fontSize(11).font("Helvetica-Bold").text("Patient:", 50, yPos);
    yPos += 15;
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`${patient.prenom} ${patient.nom}`, 70, yPos);
    yPos += 15;
    doc.text(
      `Date de naissance: ${patient.date_naissance}`,
      70,
      yPos,
    );
    yPos += 15;
    doc.text(`Matricule: ${patient.matricule}`, 70, yPos);
    yPos += 20;

    doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
    yPos += 15;

    doc.fontSize(11).font("Helvetica-Bold").text("Médicaments:", 50, yPos);
    yPos += 15;

    medicaments.forEach((med, index) => {
      doc.fontSize(10).font("Helvetica-Bold").text(`${index + 1}. ${med.dci}`, 50, yPos);
      yPos += 15;
      doc
        .fontSize(9)
        .font("Helvetica")
        .text(`Posologie: ${med.posologie}`, 70, yPos);
      yPos += 12;
      if (med.duree_traitement) {
        doc.text(`Durée: ${med.duree_traitement}`, 70, yPos);
        yPos += 12;
      }
      if (med.instructions) {
        doc.text(`Instructions: ${med.instructions}`, 70, yPos);
        yPos += 12;
      }
      yPos += 5;
    });

    if (ord.remarques) {
      yPos += 10;
      doc.fontSize(10).font("Helvetica-Bold").text("Remarques:", 50, yPos);
      yPos += 12;
      doc.fontSize(9).font("Helvetica").text(ord.remarques, 70, yPos);
      yPos += 15;
    }

    yPos += 30;
    doc.fontSize(10).font("Helvetica").text("Signature et cachet du médecin", 50, yPos);

    this.createPDFFooter(doc, 1, 1);
    doc.end();

    return new Promise((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
  }

  async exporterCertificatMedical(
    db: DB,
    certificatId: string,
  ): Promise<Buffer> {
    const data = await exportRepository.getCertificatForExport(db, certificatId);
    if (!data) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Certificat médical not found.",
      });
    }

    const { certificat: cert, patient, utilisateur } = data;

    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));

    if (!utilisateur) throw new Error("Utilisateur not found");
    if (!patient) throw new Error("Patient not found");

    const doctorName = `Dr. ${utilisateur.prenom} ${utilisateur.nom}`;
    let yPos = this.createPDFHeader(
      doc,
      doctorName,
      utilisateur.adresse || "",
      utilisateur.telephone || "",
    );

    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("CERTIFICAT MÉDICAL", { align: "center" });
    yPos += 25;

    doc
      .fontSize(13)
      .font("Helvetica-Bold")
      .text(cert.type_certificat.toUpperCase(), { align: "center" });
    yPos += 20;

    const emitDate = new Date(cert.date_emission);
    const dateStr = `${emitDate.getDate()}/${emitDate.getMonth() + 1}/${emitDate.getFullYear()}`;
    doc.fontSize(11).font("Helvetica").text(`Alger, le ${dateStr}`, 50, yPos);
    yPos += 25;

    doc.fontSize(10).font("Helvetica-Bold").text("Patient:", 50, yPos);
    yPos += 12;
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`${patient.prenom} ${patient.nom}`, 70, yPos);
    yPos += 12;
    doc.text(
      `Date de naissance: ${patient.date_naissance}`,
      70,
      yPos,
    );
    yPos += 12;
    doc.text(`Matricule: ${patient.matricule}`, 70, yPos);
    yPos += 20;

    doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
    yPos += 15;

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Je soussigné, ${doctorName}, certifie que:`, 50, yPos);
    yPos += 20;

    if (cert.diagnostic) {
      doc.fontSize(10).text(`Diagnostic: ${cert.diagnostic}`, 70, yPos);
      yPos += 15;
    }

    if (cert.date_debut && cert.date_fin) {
      doc.text(
        `Période: du ${cert.date_debut} au ${cert.date_fin}`,
        70,
        yPos,
      );
      yPos += 15;
    }

    if (cert.destinataire) {
      doc.text(`Établi pour: ${cert.destinataire}`, 70, yPos);
      yPos += 15;
    }

    if (cert.notes) {
      doc.text(`Notes: ${cert.notes}`, 70, yPos);
      yPos += 15;
    }

    yPos += 15;
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(`Statut: ${cert.statut.toUpperCase()}`, 50, yPos);
    yPos += 25;

    doc.fontSize(10).font("Helvetica").text("Signature et cachet du médecin", 50, yPos);

    this.createPDFFooter(doc, 1, 1);
    doc.end();

    return new Promise((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
  }

  async exporterLettreOrientation(
    db: DB,
    lettreId: string,
  ): Promise<Buffer> {
    const data = await exportRepository.getLettreForExport(db, lettreId);
    if (!data) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Lettre d'orientation not found.",
      });
    }

    const { lettre, patient, utilisateur } = data;

    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));

    if (!utilisateur) throw new Error("Utilisateur not found");
    if (!patient) throw new Error("Patient not found");

    const doctorName = `Dr. ${utilisateur.prenom} ${utilisateur.nom}`;
    let yPos = this.createPDFHeader(
      doc,
      doctorName,
      utilisateur.adresse || "",
      utilisateur.telephone || "",
    );

    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("LETTRE D'ORIENTATION", { align: "center" });
    yPos += 25;

    const urgenceNormalized = lettre.urgence?.toLowerCase() || "";
    if (urgenceNormalized === "urgente") {
      doc
        .fontSize(13)
        .fillColor("red")
        .font("Helvetica-Bold")
        .text("⚠ URGENT", { align: "center" });
      doc.fillColor("black");
    } else if (urgenceNormalized === "tres_urgente") {
      doc
        .fontSize(13)
        .fillColor("red")
        .font("Helvetica-Bold")
        .text("⚠⚠ TRÈS URGENT", { align: "center" });
      doc.fillColor("black");
    }
    yPos += 20;

    const createDate = new Date(lettre.date_creation);
    const dateStr = `${createDate.getDate()}/${createDate.getMonth() + 1}/${createDate.getFullYear()}`;
    doc.fontSize(11).font("Helvetica").text(`Alger, le ${dateStr}`, 50, yPos);
    yPos += 20;

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`À l'attention de: ${lettre.destinataire || "N/A"}`, 50, yPos);
    yPos += 20;

    doc.fontSize(10).font("Helvetica-Bold").text("Patient:", 50, yPos);
    yPos += 12;
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`${patient.prenom} ${patient.nom}`, 70, yPos);
    yPos += 12;
    doc.text(
      `Date de naissance: ${patient.date_naissance}`,
      70,
      yPos,
    );
    yPos += 12;
    doc.text(`Matricule: ${patient.matricule}`, 70, yPos);
    yPos += 20;

    doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
    yPos += 15;

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Je vous adresse mon patient(e) ${patient.prenom} ${patient.nom} pour:`, 50, yPos);
    yPos += 20;

    if (lettre.type_exploration) {
      doc
        .fontSize(10)
        .text(`Type d'exploration: ${lettre.type_exploration}`, 70, yPos);
      yPos += 12;
    }

    if (lettre.examen_demande) {
      doc.text(`Examen demandé: ${lettre.examen_demande}`, 70, yPos);
      yPos += 12;
    }

    if (lettre.raison) {
      doc.text(`Raison: ${lettre.raison}`, 70, yPos);
      yPos += 12;
    }

    if (lettre.contenu_lettre) {
      yPos += 5;
      doc.text(lettre.contenu_lettre, 70, yPos);
      yPos += 20;
    }

    yPos += 15;
    doc.fontSize(10).font("Helvetica").text("Signature et cachet du médecin", 50, yPos);

    this.createPDFFooter(doc, 1, 1);
    doc.end();

    return new Promise((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
  }

  async exporterDossierPatient(
    db: DB,
    patientId: string,
  ): Promise<Buffer> {
    const data = await exportRepository.getDossierPatientForExport(db, patientId);
    if (!data) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Patient not found.",
      });
    }

    const {
      patient,
      patientFemme,
      antecedentsPersonnels,
      antecedentsFamiliaux,
      vaccinations,
      historiqueTraitements,
    } = data;

    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));

    let yPos = 50;
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("DOSSIER MÉDICAL PATIENT", { align: "center" });
    yPos += 30;

    doc.fontSize(11).font("Helvetica-Bold").text("Informations Personnelles:", 50, yPos);
    yPos += 15;
    doc.fontSize(10).font("Helvetica");
    doc.text(`Nom: ${patient.nom}`, 70, yPos);
    yPos += 12;
    doc.text(`Prénom: ${patient.prenom}`, 70, yPos);
    yPos += 12;
    doc.text(`Date de naissance: ${patient.date_naissance}`, 70, yPos);
    yPos += 12;
    if (patient.sexe) {
      doc.text(`Sexe: ${patient.sexe}`, 70, yPos);
      yPos += 12;
    }
    doc.text(`Matricule: ${patient.matricule}`, 70, yPos);
    yPos += 12;
    if (patient.telephone) {
      doc.text(`Téléphone: ${patient.telephone}`, 70, yPos);
      yPos += 12;
    }
    if (patient.email) {
      doc.text(`Email: ${patient.email}`, 70, yPos);
      yPos += 12;
    }
    if (patient.adresse) {
      doc.text(`Adresse: ${patient.adresse}`, 70, yPos);
      yPos += 12;
    }
    if (patient.profession) {
      doc.text(`Profession: ${patient.profession}`, 70, yPos);
      yPos += 12;
    }
    if (patient.groupe_sanguin) {
      doc.text(`Groupe sanguin: ${patient.groupe_sanguin}`, 70, yPos);
      yPos += 12;
    }

    if (patientFemme) {
      yPos += 10;
      doc.fontSize(11).font("Helvetica-Bold").text("Info Femme:", 50, yPos);
      yPos += 12;
      if (patientFemme.menarche) {
        doc.fontSize(10).font("Helvetica").text(`Ménarche: ${patientFemme.menarche}`, 70, yPos);
        yPos += 12;
      }
      if (patientFemme.nb_grossesses !== null) {
        doc.text(`Grossesses: ${patientFemme.nb_grossesses}`, 70, yPos);
        yPos += 12;
      }
      if (patientFemme.menopause) {
        doc.text("Ménopause: Oui", 70, yPos);
        yPos += 12;
      }
    }

    if (antecedentsPersonnels.length > 0) {
      yPos += 15;
      doc.fontSize(11).font("Helvetica-Bold").text("Antécédents Personnels:", 50, yPos);
      yPos += 12;
      antecedentsPersonnels.forEach((ant) => {
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(`• ${ant.type}${ant.details ? `: ${ant.details}` : ""}`, 70, yPos);
        yPos += 12;
      });
    }

    if (antecedentsFamiliaux.length > 0) {
      yPos += 10;
      doc.fontSize(11).font("Helvetica-Bold").text("Antécédents Familiaux:", 50, yPos);
      yPos += 12;
      antecedentsFamiliaux.forEach((ant) => {
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(
            `• ${ant.lien_parente || "N/A"}${ant.details ? `: ${ant.details}` : ""}`,
            70,
            yPos,
          );
        yPos += 12;
      });
    }

    if (vaccinations.length > 0) {
      yPos += 10;
      doc.fontSize(11).font("Helvetica-Bold").text("Vaccinations:", 50, yPos);
      yPos += 12;
      vaccinations.forEach((vac) => {
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(
            `• ${vac.vaccin} (${vac.date_vaccination})${vac.notes ? `: ${vac.notes}` : ""}`,
            70,
            yPos,
          );
        yPos += 12;
      });
    }

    if (historiqueTraitements.length > 0) {
      yPos += 10;
      doc.fontSize(11).font("Helvetica-Bold").text("Traitements Actifs:", 50, yPos);
      yPos += 12;
      historiqueTraitements.forEach((trt) => {
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(
            `• ${trt.dci} - Posologie: ${trt.posologie} (depuis ${trt.date_prescription})`,
            70,
            yPos,
          );
        yPos += 12;
      });
    }

    this.createPDFFooter(doc, 1, 1);
    doc.end();

    return new Promise((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
  }

  async exporterAgenda(
    db: DB,
    utilisateurId: string,
    date: string,
  ): Promise<Buffer> {
    const data = await exportRepository.getAgendaForExport(db, utilisateurId, date);
    if (!data) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Agenda data not found.",
      });
    }

    const { rendezVous, utilisateur } = data;

    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));

    if (!utilisateur) throw new Error("Utilisateur not found");

    const doctorName = `Dr. ${utilisateur.prenom} ${utilisateur.nom}`;
    let yPos = this.createPDFHeader(
      doc,
      doctorName,
      utilisateur.adresse || "",
      utilisateur.telephone || "",
    );

    const dateObj = new Date(date);
    const dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text(`AGENDA DU ${dateStr}`, { align: "center" });
    yPos += 25;

    doc
      .fontSize(11)
      .font("Helvetica")
      .text(`Total rendez-vous: ${rendezVous.length}`, 50, yPos);
    yPos += 15;

    doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
    yPos += 15;

    if (rendezVous.length === 0) {
      doc.fontSize(10).text("Aucun rendez-vous ce jour.", 50, yPos);
    } else {
      rendezVous.forEach((rv) => {
        doc.fontSize(10).font("Helvetica-Bold").text(`${rv.heure}`, 50, yPos);
        yPos += 12;
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(`${rv.nom} ${rv.prenom}`, 70, yPos);
        yPos += 10;
        doc.fontSize(9).text(`Statut: ${rv.statut}`, 70, yPos);
        yPos += 10;
        if (rv.important) {
          doc.fillColor("red").text("⭐ IMPORTANT", 70, yPos);
          doc.fillColor("black");
          yPos += 10;
        }
        yPos += 5;
      });
    }

    this.createPDFFooter(doc, 1, 1);
    doc.end();

    return new Promise((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
  }
}

export const exportService = new ExportService();
