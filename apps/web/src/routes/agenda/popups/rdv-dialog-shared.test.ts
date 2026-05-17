import { describe, expect, test } from "bun:test";

import {
  RDV_STATUS_OPTIONS,
  RDV_TIME_OPTIONS,
  getInitialsFromName,
  getStatusLabel,
  isBlockedSlotType,
} from "./rdv-dialog-shared";

describe("rdv dialog shared helpers", () => {
  test("detects blocked slot labels with and without accents", () => {
    expect(isBlockedSlotType("Creneau bloque")).toBe(true);
    expect(isBlockedSlotType("  Créneau bloqué  ")).toBe(true);
    expect(isBlockedSlotType("Consultation")).toBe(false);
    expect(isBlockedSlotType(null)).toBe(false);
  });

  test("generates quarter-hour time options for a full day", () => {
    expect(RDV_TIME_OPTIONS).toHaveLength(96);
    expect(RDV_TIME_OPTIONS[0]).toBe("00:00");
    expect(RDV_TIME_OPTIONS[1]).toBe("00:15");
    expect(RDV_TIME_OPTIONS.at(-1)).toBe("23:45");
  });

  test("maps statuses to display labels", () => {
    expect(RDV_STATUS_OPTIONS.map((option) => getStatusLabel(option.value))).toEqual([
      "Confirme",
      "En attente",
      "Termine",
      "Annule",
      "Bloque",
    ]);
  });

  test("builds stable initials for names and empty labels", () => {
    expect(getInitialsFromName("Sara Benali")).toBe("SB");
    expect(getInitialsFromName("  Jean   ")).toBe("J");
    expect(getInitialsFromName("")).toBe("RD");
  });
});
