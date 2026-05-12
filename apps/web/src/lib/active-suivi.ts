const ACTIVE_SUIVI_STORAGE_PREFIX = "doctor-com-active-suivi";

type SuiviOption = {
  id: string;
  est_actif?: boolean | null;
};

function getStorageKey(patientId: string) {
  return `${ACTIVE_SUIVI_STORAGE_PREFIX}:${patientId}`;
}

export function getRememberedActiveSuiviId(patientId: string): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(getStorageKey(patientId));
  } catch {
    return null;
  }
}

export function rememberActiveSuiviId(patientId: string, suiviId: string) {
  if (typeof window === "undefined" || !suiviId) return;

  try {
    window.localStorage.setItem(getStorageKey(patientId), suiviId);
  } catch {
    // localStorage can be unavailable in private or restricted contexts.
  }
}

export function getPreferredActiveSuiviId(
  patientId: string,
  suivis: SuiviOption[],
): string {
  const rememberedId = getRememberedActiveSuiviId(patientId);
  const rememberedSuivi = suivis.find((suivi) => suivi.id === rememberedId);
  if (rememberedSuivi && rememberedSuivi.est_actif !== false) {
    return rememberedSuivi.id;
  }

  return (
    suivis.find((suivi) => suivi.est_actif !== false)?.id ??
    suivis[0]?.id ??
    ""
  );
}
