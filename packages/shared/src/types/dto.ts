import type { z } from "zod";

import type {
  createDocumentPatientSchema,
  createOrdonnanceMedicamentSchema,
  createOrdonnanceSchema,
  createPatientSchema,
  createRendezVousSchema,
  createSuiviSchema,
  createUtilisateurSchema,
  updateDocumentPatientSchema,
  updateOrdonnanceMedicamentSchema,
  updateOrdonnanceSchema,
  updatePatientSchema,
  updateRendezVousSchema,
  updateSuiviSchema,
  updateUtilisateurSchema,
} from "../schemas";

export type CreateUtilisateurInput = z.infer<typeof createUtilisateurSchema>;
export type UpdateUtilisateurInput = z.infer<typeof updateUtilisateurSchema>;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type CreateSuiviInput = z.infer<typeof createSuiviSchema>;
export type UpdateSuiviInput = z.infer<typeof updateSuiviSchema>;
export type CreateRendezVousInput = z.infer<typeof createRendezVousSchema>;
export type UpdateRendezVousInput = z.infer<typeof updateRendezVousSchema>;
export type CreateOrdonnanceInput = z.infer<typeof createOrdonnanceSchema>;
export type UpdateOrdonnanceInput = z.infer<typeof updateOrdonnanceSchema>;
export type CreateOrdonnanceMedicamentInput = z.infer<typeof createOrdonnanceMedicamentSchema>;
export type UpdateOrdonnanceMedicamentInput = z.infer<typeof updateOrdonnanceMedicamentSchema>;
export type CreateDocumentPatientInput = z.infer<typeof createDocumentPatientSchema>;
export type UpdateDocumentPatientInput = z.infer<typeof updateDocumentPatientSchema>;
