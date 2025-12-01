/**
 * Eat Statistics Component
 * Shows rolling 7-day trends and feeding insights
 */

import { useMemo } from "react";
import dayjs from "dayjs";
import { Block, BlockTitle } from "konsta/react";
import type { DailyEatStat } from "~/lib/eat-service";

interface EatStatsProps {
  dailyStats: DailyEatStat[];
}

interface WindowStats {
  totalVolume: number;
  avgDailyVolume: number;
  totalMeals: number;
  avgMealsPerDay: number;
  avgVolumePerMeal: number;
  daysWithData: number;
}

function calculateRangeStats(
  stats: DailyEatStat[],
  rangeStart: dayjs.Dayjs,
  rangeEnd: dayjs.Dayjs
): WindowStats {
  const windowStats = stats.filter((s) => {
    const date = s.date;
    return (
      (date.isSame(rangeStart, "day") || date.isAfter(rangeStart)) &&
      (date.isSame(rangeEnd, "day") || date.isBefore(rangeEnd))
    );
  });

  if (windowStats.length === 0) {
    return {
      totalVolume: 0,
      avgDailyVolume: 0,
      totalMeals: 0,
      avgMealsPerDay: 0,
      avgVolumePerMeal: 0,
      daysWithData: 0,
    };
  }

  const totalVolume = windowStats.reduce((sum, s) => sum + s.totalVolume, 0);
  const totalMeals = windowStats.reduce((sum, s) => sum + s.entryCount, 0);

  return {
    totalVolume,
    avgDailyVolume: totalVolume / windowStats.length,
    totalMeals,
    avgMealsPerDay: totalMeals / windowStats.length,
    avgVolumePerMeal: totalVolume / totalMeals,
    daysWithData: windowStats.length,
  };
}

type TimeBucketKey = "morning" | "afternoon" | "evening" | "night";

const TIME_BUCKETS: Array<{
  key: TimeBucketKey;
  label: string;
  startHour: number;
  endHour: number;
  wraps?: boolean;
}> = [
    { key: "morning", label: "Morning", startHour: 6, endHour: 11 },
    { key: "afternoon", label: "Afternoon", startHour: 12, endHour: 17 },
    { key: "evening", label: "Evening", startHour: 18, endHour: 21 },
    { key: "night", label: "Night", startHour: 22, endHour: 5, wraps: true },
  ];

const DAY_NIGHT_SPLIT = { dayStart: 6, dayEnd: 18 }; // 06:00-17:59 day, otherwise night

function isWithinBucket(hour: number, bucket: typeof TIME_BUCKETS[number]): boolean {
  if (bucket.wraps) {
    // Night bucket crosses midnight
    return hour >= bucket.startHour || hour <= bucket.endHour;
  }
  return hour >= bucket.startHour && hour <= bucket.endHour;
}

function describeConsistency(volumes: number[]): string {
  if (volumes.length < 2) {
    return "Not enough data";
  }
  const avg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  if (avg === 0) {
    return "No data";
  }
  const variance =
    volumes.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (volumes.length - 1);
  const stdDev = Math.sqrt(variance);
  const coeffVar = stdDev / avg;

  if (coeffVar < 0.1) {
    return "Very steady";
  }
  if (coeffVar < 0.25) {
    return "Slightly variable";
  }
  return "Quite variable";
}

