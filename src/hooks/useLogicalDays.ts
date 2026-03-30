import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { cycleSettingsAtom, sheetUrlAtom } from "~/lib/atoms";
import { getEatHistory } from "~/lib/eat-service";
import { getHistory } from "~/lib/history-service";
import {
  buildLogicalDays,
  findLogicalDayForMoment,
  findTodaySleepStat,
} from "~/lib/logical-day";
import { getSleepEntryEndInfo, resolveActiveSleepEnd } from "~/lib/sleep-utils";
import { useMinuteTick } from "~/hooks/useMinuteTick";
import type { LogicalDay } from "~/types/logical-day";
import type { DailyStat, SleepState } from "~/types/sleep";

export type UseLogicalDaysResult = {
  logicalDays: LogicalDay[];
  todayLogicalDay: LogicalDay | null;
  todaySleepStat: LogicalDay["sleep"];
  todayEatStat: LogicalDay["eat"];
  sleepStats: DailyStat[];
  eatStats: Array<NonNullable<LogicalDay["eat"]>>;
  sleepState: SleepState | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isHydrated: boolean;
  refetch: () => Promise<unknown>;
};

export function useLogicalDays(): UseLogicalDaysResult {
  const [isHydrated, setIsHydrated] = useState(false);
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const cycleSettings = useAtomValue(cycleSettingsAtom);
  const now = useMinuteTick();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const isEnabled = isHydrated && !!sheetUrl;

  const sleepQuery = useQuery({
    queryKey: ["history", sheetUrl],
    queryFn: () => getHistory(sheetUrl),
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60000,
  });

  const eatQuery = useQuery({
    queryKey: ["eatHistory", sheetUrl],
    queryFn: () => getEatHistory(sheetUrl),
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60000,
  });

  const sleepEntries = useMemo(() => {
    const stats = sleepQuery.data ?? [];
    return stats.flatMap((stat) => stat.entries);
  }, [sleepQuery.data]);

  const eatEntries = useMemo(() => {
    const stats = eatQuery.data ?? [];
    return stats.flatMap((stat) => stat.entries);
  }, [eatQuery.data]);

  const logicalDays = useMemo(() => {
    if (!isEnabled) {
      return [];
    }
    return buildLogicalDays({
      sleepEntries,
      eatEntries,
      dayStart: cycleSettings.dayStart,
      now,
    });
  }, [isEnabled, sleepEntries, eatEntries, cycleSettings.dayStart, now]);

  const sleepStats = useMemo(() => {
    return logicalDays
      .map((day) => day.sleep)
      .filter((stat): stat is DailyStat => stat !== null);
  }, [logicalDays]);

  const eatStats = useMemo(() => {
    return logicalDays
      .map((day) => day.eat)
      .filter((stat): stat is NonNullable<LogicalDay["eat"]> => stat !== null);
  }, [logicalDays]);

  const todayLogicalDay = useMemo(() => {
    if (!logicalDays.length) {
      return null;
    }
    return findLogicalDayForMoment(logicalDays, now);
  }, [logicalDays, now]);

  const todaySleepStat = useMemo(() => {
    if (!sleepStats.length) {
      return null;
    }

    return findTodaySleepStat(sleepStats, now);
  }, [sleepStats, now]);

  const sleepState = useMemo<SleepState | null>(() => {
    const todayStat = todayLogicalDay?.sleep;
    if (!todayStat || !todayStat.entries.length) {
      return null;
    }

    const lastEntry = todayStat.entries[todayStat.entries.length - 1];

    if (lastEntry.endTime === null) {
      const resolved = resolveActiveSleepEnd({
        startDatetime: lastEntry.realDatetime,
        now,
      });

      if (resolved.isActive) {
        const sleepStartTime = lastEntry.startTime.format("HH:mm");
        return {
          isActive: true,
          startTime: sleepStartTime,
          duration: resolved.durationMinutes,
          cycle: lastEntry.cycle,
          date: lastEntry.date.format("YYYY-MM-DD"),
          awakeStartTime: null,
          awakeDuration: 0,
        };
      }

      const awakeDuration = Math.round((now.unix() - resolved.endDatetime.unix()) / 60);
      return {
        isActive: false,
        startTime: null,
        duration: 0,
        cycle: lastEntry.cycle,
        date: lastEntry.date.format("YYYY-MM-DD"),
        awakeStartTime: resolved.endDatetime.format("HH:mm"),
        awakeDuration,
      };
    }

    const endInfo = getSleepEntryEndInfo(lastEntry, now);
    const awakeStartTime = endInfo.endDatetime.format("HH:mm");
    const awakeDuration = Math.round((now.unix() - endInfo.endDatetime.unix()) / 60);

    return {
      isActive: false,
      startTime: null,
      duration: 0,
      cycle: lastEntry.cycle,
      date: lastEntry.date.format("YYYY-MM-DD"),
      awakeStartTime,
      awakeDuration,
    };
  }, [todayLogicalDay, now]);

  const isLoading = isEnabled && (sleepQuery.isLoading || eatQuery.isLoading);
  const isError = sleepQuery.isError || eatQuery.isError;
  const error = sleepQuery.error ?? eatQuery.error ?? null;

  const refetch = async () => {
    const results = await Promise.all([sleepQuery.refetch(), eatQuery.refetch()]);
    return results;
  };

  const todayEatStat = useMemo(() => {
    if (!eatStats.length) {
      return null;
    }

    const calendarToday = eatStats.find((stat) => stat.date.isSame(now, "day"));
    if (calendarToday) {
      return calendarToday;
    }

    return todayLogicalDay?.eat ?? null;
  }, [eatStats, now, todayLogicalDay]);

  return {
    logicalDays,
    todayLogicalDay,
    todaySleepStat,
    todayEatStat,
    sleepStats,
    eatStats,
    sleepState,
    isLoading,
    isError,
    error,
    isHydrated,
    refetch,
  };
}
