import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { describe, it, expect } from "vitest";
import { computeDailyStats } from "~/lib/sleep-model";
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

describe("computeDailyStats", () => {
  it("aggregates same-day entries into one stat", () => {
    const entries: SleepEntry[] = [
      makeEntry({
        date: "2024-01-01",
        start: { hours: 8, minutes: 0 },
        end: { hours: 9, minutes: 0 },
        cycle: "Day",
      }),
      makeEntry({
        date: "2024-01-01",
        start: { hours: 12, minutes: 0 },
        end: { hours: 12, minutes: 30 },
        cycle: "Day",
      }),
    ];

    const stats = computeDailyStats(entries, {
      now: dayjs("2024-01-01T23:00:00"),
    });

    expect(stats).toHaveLength(1);
    expect(stats[0].logicalDate).toBe("2024-01-01");
    expect(stats[0].totalSleepMinutes).toBe(90);
    expect(stats[0].daySleepMinutes).toBe(90);
    expect(stats[0].nightSleepMinutes).toBe(0);
    expect(stats[0].sessionCount).toBe(2);
  });

  it("starts a new logical day on night-to-day transition", () => {
    const entries: SleepEntry[] = [
      makeEntry({
        date: "2024-01-01",
        start: { hours: 23, minutes: 0 },
        end: { hours: 5, minutes: 30 },
        cycle: "Night",
      }),
      makeEntry({
        date: "2024-01-02",
        start: { hours: 9, minutes: 0 },
        end: { hours: 10, minutes: 0 },
        cycle: "Day",
      }),
    ];

    const stats = computeDailyStats(entries, {
      now: dayjs("2024-01-02T12:00:00"),
    });

    expect(stats).toHaveLength(2);
    expect(stats[0].logicalDate).toBe("2024-01-01");
    expect(stats[1].logicalDate).toBe("2024-01-02");
    expect(stats[1].startDatetime.format("HH:mm")).toBe("05:30");
  });
});
