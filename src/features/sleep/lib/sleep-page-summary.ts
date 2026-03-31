import type { Dayjs } from "dayjs";
import { getSleepEntryEndInfo } from "~/lib/sleep-utils";
import type { DailyStat } from "~/types/sleep";

export interface SleepTodaySummaryData {
  totalSleepMinutes: number;
  awakeMinutes: number;
  daySleepMinutes: number;
  nightSleepMinutes: number;
}

function getLiveAwakeDurationMinutes(
  todaySleepStat: DailyStat | null,
  now: Dayjs
): number {
  const lastEntry = todaySleepStat?.entries.at(-1);
  if (!lastEntry) {
    return 0;
  }

  const endInfo = getSleepEntryEndInfo(lastEntry, now);
  if (endInfo.isActive || !endInfo.endDatetime.isSame(now, "day")) {
    return 0;
  }

  return Math.max(0, now.diff(endInfo.endDatetime, "minutes"));
}

export function buildSleepTodaySummary(params: {
  todaySleepStat: DailyStat | null;
  fallbackAwakeDuration?: number | null;
  now: Dayjs;
}): SleepTodaySummaryData {
  const { todaySleepStat, fallbackAwakeDuration = null, now } = params;
  const liveAwakeDuration = getLiveAwakeDurationMinutes(todaySleepStat, now);

  return {
    totalSleepMinutes: todaySleepStat?.totalSleepMinutes ?? 0,
    awakeMinutes: todaySleepStat
      ? todaySleepStat.awakeMinutes + liveAwakeDuration
      : fallbackAwakeDuration ?? 0,
    daySleepMinutes: todaySleepStat?.daySleepMinutes ?? 0,
    nightSleepMinutes: todaySleepStat?.nightSleepMinutes ?? 0,
  };
}
