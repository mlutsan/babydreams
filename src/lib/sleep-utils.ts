/**
 * Shared utilities for sleep tracking
 * Extracted from sleep-service.ts and history-service.ts
 */

import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { serialNumberToDate, serialNumberToTime } from "~/lib/sheets-utils";
import type { SleepEntry } from "~/types/sleep";

dayjs.extend(duration);

const MAX_ACTIVE_HOURS = 24;
const MAX_DURATION_HOURS = 16;

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
 * Calculate sleep duration in minutes
 * From history-service.ts (canonical version)
 */
export function calculateSleepDuration(
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
 * Resolve an active sleep session end time.
 * If it's older than maxActiveHours, cap duration to maxDurationHours.
 */
export function resolveActiveSleepEnd(params: {
  startDatetime: dayjs.Dayjs;
  now: dayjs.Dayjs;
}): {
  endDatetime: dayjs.Dayjs;
  durationMinutes: number;
  isActive: boolean;
  wasCapped: boolean;
} {
  const { startDatetime, now } = params;

  const elapsedMinutes = now.diff(startDatetime, "minutes");
  const maxActiveMinutes = MAX_ACTIVE_HOURS * 60;

  if (elapsedMinutes > maxActiveMinutes) {
    const endDatetime = startDatetime.add(MAX_DURATION_HOURS, "hour");
    return {
      endDatetime,
      durationMinutes: endDatetime.diff(startDatetime, "minutes"),
      isActive: false,
      wasCapped: true,
    };
  }

  return {
    endDatetime: now,
    durationMinutes: elapsedMinutes,
    isActive: true,
    wasCapped: false,
  };
}
