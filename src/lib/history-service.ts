/**
 * Client-side history service
 * Fetches and processes historical sleep data
 * NEW STRUCTURE: Only tracks sleep (no wake entries)
 */

import dayjs, { Dayjs } from "dayjs";
import duration from "dayjs/plugin/duration";
import { parseRow, calculateSleepDuration } from "~/lib/sleep-utils";
import { getSheetValues } from "~/server/proxy";
import { formatDuration } from "~/lib/date-utils";
import type { SleepEntry, DailyStat as DailyStatType } from "~/types/sleep";

dayjs.extend(duration);

const SLEEP_SHEET = "Sleep";

export type SleepSession = {
  startTime: string; // HH:mm format
  endTime: string | null; // HH:mm format, null if active
  durationMinutes: number;
  isActive: boolean;
  cycle: "Day" | "Night";
  date: string; // YYYY-MM-DD
};

export type DayHistory = {
  date: string; // YYYY-MM-DD
  sessions: SleepSession[];
  totalSleepMinutes: number;
  totalAwakeMinutes: number;
  // Day/Night breakdown
  daySleepMinutes: number;
  nightSleepMinutes: number;
  dayAwakeMinutes: number;
  nightAwakeMinutes: number;
  dayCycleDurationMinutes: number; // Total duration of day cycle
  nightCycleDurationMinutes: number; // Total duration of night cycle
};

// Re-export DailyStat from shared types for backward compatibility
export type DailyStat = DailyStatType;

/**
 * Convert date + time duration to full datetime, adjusting for night cycle
 * Same logic as realDatetime calculation in parseRow
 */
function dateTimeToDatetime(
  date: Dayjs,
  time: duration.Duration,
  cycle: "Day" | "Night"
): Dayjs {
  let datetime = date.startOf("day").add(time);
  const timeMinutes = Math.floor(time.asMinutes());

  // If night cycle and time is before 6 AM (after midnight), it's the next day
  if (cycle === "Night" && timeMinutes < 6 * 60) {
    datetime = datetime.add(1, "day");
  }

  return datetime;
}

/**
 * Calculate awake minutes for a stat entry
 * Awake = (elapsed time from start to end/now) - total sleep
 * For today: use current time as end
 * For past days: use actual end time (not 24 hours)
 */
function calculateAwakeMinutes(
  startDatetime: Dayjs,
  endDatetime: Dayjs,
  totalSleepMinutes: number
): number {
  const elapsedMinutes = endDatetime.diff(startDatetime, "minutes");  // Past: from start to end
  return Math.max(0, elapsedMinutes - totalSleepMinutes);
}

/**
 * Get all sleep history grouped by logical days
 * A logical day starts with DAY or continues from previous day's NIGHT
 * New day begins when: NIGHT→DAY transition OR gap > 12h + different dates
 */
