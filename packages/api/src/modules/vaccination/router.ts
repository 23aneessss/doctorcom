import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { vaccinationService } from "./service";

const uuidSchema = z.string().uuid();
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide. Format attendu: YYYY-MM-DD.");
const optionalNullableTextSchema = z
  .union([z.string().trim().min(1), z.null()])
  .optional();

const recordVaccinationInputSchema = z.object({
  patient_id: uuidSchema,
  vaccin: z.string().trim().min(1).max(255),
  date_vaccination: isoDateSchema,
  notes: optionalNullableTextSchema,
});

const updateVaccinationDataSchema = z
  .object({
    vaccin: z.string().trim().min(1).max(255).optional(),
    date_vaccination: isoDateSchema.optional(),
    notes: optionalNullableTextSchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ doit etre fourni pour mettre a jour la vaccination.",
  });

const patientFilterInputSchema = z.object({
  patient_id: uuidSchema,
});

export const vaccinationRouter = createTRPCRouter({
  recordVaccination: protectedProcedure
    .input(recordVaccinationInputSchema)
    .mutation(async ({ ctx, input }) => {
      return vaccinationService.recordVaccination({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),
  updateVaccination: protectedProcedure
    .input(
      z.object({
        vaccination_id: uuidSchema,
        donnees: updateVaccinationDataSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return vaccinationService.updateVaccination({
        db: ctx.db,
        session: ctx.session,
        vaccination_id: input.vaccination_id,
        input: input.donnees,
      });
    }),
  deleteVaccination: protectedProcedure
    .input(
      z.object({
        vaccination_id: uuidSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return vaccinationService.deleteVaccination({
        db: ctx.db,
        session: ctx.session,
        vaccination_id: input.vaccination_id,
      });
    }),
  getPatientVaccinations: protectedProcedure
    .input(patientFilterInputSchema)
    .query(async ({ ctx, input }) => {
      return vaccinationService.getPatientVaccinations({
        db: ctx.db,
        session: ctx.session,
        patient_id: input.patient_id,
      });
    }),
});
