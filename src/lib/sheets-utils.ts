/**
 * Shared utilities for Google Sheets data conversion
 * These functions can be safely imported by both client and server code
 */

import dayjs, { Dayjs } from "dayjs";
import type { Duration } from "dayjs/plugin/duration";

const EXCEL_EPOCH_YEAR = 1899;
const EXCEL_EPOCH_MONTH_INDEX = 11;
const EXCEL_EPOCH_DAY = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type DateLike = Date | Dayjs;

type LocalDateParts = {
  year: number;
  monthIndex: number;
  day: number;
};

type LocalTimeParts = {
  hours: number;
  minutes: number;
  seconds?: number;
  milliseconds?: number;
};

function toNativeDate(date: DateLike): Date {
  return date instanceof Date ? date : date.toDate();
}

function normalizeSerial(serial: number): { wholeDays: number; timeMs: number; } {
  let wholeDays = Math.floor(serial);
  let timeMs = Math.round((serial - wholeDays) * MS_PER_DAY);

  if (timeMs >= MS_PER_DAY) {
    wholeDays += Math.floor(timeMs / MS_PER_DAY);
    timeMs %= MS_PER_DAY;
  }

  if (timeMs < 0) {
    const borrowedDays = Math.ceil(Math.abs(timeMs) / MS_PER_DAY);
    wholeDays -= borrowedDays;
    timeMs += borrowedDays * MS_PER_DAY;
  }

  return { wholeDays, timeMs };
}

function getLocalDatePartsFromSerialDay(dayOffset: number): LocalDateParts {
  const date = new Date(Date.UTC(
    EXCEL_EPOCH_YEAR,
    EXCEL_EPOCH_MONTH_INDEX,
    EXCEL_EPOCH_DAY + dayOffset
  ));

  return {
    year: date.getUTCFullYear(),
    monthIndex: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

function getLocalTimePartsFromMs(timeMs: number): Required<LocalTimeParts> {
  const hours = Math.floor(timeMs / (60 * 60 * 1000));
  const minutes = Math.floor((timeMs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((timeMs % (60 * 1000)) / 1000);
  const milliseconds = timeMs % 1000;

  return { hours, minutes, seconds, milliseconds };
}

function buildLocalDayjs(
  dateParts: LocalDateParts,
  timeParts: LocalTimeParts = { hours: 0, minutes: 0 }
): Dayjs {
  const {
    hours = 0,
    minutes = 0,
    seconds = 0,
    milliseconds = 0,
  } = timeParts;

  return dayjs(new Date(
    dateParts.year,
    dateParts.monthIndex,
    dateParts.day,
    hours,
    minutes,
    seconds,
    milliseconds
  ));
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

/**
 * Convert Excel serial number to a local calendar date.
 * Treats the sheet value as a wall-clock date, not an absolute UTC instant.
 */
export function serialNumberToDate(serial: number): Dayjs {
  const { wholeDays } = normalizeSerial(serial);
  return buildLocalDayjs(getLocalDatePartsFromSerialDay(wholeDays));
}

/**
 * Convert Excel serial number to a local wall-clock datetime.
 * The fractional portion is interpreted as time-of-day in the local zone.
 */
export function serialNumberToDateTime(serial: number): Dayjs {
  const { wholeDays, timeMs } = normalizeSerial(serial);
  return buildLocalDayjs(
    getLocalDatePartsFromSerialDay(wholeDays),
    getLocalTimePartsFromMs(timeMs)
  );
}

/**
 * Convert Excel serial number to time Duration
 * Serial number represents fraction of a day (0.0 = midnight, 0.5 = noon, 1.0 = next midnight)
 */
export function serialNumberToTime(serial: number): Duration {
  const { timeMs } = normalizeSerial(serial);
  const totalSeconds = Math.round(timeMs / 1000);

  // Return as dayjs Duration
  return dayjs.duration(totalSeconds, "seconds");
}

/**
 * Convert a local wall-clock date or datetime to an Excel serial number.
 */
export function dateToSerialNumber(date: Date): number {
  const localDate = toNativeDate(date);
  const wholeDays = Math.round(
    (
      Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate()) -
      Date.UTC(EXCEL_EPOCH_YEAR, EXCEL_EPOCH_MONTH_INDEX, EXCEL_EPOCH_DAY)
    ) / MS_PER_DAY
  );
  const timeMs =
    localDate.getHours() * 60 * 60 * 1000 +
    localDate.getMinutes() * 60 * 1000 +
    localDate.getSeconds() * 1000 +
    localDate.getMilliseconds();

  return wholeDays + timeMs / MS_PER_DAY;
}

/**
 * Build a local wall-clock datetime for a given date and clock time.
 * This avoids DST shifts caused by adding minutes to startOf("day").
 */
export function buildWallClockDateTime(
  date: DateLike,
  time: LocalTimeParts,
  dayOffset = 0
): Dayjs {
  const localDate = toNativeDate(date);
  return dayjs(new Date(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate() + dayOffset,
    time.hours,
    time.minutes,
    time.seconds ?? 0,
    time.milliseconds ?? 0
  ));
}

/**
 * Build a local wall-clock datetime at N minutes after midnight.
 */
export function buildWallClockDateTimeFromMinutes(
  date: DateLike,
  totalMinutes: number,
  dayOffset = 0
): Dayjs {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return buildWallClockDateTime(date, { hours, minutes }, dayOffset);
}

/**
 * Build a local wall-clock datetime from a dayjs Duration.
 */
export function buildWallClockDateTimeFromDuration(
  date: DateLike,
  duration: Duration,
  dayOffset = 0
): Dayjs {
  return buildWallClockDateTime(
    date,
    {
      hours: duration.hours(),
      minutes: duration.minutes(),
      seconds: duration.seconds(),
      milliseconds: duration.milliseconds(),
    },
    dayOffset
  );
}

/**
 * Format Date as YYYY-MM-DD
 */
export function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format a local wall-clock datetime for writing back to the sheet.
 */
export function formatDateTimeForSheet(date: DateLike): string {
  const localDate = toNativeDate(date);
  return `${formatDateYYYYMMDD(localDate)} ${pad2(localDate.getHours())}:${pad2(localDate.getMinutes())}`;
}

/**
 * Format a local calendar date for writing back to the sheet.
 */
export function formatDateForSheet(date: DateLike): string {
  return formatDateYYYYMMDD(toNativeDate(date));
}

/**
 * Extract spreadsheet ID from various Google Sheets URL formats
 */
export function extractSpreadsheetId(url: string): string | null {
  // Handle different URL formats:
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit...
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}
