import dayjs from "dayjs";
import { describe, it, expect } from "vitest";
import { computeCurrentTimeMinutes, getMinStartDatetime } from "~/hooks/useCurrentTimeMinutes";
import type { DailyStat } from "~/types/sleep";

function makeStat(start: string): DailyStat {
  const startDatetime = dayjs(start);
  return {
    startDatetime,
    endDatetime: startDatetime.add(1, "hour"),
    logicalDate: startDatetime.format("YYYY-MM-DD"),
    totalSleepMinutes: 0,
    awakeMinutes: 0,
    daySleepMinutes: 0,
    nightSleepMinutes: 0,
    sessionCount: 0,
    hasActiveSleep: false,
    entries: [],
  };
}

describe("getMinStartDatetime", () => {
  it("returns null for empty input", () => {
    expect(getMinStartDatetime()).toBeNull();
    expect(getMinStartDatetime([])).toBeNull();
  });

  it("returns the earliest time-of-day even if date is later", () => {
    const stats = [
      makeStat("2024-01-01T08:00:00"),
      makeStat("2024-01-10T06:30:00"),
      makeStat("2024-01-05T07:15:00"),
    ];

    const min = getMinStartDatetime(stats);
    expect(min?.format("HH:mm")).toBe("06:30");
  });

  it("breaks ties by earlier date", () => {
    const stats = [
      makeStat("2024-01-02T06:30:00"),
      makeStat("2024-01-01T06:30:00"),
      makeStat("2024-01-03T06:30:00"),
    ];

    const min = getMinStartDatetime(stats);
    expect(min?.format("YYYY-MM-DD")).toBe("2024-01-01");
  });
});

describe("computeCurrentTimeMinutes", () => {
  it("returns current minutes when reference is null", () => {
    const now = dayjs("2024-01-02T06:30:00");
    expect(computeCurrentTimeMinutes(now, null)).toBe(390);
  });

  it("wraps after midnight when current time is before reference start", () => {
    const now = dayjs("2024-01-02T06:30:00");
    const referenceStartMinutes = 7 * 60;
    expect(computeCurrentTimeMinutes(now, referenceStartMinutes)).toBe(1830);
  });

  it("does not wrap when current time is after reference start", () => {
    const now = dayjs("2024-01-02T08:15:00");
    const referenceStartMinutes = 7 * 60;
    expect(computeCurrentTimeMinutes(now, referenceStartMinutes)).toBe(495);
  });
});
