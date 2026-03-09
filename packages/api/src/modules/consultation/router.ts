import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { consultationService } from "./service";

const decimalNumberRegex = /^-?\d+(?:\.\d+)?$/;

const uuidSchema = z.string().uuid();
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide. Format attendu: YYYY-MM-DD.");
const optionalNullableTextSchema = z
  .union([z.string().trim().min(1), z.null()])
  .optional();
const optionalNullableNumericSchema = z
  .union([z.number(), z.string().trim().regex(decimalNumberRegex), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) {
      return value;
    }
    return String(value);
  });

const createSuiviInputSchema = z.object({
  patient_id: uuidSchema,
  hypothese_diagnostic: optionalNullableTextSchema,
  motif: z.string().trim().min(1),
  historique: optionalNullableTextSchema,
  date_ouverture: isoDateSchema,
});

const updateSuiviDataSchema = z
  .object({
    hypothese_diagnostic: optionalNullableTextSchema,
    motif: z.string().trim().min(1).optional(),
    historique: optionalNullableTextSchema,
    date_ouverture: isoDateSchema.optional(),
    date_fermeture: isoDateSchema.nullable().optional(),
    est_actif: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ doit etre fourni pour mettre a jour le suivi.",
  });

const closeSuiviInputSchema = z.object({
  suivi_id: uuidSchema,
  date_fermeture: isoDateSchema.optional(),
});

const patientFilterInputSchema = z.object({
  patient_id: uuidSchema,
});

const createExamenInputSchema = z.object({
  rendez_vous_id: uuidSchema,
  suivi_id: uuidSchema,
  date: isoDateSchema,
  taille: optionalNullableNumericSchema,
  poids: optionalNullableNumericSchema,
  traitement_prescrit: optionalNullableTextSchema,
  description_consultation: optionalNullableTextSchema,
  aspect_general: optionalNullableTextSchema,
  examen_respiratoire: optionalNullableTextSchema,
  examen_cardiovasculaire: optionalNullableTextSchema,
  examen_cutane_muqueux: optionalNullableTextSchema,
  examen_orl: optionalNullableTextSchema,
  examen_digestif: optionalNullableTextSchema,
  examen_neurologique: optionalNullableTextSchema,
  examen_locomoteur: optionalNullableTextSchema,
  examen_genital: optionalNullableTextSchema,
  examen_urinaire: optionalNullableTextSchema,
  examen_ganglionnaire: optionalNullableTextSchema,
  examen_endocrinien: optionalNullableTextSchema,
  conclusion: optionalNullableTextSchema,
});

const updateExamenDataSchema = createExamenInputSchema
  .omit({
    rendez_vous_id: true,
    suivi_id: true,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ doit etre fourni pour mettre a jour l'examen.",
  });

export const consultationRouter = createTRPCRouter({
  createSuivi: protectedProcedure
    .input(createSuiviInputSchema)
    .mutation(async ({ ctx, input }) => {
      return consultationService.createSuivi({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),
  updateSuivi: protectedProcedure
    .input(
      z.object({
        suivi_id: uuidSchema,
        donnees: updateSuiviDataSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return consultationService.updateSuivi({
        db: ctx.db,
        session: ctx.session,
        suivi_id: input.suivi_id,
        input: input.donnees,
      });
    }),
  closeSuivi: protectedProcedure
    .input(closeSuiviInputSchema)
    .mutation(async ({ ctx, input }) => {
      return consultationService.closeSuivi({
        db: ctx.db,
        session: ctx.session,
        suivi_id: input.suivi_id,
        date_fermeture: input.date_fermeture,
      });
    }),
  getPatientSuivis: protectedProcedure
    .input(patientFilterInputSchema)
    .query(async ({ ctx, input }) => {
      return consultationService.getPatientSuivis({
        db: ctx.db,
        session: ctx.session,
        patient_id: input.patient_id,
      });
    }),
  getActiveSuivis: protectedProcedure
    .input(patientFilterInputSchema)
    .query(async ({ ctx, input }) => {
      return consultationService.getActiveSuivis({
        db: ctx.db,
        session: ctx.session,
        patient_id: input.patient_id,
      });
    }),
  createExamen: protectedProcedure
    .input(createExamenInputSchema)
    .mutation(async ({ ctx, input }) => {
      return consultationService.createExamen({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),
  updateExamen: protectedProcedure
    .input(
      z.object({
        examen_id: uuidSchema,
        donnees: updateExamenDataSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return consultationService.updateExamen({
        db: ctx.db,
        session: ctx.session,
        examen_id: input.examen_id,
        input: input.donnees,
      });
    }),
  getExamensSuivi: protectedProcedure
    .input(
      z.object({
        suivi_id: uuidSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      return consultationService.getExamensSuivi({
        db: ctx.db,
        session: ctx.session,
        suivi_id: input.suivi_id,
      });
    }),
  getExamensPatient: protectedProcedure
    .input(patientFilterInputSchema)
    .query(async ({ ctx, input }) => {
      return consultationService.getExamensPatient({
        db: ctx.db,
        session: ctx.session,
        patient_id: input.patient_id,
      });
    }),
});
