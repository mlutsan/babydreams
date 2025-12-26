/**
 * Pure sleep computation utilities.
 * Accepts parsed sleep entries and returns grouped daily stats.
 */

import dayjs, { Dayjs } from "dayjs";
import duration from "dayjs/plugin/duration";
import { calculateSleepDuration, resolveActiveSleepEnd } from "~/lib/sleep-utils";
import type { SleepEntry, DailyStat } from "~/types/sleep";

dayjs.extend(duration);

export type SleepComputationOptions = {
  now?: Dayjs;
  gapHours?: number;
};

/**
 * Convert date + time duration to full datetime, adjusting for night cycle.
 * Same logic as realDatetime calculation in parseRow.
 */
function dateTimeToDatetime(
  date: Dayjs,
  time: duration.Duration,
  cycle: "Day" | "Night"
): Dayjs {
  let datetime = date.startOf("day").add(time);
  const timeMinutes = Math.floor(time.asMinutes());

  // If night cycle and time is before 6 AM (after midnight), it's the next day.
  if (cycle === "Night" && timeMinutes < 6 * 60) {
    datetime = datetime.add(1, "day");
  }

  return datetime;
}

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

  const now = options.now ?? dayjs();
  const gapMinutes = (options.gapHours ?? 12) * 60;

  const sortedEntries = [...entries].sort(
    (a, b) => a.realDatetime.unix() - b.realDatetime.unix()
  );

  const stats: DailyStat[] = [];
  let currentStat: DailyStat | null = null;
  let previousEntry: SleepEntry | null = null;

  for (const entry of sortedEntries) {
    let durationMinutes = 0;
    let isActive = false;
    let entryEndDatetime: Dayjs;

    if (entry.endTime === null) {
      const resolved = resolveActiveSleepEnd({
        startDatetime: entry.realDatetime,
        now,
      });
      isActive = resolved.isActive;
      durationMinutes = resolved.durationMinutes;
      entryEndDatetime = resolved.endDatetime;
    } else {
      durationMinutes = calculateSleepDuration(entry.startTime, entry.endTime);

      entryEndDatetime = entry.realDatetime.startOf("day").add(entry.endTime);
      const startMinutes = Math.floor(entry.startTime.asMinutes());
      const endMinutes = Math.floor(entry.endTime.asMinutes());
      if (endMinutes < startMinutes) {
        entryEndDatetime = entryEndDatetime.add(1, "day");
      }
    }

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
        previousEntry.endTime
      ) {
        newStartDatetime = dateTimeToDatetime(
          entry.date,
          previousEntry.endTime,
          entry.cycle
        );
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
