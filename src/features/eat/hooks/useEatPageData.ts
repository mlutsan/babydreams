import { useMemo } from "react";
import { useLogicalDays } from "~/hooks/useLogicalDays";
import { useMinuteTick } from "~/hooks/useMinuteTick";

export type EatStatusMode = "with-meals" | "no-meals-today" | "no-data";

export interface EatStatusCardData {
  mode: EatStatusMode;
  totalVolume: number;
  lastMealTime: string | null;
  lastMealAgo: string | null;
  lastMealVolume: number | null;
}

export interface EatTodaySummaryData {
  lastMealTime: string;
  lastMealAgo: string;
  yesterdayByNowVolume: number;
  yesterdayTotalVolume: number;
}

function formatTimeSince(hoursSinceMeal: number | null) {
  if (hoursSinceMeal === null) {
    return { time: "N/A", duration: "—" };
  }

  if (hoursSinceMeal < 24) {
    const totalMinutes = Math.round(hoursSinceMeal * 60);
    const durationHours = Math.floor(totalMinutes / 60);
    const durationMinutes = totalMinutes % 60;

    return {
      duration: `${String(durationHours).padStart(2, "0")}:${String(durationMinutes).padStart(2, "0")} ago`,
    };
  }

  return {
    duration: "",
  };
}

export function useEatPageData() {
  const now = useMinuteTick();
  const {
    sleepStats,
    eatStats,
    todayEatStat,
    isLoading,
    isError,
    error,
    isHydrated,
    refetch,
  } = useLogicalDays();

  const statusCard = useMemo<EatStatusCardData>(() => {
    const lastMeal = todayEatStat?.entries.at(-1) ?? null;
    const timeSinceLastMeal = lastMeal
      ? now.diff(lastMeal.datetime, "hours", true)
      : null;
    const formattedSince = formatTimeSince(timeSinceLastMeal);

    if (todayEatStat && todayEatStat.totalVolume > 0) {
      return {
        mode: "with-meals",
        totalVolume: todayEatStat.totalVolume,
        lastMealTime: lastMeal?.datetime.format("HH:mm") ?? null,
        lastMealAgo: formattedSince.duration || null,
        lastMealVolume: lastMeal?.volume ?? null,
      };
    }

    if (eatStats.length > 0) {
      return {
        mode: "no-meals-today",
        totalVolume: 0,
        lastMealTime: null,
        lastMealAgo: null,
        lastMealVolume: null,
      };
    }

    return {
      mode: "no-data",
      totalVolume: 0,
      lastMealTime: null,
      lastMealAgo: null,
      lastMealVolume: null,
    };
  }, [todayEatStat, eatStats, now]);

  const todaySummary = useMemo<EatTodaySummaryData>(() => {
    const allEntries = eatStats.flatMap((stat) => stat.entries);
    const sortedEntries = [...allEntries].sort(
      (a, b) => b.datetime.unix() - a.datetime.unix()
    );
    const lastMeal = sortedEntries[0] ?? null;
    const timeSinceLastMeal = lastMeal
      ? now.diff(lastMeal.datetime, "hours", true)
      : null;
    const logicalToday = todayEatStat?.date ?? now.startOf("day");
    const todayStart = logicalToday.startOf("day");
    const minutesIntoDay = Math.max(0, now.diff(todayStart, "minute"));
    const yesterdayStart = todayStart.subtract(1, "day");
    const yesterdayEndSameTime = yesterdayStart.add(minutesIntoDay, "minute");
    const yesterdayEntries = allEntries.filter((entry) =>
      entry.cycleDate.isSame(yesterdayStart, "day")
    );
    const yesterdayTotalVolume = yesterdayEntries.reduce(
      (sum, entry) => sum + entry.volume,
      0
    );
    const yesterdayByNowVolume = yesterdayEntries
      .filter((entry) => {
        return (
          (entry.datetime.isSame(yesterdayStart, "minute") ||
            entry.datetime.isAfter(yesterdayStart)) &&
          (entry.datetime.isSame(yesterdayEndSameTime, "minute") ||
            entry.datetime.isBefore(yesterdayEndSameTime))
        );
      })
      .reduce((sum, entry) => sum + entry.volume, 0);
    const formattedSince = formatTimeSince(timeSinceLastMeal);

    return {
      lastMealTime: lastMeal?.datetime.format("HH:mm") ?? "N/A",
      lastMealAgo: formattedSince.duration || "—",
      yesterdayByNowVolume,
      yesterdayTotalVolume,
    };
  }, [eatStats, todayEatStat, now]);

  return {
    sleepStats,
    eatStats,
    todayEatStat,
    isLoading,
    isError,
    error,
    isHydrated,
    refetch,
    statusCard,
    todaySummary,
  };
}
