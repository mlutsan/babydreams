import dayjs, { type Dayjs } from "dayjs";
import type { DailyEatStat, EatEntry } from "~/lib/eat-service";
import { systemClock } from "~/lib/clock";
import { timeToMinutes } from "~/lib/date-utils";
import { computeDailyStats } from "~/lib/sleep-model";
import { buildWallClockDateTimeFromMinutes } from "~/lib/sheets-utils";
import type { DailyStat } from "~/types/sleep";
import type { SleepEntry } from "~/types/sleep";
import type { LogicalDay } from "~/types/logical-day";

export type BuildLogicalDaysParams = {
  sleepEntries?: SleepEntry[];
  eatEntries?: EatEntry[];
  dayStart: string;
  now?: Dayjs;
};

function getFallbackWindowForDate(logicalDate: string, dayStart: string): { start: Dayjs; end: Dayjs } {
  const dayStartMinutes = timeToMinutes(dayStart);
  const start = buildWallClockDateTimeFromMinutes(dayjs(logicalDate), dayStartMinutes);
  return {
    start,
    end: buildWallClockDateTimeFromMinutes(dayjs(logicalDate), dayStartMinutes, 1),
  };
}

function buildEatStat(logicalDate: string, entries: EatEntry[]): DailyEatStat {
  const sortedEntries = [...entries].sort(
    (a, b) => a.datetime.unix() - b.datetime.unix()
  );
  const totalVolume = sortedEntries.reduce((sum, entry) => sum + entry.volume, 0);

  return {
    date: dayjs(logicalDate),
    totalVolume,
    entries: sortedEntries,
    entryCount: sortedEntries.length,
  };
}

export function findLogicalDayForMoment(
  logicalDays: LogicalDay[],
  moment: Dayjs
): LogicalDay | null {
  return (
    logicalDays.find((day) => {
      const startsBeforeOrAtMoment =
        day.startDatetime.isSame(moment) || day.startDatetime.isBefore(moment);
      const endsAfterOrAtMoment =
        day.endDatetime.isSame(moment) || day.endDatetime.isAfter(moment);

      return startsBeforeOrAtMoment && endsAfterOrAtMoment;
    }) ?? null
  );
}

export function findTodaySleepStat(
  sleepStats: DailyStat[],
  moment: Dayjs
): DailyStat | null {
  const dayStart = moment.startOf("day");
  const dayEnd = moment.endOf("day");

  for (let index = sleepStats.length - 1; index >= 0; index -= 1) {
    const stat = sleepStats[index];
    const overlapsToday =
      (stat.startDatetime.isSame(dayEnd) || stat.startDatetime.isBefore(dayEnd)) &&
      (stat.endDatetime.isSame(dayStart) || stat.endDatetime.isAfter(dayStart));

    if (overlapsToday) {
      return stat;
    }
  }

  return null;
}

export function buildLogicalDays({
  sleepEntries = [],
  eatEntries = [],
  dayStart,
  now = systemClock.now(),
}: BuildLogicalDaysParams): LogicalDay[] {
  const sleepStats = sleepEntries.length > 0 ? computeDailyStats(sleepEntries, { now }) : [];

  const logicalDaysByDate = new Map<string, LogicalDay>();

  for (const stat of sleepStats) {
    logicalDaysByDate.set(stat.logicalDate, {
      logicalDate: stat.logicalDate,
      startDatetime: stat.startDatetime,
      endDatetime: stat.endDatetime,
      sleep: stat,
      eat: null,
      source: "sleep",
    });
  }

  const eatEntriesByDate = new Map<string, EatEntry[]>();
  const eatLatestByDate = new Map<string, Dayjs>();
  for (const entry of eatEntries) {
    const logicalDate = entry.cycleDate.format("YYYY-MM-DD");
    const bucket = eatEntriesByDate.get(logicalDate) ?? [];
    bucket.push(entry);
    eatEntriesByDate.set(logicalDate, bucket);
    const currentLatest = eatLatestByDate.get(logicalDate);
    if (!currentLatest || entry.datetime.isAfter(currentLatest)) {
      eatLatestByDate.set(logicalDate, entry.datetime);
    }
  }

  for (const [logicalDate, entries] of eatEntriesByDate.entries()) {
    const existingDay = logicalDaysByDate.get(logicalDate);
    if (existingDay) {
      existingDay.eat = buildEatStat(logicalDate, entries);
      const latestEat = eatLatestByDate.get(logicalDate);
      if (latestEat && latestEat.isAfter(existingDay.endDatetime)) {
        existingDay.endDatetime = latestEat;
      }
      continue;
    }

    const { start, end } = getFallbackWindowForDate(logicalDate, dayStart);
    const latestEat = eatLatestByDate.get(logicalDate);
    const endDatetime = latestEat && latestEat.isAfter(end) ? latestEat : end;
    logicalDaysByDate.set(logicalDate, {
      logicalDate,
      startDatetime: start,
      endDatetime: endDatetime,
      sleep: null,
      eat: buildEatStat(logicalDate, entries),
      source: "fallback",
    });
  }

  return Array.from(logicalDaysByDate.values()).sort(
    (a, b) => a.startDatetime.unix() - b.startDatetime.unix()
  );
}
