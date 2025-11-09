/**
 * Client-side sleep tracking service
 * All business logic runs in the browser
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
const HEADERS = ["Added Date", "Date", "Start Time", "What", "Cycle", "Length"] as const;

export type SleepEntry = {
  addedDate: dayjs.Dayjs;
  date: dayjs.Dayjs;
  startTime: duration.Duration;
  what: "Sleep" | "Wake";
  cycle: "Day" | "Night";
  length: string | number; // Empty string means active period
};

export type SleepState = {
  isActive: boolean;
  state: "Sleep" | "Wake" | null;
  startTime: string | null;
  duration: number;
  cycle: "Day" | "Night" | null;
  date: string | null;
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

  return {
    addedDate: extractDate(row[0]),
    date: extractDate(row[1]),
    startTime: serialNumberToTime(row[2] as number),
    what: normalize(row[3]) as "Sleep" | "Wake",
    cycle: normalize(row[4]) as "Day" | "Night",
    length: row[5] === "" ? "" : normalize(row[5]),
  };
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
    const result = (await getSheetValues({ data: { sheetUrl, range } })) as { values?: unknown[][] };
    const rows = (result.values as unknown[][]) || [];

    // Skip header row
    const dataRows = rows.slice(1);

    if (dataRows.length === 0) {
      return {
        state: {
          isActive: false,
          state: null,
          startTime: null,
          duration: 0,
          cycle: null,
          date: null,
        },
        stats: {
          sleepMinutes: 0,
          awakeMinutes: 0,
        },
      };
    }

    // Process all entries in a single pass
    let activeEntry: SleepEntry | null = null;
    let sleepMinutes = 0;
    let awakeMinutes = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const entry = parseRow(dataRows[i]);
      if (!entry) {
        continue;
      }

      // Check if this is the active period
      if (entry.length === "") {
        activeEntry = entry;
        continue;
      }

      // Only count completed entries that belong to today
      if (entry.date.isSame(today, "day")) {
        const length =
          typeof entry.length === "number"
            ? entry.length
            : parseInt(entry.length, 10);

        if (!isNaN(length)) {
          if (entry.what === "Sleep") {
            sleepMinutes += length;
          } else if (entry.what === "Wake") {
            awakeMinutes += length;
          }
        }
      }
    }

    // Calculate active entry duration and add to totals
    let activeDuration = 0;
    if (activeEntry) {
      activeDuration = getMinutesSince(activeEntry.startTime);
      if (activeEntry.what === "Sleep") {
        sleepMinutes += activeDuration;
      } else if (activeEntry.what === "Wake") {
        awakeMinutes += activeDuration;
      }
    }

    return {
      state: activeEntry
        ? {
            isActive: true,
            state: activeEntry.what,
            startTime: activeEntry.startTime.format("HH:mm"),
            duration: activeDuration,
            cycle: activeEntry.cycle,
            date: activeEntry.date.format("YYYY-MM-DD"),
          }
        : {
            isActive: false,
            state: null,
            startTime: null,
            duration: 0,
            cycle: null,
            date: null,
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
 * Add new sleep entry and close previous period
 * All validation and calculation runs on client side
 */
export async function addSleepEntry(params: {
  today: Date;
  sheetUrl: string;
  endTime: Date;
  timeAgo: number;
  cycle: "Day" | "Night";
  newState: "Sleep" | "Wake";
}): Promise<{ success: boolean }> {
  const { today, sheetUrl, endTime, timeAgo, cycle, newState } = params;

  // Client-side validation
  const endTimeDayjs = dayjs(endTime);
  if (
    !endTimeDayjs.isSame(dayjs(), "date") ||
    Math.abs(endTimeDayjs.diff(dayjs(), "minutes")) > 30
  ) {
    throw new Error("endTime must be between 0 and 30 minutes from now");
  }
  if (!["Day", "Night"].includes(cycle)) {
    throw new Error("cycle must be Day or Night");
  }
  if (!["Sleep", "Wake"].includes(newState)) {
    throw new Error("newState must be Sleep or Wake");
  }

  const range = `${SLEEP_SHEET}!A:F`;
  const todayDayjs = dayjs(today);

  try {
    // 1. Get all current entries
    const result = (await getSheetValues({ data: { sheetUrl, range } })) as { values?: unknown[][] };
    const rows = (result.values as unknown[][]) || [];

    // 2. Ensure headers exist
    if (rows.length === 0 || rows[0]?.[0] !== HEADERS[0]) {
      await updateSheetValues({
        data: {
          sheetUrl,
          range: `${SLEEP_SHEET}!A1:F1`,
          values: [[HEADERS[0], HEADERS[1], HEADERS[2], HEADERS[3], HEADERS[4], HEADERS[5]]],
        },
      });
    }

    // 3. Refresh after potential header write
    const afterHeader = (await getSheetValues({ data: { sheetUrl, range } })) as { values?: unknown[][] };
    const allRows = (afterHeader.values as unknown[][]) || [];
    const dataRows = allRows.slice(1);

    // 4. Find active entry (empty Length)
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

      if (entry.length === "") {
        activeEntry = entry;
        activeEntryIndex = i + 2; // +1 for header, +1 for 1-based index
        break;
      }
    }

    // 5. Close active entry if exists
    if (activeEntry && activeEntryIndex > 0) {
      const start = activeEntry.addedDate.startOf("day").add(activeEntry.startTime);
      const end = dayjs(endTime);

      // FIXED BUG: Added parentheses around (end.unix() - start.unix())
      const length = Math.round((end.unix() - start.unix()) / 60);

      // Update the Length column for the active entry
      await updateSheetValues({
        data: {
          sheetUrl,
          range: `${SLEEP_SHEET}!F${activeEntryIndex}`,
          values: [[length]],
        },
      });
    }

    // 6. Determine date for new entry
    const newDate = calculateDateForCycle(cycle, lastDate || todayDayjs, todayDayjs);

    // 7. Create new entry
    const newStartTime = getTimeAgo(timeAgo);
    const addedDate = getTimestamp();

    const newEntry = [
      addedDate, // Added Date
      newDate.format("YYYY-MM-DD"), // Date
      newStartTime, // Start Time
      newState, // What (Sleep/Wake)
      cycle, // Cycle (Day/Night)
      "", // Length (empty = active)
    ];

    // 8. Append new entry
    await appendSheetValues({
      data: {
        sheetUrl,
        range,
        values: [newEntry],
      },
    });

    return { success: true };
  } catch (error) {
    throw new Error(
      `Failed to add sleep entry: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
