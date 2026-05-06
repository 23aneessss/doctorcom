import { rendez_vous_statut_values } from "@doctor.com/db/schema";
import { z } from "zod";

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
const mobileSlotStatusSchema = z.enum([
  "booked",
  "pending",
  "completed",
  "cancelled",
  "blocked",
]);
const nullableOptionalTextSchema = z
  .union([z.string().trim().min(1).max(128), z.null()])
  .optional();

const createRendezVousInputSchema = z.object({
  patient_id: uuidSchema,
  suivi_id: uuidSchema.nullable().optional(),
  date: isoDateSchema,
  heure: heureSchema,
  heure_fin: heureSchema.nullable().optional(),
  statut: rendezVousStatutSchema,
  type_creneau: z.string().trim().min(1).max(64).nullable().optional(),
  patient_label: z.string().trim().min(1).max(255).nullable().optional(),
  patient_initials: z.string().trim().min(1).max(16).nullable().optional(),
  couleur: z.string().trim().min(1).max(32).nullable().optional(),
  notes: z.string().trim().min(1).max(5000).nullable().optional(),
  important: z.boolean(),
  frequence_rappel: nullableOptionalTextSchema,
  periode_rappel: nullableOptionalTextSchema,
});

const updateRendezVousInputSchema = createRendezVousInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ doit etre fourni pour modifier le rendez-vous.",
  });

const mobileSlotInputSchema = z.object({
  date: isoDateSchema,
  startTime: heureSchema,
  endTime: heureSchema,
  status: mobileSlotStatusSchema,
  slotType: z.string().trim().min(1).max(64),
  patientInitials: z.string().trim().min(1).max(16).optional(),
  patientLabel: z.string().trim().min(1).max(255).optional(),
  notes: z.string().trim().min(1).max(5000).optional(),
  color: z.string().trim().min(1).max(32).optional().nullable(),
  important: z.boolean().optional(),
});

const mobileSlotUpdateSchema = mobileSlotInputSchema.partial();

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
  envoyerRappelRDV: protectedProcedure
    .input(
      z.object({
        rendezVousId: uuidSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return agendaService.envoyerRappelRDV({
        db: ctx.db,
        rendezVousId: input.rendezVousId,
        userId: ctx.session.user.id,
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
  getSlots: protectedProcedure
    .input(
      z.object({
        startDate: isoDateSchema,
        endDate: isoDateSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      return agendaService.getSlots({
        db: ctx.db,
        session: ctx.session,
        startDate: input.startDate,
        endDate: input.endDate,
      });
    }),
  getDaySlots: protectedProcedure
    .input(
      z.object({
        date: isoDateSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      return agendaService.getDaySlots({
        db: ctx.db,
        session: ctx.session,
        date: input.date,
      });
    }),
  getSlot: protectedProcedure
    .input(
      z.object({
        id: uuidSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      return agendaService.getSlot({
        db: ctx.db,
        session: ctx.session,
        id: input.id,
      });
    }),
  createSlot: protectedProcedure
    .input(mobileSlotInputSchema)
    .mutation(async ({ ctx, input }) => {
      return agendaService.createSlot({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),
  updateSlot: protectedProcedure
    .input(
      z
        .object({
          id: uuidSchema,
        })
        .merge(mobileSlotUpdateSchema)
        .refine((value) => Object.keys(value).length > 1, {
          message: "Au moins un champ doit etre fourni pour mettre a jour le rendez-vous.",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...changes } = input;
      return agendaService.updateSlot({
        db: ctx.db,
        session: ctx.session,
        id,
        input: changes,
      });
    }),
  deleteSlot: protectedProcedure
    .input(
      z.object({
        id: uuidSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return agendaService.deleteSlot({
        db: ctx.db,
        session: ctx.session,
        id: input.id,
      });
    }),
});
