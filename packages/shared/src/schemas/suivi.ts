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
  motif: trimmedStringSchema,
  historique: optionalTrimmedStringSchema,
  date_ouverture: isoDateSchema,
  date_fermeture: isoDateSchema.optional(),
  est_actif: z.boolean(),
} satisfies z.ZodRawShape;

export const suiviSchema = z.object({
  id: uuidSchema,
  ...suiviMutationShape,
});

export const createSuiviSchema = z.object(suiviMutationShape);

export const updateSuiviSchema = createSuiviSchema.partial().extend({
  id: uuidSchema,
});
