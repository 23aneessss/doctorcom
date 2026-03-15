import { antecedent_type_values } from "@doctor.com/db/schema";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { medicalHistoryService } from "./service";

const uuidSchema = z.string().uuid();
const antecedentTypeSchema = z.enum(antecedent_type_values);
const optionalNullableTextSchema = z
  .union([z.string().trim().min(1), z.null()])
  .optional();

const personalAntecedentInputSchema = z.object({
  type: z.string().trim().min(1).max(255),
  details: optionalNullableTextSchema,
  est_actif: z.boolean().optional(),
});

const familyAntecedentInputSchema = z.object({
  details: optionalNullableTextSchema,
  lien_parente: z.union([z.string().trim().min(1).max(128), z.null()]).optional(),
});

const ajouterAntecedentInputSchema = z
  .object({
    patient_id: uuidSchema,
    type: antecedentTypeSchema,
    description: z.string().trim().min(1),
    personnel: personalAntecedentInputSchema.optional(),
    familial: familyAntecedentInputSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "personnel" && !value.personnel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Les donnees d'antecedent personnel sont obligatoires.",
        path: ["personnel"],
      });
    }

    if (value.type === "familial" && !value.familial) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Les donnees d'antecedent familial sont obligatoires.",
        path: ["familial"],
      });
    }
  });

const updatePersonalAntecedentDataSchema = z
  .object({
    type: z.string().trim().min(1).max(255).optional(),
    details: optionalNullableTextSchema,
    est_actif: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ personnel doit etre fourni.",
  });

const updateFamilyAntecedentDataSchema = z
  .object({
    details: optionalNullableTextSchema,
    lien_parente: z.union([z.string().trim().min(1).max(128), z.null()]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ familial doit etre fourni.",
  });

const mettreAJourAntecedentInputSchema = z
  .object({
    type: antecedentTypeSchema.optional(),
    description: z.string().trim().min(1).optional(),
    personnel: updatePersonalAntecedentDataSchema.optional(),
    familial: updateFamilyAntecedentDataSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ doit etre fourni pour mettre a jour l'antecedent.",
  });

export const medicalHistoryRouter = createTRPCRouter({
  ajouterAntecedent: protectedProcedure
    .input(ajouterAntecedentInputSchema)
    .mutation(async ({ ctx, input }) => {
      return medicalHistoryService.ajouterAntecedent({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),
  mettreAJourAntecedent: protectedProcedure
    .input(
      z.object({
        antecedent_id: uuidSchema,
        donnees: mettreAJourAntecedentInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return medicalHistoryService.mettreAJourAntecedent({
        db: ctx.db,
        session: ctx.session,
        antecedent_id: input.antecedent_id,
        input: input.donnees,
      });
    }),
  supprimerAntecedent: protectedProcedure
    .input(
      z.object({
        antecedent_id: uuidSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return medicalHistoryService.supprimerAntecedent({
        db: ctx.db,
        session: ctx.session,
        antecedent_id: input.antecedent_id,
      });
    }),
  getAntecedentsPatient: protectedProcedure
    .input(
      z.object({
        patient_id: uuidSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      return medicalHistoryService.getAntecedentsPatient({
        db: ctx.db,
        session: ctx.session,
        patient_id: input.patient_id,
      });
    }),
  getAntecedentsPersonnels: protectedProcedure
    .input(
      z.object({
        antecedent_id: uuidSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      return medicalHistoryService.getAntecedentsPersonnels({
        db: ctx.db,
        session: ctx.session,
        antecedent_id: input.antecedent_id,
      });
    }),
  getAntecedentsFamiliaux: protectedProcedure
    .input(
      z.object({
        antecedent_id: uuidSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      return medicalHistoryService.getAntecedentsFamiliaux({
        db: ctx.db,
        session: ctx.session,
        antecedent_id: input.antecedent_id,
      });
    }),
  marquerAntecedentPersonnelInactif: protectedProcedure
    .input(
      z.object({
        antecedent_personnel_id: uuidSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return medicalHistoryService.marquerAntecedentPersonnelInactif({
        db: ctx.db,
        session: ctx.session,
        antecedent_personnel_id: input.antecedent_personnel_id,
      });
    }),
  mettreAJourDetailsAntecedentPersonnel: protectedProcedure
    .input(
      z.object({
        antecedent_personnel_id: uuidSchema,
        details: z.union([z.string().trim().min(1), z.null()]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return medicalHistoryService.mettreAJourDetailsAntecedentPersonnel({
        db: ctx.db,
        session: ctx.session,
        antecedent_personnel_id: input.antecedent_personnel_id,
        details: input.details,
      });
    }),
  mettreAJourLienParente: protectedProcedure
    .input(
      z.object({
        antecedent_familial_id: uuidSchema,
        lien_parente: z.union([z.string().trim().min(1).max(128), z.null()]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return medicalHistoryService.mettreAJourLienParente({
        db: ctx.db,
        session: ctx.session,
        antecedent_familial_id: input.antecedent_familial_id,
        lien_parente: input.lien_parente,
      });
    }),
});
