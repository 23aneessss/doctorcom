export function normalizeSexValue(sexe: string | null | undefined): string {
  return (sexe ?? "").trim().toLowerCase();
}

export function isFemaleSex(sexe: string | null | undefined): boolean {
  const normalized = normalizeSexValue(sexe);
  return (
    normalized === "f" ||
    normalized === "feminin" ||
    normalized === "femme" ||
    normalized.startsWith("fem")
  );
}

export function isMaleSex(sexe: string | null | undefined): boolean {
  const normalized = normalizeSexValue(sexe);
  return (
    normalized === "m" ||
    normalized === "masculin" ||
    normalized === "homme" ||
    normalized.startsWith("mas") ||
    normalized.startsWith("hom")
  );
}

export function formatSexLabel(sexe: string | null | undefined): string {
  const normalized = normalizeSexValue(sexe);

  if (normalized === "f" || normalized.startsWith("fem")) {
    return "Femme";
  }

  if (
    normalized === "m" ||
    normalized === "masculin" ||
    normalized.startsWith("mas") ||
    normalized.startsWith("hom")
  ) {
    return "Homme";
  }

  return sexe?.trim() || "Non renseigne";
}