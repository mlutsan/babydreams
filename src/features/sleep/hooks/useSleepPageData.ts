import { useMemo } from "react";
import { useLogicalDays } from "~/hooks/useLogicalDays";
import { useMinuteTick } from "~/hooks/useMinuteTick";
import {
  buildSleepTodaySummary,
  type SleepTodaySummaryData,
} from "~/features/sleep/lib/sleep-page-summary";

export type SleepPageStatusMode = "sleeping" | "awake" | "empty" | "today-empty";

export interface SleepPageStatus {
  mode: SleepPageStatusMode;
  sinceTime: string | null;
  sinceDurationMinutes: number | null;
}

export function useSleepPageData() {
  const now = useMinuteTick();
  const {
    todaySleepStat,
    sleepState,
    sleepStats,
    isLoading,
  } = useLogicalDays();

  const yesterdayNightWake = useMemo(() => {
    if (sleepState || sleepStats.length === 0) {
      return null;
    }

    const latestStat = sleepStats.at(-1);
    if (!latestStat) {
      return null;
    }

    const awakeStart = latestStat.endDatetime;
    if (!awakeStart.isSame(now, "day")) {
      return null;
    }

    return {
      awakeStartTime: awakeStart.format("HH:mm"),
      awakeDuration: now.diff(awakeStart, "minutes"),
    };
  }, [sleepState, sleepStats, now]);

  const todaySummary = useMemo<SleepTodaySummaryData>(() => {
    return buildSleepTodaySummary({
      todaySleepStat,
      fallbackAwakeDuration: yesterdayNightWake?.awakeDuration ?? null,
      now,
    });
  }, [todaySleepStat, yesterdayNightWake, now]);

  const status = useMemo<SleepPageStatus>(() => {
    if (sleepState?.isActive) {
      return {
        mode: "sleeping",
        sinceTime: sleepState.startTime,
        sinceDurationMinutes: sleepState.duration,
      };
    }

    if (sleepState?.awakeStartTime) {
      return {
        mode: "awake",
        sinceTime: sleepState.awakeStartTime,
        sinceDurationMinutes: sleepState.awakeDuration,
      };
    }

    if (yesterdayNightWake) {
      return {
        mode: "awake",
        sinceTime: yesterdayNightWake.awakeStartTime,
        sinceDurationMinutes: yesterdayNightWake.awakeDuration,
      };
    }

    if (sleepStats.length === 0) {
      return {
        mode: "empty",
        sinceTime: null,
        sinceDurationMinutes: null,
      };
    }

    return {
      mode: "today-empty",
      sinceTime: null,
      sinceDurationMinutes: null,
    };
  }, [sleepState, yesterdayNightWake, sleepStats]);

  return {
    sleepStats,
    isLoading,
    status,
    todaySummary,
  };
}
