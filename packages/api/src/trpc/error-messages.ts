const sessionMessage = "La session a expiré. Reconnectez-vous.";
const genericInternalMessage =
  "La demande n’a pas pu être traitée pour le moment.";
const genericBadRequestMessage =
  "La demande n’a pas pu être analysée correctement. Vérifie les informations saisies.";

type RuntimeErrorCode =
  | "BAD_REQUEST"
  | "CONFLICT"
  | "INTERNAL_SERVER_ERROR"
  | "NOT_FOUND"
  | "PARSE_ERROR"
  | "PRECONDITION_FAILED"
  | "TIMEOUT"
  | "UNAUTHORIZED"
  | string;

interface RuntimeErrorMessageInput {
  code?: RuntimeErrorCode;
  message?: string | null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function matchesAny(message: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message));
}

function normalizeEntityNotFound(message: string): string | null {
  const mappings: Array<{ patterns: RegExp[]; normalized: string }> = [
    {
      patterns: [/patient introuvable/i, /patient not found/i],
      normalized: "Le patient demandé est introuvable.",
    },
    {
      patterns: [/suivi introuvable/i],
      normalized: "Le suivi demandé est introuvable.",
    },
    {
      patterns: [/examen de consultation introuvable/i, /examen introuvable/i],
      normalized: "L'examen demandé est introuvable.",
    },
    {
      patterns: [/ordonnance introuvable/i, /ordonnance not found/i],
      normalized: "Cette ordonnance est introuvable.",
    },
    {
      patterns: [/rendez-vous introuvable/i, /rdv introuvable/i],
      normalized: "Ce rendez-vous est introuvable.",
    },
    {
      patterns: [/document introuvable/i, /document not found/i],
      normalized: "Ce document n’a pas été trouvé.",
    },
    {
      patterns: [/lettre introuvable/i, /lettre d'orientation not found/i],
      normalized: "Cette lettre est introuvable.",
    },
    {
      patterns: [/certificat introuvable/i, /certificat médical not found/i],
      normalized: "Ce certificat est introuvable.",
    },
    {
      patterns: [/categorie introuvable/i],
      normalized: "La catégorie demandée est introuvable.",
    },
    {
      patterns: [/traitement introuvable/i],
      normalized: "Ce traitement est introuvable.",
    },
    {
      patterns: [/antecedent introuvable/i],
      normalized: "L’antécédent demandé est introuvable.",
    },
    {
      patterns: [/vaccin.*introuvable/i, /vaccination.*introuvable/i],
      normalized: "La vaccination demandée est introuvable.",
    },
    {
      patterns: [/voyage recent introuvable/i, /voyage introuvable/i],
      normalized: "Ce voyage est introuvable.",
    },
    {
      patterns: [/agenda data not found/i],
      normalized: "Aucune donnée d’agenda n’a été trouvée pour cette date.",
    },
    {
      patterns: [/utilisateur introuvable/i, /utilisateur not found/i],
      normalized: "Le compte associé à cette session est introuvable.",
    },
  ];

  const found = mappings.find((entry) => matchesAny(message, entry.patterns));
  return found?.normalized ?? null;
}

function normalizeBadRequestMessage(message: string): string | null {
  if (
    matchesAny(message, [
      /session invalide/i,
      /email utilisateur manquant/i,
      /email utilisateur introuvable dans la session/i,
      /utilisateur .*session/i,
      /authentification requise/i,
      /unauthorized/i,
    ])
  ) {
    return sessionMessage;
  }

  if (
    matchesAny(message, [
      /json/i,
      /schema/i,
      /constraint/i,
      /format/i,
      /invalid/i,
      /missing/i,
      /parse/i,
    ])
  ) {
    return genericBadRequestMessage;
  }

  if (matchesAny(message, [/aucun champ valide fourni/i, /au moins un champ/i])) {
    return "Au moins une information valable est attendue pour cette action.";
  }

  if (matchesAny(message, [/obligatoire/i, /requis/i])) {
    return "Certaines informations obligatoires sont manquantes ou incomplètes.";
  }

  return null;
}

function normalizeConflictMessage(message: string): string | null {
  if (matchesAny(message, [/existe deja/i])) {
    return "Une donnée identique existe déjà.";
  }

  if (matchesAny(message, [/deja occupe/i, /deja pour ce creneau/i])) {
    return "Ce créneau est déjà occupé.";
  }

  return null;
}

function normalizeInternalMessage(message: string): string | null {
  if (
    matchesAny(message, [
      /json/i,
      /schema/i,
      /constraint/i,
      /provider/i,
      /shortlist/i,
      /modele ai/i,
      /service ai/i,
      /gemini/i,
    ])
  ) {
    return "Aucune réponse fiable n’a pu être produite pour le moment.";
  }

  if (matchesAny(message, [/invalid minio url format/i, /minio/i, /stockage/i])) {
    return "Le service de stockage n’est pas disponible correctement pour le moment.";
  }

  if (matchesAny(message, [/not found/i, /invalid/i, /missing/i, /failed/i])) {
    return genericInternalMessage;
  }

  return null;
}

function cleanupReadableFrenchMessage(message: string): string {
  if (matchesAny(message, [/patient introuvable\./i])) {
    return "Le patient demandé est introuvable.";
  }

  if (matchesAny(message, [/suivi introuvable\./i])) {
    return "Le suivi demandé est introuvable.";
  }

  if (matchesAny(message, [/document introuvable\./i])) {
    return "Ce document n’a pas été trouvé.";
  }

  if (matchesAny(message, [/ordonnance introuvable\./i])) {
    return "Cette ordonnance est introuvable.";
  }

  if (matchesAny(message, [/ordonnance ne peut etre creee que pour un rendez-vous termine/i])) {
    return "Une ordonnance ne peut être créée que pour un rendez-vous terminé.";
  }

  if (matchesAny(message, [/authentification requise\./i])) {
    return sessionMessage;
  }

  return message;
}

export function toSimpleFrenchRuntimeMessage(
  input: RuntimeErrorMessageInput,
): string {
  const code = input.code;
  const rawMessage = normalizeWhitespace(input.message ?? "");

  if (!rawMessage) {
    switch (code) {
      case "UNAUTHORIZED":
        return sessionMessage;
      case "NOT_FOUND":
        return "L’élément demandé est introuvable.";
      case "CONFLICT":
        return "Cette action ne peut pas être effectuée dans l’état actuel.";
      case "TIMEOUT":
        return "Le serveur met trop de temps à répondre. Réessaie dans un instant.";
      case "PRECONDITION_FAILED":
        return "Cette action ne peut pas être effectuée dans l’état actuel.";
      case "BAD_REQUEST":
      case "PARSE_ERROR":
        return genericBadRequestMessage;
      default:
        return genericInternalMessage;
    }
  }

  if (code === "UNAUTHORIZED") {
    return sessionMessage;
  }

  if (code === "NOT_FOUND") {
    return normalizeEntityNotFound(rawMessage) ?? "L’élément demandé est introuvable.";
  }

  if (code === "BAD_REQUEST" || code === "PARSE_ERROR") {
    return normalizeBadRequestMessage(rawMessage) ?? cleanupReadableFrenchMessage(rawMessage);
  }

  if (code === "CONFLICT") {
    return normalizeConflictMessage(rawMessage) ?? cleanupReadableFrenchMessage(rawMessage);
  }

  if (code === "TIMEOUT") {
    return "Le serveur met trop de temps à répondre. Réessaie dans un instant.";
  }

  if (code === "PRECONDITION_FAILED") {
    return cleanupReadableFrenchMessage(rawMessage);
  }

  if (code === "INTERNAL_SERVER_ERROR") {
    return (
      normalizeInternalMessage(rawMessage) ??
      normalizeEntityNotFound(rawMessage) ??
      cleanupReadableFrenchMessage(rawMessage)
    );
  }

  return (
    normalizeEntityNotFound(rawMessage) ??
    normalizeBadRequestMessage(rawMessage) ??
    normalizeConflictMessage(rawMessage) ??
    normalizeInternalMessage(rawMessage) ??
    cleanupReadableFrenchMessage(rawMessage)
  );
}
