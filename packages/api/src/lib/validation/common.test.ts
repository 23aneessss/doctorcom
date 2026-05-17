import { describe, expect, test } from "bun:test";

import {
  ISO_DATE_REGEX,
  ISO_TIME_REGEX,
  isIsoDateString,
  isIsoTimeString,
} from "./common";

describe("validation common helpers", () => {
  test("accepts only YYYY-MM-DD shaped dates", () => {
    expect(isIsoDateString("2026-05-12")).toBe(true);
    expect(isIsoDateString("2026-5-12")).toBe(false);
    expect(isIsoDateString("12/05/2026")).toBe(false);
    expect(isIsoDateString("")).toBe(false);
    expect(ISO_DATE_REGEX.test("2026-99-99")).toBe(true);
  });

  test("accepts HH:MM and HH:MM:SS shaped times", () => {
    expect(isIsoTimeString("09:30")).toBe(true);
    expect(isIsoTimeString("09:30:00")).toBe(true);
    expect(isIsoTimeString("9:30")).toBe(false);
    expect(isIsoTimeString("09:30:00Z")).toBe(false);
    expect(ISO_TIME_REGEX.test("99:99")).toBe(true);
  });
});
