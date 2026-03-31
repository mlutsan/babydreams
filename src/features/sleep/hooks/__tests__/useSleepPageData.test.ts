import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { describe, expect, it } from "vitest";
import { buildSleepTodaySummary } from "~/features/sleep/lib/sleep-page-summary";
import type { DailyStat, SleepEntry } from "~/types/sleep";

dayjs.extend(duration);

function makeSleepEntry(params: {
  date: string;
  start: string;
  end: string;
  cycle: "Day" | "Night";
}): SleepEntry {
  const date = dayjs(params.date);
  const [startHours, startMinutes] = params.start.split(":").map(Number);
  const [endHours, endMinutes] = params.end.split(":").map(Number);
  const startTime = dayjs.duration({ hours: startHours, minutes: startMinutes });
  const endTime = dayjs.duration({ hours: endHours, minutes: endMinutes });

  return {
    addedDate: date,
    date,
    startTime,
    endTime,
    endDatetime: dayjs(`${params.date}T${params.end}:00`),
    cycle: params.cycle,
    length: "",
    realDatetime: dayjs(`${params.date}T${params.start}:00`),
  };
}

describe("buildSleepTodaySummary", () => {
  it("adds live awake time to the stored awake minutes while baby is awake", () => {
    const todaySleepStat: DailyStat = {
      startDatetime: dayjs("2024-03-02T06:00:00"),
      endDatetime: dayjs("2024-03-02T09:15:00"),
      logicalDate: "2024-03-02",
      totalSleepMinutes: 150,
      awakeMinutes: 120,
      daySleepMinutes: 60,
      nightSleepMinutes: 90,
      sessionCount: 2,
      hasActiveSleep: false,
      entries: [
        makeSleepEntry({
          date: "2024-03-02",
          start: "06:45",
          end: "07:45",
          cycle: "Day",
        }),
        makeSleepEntry({
          date: "2024-03-02",
          start: "08:15",
          end: "09:15",
          cycle: "Day",
        }),
      ],
    };

    const summaryAt45 = buildSleepTodaySummary({
      todaySleepStat,
      now: dayjs("2024-03-02T10:00:00"),
    });
    const summaryAt50 = buildSleepTodaySummary({
      todaySleepStat,
      now: dayjs("2024-03-02T10:05:00"),
    });

    expect(summaryAt45.awakeMinutes).toBe(165);
    expect(summaryAt50.awakeMinutes).toBe(170);
  });
});