export async function getHistory(sheetUrl: string): Promise<DailyStat[]> {
  const range = `${SLEEP_SHEET}!A:F`;

  try {
    const result = (await getSheetValues({ data: { sheetUrl, range } })) as {
      values?: unknown[][];
    };
    const rows = (result.values as unknown[][]) || [];

    // Skip header row
    const dataRows = rows.slice(1);

    // Parse all entries and store their sheet row indices
    const allEntries: SleepEntry[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const entry = parseRow(dataRows[i]);
      if (entry) {
        // Store the 1-based row index (i + 2: +1 for header row, +1 for 1-based index)
        entry.sheetRowIndex = i + 2;
        allEntries.push(entry);
      }
    }

    // Sort by realDatetime ascending
    allEntries.sort((a, b) => a.realDatetime.unix() - b.realDatetime.unix());

    // Group entries into daily stats
    const stats: DailyStat[] = [];
    let currentStat: DailyStat | null = null;
    let previousEntry: SleepEntry | null = null;

    const now = dayjs();

    for (const entry of allEntries) {

      // Calculate sleep duration and actual end datetime
      let durationMinutes = 0;
      let isActive = false;
      let entryEndDatetime: Dayjs;

      if (entry.endTime === null) {
        // Active sleep - calculate to now
        isActive = true;
        durationMinutes = Math.round((now.unix() - entry.realDatetime.unix()) / 60);
        entryEndDatetime = now;
      } else {
        // Completed sleep
        durationMinutes = calculateSleepDuration(entry.startTime, entry.endTime);

        // Calculate actual end datetime (same logic as SleepTimeline)
        entryEndDatetime = entry.realDatetime.startOf("day").add(entry.endTime);
        const startMinutes = Math.floor(entry.startTime.asMinutes());
        const endMinutes = Math.floor(entry.endTime.asMinutes());
        if (endMinutes < startMinutes) {
          // Sleep crossed midnight
          entryEndDatetime = entryEndDatetime.add(1, "day");
        }
      }

      // Determine if we need to create a new stat entry
      let shouldCreateNewStat = false;

      if (!currentStat) {
        // First entry - always create new stat
        shouldCreateNewStat = true;
      } else if (previousEntry) {
        // Check transition rules
        const isNightToDayTransition =
          previousEntry.cycle === "Night" && entry.cycle === "Day";

        // Check 12-hour gap + different dates
        const gapMinutes = entry.realDatetime.diff(previousEntry.realDatetime, "minutes");
        const datesDiffer = !entry.realDatetime.isSame(previousEntry.realDatetime, "day");
        const largeGapDifferentDates = gapMinutes > 12 * 60 && datesDiffer;

        shouldCreateNewStat = isNightToDayTransition || largeGapDifferentDates;
      }

      if (shouldCreateNewStat) {
        // Calculate awake time for previous stat before pushing
        if (currentStat) {
          currentStat.awakeMinutes = calculateAwakeMinutes(
            currentStat.startDatetime,
            currentStat.endDatetime,
            currentStat.totalSleepMinutes
          );
          stats.push(currentStat);
        }

        // Determine start datetime for the new day
        // If this is a NIGHT→DAY transition, the day starts when the night sleep ended (baby woke up)
        // Otherwise, it starts with the current entry
        let newStartDatetime = entry.realDatetime;
        if (previousEntry && previousEntry.cycle === "Night" && entry.cycle === "Day" && previousEntry.endTime) {
          // Day starts when baby woke up from night sleep
          newStartDatetime = dateTimeToDatetime(entry.date, previousEntry.endTime, entry.cycle);
        }

        // Create new stat entry (awake minutes calculated later)
        currentStat = {
          startDatetime: newStartDatetime,
          endDatetime: entryEndDatetime,
          logicalDate: newStartDatetime.format("YYYY-MM-DD"),
          totalSleepMinutes: durationMinutes,
          awakeMinutes: 0, // Calculated when stat is complete
          daySleepMinutes: entry.cycle === "Day" ? durationMinutes : 0,
          nightSleepMinutes: entry.cycle === "Night" ? durationMinutes : 0,
          sessionCount: 1,
          hasActiveSleep: isActive,
          entries: [entry]
        };
      } else if (currentStat) {
        // Add to current stat (awake time calculated after loop)
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

    // Calculate awake time and push final stat
    if (currentStat) {
      currentStat.awakeMinutes = calculateAwakeMinutes(
        currentStat.startDatetime,
        currentStat.endDatetime,
        currentStat.totalSleepMinutes
      );
      stats.push(currentStat);
    }


    return stats;
  } catch (error) {
    throw new Error(
      `Failed to get history: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Format session for display
 */
export function formatSession(session: SleepSession): {
  timeRange: string;
  duration: string;
  label: string;
} {
  const timeRange = session.isActive
    ? `${session.startTime} → Now`
    : `${session.startTime} → ${session.endTime || "?"}`;

  const duration = formatDuration(session.durationMinutes);

  const label = "😴 Sleep";

  return { timeRange, duration, label };
}

/**
 * Calculate running total up to a specific session index
 */
export function calculateRunningTotal(
  sessions: SleepSession[],
  upToIndex: number
): { sleepMinutes: number; totalFormatted: string; } {
  let sleepMinutes = 0;

  for (let i = 0; i <= upToIndex; i++) {
    const session = sessions[i];
    sleepMinutes += session.durationMinutes;
  }

  return {
    sleepMinutes,
    totalFormatted: `${formatDuration(sleepMinutes)} sleep total`,
  };
}
