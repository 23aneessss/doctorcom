import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { medicamentsService } from "./service";

const positiveIntSchema = z.coerce.number().int().positive();
const optionalTrimmedStringSchema = z.string().trim().min(1).optional().nullable();

const substanceSchema = z.object({
  nom_substance: z.string().trim().min(1),
});

const indicationSchema = z.object({
  indication: z.string().trim().min(1),
});

const descriptionSchema = z.object({
  description: z.string().trim().min(1),
});

const interactionSchema = z.object({
  medicament_interaction: z.string().trim().min(1),
});

const effetIndesirableSchema = z.object({
  frequence: optionalTrimmedStringSchema,
  effet: z.string().trim().min(1),
});

const presentationSchema = z.object({
  forme: optionalTrimmedStringSchema,
  dosage: optionalTrimmedStringSchema,
});

const medicamentBaseSchema = z.object({
  nom_medicament: z.string().trim().min(1),
  nom_generique: optionalTrimmedStringSchema,
  classe_therapeutique: optionalTrimmedStringSchema,
  famille_pharmacologique: optionalTrimmedStringSchema,
  posologie_adulte: optionalTrimmedStringSchema,
  posologie_enfant: optionalTrimmedStringSchema,
  dose_maximale: optionalTrimmedStringSchema,
  frequence_administration: optionalTrimmedStringSchema,
  grossesse: optionalTrimmedStringSchema,
  allaitement: optionalTrimmedStringSchema,
  substances_actives: z.array(substanceSchema).optional(),
  indications: z.array(indicationSchema).optional(),
  contre_indications: z.array(descriptionSchema).optional(),
  precautions: z.array(descriptionSchema).optional(),
  interactions: z.array(interactionSchema).optional(),
  effets_indesirables: z.array(effetIndesirableSchema).optional(),
  presentations: z.array(presentationSchema).optional(),
});

const updateMedicamentSchema = medicamentBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ doit etre fourni.",
  });

const searchMedicamentsSchema = z.object({
  query: optionalTrimmedStringSchema,
  classe_therapeutique: optionalTrimmedStringSchema,
  famille_pharmacologique: optionalTrimmedStringSchema,
  grossesse: optionalTrimmedStringSchema,
  allaitement: optionalTrimmedStringSchema,
  nom_substance: optionalTrimmedStringSchema,
  indication: optionalTrimmedStringSchema,
  contre_indication: optionalTrimmedStringSchema,
  precaution: optionalTrimmedStringSchema,
  interaction: optionalTrimmedStringSchema,
  forme: optionalTrimmedStringSchema,
  dosage: optionalTrimmedStringSchema,
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(20),
});

export const medicamentsRouter = createTRPCRouter({
  creerMedicament: protectedProcedure
    .input(medicamentBaseSchema)
    .mutation(async ({ input }) => {
      return medicamentsService.creerMedicament(input);
    }),

  mettreAJourMedicament: protectedProcedure
    .input(
      z.object({
        id: positiveIntSchema,
        data: updateMedicamentSchema,
      }),
    )
    .mutation(async ({ input }) => {
      return medicamentsService.mettreAJourMedicament(input.id, input.data);
    }),

  supprimerMedicament: protectedProcedure
    .input(z.object({ id: positiveIntSchema }))
    .mutation(async ({ input }) => {
      return medicamentsService.supprimerMedicament(input.id);
    }),

  getMedicamentById: protectedProcedure
    .input(z.object({ id: positiveIntSchema }))
    .query(async ({ input }) => {
      return medicamentsService.getMedicamentById(input.id);
    }),

  rechercherMedicaments: protectedProcedure
    .input(searchMedicamentsSchema)
    .query(async ({ input }) => {
      return medicamentsService.rechercherMedicaments({
        query: input.query ?? undefined,
        classe_therapeutique: input.classe_therapeutique ?? undefined,
        famille_pharmacologique: input.famille_pharmacologique ?? undefined,
        grossesse: input.grossesse ?? undefined,
        allaitement: input.allaitement ?? undefined,
        nom_substance: input.nom_substance ?? undefined,
        indication: input.indication ?? undefined,
        contre_indication: input.contre_indication ?? undefined,
        precaution: input.precaution ?? undefined,
        interaction: input.interaction ?? undefined,
        forme: input.forme ?? undefined,
        dosage: input.dosage ?? undefined,
        page: input.page,
        page_size: input.page_size,
      });
    }),
});
