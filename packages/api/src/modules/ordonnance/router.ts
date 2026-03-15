import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { ordonnanceService } from "./service";

const uuidSchema = z.string().uuid();
const externalMedicationIdSchema = z.string().trim().min(1);
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide. Format attendu: YYYY-MM-DD.");

const ordonnanceMedicamentInputSchema = z.object({
  medicament_externe_id: externalMedicationIdSchema,
  dosage: z.string().trim().min(1).optional().nullable(),
  posologie: z.string().trim().min(1),
  duree_traitement: z.string().trim().min(1).optional().nullable(),
  instructions: z.string().trim().optional().nullable(),
});

const updateOrdonnanceMedicamentInputSchema = z
  .object({
    medicament_externe_id: externalMedicationIdSchema.optional(),
    dosage: z.string().trim().min(1).optional().nullable(),
    posologie: z.string().trim().min(1).optional(),
    duree_traitement: z.string().trim().min(1).optional().nullable(),
    instructions: z.string().trim().optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ doit etre fourni.",
  });

const createOrdonnanceInputSchema = z.object({
  patient_id: uuidSchema,
  rendez_vous_id: uuidSchema,
  date_prescription: isoDateSchema,
  remarques: z.string().trim().optional().nullable(),
  pre_rempli_origine_id: uuidSchema.optional().nullable(),
  medicaments: z.array(ordonnanceMedicamentInputSchema).min(1),
});

const updateOrdonnanceInputSchema = z
  .object({
    rendez_vous_id: uuidSchema.optional(),
    patient_id: uuidSchema.optional(),
    date_prescription: isoDateSchema.optional(),
    remarques: z.string().trim().optional().nullable(),
    pre_rempli_origine_id: uuidSchema.optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ doit etre fourni.",
  });

const preRempliModificationSchema = z.object({
  medicament_externe_id: externalMedicationIdSchema.optional(),
  nom_medicament: z.string().trim().min(1).optional(),
  ignorer: z.boolean().optional(),
  dosage: z.string().trim().min(1).optional().nullable(),
  posologie: z.string().trim().min(1).optional(),
  duree_traitement: z.string().trim().min(1).optional().nullable(),
  instructions: z.string().trim().optional().nullable(),
});

const createCategorieSchema = z.object({
  nom: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
});

const createPreRempliSchema = z.object({
  nom: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  specialite: z.string().trim().optional().nullable(),
  categorie_pre_rempli_id: uuidSchema,
  est_actif: z.boolean().optional(),
});

const updatePreRempliSchema = z
  .object({
    nom: z.string().trim().min(1).optional(),
    description: z.string().trim().optional().nullable(),
    specialite: z.string().trim().optional().nullable(),
    categorie_pre_rempli_id: uuidSchema.optional(),
    est_actif: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ doit etre fourni.",
  });

const addPreRempliMedicamentSchema = z.object({
  medicament_externe_id: externalMedicationIdSchema,
  dosage: z.string().trim().min(1).optional().nullable(),
  posologie_defaut: z.string().trim().min(1).optional().nullable(),
  duree_defaut: z.string().trim().min(1).optional().nullable(),
  instructions_defaut: z.string().trim().optional().nullable(),
  ordre_affichage: z.number().int().optional().nullable(),
  est_optionnel: z.boolean().optional(),
});

const updatePreRempliMedicamentSchema = z
  .object({
    medicament_externe_id: externalMedicationIdSchema.optional(),
    dosage: z.string().trim().min(1).optional().nullable(),
    posologie_defaut: z.string().trim().min(1).optional().nullable(),
    duree_defaut: z.string().trim().min(1).optional().nullable(),
    instructions_defaut: z.string().trim().optional().nullable(),
    ordre_affichage: z.number().int().optional().nullable(),
    est_optionnel: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ doit etre fourni.",
  });

