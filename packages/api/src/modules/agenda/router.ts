import { rendez_vous_statut_values } from "@doctor.com/db/schema";import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { agendaService } from "./service";

const uuidSchema = z.string().uuid();
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide. Format attendu: YYYY-MM-DD.");
const heureSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(?::\d{2})?$/, "Heure invalide. Format attendu: HH:MM ou HH:MM:SS.");
const rendezVousStatutSchema = z.enum(rendez_vous_statut_values);
const nullableOptionalTextSchema = z
  .union([z.string().trim().min(1).max(128), z.null()])
  .optional();

const createRendezVousInputSchema = z.object({
  patient_id: uuidSchema,
  suivi_id: uuidSchema.nullable().optional(),
  date: isoDateSchema,
  heure: heureSchema,
  statut: rendezVousStatutSchema,
  important: z.boolean(),
  frequence_rappel: nullableOptionalTextSchema,
  periode_rappel: nullableOptionalTextSchema,
});

const updateRendezVousInputSchema = createRendezVousInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ doit etre fourni pour modifier le rendez-vous.",
  });

export const agendaRouter = createTRPCRouter({
  planifierRDV: protectedProcedure
    .input(createRendezVousInputSchema)
    .mutation(async ({ ctx, input }) => {
      return agendaService.planifierRDV({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),
  modifierRDV: protectedProcedure
    .input(
      z.object({
        rdv_id: uuidSchema,
        donnees: updateRendezVousInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return agendaService.modifierRDV({
        db: ctx.db,
        session: ctx.session,
        rdv_id: input.rdv_id,
        input: input.donnees,
      });
    }),
  annulerRDV: protectedProcedure
    .input(
      z.object({
        rdv_id: uuidSchema,
        raison: z.string().trim().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return agendaService.annulerRDV({
        db: ctx.db,
        session: ctx.session,
        rdv_id: input.rdv_id,
        raison: input.raison,
      });
    }),
  confirmerRDV: protectedProcedure
    .input(
      z.object({
        rdv_id: uuidSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return agendaService.confirmerRDV({
        db: ctx.db,
        session: ctx.session,
        rdv_id: input.rdv_id,
      });
    }),
  consulterListeRDV: protectedProcedure
    .input(
      z.object({
        date: isoDateSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      return agendaService.consulterListeRDV({
        db: ctx.db,
        session: ctx.session,
        date: input.date,
      });
    }),
  getRDVParPatient: protectedProcedure
    .input(
      z.object({
        patient_id: uuidSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      return agendaService.getRDVParPatient({
        db: ctx.db,
        session: ctx.session,
        patient_id: input.patient_id,
      });
    }),
  getRDVParDate: protectedProcedure
    .input(
      z.object({
        date: isoDateSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      return agendaService.getRDVParDate({
        db: ctx.db,
        session: ctx.session,
        date: input.date,
      });
    }),
  getRDVParStatut: protectedProcedure
    .input(
      z.object({
        statut: rendezVousStatutSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      return agendaService.getRDVParStatut({
        db: ctx.db,
        session: ctx.session,
        statut: input.statut,
      });
    }),
  verifierDisponibilite: protectedProcedure
    .input(
      z.object({
        date: isoDateSchema,
        heure: heureSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      return agendaService.verifierDisponibilite({
        db: ctx.db,
        session: ctx.session,
        date: input.date,
        heure: input.heure,
      });
    }),
  envoyerNotificationRappel: protectedProcedure
    .input(
      z.object({
        rdv_id: uuidSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return agendaService.envoyerNotificationRappel({
        db: ctx.db,
        session: ctx.session,
        rdv_id: input.rdv_id,
      });
    }),
  getRDVAujourdhui: protectedProcedure.query(async ({ ctx }) => {
    return agendaService.getRDVAujourdhui({
      db: ctx.db,
      session: ctx.session,
    });
  }),
  getProchainsRDV: protectedProcedure
    .input(
      z.object({
        jours: z.number().int().min(1).max(365),
      }),
    )
    .query(async ({ ctx, input }) => {
      return agendaService.getProchainsRDV({
        db: ctx.db,
        session: ctx.session,
        jours: input.jours,
      });
    }),
  marquerImportant: protectedProcedure
    .input(
      z.object({
        rdv_id: uuidSchema,
        important: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return agendaService.marquerImportant({
        db: ctx.db,
        session: ctx.session,
        rdv_id: input.rdv_id,
        important: input.important,
      });
    }),
});
