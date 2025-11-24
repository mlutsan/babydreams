/**
 * Shared types for sleep tracking
 */

import dayjs from "dayjs";
import type { Duration } from "dayjs/plugin/duration";

/**
 * A single sleep entry from the Google Sheet
 */
export type SleepEntry = {
  addedDate: dayjs.Dayjs;
  date: dayjs.Dayjs;
  startTime: Duration;
  endTime: Duration | null; // null means actively sleeping
  cycle: "Day" | "Night";
  length: string | number; // Computed column for reference
  realDatetime: dayjs.Dayjs; // Computed: actual datetime of sleep (date + startTime, adjusted for night after midnight)
  sheetRowIndex?: number; // 1-based row index in Google Sheet (includes header row)
};

/**
 * Current sleep state (active or awake)
 */
export type SleepState = {
  isActive: boolean;
  startTime: string | null;
  duration: number;
  cycle: "Day" | "Night";
  date: string;
  awakeStartTime: string | null;
  awakeDuration: number;
};

/**
 * Daily sleep statistics
 */
export type SleepStats = {
  sleepMinutes: number;
  awakeMinutes: number;
};

/**
 * Aggregated statistics for a logical day (from one wake-up to the next)
 */
export type DailyStat = {
  startDatetime: dayjs.Dayjs; // Start of logical day (first wake or midnight)
  endDatetime: dayjs.Dayjs;   // End of logical day (next wake or current time)
  logicalDate: string;        // YYYY-MM-DD for the logical day
  totalSleepMinutes: number;  // Total sleep in this logical day
  awakeMinutes: number;       // Total awake time
  daySleepMinutes: number;    // Sleep during day cycle
  nightSleepMinutes: number;  // Sleep during night cycle
  sessionCount: number;       // Number of sleep sessions
  hasActiveSleep: boolean;    // Has ongoing sleep session
  entries: SleepEntry[];      // All sleep entries in this logical day
};