export const ordonnanceRouter = createTRPCRouter({
  creerOrdonnance: protectedProcedure
    .input(createOrdonnanceInputSchema)
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.creerOrdonnance({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),

  creerOrdonnanceDepuisPreRempli: protectedProcedure
    .input(
      z.object({
        preRempliId: uuidSchema,
        patientId: uuidSchema,
        rendezVousId: uuidSchema,
        modifications: z.array(preRempliModificationSchema).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.creerOrdonnanceDepuisPreRempli({
        db: ctx.db,
        session: ctx.session,
        preRempliId: input.preRempliId,
        patientId: input.patientId,
        rendezVousId: input.rendezVousId,
        modifications: input.modifications,
      });
    }),

  modifierOrdonnance: protectedProcedure
    .input(
      z.object({
        id: uuidSchema,
        data: updateOrdonnanceInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.modifierOrdonnance({
        db: ctx.db,
        session: ctx.session,
        id: input.id,
        input: input.data,
      });
    }),

  supprimerOrdonnance: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.supprimerOrdonnance({
        db: ctx.db,
        id: input.id,
      });
    }),

  ajouterMedicament: protectedProcedure
    .input(
      z.object({
        ordonnanceId: uuidSchema,
        data: ordonnanceMedicamentInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.ajouterMedicament({
        db: ctx.db,
        session: ctx.session,
        ordonnanceId: input.ordonnanceId,
        input: input.data,
      });
    }),

  modifierMedicament: protectedProcedure
    .input(
      z.object({
        ordonnanceMedicamentId: uuidSchema,
        data: updateOrdonnanceMedicamentInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.modifierMedicament({
        db: ctx.db,
        session: ctx.session,
        ordonnanceMedicamentId: input.ordonnanceMedicamentId,
        input: input.data,
      });
    }),

  retirerMedicament: protectedProcedure
    .input(z.object({ ordonnanceMedicamentId: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.retirerMedicament({
        db: ctx.db,
        ordonnanceMedicamentId: input.ordonnanceMedicamentId,
      });
    }),

  renouvelerOrdonnance: protectedProcedure
    .input(
      z.object({
        id: uuidSchema,
        newRendezVousId: uuidSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.renouvelerOrdonnance({
        db: ctx.db,
        session: ctx.session,
        id: input.id,
        newRendezVousId: input.newRendezVousId,
      });
    }),

  getOrdonnanceById: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(async ({ ctx, input }) => {
      return ordonnanceService.getOrdonnanceById({
        db: ctx.db,
        id: input.id,
      });
    }),

  getOrdonnancesByPatient: protectedProcedure
    .input(z.object({ patientId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      return ordonnanceService.getOrdonnancesByPatient({
        db: ctx.db,
        patientId: input.patientId,
      });
    }),

  getOrdonnancesByRendezVous: protectedProcedure
    .input(z.object({ rendezVousId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      return ordonnanceService.getOrdonnancesByRendezVous({
        db: ctx.db,
        rendezVousId: input.rendezVousId,
      });
    }),

  rechercherMedicaments: protectedProcedure
    .input(z.object({ query: z.string().trim().min(1) }))
    .query(async ({ input }) => {
      return ordonnanceService.rechercherMedicaments({
        query: input.query,
      });
    }),

  creerCategorie: protectedProcedure
    .input(createCategorieSchema)
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.creerCategorie({
        db: ctx.db,
        input,
      });
    }),

  mettreAJourCategorie: protectedProcedure
    .input(
      z.object({
        id: uuidSchema,
        data: createCategorieSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.mettreAJourCategorie({
        db: ctx.db,
        id: input.id,
        input: input.data,
      });
    }),

  supprimerCategorie: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.supprimerCategorie({
        db: ctx.db,
        id: input.id,
      });
    }),

  getToutesCategories: protectedProcedure.query(async ({ ctx }) => {
    return ordonnanceService.getToutesCategories({ db: ctx.db });
  }),

  creerPreRempli: protectedProcedure
    .input(createPreRempliSchema)
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.creerPreRempli({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),

  mettreAJourPreRempli: protectedProcedure
    .input(
      z.object({
        id: uuidSchema,
        data: updatePreRempliSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.mettreAJourPreRempli({
        db: ctx.db,
        id: input.id,
        input: input.data,
      });
    }),

  desactiverPreRempli: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.desactiverPreRempli({
        db: ctx.db,
        id: input.id,
      });
    }),

  dupliquerPreRempli: protectedProcedure
    .input(
      z.object({
        id: uuidSchema,
        nouveauNom: z.string().trim().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.dupliquerPreRempli({
        db: ctx.db,
        id: input.id,
        nouveauNom: input.nouveauNom,
      });
    }),

  ajouterMedicamentAuPreRempli: protectedProcedure
    .input(
      z.object({
        preRempliId: uuidSchema,
        data: addPreRempliMedicamentSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.ajouterMedicamentAuPreRempli({
        db: ctx.db,
        preRempliId: input.preRempliId,
        input: input.data,
      });
    }),

  mettreAJourMedicamentDuPreRempli: protectedProcedure
    .input(
      z.object({
        id: uuidSchema,
        data: updatePreRempliMedicamentSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.mettreAJourMedicamentDuPreRempli({
        db: ctx.db,
        id: input.id,
        input: input.data,
      });
    }),

  retirerMedicamentDuPreRempli: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      return ordonnanceService.retirerMedicamentDuPreRempli({
        db: ctx.db,
        id: input.id,
      });
    }),

  getPreRempliById: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(async ({ ctx, input }) => {
      return ordonnanceService.getPreRempliById({
        db: ctx.db,
        id: input.id,
      });
    }),

  getPreRemplisByCategorie: protectedProcedure
    .input(z.object({ categorieId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      return ordonnanceService.getPreRemplisByCategorie({
        db: ctx.db,
        categorieId: input.categorieId,
      });
    }),

  getPreRemplisBySpecialite: protectedProcedure
    .input(z.object({ specialite: z.string().trim().min(1) }))
    .query(async ({ ctx, input }) => {
      return ordonnanceService.getPreRemplisBySpecialite({
        db: ctx.db,
        specialite: input.specialite,
      });
    }),
});
