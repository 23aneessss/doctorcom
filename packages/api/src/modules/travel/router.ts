import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { travelService } from "./service";

const uuidSchema = z.string().uuid();
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide. Format attendu: YYYY-MM-DD.");
const optionalNullableTextSchema = z
  .union([z.string().trim().min(1), z.null()])
  .optional();

const createVoyageInputSchema = z.object({
  patient_id: uuidSchema,
  destination: z.string().trim().min(1).max(255),
  date: isoDateSchema,
  duree_jours: z.number().int().min(0).nullable().optional(),
  epidemies_destination: optionalNullableTextSchema,
});

const updateVoyageDataSchema = z
  .object({
    destination: z.string().trim().min(1).max(255).optional(),
    date: isoDateSchema.optional(),
    duree_jours: z.number().int().min(0).nullable().optional(),
    epidemies_destination: optionalNullableTextSchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ doit etre fourni pour mettre a jour le voyage.",
  });

const patientFilterInputSchema = z.object({
  patient_id: uuidSchema,
});

export const travelRouter = createTRPCRouter({
  createVoyage: protectedProcedure
    .input(createVoyageInputSchema)
    .mutation(async ({ ctx, input }) => {
      return travelService.createVoyage({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),
  updateVoyage: protectedProcedure
    .input(
      z.object({
        voyage_id: uuidSchema,
        donnees: updateVoyageDataSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return travelService.updateVoyage({
        db: ctx.db,
        session: ctx.session,
        voyage_id: input.voyage_id,
        input: input.donnees,
      });
    }),
  deleteVoyage: protectedProcedure
    .input(
      z.object({
        voyage_id: uuidSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return travelService.deleteVoyage({
        db: ctx.db,
        session: ctx.session,
        voyage_id: input.voyage_id,
      });
    }),
  getPatientVoyages: protectedProcedure
    .input(patientFilterInputSchema)
    .query(async ({ ctx, input }) => {
      return travelService.getPatientVoyages({
        db: ctx.db,
        session: ctx.session,
        patient_id: input.patient_id,
      });
    }),
  getRecentPatientVoyages: protectedProcedure
    .input(
      patientFilterInputSchema.extend({
        recent_days: z.number().int().min(1).max(3650).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return travelService.getRecentPatientVoyages({
        db: ctx.db,
        session: ctx.session,
        patient_id: input.patient_id,
        recent_days: input.recent_days,
      });
    }),
});
