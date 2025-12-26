/**
 * Client-side sleep tracking service
 * Handles sleep/wake toggling functionality
 */

import dayjs from "dayjs";
import { getTimestamp, calculateDateForCycle } from "~/lib/date-utils";
import { getSheetValues, appendSheetValues, updateSheetValues, deleteSheetRow } from "~/server/proxy";
import { DailyStat } from "~/types/sleep";

const SLEEP_SHEET = "Sleep";
const HEADERS = ["Added Date", "Date", "Start Time", "End Time", "Cycle"] as const;

async function ensureSleepHeaders(sheetUrl: string) {
  const range = `${SLEEP_SHEET}!A:F`;
  const result = (await getSheetValues({ data: { sheetUrl, range } })) as {
    values?: unknown[][];
  };
  const rows = (result.values as unknown[][]) || [];

  if (rows.length === 0 || rows[0]?.[0] !== HEADERS[0]) {
    await updateSheetValues({
      data: {
        sheetUrl,
        range: `${SLEEP_SHEET}!A1:F1`,
        values: [
          [HEADERS[0], HEADERS[1], HEADERS[2], HEADERS[3], HEADERS[4]],
        ],
      },
    });
  }
}

/**
 * Start or end sleep tracking
 * If there's an active sleep: ends it (updates End Time)
 * If there's no active sleep: starts new one (creates entry with empty End Time)
 */
export async function toggleSleep(params: {
  sheetUrl: string;
  time: string; // HH:mm format (what user sees on screen)
  cycle: "Day" | "Night";
  what: "Sleep" | "Awake";
  todayStat: DailyStat | null;
}): Promise<{ success: boolean; action: "started" | "ended"; }> {
  const { sheetUrl, time, cycle, what, todayStat } = params;

  // Client-side validation
  if (!["Day", "Night"].includes(cycle)) {
    throw new Error("cycle must be Day or Night");
  }
  if (!["Sleep", "Awake"].includes(what)) {
    throw new Error("what must be Sleep or Awake");
  }

  const range = `${SLEEP_SHEET}!A:F`;
  const today = dayjs();

  try {
    // Determine if there's an active sleep session from todayStat
    const activeEntry = todayStat?.hasActiveSleep
      ? todayStat.entries.find(e => e.endTime === null)
      : null;

    if (activeEntry) {
      // Baby is currently sleeping - end the sleep session
      // Validate that we're trying to wake up when baby is sleeping
      if (what !== "Awake") {
        throw new Error("Baby is already sleeping. Cannot start sleep when already asleep.");
      }

      // Use the stored sheet row index from the entry
      // (stored when DailyStat was built in history-service)
      if (!activeEntry.sheetRowIndex) {
        throw new Error("Active sleep entry is missing sheet row index");
      }

      await updateSheetValues({
        data: {
          sheetUrl,
          range: `${SLEEP_SHEET}!D${activeEntry.sheetRowIndex}`,
          values: [[time]],
        },
      });

      return { success: true, action: "ended" };
    } else {
      // Baby is awake - start new sleep session
      // Validate that we're trying to sleep when baby is awake
      if (what !== "Sleep") {
        throw new Error("Baby is already awake. Cannot wake up when not sleeping.");
      }

      // Ensure headers exist
      await ensureSleepHeaders(sheetUrl);

      // Use last entry date from todayStat if available, otherwise use today
      const lastDate = todayStat?.entries.length
        ? todayStat.entries[todayStat.entries.length - 1].date
        : undefined;

      const newDate = calculateDateForCycle(cycle, lastDate || today, today);
      const addedDate = getTimestamp();

      const newEntry = [
        addedDate, // Added Date
        newDate.format("YYYY-MM-DD"), // Date
        time, // Start Time (HH:mm from user)
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

export async function addSleepEntryManual(params: {
  sheetUrl: string;
  date: dayjs.Dayjs;
  startTime: string;
  endTime?: string;
  cycle: "Day" | "Night";
}): Promise<void> {
  const { sheetUrl, date, startTime, endTime, cycle } = params;
  const range = `${SLEEP_SHEET}!A:F`;

  await ensureSleepHeaders(sheetUrl);

  const newEntry = [
    getTimestamp(),
    date.format("YYYY-MM-DD"),
    startTime,
    endTime || "",
    cycle,
    "",
  ];

  await appendSheetValues({
    data: {
      sheetUrl,
      range,
      values: [newEntry],
    },
  });
}

export async function updateSleepEntry(params: {
  sheetUrl: string;
  rowIndex: number;
  date: dayjs.Dayjs;
  startTime: string;
  endTime?: string;
  cycle: "Day" | "Night";
}): Promise<void> {
  const { sheetUrl, rowIndex, date, startTime, endTime, cycle } = params;
  if (!Number.isInteger(rowIndex) || rowIndex < 2) {
    throw new Error("rowIndex must be a valid sheet row");
  }

  const range = `${SLEEP_SHEET}!B${rowIndex}:E${rowIndex}`;
  await updateSheetValues({
    data: {
      sheetUrl,
      range,
      values: [[date.format("YYYY-MM-DD"), startTime, endTime || "", cycle]],
    },
  });
}

export async function deleteSleepEntry(params: {
  sheetUrl: string;
  rowIndex: number;
}): Promise<void> {
  const { sheetUrl, rowIndex } = params;
  if (!Number.isInteger(rowIndex) || rowIndex < 2) {
    throw new Error("rowIndex must be a valid sheet row");
  }

  await deleteSheetRow({
    data: {
      sheetUrl,
      sheetName: SLEEP_SHEET,
      rowIndex,
    },
  });
}
