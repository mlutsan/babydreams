/**
 * Client-side sleep tracking service
 * Handles sleep/wake toggling functionality
 */

import type { Dayjs } from "dayjs";
import { getTimestamp, calculateDateForCycle, timeToMinutes } from "~/lib/date-utils";
import { getSheetValues, appendSheetValues, updateSheetValues, deleteSheetRow } from "~/server/proxy";
import { DailyStat } from "~/types/sleep";
import {
  buildWallClockDateTimeFromMinutes,
  formatDateForSheet,
  formatDateTimeForSheet,
} from "~/lib/sheets-utils";

const SLEEP_SHEET = "Sleep";
const HEADERS = ["Added Date", "Date", "Start Time", "End Time", "Cycle"] as const;

function resolveStartDatetime(params: {
  logicalDate: Dayjs;
  time: string;
  cycle: "Day" | "Night";
  dayStart: string;
}): Dayjs {
  const { logicalDate, time, cycle, dayStart } = params;
  const startMinutes = timeToMinutes(time);
  const dayStartMinutes = timeToMinutes(dayStart);
  return buildWallClockDateTimeFromMinutes(
    logicalDate,
    startMinutes,
    cycle === "Night" && startMinutes < dayStartMinutes ? 1 : 0
  );
}

function resolveEndDatetime(params: {
  startDatetime: Dayjs;
  endTime: string;
}): Dayjs {
  const { startDatetime, endTime } = params;
  const startMinutes = startDatetime.hour() * 60 + startDatetime.minute();
  const endMinutes = timeToMinutes(endTime);
  return buildWallClockDateTimeFromMinutes(
    startDatetime,
    endMinutes,
    endMinutes < startMinutes ? 1 : 0
  );
}

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
  now: Dayjs;
  lastEntryDate?: Dayjs | null;
  dayStart: string;
}): Promise<{ success: boolean; action: "started" | "ended"; }> {
  const { sheetUrl, time, cycle, what, todayStat, now, lastEntryDate, dayStart } = params;

  // Client-side validation
  if (!["Day", "Night"].includes(cycle)) {
    throw new Error("cycle must be Day or Night");
  }
  if (!["Sleep", "Awake"].includes(what)) {
    throw new Error("what must be Sleep or Awake");
  }

  const range = `${SLEEP_SHEET}!A:F`;
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

      const endDatetime = resolveEndDatetime({
        startDatetime: activeEntry.realDatetime,
        endTime: time,
      });

      await updateSheetValues({
        data: {
          sheetUrl,
          range: `${SLEEP_SHEET}!D${activeEntry.sheetRowIndex}`,
          values: [[formatDateTimeForSheet(endDatetime)]],
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

      // Use the last entry date from history if available, otherwise fall back to now.
      const lastDate = lastEntryDate ?? todayStat?.entries.at(-1)?.date ?? now;
      const newDate = calculateDateForCycle(cycle, lastDate, now);
      const startDatetime = resolveStartDatetime({
        logicalDate: newDate,
        time,
        cycle,
        dayStart,
      });
      const addedDate = getTimestamp(now);

      const newEntry = [
        addedDate, // Added Date
        formatDateForSheet(newDate), // Date
        formatDateTimeForSheet(startDatetime), // Start Time
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

export async function addSleepEntryManual(params: {
  sheetUrl: string;
  date: Dayjs;
  startTime: string;
  endTime?: string;
  cycle: "Day" | "Night";
  dayStart: string;
}): Promise<void> {
  const { sheetUrl, date, startTime, endTime, cycle, dayStart } = params;
  const range = `${SLEEP_SHEET}!A:F`;

  await ensureSleepHeaders(sheetUrl);

  const startDatetime = resolveStartDatetime({
    logicalDate: date,
    time: startTime,
    cycle,
    dayStart,
  });
  const endDatetime = endTime
    ? resolveEndDatetime({ startDatetime, endTime })
    : null;

  const newEntry = [
    getTimestamp(),
    formatDateForSheet(date),
    formatDateTimeForSheet(startDatetime),
    endDatetime ? formatDateTimeForSheet(endDatetime) : "",
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
  date: Dayjs;
  startTime: string;
  endTime?: string;
  cycle: "Day" | "Night";
  dayStart: string;
}): Promise<void> {
  const { sheetUrl, rowIndex, date, startTime, endTime, cycle, dayStart } = params;
  if (!Number.isInteger(rowIndex) || rowIndex < 2) {
    throw new Error("rowIndex must be a valid sheet row");
  }

  const startDatetime = resolveStartDatetime({
    logicalDate: date,
    time: startTime,
    cycle,
    dayStart,
  });
  const endDatetime = endTime
    ? resolveEndDatetime({ startDatetime, endTime })
    : null;

  const range = `${SLEEP_SHEET}!B${rowIndex}:E${rowIndex}`;
  await updateSheetValues({
    data: {
      sheetUrl,
      range,
      values: [[
        formatDateForSheet(date),
        formatDateTimeForSheet(startDatetime),
        endDatetime ? formatDateTimeForSheet(endDatetime) : "",
        cycle,
      ]],
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
