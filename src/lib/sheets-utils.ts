/**
 * Shared utilities for Google Sheets data conversion
 * These functions can be safely imported by both client and server code
 */

import dayjs, { Dayjs } from "dayjs";
import { Duration } from "dayjs/plugin/duration";

/**
 * Convert Excel serial number to JavaScript Date
 * Excel epoch: December 30, 1899
 */
export function serialNumberToDate(serial: number): Dayjs {
  // Excel's epoch is December 30, 1899
  const excelEpoch = new Date(1899, 11, 30);
  const msPerDay = 24 * 60 * 60 * 1000;
  return dayjs(excelEpoch.getTime() + serial * msPerDay);
}

/**
 * Convert Excel serial number to time Duration
 * Serial number represents fraction of a day (0.0 = midnight, 0.5 = noon, 1.0 = next midnight)
 */
export function serialNumberToTime(serial: number): Duration {
  // Extract just the fractional part (time component)
  const timeFraction = serial - Math.floor(serial);

  // Convert to total seconds in the day
  const totalSeconds = Math.round(timeFraction * 24 * 60 * 60);

  // Return as dayjs Duration
  return dayjs.duration(totalSeconds, "seconds");
}

/**
 * Convert JavaScript Date to Excel serial number
 */
export function dateToSerialNumber(date: Date): number {
  const excelEpoch = new Date(1899, 11, 30);
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = date.getTime() - excelEpoch.getTime();
  return diff / msPerDay;
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
 * Extract spreadsheet ID from various Google Sheets URL formats
 */
export function extractSpreadsheetId(url: string): string | null {
  // Handle different URL formats:
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit...
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}
