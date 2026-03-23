import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { uuidSchema } from "@doctor.com/shared/schemas";
import { exportService } from "./service";

export const exportRouter = createTRPCRouter({
  exporterOrdonnance: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const pdfBuffer = await exportService.exporterOrdonnance(ctx.db, input.id);
      return {
        filename: `ordonnance-${input.id}.pdf`,
        data: pdfBuffer.toString("base64"),
        mimeType: "application/pdf",
      };
    }),

  exporterCertificatMedical: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const pdfBuffer = await exportService.exporterCertificatMedical(
        ctx.db,
        input.id,
      );
      return {
        filename: `certificat-${input.id}.pdf`,
        data: pdfBuffer.toString("base64"),
        mimeType: "application/pdf",
      };
    }),

  exporterLettreOrientation: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const pdfBuffer = await exportService.exporterLettreOrientation(
        ctx.db,
        input.id,
      );
      return {
        filename: `lettre-orientation-${input.id}.pdf`,
        data: pdfBuffer.toString("base64"),
        mimeType: "application/pdf",
      };
    }),

  exporterDossierPatient: protectedProcedure
    .input(z.object({ patientId: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const pdfBuffer = await exportService.exporterDossierPatient(
        ctx.db,
        input.patientId,
      );
      return {
        filename: `dossier-patient-${input.patientId}.pdf`,
        data: pdfBuffer.toString("base64"),
        mimeType: "application/pdf",
      };
    }),

  exporterAgenda: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pdfBuffer = await exportService.exporterAgenda(
        ctx.db,
        ctx.session.user.id,
        input.date,
      );
      return {
        filename: `agenda-${input.date}.pdf`,
        data: pdfBuffer.toString("base64"),
        mimeType: "application/pdf",
      };
    }),
});
