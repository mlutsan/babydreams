import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useState, useEffect, useMemo } from "react";
import { sheetUrlAtom } from "~/lib/atoms";
import { getHistory } from "~/lib/history-service";
import dayjs from "dayjs";

/**
 * Hook for fetching sleep history data
 * Shares cache across all pages using queryKey: ["history", sheetUrl]
 */
export function useSleepHistory() {
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const [isHydrated, setIsHydrated] = useState(false);

  // Wait for atoms to hydrate from storage
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Query for all history data (shared with all pages)
  return useQuery({
    queryKey: ["history", sheetUrl],
    queryFn: () => getHistory(sheetUrl),
    enabled: isHydrated && !!sheetUrl,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchInterval: 60000, // Refresh every minute
  });
}

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
 * Hook for getting today's sleep stat
 * Returns the most recent DailyStat that represents "today"
 */
export function useTodaySleepStat() {
  const { data: allStats, ...queryResult } = useSleepHistory();

  // Find today's stat from the history
  const todayStat = useMemo(() => {
    if (!allStats || allStats.length === 0) {
      return null;
    }

    const now = dayjs();
    // Find the stat where endDatetime is today
    const today = allStats.at(-1) || null;
    if (now.isSame(today?.startDatetime, "date")) {
      return today;
    }
    if (today && today.startDatetime.diff(now, "days") < 1) {
      const lastEntry = today.entries.at(-1);
      if (!lastEntry) {
        return null;
      }

      // if no end time: 
      // return today if now() is < 12
      if (lastEntry.cycle == "Night"
        && !lastEntry.endTime
        && now.hour() < 13) {
        return today;
      }
    }
    return null;
  }, [allStats]);

  // Extract sleep state from today's data using the last entry
  const sleepState = useMemo(() => {
    if (!todayStat || !todayStat.entries || todayStat.entries.length === 0) {
      return null;
    }

    const now = dayjs();
    const lastEntry = todayStat.entries[todayStat.entries.length - 1];

    if (lastEntry.endTime === null) {
      // Baby is currently sleeping
      const sleepStartTime = lastEntry.startTime.format("HH:mm");
      const durationMinutes = Math.round((now.unix() - lastEntry.realDatetime.unix()) / 60);

      return {
        isActive: true,
        startTime: sleepStartTime,
        duration: durationMinutes,
        cycle: lastEntry.cycle,
        date: lastEntry.date.format("YYYY-MM-DD"),
        awakeStartTime: null,
        awakeDuration: 0,
      };
    } else {
      // Baby is awake
      const awakeStartTime = lastEntry.endTime.format("HH:mm");
      const awakeStart = lastEntry.date.startOf("day").add(lastEntry.endTime);
      const awakeDuration = Math.round((now.unix() - awakeStart.unix()) / 60);

      return {
        isActive: false,
        startTime: null,
        duration: 0,
        cycle: lastEntry.cycle,
        date: lastEntry.date.format("YYYY-MM-DD"),
        awakeStartTime,
        awakeDuration,
      };
    }
  }, [todayStat]);

  return {
    todayStat,
    sleepState,
    allStats,
    ...queryResult,
  };
}
