import { z } from "zod";

import {
  heureSchema,
  isoDateSchema,
  optionalTrimmedStringSchema,
  rendezVousStatutSchema,
  uuidSchema,
} from "./common";

const rendezVousMutationShape = {
  patient_id: uuidSchema,
  suivi_id: uuidSchema.optional().nullable(),
  utilisateur_id: uuidSchema,
  date: isoDateSchema,
  heure: heureSchema,
  statut: rendezVousStatutSchema,
  important: z.boolean(),
  frequence_rappel: optionalTrimmedStringSchema,
  periode_rappel: optionalTrimmedStringSchema,
} satisfies z.ZodRawShape;

export const rendezVousSchema = z.object({
  id: uuidSchema,
  ...rendezVousMutationShape,
});

export const createRendezVousSchema = z.object(rendezVousMutationShape);

export const updateRendezVousSchema = createRendezVousSchema.partial().extend({
  id: uuidSchema,
});
