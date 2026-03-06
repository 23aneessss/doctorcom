import { z } from "zod";

import {
  heureSchema,
  isoDateSchema,
  rendezVousStatutSchema,
  uuidSchema,
} from "./common";

const rendezVousMutationShape = {
  patient_id: uuidSchema,
  suivi_id: uuidSchema,
  utilisateur_id: uuidSchema,
  date: isoDateSchema,
  heure: heureSchema,
  statut: rendezVousStatutSchema,
  important: z.boolean(),
} satisfies z.ZodRawShape;

export const rendezVousSchema = z.object({
  id: uuidSchema,
  ...rendezVousMutationShape,
});

export const createRendezVousSchema = z.object(rendezVousMutationShape);

export const updateRendezVousSchema = createRendezVousSchema.partial().extend({
  id: uuidSchema,
});
