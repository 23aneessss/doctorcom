import { z } from "zod";

import {
  emailSchema,
  isoDateSchema,
  optionalTrimmedStringSchema,
  telephoneSchema,
  trimmedStringSchema,
  utilisateurRoleSchema,
  uuidSchema,
} from "./common";

const utilisateurMutationShape = {
  nom: trimmedStringSchema.max(255),
  prenom: trimmedStringSchema.max(255),
  email: emailSchema,
  adresse: optionalTrimmedStringSchema,
  telephone: telephoneSchema.optional(),
  mot_de_passe_hash: trimmedStringSchema,
  date_creation: isoDateSchema,
  role: utilisateurRoleSchema,
} satisfies z.ZodRawShape;

export const utilisateurSchema = z.object({
  id: uuidSchema,
  ...utilisateurMutationShape,
});

export const createUtilisateurSchema = z.object(utilisateurMutationShape);

export const updateUtilisateurSchema = createUtilisateurSchema.partial().extend({
  id: uuidSchema,
});