export function EatStats({ dailyStats }: EatStatsProps) {
  const stats = useMemo(() => {
    const now = dayjs();
    const logicalToday = dailyStats[0]?.date ?? now.startOf("day");
    const todayStart = logicalToday.startOf("day");
    const nowEnd = now.endOf("day");
    const rollingStart = todayStart.subtract(6, "day"); // 7-day window including today
    const previousStart = rollingStart.subtract(7, "day");
    const previousEnd = rollingStart.subtract(1, "day").endOf("day");

    const currentWindow = calculateRangeStats(dailyStats, rollingStart, nowEnd);
    const previousWindow = calculateRangeStats(dailyStats, previousStart, previousEnd);

    // Calculate percentage change
    let volumeChange = 0;
    if (previousWindow.avgDailyVolume > 0) {
      volumeChange =
        ((currentWindow.avgDailyVolume - previousWindow.avgDailyVolume) /
          previousWindow.avgDailyVolume) *
        100;
    }

    const allEntries = dailyStats.flatMap((d) => d.entries);

    // Last meal info
    const sortedEntries = [...allEntries].sort(
      (a, b) => b.datetime.unix() - a.datetime.unix()
    );
    const lastMeal = sortedEntries[0];
    const timeSinceLastMeal = lastMeal
      ? now.diff(lastMeal.datetime, "hours", true)
      : null;

    // Per-day totals for consistency (last 7 days)
    const last7DaysStats = dailyStats.filter(
      (d) =>
        (d.date.isSame(rollingStart, "day") || d.date.isAfter(rollingStart)) &&
        (d.date.isSame(nowEnd, "day") || d.date.isBefore(nowEnd))
    );
    const last7Totals = last7DaysStats.map((d) => d.totalVolume);

    // Time-of-day buckets over last 7 days
    const last7Entries = allEntries.filter(
      (e) =>
        (e.datetime.isSame(rollingStart, "day") || e.datetime.isAfter(rollingStart)) &&
        (e.datetime.isSame(nowEnd, "day") || e.datetime.isBefore(nowEnd))
    );
    const bucketVolumes: Record<TimeBucketKey, number> = {
      morning: 0,
      afternoon: 0,
      evening: 0,
      night: 0,
    };
    last7Entries.forEach((e) => {
      const hour = e.datetime.hour();
      const bucket = TIME_BUCKETS.find((b) => isWithinBucket(hour, b));
      if (bucket) {
        bucketVolumes[bucket.key] += e.volume;
      }
    });

    // Day vs night split (7-day)
    let dayVolume = 0;
    let nightVolume = 0;
    let nightFeeds = 0;
    last7Entries.forEach((e) => {
      const hour = e.datetime.hour();
      const isDay = hour >= DAY_NIGHT_SPLIT.dayStart && hour < DAY_NIGHT_SPLIT.dayEnd;
      if (isDay) {
        dayVolume += e.volume;
      } else {
        nightVolume += e.volume;
        nightFeeds += 1;
      }
    });
    const daysCount = last7Totals.length || 0;
    const nightFeedsPerDay = daysCount > 0 ? nightFeeds / daysCount : 0;
    const bucketAverages: Record<TimeBucketKey, number> = {
      morning: daysCount > 0 ? bucketVolumes.morning / daysCount : 0,
      afternoon: daysCount > 0 ? bucketVolumes.afternoon / daysCount : 0,
      evening: daysCount > 0 ? bucketVolumes.evening / daysCount : 0,
      night: daysCount > 0 ? bucketVolumes.night / daysCount : 0,
    };
    const bucketAverageTotal = Object.values(bucketAverages).reduce((sum, v) => sum + v, 0);
    const consistencyLabel = describeConsistency(last7Totals);
    const totalMealsLast7 = last7DaysStats.reduce((sum, d) => sum + d.entryCount, 0);
    const avgMealsPerDayLast7 = last7DaysStats.length > 0 ? totalMealsLast7 / last7DaysStats.length : 0;

    return {
      currentWindow,
      previousWindow,
      volumeChange,
      timeSinceLastMeal,
      lastMeal,
      todayStart,
      bucketAverages,
      dayVolume,
      nightVolume,
      nightFeeds,
      nightFeedsPerDay,
      bucketAverageTotal,
      consistencyLabel,
      avgMealsPerDayLast7,
    };
  }, [dailyStats]);

  const {
    currentWindow,
    previousWindow,
    volumeChange,
    timeSinceLastMeal,
    lastMeal,
    todayStart,
    bucketAverages,
    dayVolume,
    nightVolume,
    nightFeeds,
    nightFeedsPerDay,
    bucketAverageTotal,
    consistencyLabel,
    avgMealsPerDayLast7,
  } = stats;

  // Don't show if no data
  if (currentWindow.daysWithData === 0 && previousWindow.daysWithData === 0) {
    return null;
  }

  const now = dayjs();

  // Flatten entries for today's and rolling calculations
  const allEntries = dailyStats.flatMap((d) => d.entries);

  const todayEntries = allEntries.filter((e) => e.cycleDate.isSame(todayStart, "day"));
  const totalTodayVolume = todayEntries.reduce((sum, e) => sum + e.volume, 0);
  const todayMealCount = todayEntries.length;

  // Yesterday volumes (logical day) and by-this-time comparison
  const minutesIntoDay = Math.max(0, now.diff(todayStart, "minute"));
  const yesterdayStart = todayStart.subtract(1, "day");
  const yesterdayEndSameTime = yesterdayStart.add(minutesIntoDay, "minute");
  const yesterdayEntries = allEntries.filter((e) => e.cycleDate.isSame(yesterdayStart, "day"));
  const yesterdayTotalVolume = yesterdayEntries.reduce((sum, e) => sum + e.volume, 0);
  const yesterdayByNowVolume = yesterdayEntries
    .filter(
      (e) =>
        (e.datetime.isSame(yesterdayStart, "minute") || e.datetime.isAfter(yesterdayStart)) &&
        (e.datetime.isSame(yesterdayEndSameTime, "minute") || e.datetime.isBefore(yesterdayEndSameTime))
    )
    .reduce((sum, e) => sum + e.volume, 0);

  const avgMeals = avgMealsPerDayLast7;
  const formatTimeSince = () => {
    if (!lastMeal) {
      return { time: "N/A", duration: "" };
    }
    const hours = timeSinceLastMeal || 0;
    if (hours < 24) {
      // Show time (HH:mm) for meals within last 24 hours
      const totalMinutes = Math.round(hours * 60);
      const durationHours = Math.floor(totalMinutes / 60);
      const durationMinutes = totalMinutes % 60;
      const durationStr = `${String(durationHours).padStart(2, "0")}:${String(durationMinutes).padStart(2, "0")} ago`;

      return {
        time: lastMeal.datetime.format("HH:mm"),
        duration: durationStr
      };
    }
    // Show days ago for older meals
    return {
      time: `${Math.floor(hours / 24)}d ago`,
      duration: ""
    };
  };

  const todayAvgPerMeal = todayMealCount > 0 ? Math.round(totalTodayVolume / todayMealCount) : null;
  const { time: lastMealTime, duration: lastMealAgo } = formatTimeSince();

  return (
    <div className="space-y-4">
      <BlockTitle>Today</BlockTitle>
      <Block strong inset className="space-y-3">

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Per Meal</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {todayAvgPerMeal !== null ? todayAvgPerMeal : "N/A"}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">ml avg</div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Last Meal</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {lastMealTime}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {lastMealAgo || "—"}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">vs Yesterday</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {yesterdayByNowVolume} ml
              <div className="text-xs text-gray-500 dark:text-gray-400"> by now</div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              total: {yesterdayTotalVolume} ml
            </div>
          </div>
        </div>
      </Block>

      <Block strong inset className="space-y-3 hidden" >
        {/* Patterns Over Time */}

        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Patterns Over Time
          </h3>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Rolling 7 days
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Rolling avg vs prior</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {previousWindow.avgDailyVolume > 0
                ? `${volumeChange >= 0 ? "Up" : "Down"} ${Math.abs(volumeChange).toFixed(1)}%`
                : "N/A"}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Day-to-day consistency</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {consistencyLabel}
            </span>
          </div>
        </div>

        <div className="pt-2 space-y-2">
          <div className="text-xs text-gray-600 dark:text-gray-400">Typical by time of day</div>
          {bucketAverageTotal === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>
          ) : (
            TIME_BUCKETS.map((bucket) => {
              const volume = bucketAverages[bucket.key];
              const pct = bucketAverageTotal > 0 ? Math.round((volume / bucketAverageTotal) * 100) : 0;
              return (
                <div key={bucket.key} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{bucket.label}</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {Math.round(volume)} ml ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="h-full bg-amber-500"
                      style={{ width: `${Math.min(100, Math.max(pct, 4))}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-2 space-y-1">
          <div className="text-xs text-gray-600 dark:text-gray-400">Day vs night feeds (7d)</div>
          {dayVolume + nightVolume === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">Daytime volume</span>
                <span className="text-gray-900 dark:text-gray-100 font-semibold">
                  {Math.round((dayVolume / (dayVolume + nightVolume)) * 100)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">Night volume</span>
                <span className="text-gray-900 dark:text-gray-100 font-semibold">
                  {Math.round((nightVolume / (dayVolume + nightVolume)) * 100)}%
                </span>
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Night feeds per day:{" "}
                <span className="font-semibold">
                  {nightFeedsPerDay > 0 ? nightFeedsPerDay.toFixed(1) : "0.0"}
                </span>
              </div>
            </>
          )}
        </div>

      </Block>
    </div>
  );
}
