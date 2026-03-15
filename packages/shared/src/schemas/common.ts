import { z } from "zod";

import {
  antecedent_type_values,
  certificat_medical_statut_values,
  certificat_medical_type_values,
  lettre_orientation_urgence_values,
  rendez_vous_statut_values,
  utilisateur_role_values,
} from "@doctor.com/db/schema";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const isoDateTimeRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const decimalNumberRegex = /^-?\d+(?:\.\d+)?$/;

export const uuidSchema = z.string().uuid();
export const trimmedStringSchema = z.string().trim().min(1);
export const optionalTrimmedStringSchema = trimmedStringSchema.optional();
export const emailSchema = z.string().trim().email().max(255);
export const telephoneSchema = z.string().trim().min(1).max(32);
export const isoDateSchema = z.string().regex(isoDateRegex, "Date invalide. Format attendu: YYYY-MM-DD.");
export const isoDateTimeSchema = z
  .string()
  .regex(isoDateTimeRegex, "Date/heure invalide. Format ISO 8601 avec fuseau requis.");
export const heureSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(?::\d{2})?$/, "Heure invalide. Format attendu: HH:MM ou HH:MM:SS.");
export const integerSchema = z.number().int();
export const nonNegativeIntegerSchema = integerSchema.min(0);
export const numericSchema = z.union([
  z.number(),
  z.string().trim().regex(decimalNumberRegex, "Nombre decimal invalide."),
]);

export const utilisateurRoleSchema = z.enum(utilisateur_role_values);
export const antecedentTypeSchema = z.enum(antecedent_type_values);
export const rendezVousStatutSchema = z.enum(rendez_vous_statut_values);
export const lettreOrientationUrgenceSchema = z.enum(lettre_orientation_urgence_values);
export const certificatMedicalTypeSchema = z.enum(certificat_medical_type_values);
export const certificatMedicalStatutSchema = z.enum(certificat_medical_statut_values);
