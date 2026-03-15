export const ERROR_CODES = {
  ACCES_INTERDIT: "ACCES_INTERDIT",
  AUTHENTIFICATION_REQUISE: "AUTHENTIFICATION_REQUISE",
  CONFLIT_DONNEES: "CONFLIT_DONNEES",
  ERREUR_BASE_DONNEES: "ERREUR_BASE_DONNEES",
  ERREUR_INTERNE: "ERREUR_INTERNE",
  RESSOURCE_INTROUVABLE: "RESSOURCE_INTROUVABLE",
  VALIDATION: "VALIDATION",
} as const;

export type AppErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  ACCES_INTERDIT: "Acces interdit.",
  AUTHENTIFICATION_REQUISE: "Authentification requise.",
  CONFLIT_DONNEES: "Conflit detecte avec les donnees existantes.",
  ERREUR_BASE_DONNEES: "Erreur lors de l'acces a la base de donnees.",
  ERREUR_INTERNE: "Une erreur interne est survenue.",
  RESSOURCE_INTROUVABLE: "Ressource introuvable.",
  VALIDATION: "Les donnees fournies sont invalides.",
};

export function getErrorMessage(code: AppErrorCode): string {
  return ERROR_MESSAGES[code];
}
