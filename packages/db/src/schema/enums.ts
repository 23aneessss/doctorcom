import { pgEnum } from "drizzle-orm/pg-core";

export const utilisateur_role_values = ["medecin", "secretaire", "admin"] as const;
export const antecedent_type_values = ["personnel", "familial"] as const;
export const rendez_vous_statut_values = [
  "planifie",
  "confirme",
  "termine",
  "annule",
  "non_present",
] as const;
export const lettre_orientation_urgence_values = [
  "normale",
  "urgente",
  "tres_urgente",
] as const;
export const certificat_medical_type_values = [
  "arret_travail",
  "aptitude",
  "scolaire",
  "grossesse",
  "deces",
] as const;
export const certificat_medical_statut_values = ["brouillon", "emis", "annule"] as const;
export const historique_traitement_source_values = ["manuel", "ordonnance"] as const;

export const utilisateur_role_enum = pgEnum("utilisateur_role", utilisateur_role_values);
export const antecedent_type_enum = pgEnum("antecedent_type", antecedent_type_values);
export const rendez_vous_statut_enum = pgEnum(
  "rendez_vous_statut",
  rendez_vous_statut_values,
);
export const lettre_orientation_urgence_enum = pgEnum(
  "lettre_orientation_urgence",
  lettre_orientation_urgence_values,
);
export const certificat_medical_type_enum = pgEnum(
  "certificat_medical_type",
  certificat_medical_type_values,
);
export const certificat_medical_statut_enum = pgEnum(
  "certificat_medical_statut",
  certificat_medical_statut_values,
);
export const historique_traitement_source_enum = pgEnum(
  "historique_traitement_source",
  historique_traitement_source_values,
);
