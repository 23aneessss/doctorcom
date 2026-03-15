import { z } from "zod";

import {
  isoDateSchema,
  optionalTrimmedStringSchema,
  trimmedStringSchema,
  uuidSchema,
} from "./common";

const ordonnanceMedicamentMutationShape = {
  medicament_id: uuidSchema,
  posologie: trimmedStringSchema,
  duree_traitement: optionalTrimmedStringSchema,
  instructions: optionalTrimmedStringSchema,
} satisfies z.ZodRawShape;

const ordonnanceMutationShape = {
  rendez_vous_id: uuidSchema,
  patient_id: uuidSchema,
  utilisateur_id: uuidSchema,
  remarques: optionalTrimmedStringSchema,
  date_prescription: isoDateSchema,
} satisfies z.ZodRawShape;

export const ordonnanceMedicamentSchema = z.object({
  id: uuidSchema,
  ordonnance_id: uuidSchema,
  ...ordonnanceMedicamentMutationShape,
});

export const createOrdonnanceMedicamentSchema = z.object(ordonnanceMedicamentMutationShape);

export const updateOrdonnanceMedicamentSchema = createOrdonnanceMedicamentSchema
  .partial()
  .extend({
    id: uuidSchema,
    ordonnance_id: uuidSchema.optional(),
  });

export const ordonnanceSchema = z.object({
  id: uuidSchema,
  ...ordonnanceMutationShape,
  items: z.array(ordonnanceMedicamentSchema),
});

export const createOrdonnanceSchema = z.object({
  ...ordonnanceMutationShape,
  items: z.array(createOrdonnanceMedicamentSchema).min(1),
});

export const updateOrdonnanceSchema = createOrdonnanceSchema.partial().extend({
  id: uuidSchema,
});
