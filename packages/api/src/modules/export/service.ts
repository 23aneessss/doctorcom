import PDFDocument from "pdfkit";
import {
  PDFDocument as PdfLibDocument,
  type PDFImage,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { TRPCError } from "@trpc/server";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  getObjectNameFromUrl,
  minioClient,
  storageConfig,
} from "../../infrastructure/storage";
import {
  normalizeOrdonnancePdfLayout,
  type OrdonnancePdfTemplateField,
} from "../ordonnance/pdf-template-layout";
import { exportRepository } from "./repo";

type DB = NodePgDatabase<any>;
type OrdonnanceExportPayload = NonNullable<
  Awaited<ReturnType<typeof exportRepository.getOrdonnanceForExport>>
>;

type ClinicalPdfPatient = {
  nom: string;
  prenom: string;
  date_naissance: Date | string;
  matricule: string;
};

type ClinicalPdfUtilisateur = {
  nom: string;
  prenom: string;
  adresse: string | null;
  telephone: string | null;
};

type ClinicalPdfSectionRow = {
  label: string;
  value: unknown;
};

type ClinicalPdfSection = {
  title: string;
  body?: string | null;
  rows?: ClinicalPdfSectionRow[];
  tone?: "default" | "attention";
};

export class ExportService {
  private ensureUtilisateurExportData<T>(value: T | null | undefined): T {
    if (!value) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Le compte associé à cette session est introuvable.",
      });
    }

    return value;
  }

  private ensurePatientExportData<T>(value: T | null | undefined): T {
    if (!value) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Le patient demandé est introuvable.",
      });
    }

    return value;
  }

  private async resolveUtilisateurIdByEmail(
    db: DB,
    email: string,
  ): Promise<string> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "La session a expiré. Reconnectez-vous.",
      });
    }

    const utilisateur = await exportRepository.findUtilisateurByEmail(
      db,
      normalizedEmail,
    );

    if (!utilisateur) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Le compte associé à cette session est introuvable.",
      });
    }

    return utilisateur.id;
  }

  private cleanText(value: unknown, fallback = "Non renseigné") {
    if (value === null || value === undefined) return fallback;
    const normalized = String(value).replace(/\s+/g, " ").trim();
    return normalized || fallback;
  }

  private stripMarkdown(text: string): string {
    return (
      text
        // Bold+italic ***text*** or **text**
        .replace(/\*{3}([^*]+)\*{3}/g, "$1")
        .replace(/\*{2}([^*]+)\*{2}/g, "$1")
        // Italic *text* (but not bullet * items)
        .replace(/(?<![*\s])\*([^*\n]+)\*(?![*])/g, "$1")
        // Headings # ## ###
        .replace(/^#{1,6}\s+/gm, "")
        // Bullet list * item or - item → • item
        .replace(/^[*-]\s+/gm, "• ")
        // Inline code `text`
        .replace(/`([^`]+)`/g, "$1")
        // Horizontal rule
        .replace(/^[-_*]{3,}\s*$/gm, "")
        // Multiple blank lines → single blank line
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    );
  }

  private formatDate(value: Date | string | null | undefined) {
    if (!value) return "Non renseignée";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("fr-DZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }

  private async readStoredFileBuffer(fileUrl: string): Promise<Buffer> {
    const objectName = getObjectNameFromUrl(fileUrl);
    const stream = await minioClient.getObject(storageConfig.bucket, objectName);
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  private wrapPdfText(text: string, width: number, font: PDFFont, fontSize: number) {
    const lines: string[] = [];
    const paragraphs = text.split(/\r?\n/);

    for (const paragraph of paragraphs) {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        lines.push("");
        continue;
      }

      let current = "";
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(next, fontSize) <= width) {
          current = next;
          continue;
        }

        if (current) {
          lines.push(current);
          current = word;
        } else {
          lines.push(this.truncatePdfLine(word, width, font, fontSize));
          current = "";
        }
      }

      if (current) {
        lines.push(current);
      }
    }

    return lines;
  }

  private truncatePdfLine(
    text: string,
    width: number,
    font: PDFFont,
    fontSize: number,
  ) {
    const ellipsis = "...";
    let candidate = text;

    while (
      candidate.length > 0 &&
      font.widthOfTextAtSize(`${candidate}${ellipsis}`, fontSize) > width
    ) {
      candidate = candidate.slice(0, -1);
    }

    return candidate ? `${candidate}${ellipsis}` : ellipsis;
  }

  private drawMappedTextBlock(
    page: PDFPage,
    text: string,
    field: OrdonnancePdfTemplateField,
    pageHeight: number,
    font: PDFFont,
  ) {
    if (field.enabled === false) {
      return;
    }

    const fontSize = field.fontSize;
    const lineHeight = field.lineHeight ?? fontSize * 1.25;
    const maxLines = Math.max(1, Math.floor(field.height / lineHeight));
    const wrappedLines = this.wrapPdfText(text, field.width, font, fontSize);
    const renderedLines = wrappedLines.slice(0, maxLines);

    if (wrappedLines.length > maxLines && renderedLines.length > 0) {
      renderedLines[renderedLines.length - 1] = this.truncatePdfLine(
        renderedLines[renderedLines.length - 1] ?? "",
        field.width,
        font,
        fontSize,
      );
    }

    renderedLines.forEach((line, index) => {
      const lineWidth = font.widthOfTextAtSize(line, fontSize);
      const align = field.align ?? "left";
      const x =
        align === "right"
          ? field.x + Math.max(0, field.width - lineWidth)
          : align === "center"
            ? field.x + Math.max(0, (field.width - lineWidth) / 2)
            : field.x;

      page.drawText(line, {
        x,
        y: pageHeight - field.y - fontSize - index * lineHeight,
        size: fontSize,
        font,
        color: rgb(15 / 255, 52 / 255, 96 / 255),
      });
    });
  }

  private drawMappedLogoBlock(
    page: PDFPage,
    initials: string,
    field: OrdonnancePdfTemplateField,
    pageHeight: number,
    font: PDFFont,
  ) {
    if (field.enabled === false) {
      return;
    }

    const size = Math.min(field.width, field.height);
    if (size < 12) {
      return;
    }

    const centerX = field.x + field.width / 2;
    const centerY = pageHeight - field.y - field.height / 2;
    page.drawEllipse({
      x: centerX,
      y: centerY,
      xScale: size / 2,
      yScale: size / 2,
      color: rgb(15 / 255, 52 / 255, 96 / 255),
    });

    const text = this.cleanText(initials, "Dr").slice(0, 3);
    const fontSize = Math.min(field.fontSize, size * 0.42);
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    page.drawText(text, {
      x: centerX - textWidth / 2,
      y: centerY - fontSize / 3,
      size: fontSize,
      font,
      color: rgb(1, 1, 1),
    });
  }

  private drawMappedImageBlock(
    page: PDFPage,
    image: PDFImage,
    field: OrdonnancePdfTemplateField,
    pageHeight: number,
  ) {
    if (field.enabled === false) {
      return;
    }

    const imageWidth = image.width;
    const imageHeight = image.height;
    if (imageWidth <= 0 || imageHeight <= 0) {
      return;
    }

    const scale = Math.min(field.width / imageWidth, field.height / imageHeight);
    const renderedWidth = imageWidth * scale;
    const renderedHeight = imageHeight * scale;

    page.drawImage(image, {
      x: field.x + Math.max(0, (field.width - renderedWidth) / 2),
      y:
        pageHeight -
        field.y -
        field.height +
        Math.max(0, (field.height - renderedHeight) / 2),
      width: renderedWidth,
      height: renderedHeight,
    });
  }

  private async embedTemplateImage(params: {
    pdfDoc: PdfLibDocument;
    fileUrl: string | null;
    mimeType: string | null;
  }): Promise<PDFImage | null> {
    if (!params.fileUrl) {
      return null;
    }

    const imageBytes = await this.readStoredFileBuffer(params.fileUrl);
    const mimeType = params.mimeType?.toLowerCase() ?? "";

    if (mimeType.includes("png")) {
      return params.pdfDoc.embedPng(imageBytes);
    }

    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
      return params.pdfDoc.embedJpg(imageBytes);
    }

    return null;
  }

  private renderDoctorComClinicalPdf({
    title,
    subtitle,
    date,
    patient,
    utilisateur,
    sections,
    closingText,
  }: {
    title: string;
    subtitle?: string;
    date: Date | string | null | undefined;
    patient: ClinicalPdfPatient;
    utilisateur: ClinicalPdfUtilisateur;
    sections: ClinicalPdfSection[];
    closingText?: string;
  }): Promise<Buffer> {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      bufferPages: true,
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));

    const colors = {
      primary: "#123F6D",
      primarySoft: "#EAF6FF",
      border: "#B8DBEF",
      borderStrong: "#78BDE3",
      text: "#102A43",
      muted: "#5D7285",
      pale: "#F7FCFF",
      attention: "#F97316",
      attentionSoft: "#FFF7ED",
    };
    const page = {
      left: 54,
      right: doc.page.width - 54,
      top: 42,
      bottom: doc.page.height - 78,
    };
    const contentWidth = page.right - page.left;
    let yPos = page.top;

    const drawContinuationHeader = () => {
      doc
        .fillColor(colors.primary)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(`${title} - SUITE`, page.left, page.top, {
          width: contentWidth,
          align: "center",
        });
      doc
        .moveTo(page.left, page.top + 22)
        .lineTo(page.right, page.top + 22)
        .lineWidth(1)
        .strokeColor(colors.border)
        .stroke();
    };

    const ensureSpace = (height: number) => {
      if (yPos + height <= page.bottom) return;
      doc.addPage();
      drawContinuationHeader();
      yPos = page.top + 46;
    };

    const doctorName = `Dr. ${utilisateur.prenom} ${utilisateur.nom}`;
    doc
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .fontSize(17)
      .text(doctorName, page.left, yPos, { width: 310 });
    yPos += 24;
    doc
      .fillColor(colors.text)
      .font("Helvetica")
      .fontSize(9.5)
      .text(`Adresse : ${this.cleanText(utilisateur.adresse)}`, page.left, yPos, {
        width: 330,
      });
    yPos += 15;
    doc.text(
      `Téléphone : ${this.cleanText(utilisateur.telephone)}`,
      page.left,
      yPos,
      { width: 330 },
    );

    doc
      .roundedRect(page.right - 170, page.top, 170, 58, 12)
      .fillAndStroke(colors.primarySoft, colors.border);
    doc
      .fillColor(colors.muted)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("DATE DU DOCUMENT", page.right - 154, page.top + 13, {
        width: 138,
        align: "center",
      });
    doc
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(this.formatDate(date), page.right - 154, page.top + 31, {
        width: 138,
        align: "center",
      });

    yPos = 120;
    doc
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .fontSize(18)
      .text(title, page.left, yPos, {
        width: contentWidth,
        align: "center",
      });
    if (subtitle) {
      yPos += 24;
      doc
        .fillColor(colors.muted)
        .font("Helvetica")
        .fontSize(10.5)
        .text(subtitle, page.left, yPos, {
          width: contentWidth,
          align: "center",
        });
    }
    yPos += 32;
    doc
      .moveTo(page.left, yPos)
      .lineTo(page.right, yPos)
      .lineWidth(1.2)
      .strokeColor(colors.borderStrong)
      .stroke();
    yPos += 22;

    const patientCardHeight = 86;
    doc
      .roundedRect(page.left, yPos, contentWidth, patientCardHeight, 14)
      .fillAndStroke(colors.pale, colors.border);
    doc
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("PATIENT", page.left + 18, yPos + 14);
    doc
      .fillColor(colors.text)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(`${patient.prenom} ${patient.nom}`, page.left + 18, yPos + 35, {
        width: 220,
      });
    doc
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(9.5)
      .text(
        `Date de naissance : ${this.formatDate(patient.date_naissance)}`,
        page.left + 270,
        yPos + 30,
        { width: 210 },
      )
      .text(
        `Matricule : ${this.cleanText(patient.matricule)}`,
        page.left + 270,
        yPos + 49,
        { width: 210 },
      );
    yPos += patientCardHeight + 24;

    sections.forEach((section) => {
      const rows = (section.rows ?? []).filter(
        (row) => this.cleanText(row.value, "") !== "",
      );
      const body = this.stripMarkdown(this.cleanText(section.body, ""));
      const rowHeight = rows.length > 0 ? rows.length * 19 + 8 : 0;
      const bodyHeight =
        body.length > 0
          ? doc.font("Helvetica").fontSize(10).heightOfString(body, {
              width: contentWidth - 36,
              lineGap: 3,
            }) + 8
          : 0;
      const cardHeight = Math.max(68, 42 + rowHeight + bodyHeight);

      ensureSpace(cardHeight + 14);
      const borderColor =
        section.tone === "attention" ? colors.attention : colors.border;
      const fillColor =
        section.tone === "attention" ? colors.attentionSoft : "#FFFFFF";
      doc
        .roundedRect(page.left, yPos, contentWidth, cardHeight, 12)
        .fillAndStroke(fillColor, borderColor);
      doc
        .fillColor(colors.primary)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(section.title, page.left + 18, yPos + 14, {
          width: contentWidth - 36,
        });

      let sectionY = yPos + 37;
      rows.forEach((row) => {
        doc
          .fillColor(colors.muted)
          .font("Helvetica-Bold")
          .fontSize(8.5)
          .text(row.label.toUpperCase(), page.left + 18, sectionY, {
            width: 140,
          });
        doc
          .fillColor(colors.text)
          .font("Helvetica")
          .fontSize(9.5)
          .text(this.stripMarkdown(this.cleanText(row.value)), page.left + 170, sectionY - 1, {
            width: contentWidth - 188,
          });
        sectionY += 19;
      });

      if (body.length > 0) {
        doc
          .fillColor(colors.text)
          .font("Helvetica")
          .fontSize(10)
          .text(body, page.left + 18, sectionY + 2, {
            width: contentWidth - 36,
            lineGap: 3,
          });
      }

      yPos += cardHeight + 14;
    });

    if (closingText) {
      const closingHeight =
        doc.font("Helvetica").fontSize(10).heightOfString(closingText, {
          width: contentWidth,
          lineGap: 3,
        }) + 18;
      ensureSpace(closingHeight);
      doc
        .fillColor(colors.text)
        .font("Helvetica")
        .fontSize(10)
        .text(closingText, page.left, yPos, {
          width: contentWidth,
          lineGap: 3,
        });
      yPos += closingHeight;
    }

    ensureSpace(118);
    yPos = Math.max(yPos + 18, doc.page.height - 202);
    doc
      .fillColor(colors.text)
      .font("Helvetica")
      .fontSize(10)
      .text("Signature et cachet du médecin", page.right - 210, yPos, {
        width: 210,
        align: "center",
      });
    doc
      .moveTo(page.right - 210, yPos + 58)
      .lineTo(page.right, yPos + 58)
      .lineWidth(1)
      .strokeColor(colors.text)
      .stroke();

    const pageRange = doc.bufferedPageRange();
    for (
      let pageIndex = pageRange.start;
      pageIndex < pageRange.start + pageRange.count;
      pageIndex += 1
    ) {
      doc.switchToPage(pageIndex);
      doc
        .moveTo(page.left, doc.page.height - 54)
        .lineTo(page.right, doc.page.height - 54)
        .lineWidth(0.8)
        .strokeColor(colors.border)
        .stroke();
      doc
        .fillColor(colors.muted)
        .font("Helvetica")
        .fontSize(8)
        .text(
          "Document généré par doctor.com - à vérifier et signer par le médecin.",
          page.left,
          doc.page.height - 40,
          { width: contentWidth - 90 },
        )
        .text(
          `Page ${pageIndex - pageRange.start + 1} / ${pageRange.count}`,
          page.right - 80,
          doc.page.height - 40,
          { width: 80, align: "right" },
        );
    }

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
  }

  private async exporterOrdonnanceAvecTemplatePdf(
    db: DB,
    data: OrdonnanceExportPayload,
    options: { templateId: string; userEmail: string },
  ): Promise<Buffer> {
    const utilisateurId = await this.resolveUtilisateurIdByEmail(
      db,
      options.userEmail,
    );
    const template = await exportRepository.getOrdonnancePdfTemplateForExport(
      db,
      options.templateId,
    );

    if (!template || !template.est_actif) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Le template PDF selectionne est introuvable.",
      });
    }

    if (template.utilisateur_id !== utilisateurId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Vous n'avez pas acces a ce template PDF.",
      });
    }

    const pdfBytes = await this.readStoredFileBuffer(template.chemin_fichier);
    const pdfDoc = await PdfLibDocument.load(pdfBytes);
    const [page] = pdfDoc.getPages();

    if (!page) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Le template PDF ne contient aucune page utilisable.",
      });
    }

    const { height: pageHeight } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const layout = normalizeOrdonnancePdfLayout(template.layout_config);
    const logoImage = await this.embedTemplateImage({
      pdfDoc,
      fileUrl: template.logo_chemin_fichier,
      mimeType: template.logo_type_fichier,
    });
    const patient = this.ensurePatientExportData(data.patient);
    const utilisateur = this.ensureUtilisateurExportData(data.utilisateur);
    const ord = data.ordonnance;
    const doctorFullName = [
      this.cleanText(utilisateur.prenom, ""),
      this.cleanText(utilisateur.nom, ""),
    ]
      .join(" ")
      .trim();
    const doctorDisplayName = doctorFullName
      ? `Dr. ${doctorFullName}`
      : "Dr. Médecin";
    const doctorInitials = doctorFullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
    const medecinText = [doctorDisplayName, "Médecin généraliste"].join("\n");
    const cabinetText = [
      utilisateur.adresse ? `Adresse : ${this.cleanText(utilisateur.adresse)}` : null,
      utilisateur.telephone
        ? `Téléphone : ${this.cleanText(utilisateur.telephone)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const patientText = [
      `${this.cleanText(patient.prenom, "")} ${this.cleanText(patient.nom, "")}`.trim(),
      `Date de naissance : ${this.formatDate(patient.date_naissance)}`,
      `Matricule : ${this.cleanText(patient.matricule)}`,
    ].join("\n");

    const medicamentsText =
      data.medicaments.length > 0
        ? data.medicaments
            .map((medicament, index) => {
              const lines = [
                `${index + 1}. ${this.cleanText(
                  medicament.nom_medicament || medicament.dci,
                  "Medicament",
                )}`,
                medicament.posologie
                  ? `Posologie : ${this.cleanText(medicament.posologie)}`
                  : null,
                medicament.duree_traitement
                  ? `Durée : ${this.cleanText(medicament.duree_traitement)}`
                  : null,
                medicament.dosage
                  ? `Dosage : ${this.cleanText(medicament.dosage)}`
                  : null,
                medicament.instructions
                  ? `Instructions : ${this.cleanText(medicament.instructions)}`
                  : null,
              ].filter(Boolean);

              return lines.join("\n");
            })
            .join("\n\n")
        : "Aucun médicament renseigné.";

    if (logoImage) {
      this.drawMappedImageBlock(
        page,
        logoImage,
        layout.fields.logo_medecin,
        pageHeight,
      );
    } else {
      this.drawMappedLogoBlock(
        page,
        doctorInitials || "Dr",
        layout.fields.logo_medecin,
        pageHeight,
        font,
      );
    }
    this.drawMappedTextBlock(
      page,
      medecinText,
      layout.fields.medecin,
      pageHeight,
      font,
    );
    this.drawMappedTextBlock(
      page,
      cabinetText,
      layout.fields.cabinet,
      pageHeight,
      font,
    );
    this.drawMappedTextBlock(
      page,
      this.formatDate(ord.date_prescription),
      layout.fields.date_prescription,
      pageHeight,
      font,
    );
    this.drawMappedTextBlock(
      page,
      "ORDONNANCE",
      layout.fields.titre,
      pageHeight,
      font,
    );
    this.drawMappedTextBlock(
      page,
      patientText,
      layout.fields.patient,
      pageHeight,
      font,
    );
    this.drawMappedTextBlock(
      page,
      medicamentsText,
      layout.fields.medicaments,
      pageHeight,
      font,
    );
    this.drawMappedTextBlock(
      page,
      this.stripMarkdown(this.cleanText(ord.remarques, "")),
      layout.fields.remarques,
      pageHeight,
      font,
    );
    this.drawMappedTextBlock(
      page,
      "Signature et cachet",
      layout.fields.signature_cachet,
      pageHeight,
      font,
    );

    return Buffer.from(await pdfDoc.save());
  }

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
    doc
      .moveTo(50, doc.page.height - 60)
      .lineTo(550, doc.page.height - 60)
      .stroke();
    doc.fontSize(9).font("Helvetica");
    doc.text(`Page ${currentPage} / ${totalPages}`, 50, doc.page.height - 50);
    doc.text(`Document généré le ${dateStr}`, 50, doc.page.height - 35);
  }

  async exporterOrdonnance(
    db: DB,
    ordonnanceId: string,
    options: { templateId?: string | null; userEmail?: string } = {},
  ): Promise<Buffer> {
    const data = await exportRepository.getOrdonnanceForExport(
      db,
      ordonnanceId,
    );
    if (!data) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Cette ordonnance est introuvable.",
      });
    }

    const { ordonnance: ord, medicaments } = data;
    const patient = this.ensurePatientExportData(data.patient);
    const utilisateur = this.ensureUtilisateurExportData(data.utilisateur);

    if (options.templateId) {
      if (!options.userEmail) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "La session a expiré. Reconnectez-vous.",
        });
      }

      return this.exporterOrdonnanceAvecTemplatePdf(db, data, {
        templateId: options.templateId,
        userEmail: options.userEmail,
      });
    }

    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      bufferPages: true,
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));

    const doctorName = `Dr. ${utilisateur.prenom} ${utilisateur.nom}`;
    const prescDate = new Date(ord.date_prescription);
    const formatDate = (value: Date | string | null | undefined) => {
      if (!value) return "Non renseignée";
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat("fr-DZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
    };
    const cleanText = (value: unknown, fallback = "Non renseigné") => {
      if (value === null || value === undefined) return fallback;
      const normalized = String(value).replace(/\s+/g, " ").trim();
      return normalized || fallback;
    };
    const colors = {
      primary: "#123F6D",
      primarySoft: "#EAF6FF",
      border: "#B8DBEF",
      borderStrong: "#78BDE3",
      text: "#102A43",
      muted: "#5D7285",
      pale: "#F7FCFF",
    };
    const page = {
      left: 54,
      right: doc.page.width - 54,
      top: 42,
      bottom: doc.page.height - 78,
    };
    const contentWidth = page.right - page.left;

    const drawContinuationHeader = () => {
      doc
        .fillColor(colors.primary)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("ORDONNANCE MÉDICALE - SUITE", page.left, page.top, {
          width: contentWidth,
          align: "center",
        });
      doc
        .moveTo(page.left, page.top + 22)
        .lineTo(page.right, page.top + 22)
        .lineWidth(1)
        .strokeColor(colors.border)
        .stroke();
    };

    let yPos = page.top;
    const ensureSpace = (height: number) => {
      if (yPos + height <= page.bottom) return;
      doc.addPage();
      drawContinuationHeader();
      yPos = page.top + 46;
    };

    doc
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .fontSize(17)
      .text(doctorName, page.left, yPos, { width: 300 });
    yPos += 24;
    doc
      .fillColor(colors.text)
      .font("Helvetica")
      .fontSize(9.5)
      .text(`Adresse : ${cleanText(utilisateur.adresse)}`, page.left, yPos, {
        width: 310,
      });
    yPos += 15;
    doc.text(
      `Téléphone : ${cleanText(utilisateur.telephone)}`,
      page.left,
      yPos,
      {
        width: 310,
      },
    );

    doc
      .roundedRect(page.right - 170, page.top, 170, 58, 12)
      .fillAndStroke(colors.primarySoft, colors.border);
    doc
      .fillColor(colors.muted)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("DATE DE PRESCRIPTION", page.right - 154, page.top + 13, {
        width: 138,
        align: "center",
      });
    doc
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(formatDate(prescDate), page.right - 154, page.top + 31, {
        width: 138,
        align: "center",
      });

    yPos = 120;
    doc
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("ORDONNANCE MÉDICALE", page.left, yPos, {
        width: contentWidth,
        align: "center",
      });
    yPos += 34;
    doc
      .moveTo(page.left, yPos)
      .lineTo(page.right, yPos)
      .lineWidth(1.2)
      .strokeColor(colors.borderStrong)
      .stroke();
    yPos += 22;

    doc
      .fillColor(colors.text)
      .font("Helvetica")
      .fontSize(10.5)
      .text(`Alger, le ${formatDate(prescDate)}`, page.left, yPos);
    yPos += 28;

    const patientCardHeight = 78;
    doc
      .roundedRect(page.left, yPos, contentWidth, patientCardHeight, 14)
      .fillAndStroke(colors.pale, colors.border);
    doc
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("PATIENT", page.left + 18, yPos + 14);
    doc
      .fillColor(colors.text)
      .font("Helvetica-Bold")
      .fontSize(11.5)
      .text(`${patient.prenom} ${patient.nom}`, page.left + 18, yPos + 34, {
        width: 220,
      });
    doc
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(9.5)
      .text(
        `Date de naissance : ${formatDate(patient.date_naissance)}`,
        page.left + 270,
        yPos + 30,
        {
          width: 200,
        },
      )
      .text(
        `Matricule : ${cleanText(patient.matricule)}`,
        page.left + 270,
        yPos + 47,
        {
          width: 200,
        },
      );
    yPos += patientCardHeight + 26;

    doc
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("Médicaments prescrits", page.left, yPos);
    yPos += 18;

    medicaments.forEach((med, index) => {
      const medicationLabel = cleanText(
        med.nom_medicament || med.dci,
        "Médicament",
      );
      const details = [
        ["Posologie", med.posologie],
        ["Durée", med.duree_traitement],
        ["Instructions", med.instructions],
      ].filter(([, value]) => cleanText(value, "") !== "");
      const detailWidth = contentWidth - 46;
      const detailsHeight = details.reduce((total, [label, value]) => {
        doc.font("Helvetica").fontSize(9.5);
        return (
          total +
          doc.heightOfString(`${label} : ${cleanText(value)}`, {
            width: detailWidth,
            lineGap: 2,
          }) +
          5
        );
      }, 0);
      const cardHeight = Math.max(74, 42 + detailsHeight);

      ensureSpace(cardHeight + 12);
      doc
        .roundedRect(page.left, yPos, contentWidth, cardHeight, 12)
        .fillAndStroke("#FFFFFF", colors.border);
      doc
        .circle(page.left + 18, yPos + 21, 10)
        .fillAndStroke(colors.primarySoft, colors.borderStrong);
      doc
        .fillColor(colors.primary)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(String(index + 1), page.left + 12.5, yPos + 15.5, {
          width: 11,
          align: "center",
        });
      doc
        .fillColor(colors.text)
        .font("Helvetica-Bold")
        .fontSize(11.5)
        .text(medicationLabel, page.left + 38, yPos + 14, {
          width: contentWidth - 54,
        });

      let detailY = yPos + 38;
      details.forEach(([label, value]) => {
        const text = `${label} : ${cleanText(value)}`;
        const height = doc
          .font("Helvetica")
          .fontSize(9.5)
          .heightOfString(text, { width: detailWidth, lineGap: 2 });
        doc
          .fillColor(colors.text)
          .font("Helvetica")
          .fontSize(9.5)
          .text(text, page.left + 38, detailY, {
            width: detailWidth,
            lineGap: 2,
          });
        detailY += height + 5;
      });

      yPos += cardHeight + 12;
    });

    if (ord.remarques) {
      const remarks = cleanText(ord.remarques);
      const remarksHeight =
        doc
          .font("Helvetica")
          .fontSize(9.5)
          .heightOfString(remarks, {
            width: contentWidth - 36,
            lineGap: 2,
          }) + 46;
      ensureSpace(remarksHeight + 18);
      doc
        .roundedRect(page.left, yPos, contentWidth, remarksHeight, 12)
        .fillAndStroke(colors.pale, colors.border);
      doc
        .fillColor(colors.primary)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("Remarques", page.left + 18, yPos + 14);
      doc
        .fillColor(colors.text)
        .font("Helvetica")
        .fontSize(9.5)
        .text(remarks, page.left + 18, yPos + 32, {
          width: contentWidth - 36,
          lineGap: 2,
        });
      yPos += remarksHeight + 18;
    }

    ensureSpace(118);
    yPos = Math.max(yPos + 18, doc.page.height - 202);
    doc
      .fillColor(colors.text)
      .font("Helvetica")
      .fontSize(10)
      .text("Signature et cachet du médecin", page.right - 210, yPos, {
        width: 210,
        align: "center",
      });
    doc
      .moveTo(page.right - 210, yPos + 58)
      .lineTo(page.right, yPos + 58)
      .lineWidth(1)
      .strokeColor(colors.text)
      .stroke();

    const pageRange = doc.bufferedPageRange();
    for (
      let pageIndex = pageRange.start;
      pageIndex < pageRange.start + pageRange.count;
      pageIndex += 1
    ) {
      doc.switchToPage(pageIndex);
      doc
        .moveTo(page.left, doc.page.height - 54)
        .lineTo(page.right, doc.page.height - 54)
        .lineWidth(0.8)
        .strokeColor(colors.border)
        .stroke();
      doc
        .fillColor(colors.muted)
        .font("Helvetica")
        .fontSize(8)
        .text(
          "Document généré par doctor.com - à vérifier et signer par le médecin.",
          page.left,
          doc.page.height - 40,
          { width: contentWidth - 90 },
        )
        .text(
          `Page ${pageIndex - pageRange.start + 1} / ${pageRange.count}`,
          page.right - 80,
          doc.page.height - 40,
          { width: 80, align: "right" },
        );
    }
    doc.end();

    return new Promise((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
  }

  private formatCertificatType(value: string | null | undefined) {
    const labels: Record<string, string> = {
      arret_travail: "Arrêt de travail",
      aptitude: "Certificat d'aptitude",
      scolaire: "Certificat scolaire",
      grossesse: "Certificat de grossesse",
      deces: "Certificat de décès",
    };

    return labels[value ?? ""] ?? this.cleanText(value, "Certificat médical");
  }

  private formatCertificatStatut(value: string | null | undefined) {
    const labels: Record<string, string> = {
      brouillon: "Brouillon",
      emis: "Émis",
      annule: "Annulé",
    };

    return labels[value ?? ""] ?? this.cleanText(value);
  }

  private formatLettreUrgence(value: string | null | undefined) {
    const labels: Record<string, string> = {
      normale: "Normale",
      urgente: "Urgente",
      tres_urgente: "Très urgente",
    };

    return labels[value ?? ""] ?? this.cleanText(value, "Normale");
  }

  async exporterCertificatMedical(
    db: DB,
    certificatId: string,
  ): Promise<Buffer> {
    const data = await exportRepository.getCertificatForExport(
      db,
      certificatId,
    );
    if (!data) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ce certificat est introuvable.",
      });
    }

    const { certificat: cert } = data;
    const patient = this.ensurePatientExportData(data.patient);
    const utilisateur = this.ensureUtilisateurExportData(data.utilisateur);
    const typeLabel = this.formatCertificatType(cert.type_certificat);
    const statutLabel = this.formatCertificatStatut(cert.statut);
    const periode =
      cert.date_debut || cert.date_fin
        ? `Du ${this.formatDate(cert.date_debut)} au ${this.formatDate(cert.date_fin)}`
        : null;
    const certificateBody = [
      `Je soussigné(e), Dr. ${utilisateur.prenom} ${utilisateur.nom}, certifie avoir examiné le/la patient(e) ${patient.prenom} ${patient.nom}.`,
      cert.diagnostic
        ? `Diagnostic ou motif clinique : ${cert.diagnostic}.`
        : null,
      cert.notes,
    ]
      .filter(Boolean)
      .join("\n\n");

    return this.renderDoctorComClinicalPdf({
      title: "CERTIFICAT MÉDICAL",
      subtitle: typeLabel,
      date: cert.date_emission,
      patient,
      utilisateur,
      sections: [
        {
          title: "Informations du certificat",
          rows: [
            { label: "Type", value: typeLabel },
            { label: "Statut", value: statutLabel },
            { label: "Période", value: periode },
            { label: "Destinataire", value: cert.destinataire },
          ],
        },
        {
          title: "Certificat",
          body: certificateBody,
        },
      ],
      closingText:
        "Ce certificat est établi à la demande de l'intéressé(e) pour servir et valoir ce que de droit.",
    });
  }

  async exporterLettreOrientation(db: DB, lettreId: string): Promise<Buffer> {
    const data = await exportRepository.getLettreForExport(db, lettreId);
    if (!data) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Cette lettre est introuvable.",
      });
    }

    const { lettre } = data;
    const patient = this.ensurePatientExportData(data.patient);
    const utilisateur = this.ensureUtilisateurExportData(data.utilisateur);
    const urgenceLabel = this.formatLettreUrgence(lettre.urgence);

    return this.renderDoctorComClinicalPdf({
      title: "LETTRE D'ORIENTATION",
      subtitle:
        lettre.destinataire || lettre.type_exploration
          ? this.cleanText(
              [lettre.destinataire, lettre.type_exploration]
                .filter(Boolean)
                .join(" - "),
              "Courrier médical",
            )
          : "Courrier médical",
      date: lettre.date_creation,
      patient,
      utilisateur,
      sections: [
        {
          title: "Destinataire et priorité",
          tone:
            lettre.urgence === "urgente" || lettre.urgence === "tres_urgente"
              ? "attention"
              : "default",
          rows: [
            { label: "Destinataire", value: lettre.destinataire },
            { label: "Urgence", value: urgenceLabel },
          ],
        },
        {
          title: "Demande d'orientation",
          rows: [
            { label: "Type", value: lettre.type_exploration },
            { label: "Examen demandé", value: lettre.examen_demande },
          ],
          body: lettre.raison,
        },
        {
          title: "Synthèse médicale",
          body: lettre.contenu_lettre,
        },
      ],
      closingText:
        "Je vous remercie par avance pour votre avis spécialisé et reste disponible pour tout complément d'information.",
    });
  }

  async exporterDossierPatient(db: DB, patientId: string): Promise<Buffer> {
    const data = await exportRepository.getDossierPatientForExport(
      db,
      patientId,
    );
    if (!data) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Le patient demandé est introuvable.",
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

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("Informations Personnelles:", 50, yPos);
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
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(`Ménarche: ${patientFemme.menarche}`, 70, yPos);
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
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("Antécédents Personnels:", 50, yPos);
      yPos += 12;
      antecedentsPersonnels.forEach((ant) => {
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(
            `• ${ant.type}${ant.details ? `: ${ant.details}` : ""}`,
            70,
            yPos,
          );
        yPos += 12;
      });
    }

    if (antecedentsFamiliaux.length > 0) {
      yPos += 10;
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("Antécédents Familiaux:", 50, yPos);
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
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("Traitements Actifs:", 50, yPos);
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
    userEmail: string,
    date: string,
  ): Promise<Buffer> {
    const utilisateurId = await this.resolveUtilisateurIdByEmail(db, userEmail);
    const data = await exportRepository.getAgendaForExport(
      db,
      utilisateurId,
      date,
    );
    if (!data) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Aucune donnée d’agenda n’a été trouvée pour cette date.",
      });
    }

    const { rendezVous } = data;
    const utilisateur = this.ensureUtilisateurExportData(data.utilisateur);

    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));

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
