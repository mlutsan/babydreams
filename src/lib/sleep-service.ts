/**
 * Client-side sleep tracking service
 * All business logic runs in the browser
 * NEW STRUCTURE: Only tracks sleep (no wake entries)
 */

import dayjs, { Dayjs } from "dayjs";
import duration from "dayjs/plugin/duration";
import {
  serialNumberToDate,
  serialNumberToTime,
} from "~/lib/sheets-utils";
import {
  getMinutesSince,
  getTimeAgo,
  getTimestamp,
  calculateDateForCycle,
} from "~/lib/date-utils";
import {
  getSheetValues,
  appendSheetValues,
  updateSheetValues,
} from "~/server/proxy";

dayjs.extend(duration);

const SLEEP_SHEET = "Sleep";
const HEADERS = ["Added Date", "Date", "Start Time", "End Time", "Cycle", "Length"] as const;

export type SleepEntry = {
  addedDate: dayjs.Dayjs;
  date: dayjs.Dayjs;
  startTime: duration.Duration;
  endTime: duration.Duration | null; // null means actively sleeping
  cycle: "Day" | "Night";
  length: string | number; // Computed column for reference
  realDatetime: dayjs.Dayjs; // Computed: actual datetime of sleep (date + startTime, adjusted for night after midnight)
};

export type SleepState = {
  isActive: boolean; // true if baby is currently sleeping
  startTime: string | null; // Sleep start time or wake up time
  duration: number; // Duration in minutes (sleeping or awake)
  cycle: "Day" | "Night" | null;
  date: string | null;
  // When not sleeping (awake):
  awakeStartTime: string | null; // Time baby woke up
  awakeDuration: number; // Minutes awake
};

export type SleepStats = {
  sleepMinutes: number;
  awakeMinutes: number;
};

export type SleepScreenData = {
  state: SleepState;
  stats: SleepStats;
};

/**
 * Normalize cell value to string
 */
function normalize(val: unknown): string {
  return typeof val === "string" ? val.trim() : String(val || "");
}

/**
 * Parse a single row from Google Sheets into a SleepEntry
 */
export function parseRow(row: unknown[]): SleepEntry | null {
  if (!row) {
    return null;
  }

  // Date columns come as Excel serial numbers
  const extractDate = (val: unknown) => {
    if (typeof val === "number") {
      return serialNumberToDate(val);
    }
    // Fallback for string dates (shouldn't happen with SERIAL_NUMBER mode)
    const dateStr = normalize(val);
    return dayjs(dateStr);
  };

  // End Time can be empty (actively sleeping) or a time
  const extractEndTime = (val: unknown): duration.Duration | null => {
    if (val === "" || val === null || val === undefined) {
      return null;
    }
    if (typeof val === "number") {
      return serialNumberToTime(val);
    }
    return null;
  };

  const date = extractDate(row[1]);
  const startTime = serialNumberToTime(row[2] as number);
  const cycle = normalize(row[4]) as "Day" | "Night";

  // Calculate real datetime: date + startTime
  // If night cycle and time is after midnight (early morning), it's the next day
  let realDatetime = date.startOf("day").add(startTime);
  const startMinutes = Math.floor(startTime.asMinutes());
  if (cycle === "Night" && startMinutes < 6 * 60) {
    // Before 6 AM is considered "after midnight" for night cycle
    realDatetime = realDatetime.add(1, "day");
  }

  return {
    addedDate: extractDate(row[0]),
    date,
    startTime,
    endTime: extractEndTime(row[3]),
    cycle,
    length: row[5] === "" ? "" : normalize(row[5]),
    realDatetime,
  };
}

/**
 * Calculate duration between start and end times (in minutes)
 */
function calculateSleepDuration(
  startTime: duration.Duration,
  endTime: duration.Duration
): number {
  const startMinutes = Math.floor(startTime.asMinutes());
  const endMinutes = Math.floor(endTime.asMinutes());

  let diff = endMinutes - startMinutes;

  // Handle midnight crossover
  if (diff < 0) {
    diff += 24 * 60;
  }

  return diff;
}

/**
 * Get current sleep screen data (state + statistics)
 * Runs entirely on client side
 */
