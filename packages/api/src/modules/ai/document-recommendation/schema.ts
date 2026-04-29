import { z } from "zod";

// --- Input schemas ---

export const generateOrientationLetterInputSchema = z.object({
  patient_id: z.string().uuid(),
  suivi_id: z.string().uuid(),
  type_exploration: z.string().trim().min(1).max(255),
  examen_demande: z.string().trim().min(1).max(1000),
  destinataire: z.string().trim().min(1).max(255),
  urgence: z.enum(["normale", "urgente", "tres_urgente"]),
  user_instructions: z.string().trim().min(1).max(2000).optional(),
});

export const generateCertificatInputSchema = z.object({
  patient_id: z.string().uuid(),
  suivi_id: z.string().uuid(),
  type_certificat: z.enum([
    "arret_travail",
    "aptitude",
    "scolaire",
    "grossesse",
    "deces",
  ]),
  date_debut: z.string().trim().min(1).max(32).optional(),
  date_fin: z.string().trim().min(1).max(32).optional(),
  destinataire: z.string().trim().min(1).max(255).optional(),
  user_instructions: z.string().trim().min(1).max(2000).optional(),
});

// --- AI output schemas (what the model returns as JSON) ---

export const orientationLetterOutputSchema = z.object({
  contenu_lettre: z.string().trim().min(1).max(8000),
  raison: z.string().trim().min(1).max(2000),
  examen_demande: z.string().trim().min(1).max(1000),
  urgence: z.string().trim().min(1).max(64),
});

export const certificatOutputSchema = z.object({
  contenu_certificat: z.string().trim().min(1).max(8000),
  diagnostic: z.string().trim().min(1).max(2000),
  notes: z.string().trim().min(1).max(2000),
});

// --- TypeScript types ---

export type GenerateOrientationLetterInput = z.infer<typeof generateOrientationLetterInputSchema>;
export type GenerateCertificatInput = z.infer<typeof generateCertificatInputSchema>;
export type OrientationLetterOutput = z.infer<typeof orientationLetterOutputSchema>;
export type CertificatOutput = z.infer<typeof certificatOutputSchema>;
