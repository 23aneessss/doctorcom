import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { treatmentService } from "./service";

const uuidSchema = z.string().uuid();
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide. Format attendu: YYYY-MM-DD.");

const startTreatmentInputSchema = z.object({
  patient_id: uuidSchema,
  medicament_id: uuidSchema,
  posologie: z.string().trim().min(1),
  date_prescription: isoDateSchema,
  est_actif: z.boolean().optional(),
});

const updateTreatmentDataSchema = z
  .object({
    medicament_id: uuidSchema.optional(),
    posologie: z.string().trim().min(1).optional(),
    date_prescription: isoDateSchema.optional(),
    est_actif: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ doit etre fourni pour mettre a jour le traitement.",
  });

const patientFilterInputSchema = z.object({
  patient_id: uuidSchema,
});

export const treatmentRouter = createTRPCRouter({
  startTreatment: protectedProcedure
    .input(startTreatmentInputSchema)
    .mutation(async ({ ctx, input }) => {
      return treatmentService.startTreatment({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),
  updateTreatment: protectedProcedure
    .input(
      z.object({
        treatment_id: uuidSchema,
        donnees: updateTreatmentDataSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return treatmentService.updateTreatment({
        db: ctx.db,
        session: ctx.session,
        treatment_id: input.treatment_id,
        input: input.donnees,
      });
    }),
  stopTreatment: protectedProcedure
    .input(
      z.object({
        treatment_id: uuidSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return treatmentService.stopTreatment({
        db: ctx.db,
        session: ctx.session,
        treatment_id: input.treatment_id,
      });
    }),
  getPatientTreatments: protectedProcedure
    .input(patientFilterInputSchema)
    .query(async ({ ctx, input }) => {
      return treatmentService.getPatientTreatments({
        db: ctx.db,
        session: ctx.session,
        patient_id: input.patient_id,
      });
    }),
  getActivePatientTreatments: protectedProcedure
    .input(patientFilterInputSchema)
    .query(async ({ ctx, input }) => {
      return treatmentService.getActivePatientTreatments({
        db: ctx.db,
        session: ctx.session,
        patient_id: input.patient_id,
      });
    }),
});
