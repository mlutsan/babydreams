/**
 * Pure sleep computation utilities.
 * Accepts parsed sleep entries and returns grouped daily stats.
 */

import dayjs, { Dayjs } from "dayjs";
import duration from "dayjs/plugin/duration";
import { getSleepEntryEndInfo } from "~/lib/sleep-utils";
import { systemClock } from "~/lib/clock";
import type { SleepEntry, DailyStat } from "~/types/sleep";

dayjs.extend(duration);

export type SleepComputationOptions = {
  now?: Dayjs;
  gapHours?: number;
};

/**
 * Calculate awake minutes for a stat entry.
 * Awake = (elapsed time from start to end/now) - total sleep.
 */
function calculateAwakeMinutes(
  startDatetime: Dayjs,
  endDatetime: Dayjs,
  totalSleepMinutes: number
): number {
  const elapsedMinutes = endDatetime.diff(startDatetime, "minutes");
  return Math.max(0, elapsedMinutes - totalSleepMinutes);
}

/**
 * Build DailyStat list from parsed sleep entries.
 * This is a pure computation: no fetching, no external state.
 */
export function computeDailyStats(
  entries: SleepEntry[],
  options: SleepComputationOptions = {}
): DailyStat[] {
  if (!entries || entries.length === 0) {
    return [];
  }

  const now = options.now ?? systemClock.now();
  const gapMinutes = (options.gapHours ?? 12) * 60;

  const sortedEntries = [...entries].sort(
    (a, b) => a.realDatetime.unix() - b.realDatetime.unix()
  );

  const stats: DailyStat[] = [];
  let currentStat: DailyStat | null = null;
  let previousEntry: SleepEntry | null = null;
  let previousEntryEndDatetime: Dayjs | null = null;

  for (const entry of sortedEntries) {
    const endInfo = getSleepEntryEndInfo(entry, now);
    const durationMinutes = endInfo.durationMinutes;
    const isActive = endInfo.isActive;
    const entryEndDatetime = endInfo.endDatetime;

    let shouldCreateNewStat = false;

    if (!currentStat) {
      shouldCreateNewStat = true;
    } else if (previousEntry) {
      const isNightToDayTransition =
        previousEntry.cycle === "Night" && entry.cycle === "Day";
      const gap = entry.realDatetime.diff(previousEntry.realDatetime, "minutes");
      const datesDiffer = !entry.realDatetime.isSame(previousEntry.realDatetime, "day");
      const largeGapDifferentDates = gap > gapMinutes && datesDiffer;

      shouldCreateNewStat = isNightToDayTransition || largeGapDifferentDates;
    }

    if (shouldCreateNewStat) {
      if (currentStat) {
        currentStat.awakeMinutes = calculateAwakeMinutes(
          currentStat.startDatetime,
          currentStat.endDatetime,
          currentStat.totalSleepMinutes
        );
        stats.push(currentStat);
      }

      let newStartDatetime = entry.realDatetime;
      if (
        previousEntry &&
        previousEntry.cycle === "Night" &&
        entry.cycle === "Day" &&
        previousEntryEndDatetime
      ) {
        newStartDatetime = previousEntryEndDatetime;
      }

      currentStat = {
        startDatetime: newStartDatetime,
        endDatetime: entryEndDatetime,
        logicalDate: newStartDatetime.format("YYYY-MM-DD"),
        totalSleepMinutes: durationMinutes,
        awakeMinutes: 0,
        daySleepMinutes: entry.cycle === "Day" ? durationMinutes : 0,
        nightSleepMinutes: entry.cycle === "Night" ? durationMinutes : 0,
        sessionCount: 1,
        hasActiveSleep: isActive,
        entries: [entry],
      };
    } else if (currentStat) {
      currentStat.endDatetime = entryEndDatetime;
      currentStat.totalSleepMinutes += durationMinutes;
      currentStat.sessionCount += 1;
      currentStat.hasActiveSleep = isActive;
      currentStat.entries.push(entry);

      if (entry.cycle === "Day") {
        currentStat.daySleepMinutes += durationMinutes;
      } else {
        currentStat.nightSleepMinutes += durationMinutes;
      }
    }

    previousEntry = entry;
    previousEntryEndDatetime = entryEndDatetime;
  }

  if (currentStat) {
    currentStat.awakeMinutes = calculateAwakeMinutes(
      currentStat.startDatetime,
      currentStat.endDatetime,
      currentStat.totalSleepMinutes
    );
    stats.push(currentStat);
  }

  return stats;
}
