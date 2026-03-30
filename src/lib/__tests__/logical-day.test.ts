import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { describe, it, expect } from "vitest";
import { buildLogicalDays, findTodaySleepStat } from "~/lib/logical-day";
import type { DailyStat } from "~/types/sleep";
import type { EatEntry } from "~/lib/eat-service";
import type { SleepEntry } from "~/types/sleep";

dayjs.extend(duration);

type SleepEntryInput = {
  date: string;
  start: string;
  end?: string;
  cycle: "Day" | "Night";
};

type EatEntryInput = {
  datetime: string;
  cycleDate: string;
  volume: number;
};

function parseTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return { hours, minutes };
}

function makeSleepEntry(input: SleepEntryInput): SleepEntry {
  const date = dayjs(input.date);
  const startTime = dayjs.duration(parseTime(input.start));
  const endTime = input.end ? dayjs.duration(parseTime(input.end)) : null;

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

function makeEatEntry(input: EatEntryInput): EatEntry {
  return {
    datetime: dayjs(input.datetime),
    cycleDate: dayjs(input.cycleDate),
    volume: input.volume,
  };
}

describe("buildLogicalDays", () => {
  it("uses sleep-backed logical days and attaches eat stats by cycleDate", () => {
    const sleepEntries: SleepEntry[] = [
      makeSleepEntry({
        date: "2024-01-01",
        start: "09:00",
        end: "10:00",
        cycle: "Day",
      }),
      makeSleepEntry({
        date: "2024-01-02",
        start: "09:00",
        end: "10:00",
        cycle: "Day",
      }),
    ];

    const eatEntries: EatEntry[] = [
      makeEatEntry({
        datetime: "2024-01-01T12:30:00",
        cycleDate: "2024-01-01",
        volume: 60,
      }),
      makeEatEntry({
        datetime: "2024-01-02T09:15:00",
        cycleDate: "2024-01-02",
        volume: 80,
      }),
    ];

    const days = buildLogicalDays({
      sleepEntries,
      eatEntries,
      dayStart: "08:00",
      now: dayjs("2024-01-02T12:00:00"),
    });

    expect(days).toHaveLength(2);
    expect(days[0].logicalDate).toBe("2024-01-01");
    expect(days[0].source).toBe("sleep");
    expect(days[0].sleep).not.toBeNull();
    expect(days[0].eat?.entryCount).toBe(1);
    expect(days[0].eat?.totalVolume).toBe(60);
    expect(days[1].logicalDate).toBe("2024-01-02");
    expect(days[1].source).toBe("sleep");
    expect(days[1].eat?.entryCount).toBe(1);
    expect(days[1].eat?.totalVolume).toBe(80);
  });

  it("creates fallback logical days for eat-only entries using dayStart", () => {
    const eatEntries: EatEntry[] = [
      makeEatEntry({
        datetime: "2024-02-01T06:30:00",
        cycleDate: "2024-02-01",
        volume: 40,
      }),
      makeEatEntry({
        datetime: "2024-02-01T08:15:00",
        cycleDate: "2024-02-01",
        volume: 70,
      }),
    ];

    const days = buildLogicalDays({
      eatEntries,
      dayStart: "07:30",
      now: dayjs("2024-02-01T10:00:00"),
    });

    expect(days).toHaveLength(1);
    expect(days[0].source).toBe("fallback");
    expect(days[0].sleep).toBeNull();
    expect(days[0].eat?.entryCount).toBe(2);
    expect(days[0].eat?.totalVolume).toBe(110);
    expect(days[0].startDatetime.format("YYYY-MM-DD HH:mm")).toBe("2024-02-01 07:30");
    expect(days[0].endDatetime.format("YYYY-MM-DD HH:mm")).toBe("2024-02-02 07:30");
  });

  it("keeps sleep-backed boundaries even when dayStart differs", () => {
    const sleepEntries: SleepEntry[] = [
      makeSleepEntry({
        date: "2024-02-01",
        start: "23:00",
        end: "05:30",
        cycle: "Night",
      }),
      makeSleepEntry({
        date: "2024-02-02",
        start: "09:00",
        end: "10:00",
        cycle: "Day",
      }),
    ];

    const eatEntries: EatEntry[] = [
      makeEatEntry({
        datetime: "2024-02-02T08:00:00",
        cycleDate: "2024-02-02",
        volume: 55,
      }),
    ];

    const days = buildLogicalDays({
      sleepEntries,
      eatEntries,
      dayStart: "08:00",
      now: dayjs("2024-02-02T12:00:00"),
    });

    const day = days.find((entry) => entry.logicalDate === "2024-02-02");
    expect(day).toBeDefined();
    expect(day?.source).toBe("sleep");
    expect(day?.startDatetime.format("HH:mm")).toBe("05:30");
    expect(day?.eat?.entryCount).toBe(1);
  });

  it("uses now as endDatetime for active sleep sessions", () => {
    const sleepEntries: SleepEntry[] = [
      makeSleepEntry({
        date: "2024-03-01",
        start: "08:00",
        cycle: "Day",
      }),
    ];
    const now = dayjs("2024-03-01T12:00:00");

    const days = buildLogicalDays({
      sleepEntries,
      dayStart: "08:00",
      now,
    });

    expect(days).toHaveLength(1);
    expect(days[0].source).toBe("sleep");
    expect(days[0].sleep?.hasActiveSleep).toBe(true);
    expect(days[0].endDatetime.format("YYYY-MM-DD HH:mm")).toBe(
      now.format("YYYY-MM-DD HH:mm")
    );
  });

  it("finds today's sleep stat when the overnight sleep ended earlier today", () => {
    const sleepStats: DailyStat[] = [
      {
        startDatetime: dayjs("2024-03-01T22:00:00"),
        endDatetime: dayjs("2024-03-02T06:30:00"),
        logicalDate: "2024-03-01",
        totalSleepMinutes: 510,
        awakeMinutes: 0,
        daySleepMinutes: 0,
        nightSleepMinutes: 510,
        sessionCount: 1,
        hasActiveSleep: false,
        entries: [],
      },
    ];

    const result = findTodaySleepStat(sleepStats, dayjs("2024-03-02T14:00:00"));

    expect(result).not.toBeNull();
    expect(result?.logicalDate).toBe("2024-03-01");
    expect(result?.totalSleepMinutes).toBe(510);
  });
});
