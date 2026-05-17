import { describe, expect, test } from "bun:test";

import {
  addDays,
  formatDuration,
  formatDurationMinutes,
  formatTime,
  getDateString,
  getWeekDates,
  isSameDay,
} from "./dates";

describe("native date utilities", () => {
  test("formats 24h time values as AM/PM", () => {
    expect(formatTime("00:05")).toBe("12:05 AM");
    expect(formatTime("09:30:00")).toBe("09:30 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
    expect(formatTime("23:45")).toBe("11:45 PM");
  });

  test("formats durations at second and minute boundaries", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3_665)).toBe("1h 01m");
    expect(formatDurationMinutes(45)).toBe("45 min");
    expect(formatDurationMinutes(125)).toBe("2h 5min");
  });

  test("compares dates by calendar day", () => {
    expect(isSameDay("2026-05-12T01:00:00.000Z", "2026-05-12T23:00:00.000Z")).toBe(true);
    expect(isSameDay("2026-05-12T23:00:00.000Z", "2026-05-13T00:00:00.000Z")).toBe(false);
  });

  test("adds days and builds Sunday-start weeks", () => {
    expect(getDateString(addDays(new Date("2026-05-12T00:00:00.000Z"), 2))).toBe("2026-05-14");

    const week = getWeekDates(new Date("2026-05-12T00:00:00.000Z")).map((date) =>
      getDateString(date),
    );

    expect(week).toEqual([
      "2026-05-10",
      "2026-05-11",
      "2026-05-12",
      "2026-05-13",
      "2026-05-14",
      "2026-05-15",
      "2026-05-16",
    ]);
  });
});
