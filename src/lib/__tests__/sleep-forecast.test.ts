import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { describe, it, expect } from "vitest";
import { computeSleepForecast } from "~/lib/sleep-forecast";
import type { SleepEntry } from "~/types/sleep";

dayjs.extend(duration);

type EntryInput = {
  date: string;
  start: { hours: number; minutes: number };
  end?: { hours: number; minutes: number };
  cycle: "Day" | "Night";
};

function makeEntry(input: EntryInput): SleepEntry {
  const date = dayjs(input.date);
  const startTime = dayjs.duration(input.start);
  const endTime = input.end ? dayjs.duration(input.end) : null;

  let realDatetime = date.startOf("day").add(startTime);
  const startMinutes = Math.floor(startTime.asMinutes());
  if (input.cycle === "Night" && startMinutes < 6 * 60) {
    realDatetime = realDatetime.add(1, "day");
  }

  return {
    addedDate: date,
    date,
    startTime,
    endTime,
    cycle: input.cycle,
    length: "",
    realDatetime,
  };
}

describe("computeSleepForecast", () => {
  it("uses day sleeps to predict awake windows and durations", () => {
    const entries: SleepEntry[] = [
      makeEntry({
        date: "2024-01-01",
        start: { hours: 9, minutes: 0 },
        end: { hours: 10, minutes: 0 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-01",
        start: { hours: 13, minutes: 0 },
        end: { hours: 13, minutes: 45 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-01",
        start: { hours: 20, minutes: 0 },
        end: { hours: 6, minutes: 0 },
        cycle: "Night",
      }),
      makeEntry({
        date: "2024-01-02",
        start: { hours: 9, minutes: 30 },
        end: { hours: 10, minutes: 30 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-02",
        start: { hours: 14, minutes: 0 },
        end: { hours: 14, minutes: 30 },
        cycle: "Day",
      }),
    ];

    const forecast = computeSleepForecast(entries, {
      now: dayjs("2024-01-02T15:00:00"),
    });

    expect(forecast.samples.awakeWindows).toBe(3);
    expect(forecast.samples.sleepDurations).toBe(4);
    expect(forecast.currentAwakeMinutes).toBe(30);
    expect(forecast.zone).toBe("green");

    expect(forecast.predictedSleepStart?.format("HH:mm")).toBe("18:00");
    expect(forecast.predictedSleepStartRange.earliest?.format("HH:mm")).toBe("17:54");
    expect(forecast.predictedSleepStartRange.latest?.format("HH:mm")).toBe("18:00");

    expect(forecast.predictedSleepDurationMinutes).toBe(53);
    expect(forecast.predictedSleepDurationRange.shortest).toBe(48);
    expect(forecast.predictedSleepDurationRange.longest).toBe(60);
  });

  it("falls back to all-time data when recent window lacks samples", () => {
    const entries: SleepEntry[] = [
      makeEntry({
        date: "2024-01-01",
        start: { hours: 9, minutes: 0 },
        end: { hours: 10, minutes: 0 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-01",
        start: { hours: 13, minutes: 0 },
        end: { hours: 13, minutes: 45 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-02",
        start: { hours: 9, minutes: 30 },
        end: { hours: 10, minutes: 30 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-02",
        start: { hours: 14, minutes: 0 },
        end: { hours: 14, minutes: 30 },
        cycle: "Day",
      }),
    ];

    const forecast = computeSleepForecast(entries, {
      now: dayjs("2024-01-02T15:00:00"),
      windowDays: 1,
      minSamples: 3,
    });

    expect(forecast.samples.awakeWindows).toBe(2);
    expect(forecast.samples.sleepDurations).toBe(4);
  });

  it("returns unknown zone when last sleep is active", () => {
    const entries: SleepEntry[] = [
      makeEntry({
        date: "2024-01-01",
        start: { hours: 9, minutes: 0 },
        end: { hours: 10, minutes: 0 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-01",
        start: { hours: 13, minutes: 0 },
        end: { hours: 13, minutes: 45 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-02",
        start: { hours: 9, minutes: 30 },
        end: { hours: 10, minutes: 30 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-02",
        start: { hours: 12, minutes: 0 },
        cycle: "Day",
      }),
    ];

    const forecast = computeSleepForecast(entries, {
      now: dayjs("2024-01-02T12:30:00"),
    });

    expect(forecast.currentAwakeMinutes).toBeNull();
    expect(forecast.zone).toBe("unknown");
    expect(forecast.predictedSleepStart).toBeNull();
  });

  it("caps awake minutes and avoids past predictions after a data gap", () => {
    const entries: SleepEntry[] = [
      makeEntry({
        date: "2024-01-01",
        start: { hours: 10, minutes: 0 },
        end: { hours: 11, minutes: 0 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-01",
        start: { hours: 14, minutes: 0 },
        end: { hours: 14, minutes: 30 },
        cycle: "Day",
      }),
    ];

    const now = dayjs("2024-01-02T16:17:00");
    const forecast = computeSleepForecast(entries, {
      now,
    });

    expect(forecast.currentAwakeMinutes).toBe(720);
    expect(forecast.predictedSleepStart?.isBefore(now)).toBe(false);
    expect(forecast.predictedSleepStart?.format("HH:mm")).toBe("16:17");
  });

  it("handles empty data", () => {
    const forecast = computeSleepForecast([], {
      now: dayjs("2024-01-02T12:30:00"),
    });

    expect(forecast.zone).toBe("unknown");
    expect(forecast.predictedSleepStart).toBeNull();
    expect(forecast.predictedSleepDurationMinutes).toBeNull();
    expect(forecast.samples.awakeWindows).toBe(0);
    expect(forecast.samples.sleepDurations).toBe(0);
  });

  it("uses per-nap index distributions when available", () => {
    const entries: SleepEntry[] = [
      makeEntry({
        date: "2024-01-01",
        start: { hours: 9, minutes: 0 },
        end: { hours: 9, minutes: 30 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-01",
        start: { hours: 12, minutes: 0 },
        end: { hours: 12, minutes: 30 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-01",
        start: { hours: 16, minutes: 0 },
        end: { hours: 16, minutes: 30 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-02",
        start: { hours: 9, minutes: 0 },
        end: { hours: 9, minutes: 30 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-02",
        start: { hours: 12, minutes: 0 },
        end: { hours: 12, minutes: 30 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-02",
        start: { hours: 16, minutes: 0 },
        end: { hours: 16, minutes: 30 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-03",
        start: { hours: 9, minutes: 0 },
        end: { hours: 9, minutes: 30 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-03",
        start: { hours: 12, minutes: 0 },
        end: { hours: 12, minutes: 30 },
        cycle: "Day",
      }),
    ];

    const forecast = computeSleepForecast(entries, {
      now: dayjs("2024-01-03T13:00:00"),
      minSamples: 2,
    });

    expect(forecast.napIndex).toBe(3);
    expect(forecast.predictedSleepStart?.format("HH:mm")).toBe("16:00");
    expect(forecast.predictedSleepDurationMinutes).toBe(30);
  });

  it("picks awake windows that maximize sleep duration within the safe range", () => {
    const entries: SleepEntry[] = [
      makeEntry({
        date: "2024-01-01",
        start: { hours: 9, minutes: 0 },
        end: { hours: 9, minutes: 30 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-01",
        start: { hours: 12, minutes: 0 },
        end: { hours: 12, minutes: 40 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-02",
        start: { hours: 9, minutes: 0 },
        end: { hours: 9, minutes: 30 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-02",
        start: { hours: 12, minutes: 0 },
        end: { hours: 12, minutes: 50 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-03",
        start: { hours: 9, minutes: 0 },
        end: { hours: 9, minutes: 30 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-03",
        start: { hours: 12, minutes: 10 },
        end: { hours: 13, minutes: 30 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-04",
        start: { hours: 9, minutes: 0 },
        end: { hours: 9, minutes: 30 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-04",
        start: { hours: 12, minutes: 10 },
        end: { hours: 13, minutes: 20 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-05",
        start: { hours: 9, minutes: 0 },
        end: { hours: 9, minutes: 30 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-05",
        start: { hours: 11, minutes: 50 },
        end: { hours: 12, minutes: 20 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-06",
        start: { hours: 9, minutes: 0 },
        end: { hours: 9, minutes: 30 },
        cycle: "Day",
      }),
    ];

    const forecast = computeSleepForecast(entries, {
      now: dayjs("2024-01-06T10:00:00"),
      minSamples: 3,
    });

    expect(forecast.napIndex).toBe(2);
    expect(forecast.predictedSleepStart?.format("HH:mm")).toBe("12:10");
    expect(forecast.predictedSleepDurationMinutes).toBe(75);
  });
});
