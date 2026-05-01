import { z } from "zod";

import {
  isoDateSchema,
  optionalTrimmedStringSchema,
  trimmedStringSchema,
  uuidSchema,
} from "./common";

const suiviMutationShape = {
  patient_id: uuidSchema,
  utilisateur_id: uuidSchema,
  hypothese_diagnostic: optionalTrimmedStringSchema,
  motif: trimmedStringSchema.optional(),
  symptoms: z.array(trimmedStringSchema).optional(),
  historique: optionalTrimmedStringSchema,
  date_ouverture: isoDateSchema,
  date_fermeture: isoDateSchema.optional(),
  est_actif: z.boolean(),
} satisfies z.ZodRawShape;

export const suiviSchema = z.object({
  id: uuidSchema,
  ...suiviMutationShape,
});

const suiviMutationSchema = z.object(suiviMutationShape);

export const createSuiviSchema = suiviMutationSchema.refine(
  (value) => Boolean(value.motif || value.symptoms?.length),
  "At least one symptom is required.",
);

export const updateSuiviSchema = suiviMutationSchema.partial().extend({
  id: uuidSchema,
});
