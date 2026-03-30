import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { describe, it, expect } from "vitest";
import { buildLogicalDays } from "~/lib/logical-day";
import { commitPlacement, resolvePlacement } from "~/lib/entry-placement";
import type { SleepEntry } from "~/types/sleep";

dayjs.extend(duration);

type SleepEntryInput = {
  date: string;
  start: string;
  end?: string;
  cycle: "Day" | "Night";
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

describe("entry placement", () => {
  it("uses sleep-backed logical day when datetime is inside the window", () => {
    const sleepEntries = [
      makeSleepEntry({
        date: "2024-01-01",
        start: "08:00",
        end: "10:00",
        cycle: "Day",
      }),
    ];
    const logicalDays = buildLogicalDays({
      sleepEntries,
      dayStart: "08:00",
      now: dayjs("2024-01-01T12:00:00"),
    });

    const decision = resolvePlacement({
      datetime: dayjs("2024-01-01T09:00:00"),
      logicalDays,
      dayStart: "08:00",
      now: dayjs("2024-01-01T09:30:00"),
    });

    expect(decision.reason).toBe("sleep-window");
    expect(decision.isAmbiguous).toBe(false);
    expect(decision.logicalDate).toBe("2024-01-01");
  });

  it("flags ambiguity near day start when no sleep-backed day exists for today", () => {
    const decision = resolvePlacement({
      datetime: dayjs("2024-01-02T07:30:00"),
      logicalDays: [],
      dayStart: "08:00",
      now: dayjs("2024-01-02T07:30:00"),
    });

    expect(decision.isAmbiguous).toBe(true);
    expect(decision.reason).toBe("near-daystart");
    expect(decision.logicalDate).toBe("2024-01-01");
    expect(decision.options?.map((option) => option.label)).toEqual([
      "Start new day",
      "Continue night",
    ]);
  });

  it("does not prompt when a sleep-backed day exists for today", () => {
    const sleepEntries = [
      makeSleepEntry({
        date: "2024-01-02",
        start: "09:00",
        end: "10:00",
        cycle: "Day",
      }),
    ];
    const logicalDays = buildLogicalDays({
      sleepEntries,
      dayStart: "08:00",
      now: dayjs("2024-01-02T12:00:00"),
    });

    const decision = resolvePlacement({
      datetime: dayjs("2024-01-02T07:30:00"),
      logicalDays,
      dayStart: "08:00",
      now: dayjs("2024-01-02T07:30:00"),
    });

    expect(decision.isAmbiguous).toBe(false);
    expect(decision.reason).toBe("fallback");
    expect(decision.logicalDate).toBe("2024-01-01");
  });

  it("uses override logical date on commit", () => {
    const committed = commitPlacement({
      datetime: dayjs("2024-01-02T07:30:00"),
      logicalDays: [],
      dayStart: "08:00",
      now: dayjs("2024-01-02T07:30:00"),
      overrideLogicalDate: "2024-01-02",
    });

    expect(committed.format("YYYY-MM-DD")).toBe("2024-01-02");
  });

  it("uses the sleep-backed day that contains now to avoid ambiguity", () => {
    const sleepEntries = [
      makeSleepEntry({
        date: "2024-01-01",
        start: "22:30",
        end: "07:30",
        cycle: "Night",
      }),
    ];
    const logicalDays = buildLogicalDays({
      sleepEntries,
      dayStart: "08:00",
      now: dayjs("2024-01-02T07:00:00"),
    });

    const decision = resolvePlacement({
      datetime: dayjs("2024-01-02T07:00:00"),
      logicalDays,
      dayStart: "08:00",
      now: dayjs("2024-01-02T07:00:00"),
    });

    expect(decision.isAmbiguous).toBe(false);
    expect(decision.reason).toBe("sleep-window");
    expect(decision.logicalDate).toBe("2024-01-01");
  });

  it("treats an entry at the active sleep end as inside the sleep window", () => {
    const sleepEntries = [
      makeSleepEntry({
        date: "2026-01-14",
        start: "23:00",
        cycle: "Night",
      }),
    ];
    const now = dayjs("2026-01-15T07:00:00");
    const logicalDays = buildLogicalDays({
      sleepEntries,
      dayStart: "08:00",
      now,
    });

    const decision = resolvePlacement({
      datetime: now,
      logicalDays,
      dayStart: "08:00",
      now,
    });

    expect(decision.isAmbiguous).toBe(false);
    expect(decision.reason).toBe("sleep-window");
    expect(decision.logicalDate).toBe("2026-01-14");
  });
});
