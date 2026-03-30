import dayjs, { type Dayjs } from "dayjs";
import { systemClock } from "~/lib/clock";
import { MINUTES_PER_DAY, timeToMinutes } from "~/lib/date-utils";
import type { LogicalDay } from "~/types/logical-day";

export type PlacementReason = "sleep-window" | "near-daystart" | "fallback";

export type PlacementOption = {
  label: "Start new day" | "Continue night";
  logicalDate: string;
};

export type PlacementDecision = {
  logicalDate: string;
  isAmbiguous: boolean;
  reason: PlacementReason;
  options?: PlacementOption[];
};

export type ResolvePlacementParams = {
  // Selected entry datetime (already resolved to the intended day/time).
  datetime: Dayjs;
  // Logical days built from existing sleep/eat stats.
  logicalDays: LogicalDay[];
  // User-configured day start (HH:mm).
  dayStart: string;
  // Reference "now" for ambiguity checks (defaults to system clock).
  now?: Dayjs;
  // Minutes around dayStart that trigger ambiguity.
  boundaryMinutes?: number;
};

export type CommitPlacementParams = ResolvePlacementParams & {
  overrideLogicalDate?: string | null;
};

export type SleepPlacementDecision = PlacementDecision & {
  cycleDate: Dayjs;
  cycle: "Day" | "Night";
  isAmbiguousCycle: boolean;
  cycleOptions?: Array<{ label: "Day" | "Night"; }>;
};

export function getSleepCycleDateForPlacement(decision: PlacementDecision): Dayjs {
  if (decision.isAmbiguous) {
    return dayjs(decision.logicalDate).subtract(1, "day").startOf("day");
  }
  return dayjs(decision.logicalDate).startOf("day");
}

function isWithinWindow(datetime: Dayjs, start: Dayjs, end: Dayjs): boolean {
  const value = datetime.startOf("minute");
  const startMinute = start.startOf("minute");
  const endMinute = end.startOf("minute");
  const startsBefore = value.isSame(startMinute) || value.isAfter(startMinute);
  const endsAfter = value.isSame(endMinute) || value.isBefore(endMinute);
  return startsBefore && endsAfter;
}

function getFallbackLogicalDate(datetime: Dayjs, dayStart: string): string {
  const dayStartMinutes = timeToMinutes(dayStart);
  const timeMinutes = datetime.hour() * 60 + datetime.minute();
  if (timeMinutes < dayStartMinutes) {
    return datetime.subtract(1, "day").format("YYYY-MM-DD");
  }
  return datetime.format("YYYY-MM-DD");
}

function hasSleepBackedDay(logicalDays: LogicalDay[], logicalDate: string): boolean {
  return logicalDays.some((day) => day.sleep && day.logicalDate === logicalDate);
}

export function resolvePlacement({
  datetime,
  logicalDays,
  dayStart,
  now = systemClock.now(),
  boundaryMinutes = 120,
}: ResolvePlacementParams): PlacementDecision {
  const sleepDay = logicalDays.find(
    (day) => day.sleep && isWithinWindow(datetime, day.startDatetime, day.endDatetime)
  );

  if (sleepDay) {
    return {
      logicalDate: sleepDay.logicalDate,
      isAmbiguous: false,
      reason: "sleep-window",
    };
  }

  const todayKey = now.format("YYYY-MM-DD");
  const yesterdayKey = now.subtract(1, "day").format("YYYY-MM-DD");

  const dayStartMinutes = timeToMinutes(dayStart);
  const timeMinutes = datetime.hour() * 60 + datetime.minute();
  const diff = Math.abs(timeMinutes - dayStartMinutes);
  const distance = Math.min(diff, MINUTES_PER_DAY - diff);

  const isNearBoundary = distance <= boundaryMinutes;
  const isSameCalendarDay = datetime.isSame(now, "day");
  const hasSleepBackedToday = hasSleepBackedDay(logicalDays, todayKey);
  const sleepDayForNow = logicalDays.find(
    (day) => day.sleep && isWithinWindow(now, day.startDatetime, day.endDatetime)
  );
  if (isSameCalendarDay && sleepDayForNow) {
    return {
      logicalDate: sleepDayForNow.logicalDate,
      isAmbiguous: false,
      reason: "sleep-window",
    };
  }

  if (isSameCalendarDay && isNearBoundary && !hasSleepBackedToday) {
    return {
      logicalDate: getFallbackLogicalDate(datetime, dayStart),
      isAmbiguous: true,
      reason: "near-daystart",
      options: [
        { label: "Start new day", logicalDate: todayKey },
        { label: "Continue night", logicalDate: yesterdayKey },
      ],
    };
  }

  return {
    logicalDate: getFallbackLogicalDate(datetime, dayStart),
    isAmbiguous: false,
    reason: "fallback",
  };
}

export function commitPlacement({
  overrideLogicalDate,
  ...params
}: CommitPlacementParams): Dayjs {
  if (overrideLogicalDate) {
    return dayjs(overrideLogicalDate).startOf("day");
  }

  const decision = resolvePlacement(params);
  return dayjs(decision.logicalDate).startOf("day");
}

export function resolveSleepPlacement(
  params: ResolvePlacementParams
): SleepPlacementDecision {
  const decision = resolvePlacement(params);
  const cycleDate = dayjs(decision.logicalDate).startOf("day");
  const cycle = decision.isAmbiguous ? "Night" : "Day";
  const isAmbiguousCycle = decision.isAmbiguous;
  const cycleOptions = decision.isAmbiguous
    ? [{ label: "Night" as const }, { label: "Day" as const }]
    : undefined;
  return {
    ...decision,
    cycleDate,
    cycle,
    isAmbiguousCycle,
    cycleOptions,
  };
}
