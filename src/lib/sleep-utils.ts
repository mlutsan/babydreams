/**
 * Shared utilities for sleep tracking
 * Extracted from sleep-service.ts and history-service.ts
 */

import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import {
  buildWallClockDateTimeFromDuration,
  serialNumberToDate,
  serialNumberToDateTime,
  serialNumberToTime,
} from "~/lib/sheets-utils";
import type { SleepEntry } from "~/types/sleep";

dayjs.extend(duration);

const MAX_ACTIVE_HOURS = 24;
const MAX_DURATION_HOURS = 16;

function deriveEndDatetime(
  startDatetime: dayjs.Dayjs,
  endTime: duration.Duration
): dayjs.Dayjs {
  const startMinutes = startDatetime.hour() * 60 + startDatetime.minute();
  const endMinutes = Math.floor(endTime.asMinutes());
  return buildWallClockDateTimeFromDuration(
    startDatetime,
    endTime,
    endMinutes < startMinutes ? 1 : 0
  );
}

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

  const parseDateTime = (val: unknown): dayjs.Dayjs | null => {
    if (typeof val === "number") {
      if (val >= 1) {
        return serialNumberToDateTime(val);
      }
      return null;
    }
    if (typeof val === "string") {
      const text = normalize(val);
      if (!text) {
        return null;
      }
      if (/\d{4}-\d{2}-\d{2}/.test(text)) {
        const parsed = dayjs(text);
        return parsed.isValid() ? parsed : null;
      }
    }
    return null;
  };

  const parseTimeDuration = (val: unknown): duration.Duration | null => {
    if (val === "" || val === null || val === undefined) {
      return null;
    }
    if (typeof val === "number") {
      if (val >= 1) {
        return null;
      }
      return serialNumberToTime(val);
    }
    const text = normalize(val);
    const match = text.match(/^(\d{1,2}):(\d{2})/);
    if (!match) {
      return null;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return null;
    }
    return dayjs.duration({ hours, minutes });
  };

  const toTimeDuration = (datetime: dayjs.Dayjs): duration.Duration => {
    return dayjs.duration({ hours: datetime.hour(), minutes: datetime.minute() });
  };

  const date = extractDate(row[1]);
  const cycle = normalize(row[4]) as "Day" | "Night";

  const startDateTimeValue = parseDateTime(row[2]);
  const startTimeValue = startDateTimeValue ? toTimeDuration(startDateTimeValue) : parseTimeDuration(row[2]);

  if (!startTimeValue) {
    return null;
  }

  const startMinutes = Math.floor(startTimeValue.asMinutes());
  const realDatetime = startDateTimeValue ?? buildWallClockDateTimeFromDuration(
    date,
    startTimeValue,
    cycle === "Night" && startMinutes < 6 * 60 ? 1 : 0
  );

  const endDateTimeValue = parseDateTime(row[3]);
  const endTimeValue = endDateTimeValue ? toTimeDuration(endDateTimeValue) : parseTimeDuration(row[3]);
  const endTime = endTimeValue ?? null;
  const endDatetime = endTime
    ? endDateTimeValue ?? deriveEndDatetime(realDatetime, endTime)
    : null;

  return {
    addedDate: extractDate(row[0]),
    date,
    startTime: startTimeValue,
    endTime,
    endDatetime,
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

export type SleepEntryEndInfo = {
  endDatetime: dayjs.Dayjs;
  durationMinutes: number;
  isActive: boolean;
  wasCapped: boolean;
};

export function getSleepEntryEndInfo(
  entry: SleepEntry,
  now: dayjs.Dayjs
): SleepEntryEndInfo {
  if (entry.endTime === null) {
    return resolveActiveSleepEnd({
      startDatetime: entry.realDatetime,
      now,
    });
  }

  const endDatetime = entry.endDatetime ?? deriveEndDatetime(entry.realDatetime, entry.endTime);
  return {
    endDatetime,
    durationMinutes: Math.max(0, endDatetime.diff(entry.realDatetime, "minutes")),
    isActive: false,
    wasCapped: false,
  };
}
