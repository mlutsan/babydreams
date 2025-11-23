/**
 * Date and time utilities for sleep/eat tracking
 * Uses dayjs for reliable date/time operations
 */

import dayjs, { Dayjs } from "dayjs";
import duration from "dayjs/plugin/duration";


/**
 * Convert minutes to human-readable duration format "2h 15m" or "45m"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 0) {
    return "0m";
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  }

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}

/**
 * Convert minutes to HH:mm format (e.g., "02:15")
 */
export function formatDurationHHMM(minutes: number): string {
  if (minutes < 0) {
    return "00:00";
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const hh = hours.toString().padStart(2, "0");
  const mm = mins.toString().padStart(2, "0");

  return `${hh}:${mm}`;
}

/**
 * Generate time picker options for "now" or up to 30 minutes ago
 */
export function getTimeAgoOptions(): Array<{ label: string; value: number; }> {
  return [
    { label: "Now", value: 0 },
    { label: "5 min ago", value: 5 },
    { label: "10 min ago", value: 10 },
    { label: "15 min ago", value: 15 },
    { label: "20 min ago", value: 20 },
    { label: "25 min ago", value: 25 },
    { label: "30 min ago", value: 30 },
  ];
}

/**
 * Get current time in HH:mm format
 */
export function getCurrentTime(): string {
  return dayjs().format("HH:mm");
}

/**
 * Get timestamp in YYYY-MM-DD HH:mm format
 */
export function getTimestamp(): string {
  return dayjs().format("YYYY-MM-DD HH:mm");
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
  return dayjs().format("YYYY-MM-DD");
}

/**
 * Get yesterday's date in YYYY-MM-DD format
 */
export function getYesterdayDate(): string {
  return dayjs().subtract(1, "day").format("YYYY-MM-DD");
}

/**
 * Calculate logical date based on cycle
 * Night entries belong to previous day until first Day entry
 *
 * @param cycle - Day or Night
 * @param lastDate - Optional last logical date from previous entry
 * @returns Date in YYYY-MM-DD format
 */
export function calculateDateForCycle(
  cycle: "Day" | "Night",
  lastDate: Dayjs,
  today: Dayjs,
): Dayjs {

  // If it's a Day cycle, always use today's date
  if (cycle === "Day") {
    return today;
  }

  // If there's no previous entry (first entry ever), use today
  // Even for Night - the "night belongs to previous day" rule only
  // applies when continuing an existing day
  if (!lastDate) {
    return today;
  }

  // For Night cycle with existing entries:
  // Keep using the lastDate if it's yesterday or earlier
  // This maintains the "night belongs to previous day" logic
  const yesterday = today.add(-1, "day");
  if (lastDate <= yesterday) {
    return lastDate;
  }

  // If lastDate is today, keep it (day hasn't changed yet)
  return lastDate;
}

/**
 * Calculate duration in minutes between two HH:mm times
 * Handles times that cross midnight
 */
export function calculateLength(startTime: string, endTime: string): number {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);

  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;

  let duration = endTotalMinutes - startTotalMinutes;

  // If duration is negative, it crossed midnight
  if (duration < 0) {
    duration += 24 * 60; // Add 24 hours
  }

  return duration;
}

/**
 * Subtract minutes from current time and return HH:mm
 */
export function getTimeAgo(minutesAgo: number): string {
  return dayjs().subtract(minutesAgo, "minute").format("HH:mm");
}

/**
 * Parse HH:mm time string and get total minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Calculate how many minutes have passed since a given HH:mm time today
 * If the time is in the future (crossed midnight), calculate properly
 */
export function getMinutesSince(startTime: duration.Duration): number {
  const now = dayjs();
  const currentMinutes = now.hour() * 60 + now.minute();
  const startMinutes = timeToMinutes(startTime.format("HH:mm"));

  let duration = currentMinutes - startMinutes;

  // If duration is negative, the start time was yesterday (crossed midnight)
  if (duration < 0) {
    duration += 24 * 60; // Add 24 hours
  }

  return duration;
}

/**
 * Format time ago label for slider (e.g., "Now", "5 minutes ago", "1 minute ago")
 */
export function formatTimeAgoLabel(minutesAgo: number): string {
  if (minutesAgo === 0) {
    return "Now";
  }
  if (minutesAgo === 1) {
    return "1 minute ago";
  }
  return `${minutesAgo} minutes ago`;
}

/**
 * Add minutes to a HH:mm time string
 * Handles wrapping around midnight
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const date = dayjs().hour(hours).minute(mins).add(minutes, "minute");
  return date.format("HH:mm");
}

/**
 * Subtract minutes from a HH:mm time string
 * Handles wrapping around midnight
 */
export function subtractMinutesFromTime(time: string, minutes: number): string {
  return addMinutesToTime(time, -minutes);
}

/**
 * Calculate how many minutes ago a given time (HH:mm) was from now
 * Returns positive number for past times, negative for future times
 * Handles midnight crossover (if time is in past but after midnight)
 */
export function getTimeAgoFromManualInput(time: string): number {
  if (!time) {
    return 0;
  }

  const now = dayjs();
  const currentMinutes = now.hour() * 60 + now.minute();
  const inputMinutes = timeToMinutes(time);

  let diff = currentMinutes - inputMinutes;

  // If negative (time is in future), check if it's really future or crossed midnight
  // If very negative (> 12 hours), assume it's from yesterday (crossed midnight)
  if (diff < 0 && diff <= -12 * 60) {
    // Time is in the far past (crossed midnight yesterday)
    diff += 24 * 60;
  }

  // Return diff as-is: positive for past, negative for future
  return diff;
}
