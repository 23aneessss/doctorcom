import { z } from "zod";

import {
  isoDateTimeSchema,
  nonNegativeIntegerSchema,
  optionalTrimmedStringSchema,
  trimmedStringSchema,
  uuidSchema,
} from "./common";

const documentPatientMutationShape = {
  patient_id: uuidSchema,
  categorie_id: uuidSchema,
  type_document: trimmedStringSchema.max(128),
  nom_document: trimmedStringSchema.max(255),
  chemin_fichier: trimmedStringSchema,
  type_fichier: trimmedStringSchema.max(64),
  taille_fichier: nonNegativeIntegerSchema,
  description: optionalTrimmedStringSchema,
  date_upload: isoDateTimeSchema,
  uploade_par_utilisateur: uuidSchema,
  est_archive: z.boolean(),
} satisfies z.ZodRawShape;

export const documentPatientSchema = z.object({
  id: uuidSchema,
  ...documentPatientMutationShape,
});

export const createDocumentPatientSchema = z.object(documentPatientMutationShape);

export const updateDocumentPatientSchema = createDocumentPatientSchema.partial().extend({
  id: uuidSchema,
});
