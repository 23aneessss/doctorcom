import { describe, expect, test } from "bun:test";

import {
  formatSexLabel,
  isFemaleSex,
  isMaleSex,
  normalizeSexValue,
} from "./patient-sex";

describe("patient sex helpers", () => {
  test("normalizes empty and spaced values", () => {
    expect(normalizeSexValue("  Femme ")).toBe("femme");
    expect(normalizeSexValue(null)).toBe("");
    expect(normalizeSexValue(undefined)).toBe("");
  });

  test("detects common female labels", () => {
    expect(isFemaleSex("F")).toBe(true);
    expect(isFemaleSex("féminin")).toBe(true);
    expect(isFemaleSex("femme")).toBe(true);
    expect(isFemaleSex("masculin")).toBe(false);
  });

  test("detects common male labels", () => {
    expect(isMaleSex("M")).toBe(true);
    expect(isMaleSex("masculin")).toBe(true);
    expect(isMaleSex("homme")).toBe(true);
    expect(isMaleSex("femme")).toBe(false);
  });

  test("formats known and unknown labels", () => {
    expect(formatSexLabel("feminin")).toBe("Femme");
    expect(formatSexLabel("masculin")).toBe("Homme");
    expect(formatSexLabel(" autre ")).toBe("autre");
    expect(formatSexLabel("")).toBe("Non renseigne");
  });
});
