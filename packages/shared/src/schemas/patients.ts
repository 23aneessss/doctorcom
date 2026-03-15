import { z } from "zod";

import {
  emailSchema,
  isoDateSchema,
  nonNegativeIntegerSchema,
  numericSchema,
  optionalTrimmedStringSchema,
  telephoneSchema,
  trimmedStringSchema,
  uuidSchema,
} from "./common";

const patientMutationShape = {
  nom: trimmedStringSchema.max(255),
  prenom: trimmedStringSchema.max(255),
  telephone: telephoneSchema.optional(),
  email: emailSchema.optional(),
  matricule: trimmedStringSchema.max(128),
  date_naissance: isoDateSchema,
  nss: nonNegativeIntegerSchema.optional(),
  lieu_naissance: optionalTrimmedStringSchema,
  sexe: optionalTrimmedStringSchema,
  nationalite: optionalTrimmedStringSchema,
  groupe_sanguin: optionalTrimmedStringSchema,
  adresse: optionalTrimmedStringSchema,
  profession: optionalTrimmedStringSchema,
  habitudes_saines: optionalTrimmedStringSchema,
  habitudes_toxiques: optionalTrimmedStringSchema,
  nb_enfants: nonNegativeIntegerSchema.optional(),
  situation_familiale: optionalTrimmedStringSchema,
  age_circoncision: nonNegativeIntegerSchema.optional(),
  date_admission: isoDateSchema.optional(),
  environnement_animal: optionalTrimmedStringSchema,
  revenu_mensuel: numericSchema.optional(),
  taille_menage: nonNegativeIntegerSchema.optional(),
  nb_pieces: nonNegativeIntegerSchema.optional(),
  niveau_intellectuel: optionalTrimmedStringSchema,
  activite_sexuelle: z.boolean().optional(),
  relations_environnement: optionalTrimmedStringSchema,
  cree_par_utilisateur: uuidSchema,
} satisfies z.ZodRawShape;

export const patientSchema = z.object({
  id: uuidSchema,
  ...patientMutationShape,
});

export const createPatientSchema = z.object(patientMutationShape);

export const updatePatientSchema = createPatientSchema.partial().extend({
  id: uuidSchema,
});
