/**
 * Client-side history service
 * Fetches and processes historical sleep data
 * NEW STRUCTURE: Only tracks sleep (no wake entries)
 */

import dayjs from "dayjs";
import { parseRow } from "~/lib/sleep-utils";
import { computeDailyStats } from "~/lib/sleep-model";
import { getSheetValues } from "~/server/proxy";
import { formatDuration } from "~/lib/date-utils";
import type { DailyStat, SleepEntry } from "~/types/sleep";

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

    const now = dayjs();
    return computeDailyStats(allEntries, { now });
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