export async function getSleepScreenData(
  sheetUrl: string
): Promise<SleepScreenData> {
  const range = `${SLEEP_SHEET}!A:F`;
  const today = dayjs();

  try {
    const result = (await getSheetValues({ data: { sheetUrl, range } })) as {
      values?: unknown[][];
    };
    const rows = (result.values as unknown[][]) || [];

    // Skip header row
    const dataRows = rows.slice(1);

    if (dataRows.length === 0) {
      return {
        state: {
          isActive: false,
          startTime: null,
          duration: 0,
          cycle: null,
          date: null,
          awakeStartTime: null,
          awakeDuration: 0,
        },
        stats: {
          sleepMinutes: 0,
          awakeMinutes: 0,
        },
      };
    }

    // Process all entries
    let activeEntry: SleepEntry | null = null;
    let sleepMinutes = 0;
    const todayEntries: SleepEntry[] = [];
    let lastCompletedEntry: SleepEntry | null = null;

    for (let i = 0; i < dataRows.length; i++) {
      const entry = parseRow(dataRows[i]);
      if (!entry) {
        continue;
      }

      // Check if this is the active sleep period (no end time)
      if (entry.endTime === null) {
        activeEntry = entry;
        if (entry.date.isSame(today, "day")) {
          todayEntries.push(entry);
        }
        continue;
      }

      // Track last completed entry (for awake time calculation)
      // Use realDatetime instead of addedDate for accurate ordering
      if (!lastCompletedEntry || entry.realDatetime.isAfter(lastCompletedEntry.realDatetime)) {
        lastCompletedEntry = entry;
      }

      // Only process completed entries that belong to today
      if (entry.date.isSame(today, "day")) {
        todayEntries.push(entry);
        const sleepDuration = calculateSleepDuration(entry.startTime, entry.endTime);
        sleepMinutes += sleepDuration;
      }
    }

    // Calculate active entry duration and add to sleep totals
    let activeDuration = 0;
    if (activeEntry) {
      activeDuration = getMinutesSince(activeEntry.startTime);
      if (activeEntry.date.isSame(today, "day")) {
        sleepMinutes += activeDuration;
      }
    }

    // Calculate awake time: 24 hours - total sleep time
    const awakeMinutes = Math.max(0, 24 * 60 - sleepMinutes);

    // Calculate awake information when not sleeping
    let awakeStartTime: string | null = null;
    let awakeDuration = 0;
    if (!activeEntry && lastCompletedEntry && lastCompletedEntry.endTime) {
      awakeStartTime = lastCompletedEntry.endTime.format("HH:mm");
      awakeDuration = getMinutesSince(lastCompletedEntry.endTime);
    }

    return {
      state: activeEntry
        ? {
          isActive: true,
          startTime: activeEntry.startTime.format("HH:mm"),
          duration: activeDuration,
          cycle: activeEntry.cycle,
          date: activeEntry.date.format("YYYY-MM-DD"),
          awakeStartTime: null,
          awakeDuration: 0,
        }
        : {
          isActive: false,
          startTime: null,
          duration: 0,
          cycle: null,
          date: null,
          awakeStartTime,
          awakeDuration,
        },
      stats: {
        sleepMinutes,
        awakeMinutes,
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to get sleep screen data: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Start or end sleep tracking
 * If there's an active sleep: ends it (updates End Time)
 * If there's no active sleep: starts new one (creates entry with empty End Time)
 */
export async function toggleSleep(params: {
  sheetUrl: string;
  timeAgo: number;
  cycle: "Day" | "Night";
}): Promise<{ success: boolean; action: "started" | "ended"; }> {
  const { sheetUrl, timeAgo, cycle } = params;

  // Client-side validation
  if (!["Day", "Night"].includes(cycle)) {
    throw new Error("cycle must be Day or Night");
  }
  if (timeAgo < 0 || timeAgo > 180) {
    // Allow up to 3 hours
    throw new Error("timeAgo must be between 0 and 180 minutes");
  }

  const range = `${SLEEP_SHEET}!A:F`;
  const today = dayjs();

  try {
    // 1. Get all current entries
    const result = (await getSheetValues({ data: { sheetUrl, range } })) as {
      values?: unknown[][];
    };
    const rows = (result.values as unknown[][]) || [];

    // 2. Ensure headers exist
    if (rows.length === 0 || rows[0]?.[0] !== HEADERS[0]) {
      await updateSheetValues({
        data: {
          sheetUrl,
          range: `${SLEEP_SHEET}!A1:F1`,
          values: [
            [HEADERS[0], HEADERS[1], HEADERS[2], HEADERS[3], HEADERS[4], HEADERS[5]],
          ],
        },
      });
    }

    // 3. Refresh after potential header write
    const afterHeader = (await getSheetValues({ data: { sheetUrl, range } })) as {
      values?: unknown[][];
    };
    const allRows = (afterHeader.values as unknown[][]) || [];
    const dataRows = allRows.slice(1);

    // 4. Find active entry (no end time)
    let activeEntryIndex = -1;
    let activeEntry: SleepEntry | null = null;
    let lastDate: Dayjs | undefined;

    for (let i = dataRows.length - 1; i >= 0; i--) {
      const entry = parseRow(dataRows[i]);
      if (!entry) {
        continue;
      }

      if (!lastDate) {
        lastDate = entry.date;
      }

      if (entry.endTime === null) {
        activeEntry = entry;
        activeEntryIndex = i + 2; // +1 for header, +1 for 1-based index
        break;
      }
    }

    if (activeEntry && activeEntryIndex > 0) {
      // 5. End active sleep - update End Time column
      const endTime = getTimeAgo(timeAgo);

      await updateSheetValues({
        data: {
          sheetUrl,
          range: `${SLEEP_SHEET}!D${activeEntryIndex}`,
          values: [[endTime]],
        },
      });

      return { success: true, action: "ended" };
    } else {
      // 6. Start new sleep - create entry with empty End Time
      const newDate = calculateDateForCycle(cycle, lastDate || today, today);
      const startTime = getTimeAgo(timeAgo);
      const addedDate = getTimestamp();

      const newEntry = [
        addedDate, // Added Date
        newDate.format("YYYY-MM-DD"), // Date
        startTime, // Start Time
        "", // End Time (empty = actively sleeping)
        cycle, // Cycle (Day/Night)
        "", // Length (empty)
      ];

      await appendSheetValues({
        data: {
          sheetUrl,
          range,
          values: [newEntry],
        },
      });

      return { success: true, action: "started" };
    }
  } catch (error) {
    throw new Error(
      `Failed to toggle sleep: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Keep old function name for backward compatibility during migration
export const addSleepEntry = toggleSleep;
