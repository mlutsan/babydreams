/**
 * Eat Statistics Component
 * Shows weekly trends and feeding insights
 */

import { useMemo } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { ArrowUp, ArrowDown, TrendingUp } from "lucide-react";
import type { DailyEatStat } from "~/lib/eat-service";

dayjs.extend(isoWeek);

interface EatStatsProps {
  dailyStats: DailyEatStat[];
}

interface WeeklyStats {
  totalVolume: number;
  avgDailyVolume: number;
  totalFeedings: number;
  avgFeedingsPerDay: number;
  avgVolumePerFeeding: number;
  daysWithData: number;
}

function calculateWeeklyStats(
  stats: DailyEatStat[],
  weekStart: dayjs.Dayjs
): WeeklyStats {
  const weekEnd = weekStart.add(7, "days");
  const weekStats = stats.filter(
    (s) => s.date.isAfter(weekStart) && s.date.isBefore(weekEnd)
  );

  if (weekStats.length === 0) {
    return {
      totalVolume: 0,
      avgDailyVolume: 0,
      totalFeedings: 0,
      avgFeedingsPerDay: 0,
      avgVolumePerFeeding: 0,
      daysWithData: 0,
    };
  }

  const totalVolume = weekStats.reduce((sum, s) => sum + s.totalVolume, 0);
  const totalFeedings = weekStats.reduce((sum, s) => sum + s.entryCount, 0);

  return {
    totalVolume,
    avgDailyVolume: totalVolume / weekStats.length,
    totalFeedings,
    avgFeedingsPerDay: totalFeedings / weekStats.length,
    avgVolumePerFeeding: totalVolume / totalFeedings,
    daysWithData: weekStats.length,
  };
}

export function EatStats({ dailyStats }: EatStatsProps) {
  const stats = useMemo(() => {
    const now = dayjs();
    const thisWeekStart = now.startOf("week");
    const lastWeekStart = thisWeekStart.subtract(1, "week");

    const thisWeek = calculateWeeklyStats(dailyStats, thisWeekStart);
    const lastWeek = calculateWeeklyStats(dailyStats, lastWeekStart);

    // Calculate percentage change
    let volumeChange = 0;
    if (lastWeek.avgDailyVolume > 0) {
      volumeChange =
        ((thisWeek.avgDailyVolume - lastWeek.avgDailyVolume) /
          lastWeek.avgDailyVolume) *
        100;
    }

    // Find most recent feeding
    const allEntries = dailyStats.flatMap((d) => d.entries);
    const sortedEntries = allEntries.sort(
      (a, b) => b.datetime.unix() - a.datetime.unix()
    );
    const lastFeeding = sortedEntries[0];
    const timeSinceLastFeeding = lastFeeding
      ? now.diff(lastFeeding.datetime, "hours", true)
      : null;

    return {
      thisWeek,
      lastWeek,
      volumeChange,
      timeSinceLastFeeding,
      lastFeeding,
    };
  }, [dailyStats]);

  const { thisWeek, lastWeek, volumeChange, timeSinceLastFeeding } = stats;

  // Don't show if no data
  if (thisWeek.daysWithData === 0 && lastWeek.daysWithData === 0) {
    return null;
  }

  const formatHoursSince = (hours: number | null) => {
    if (hours === null) {
      return "N/A";
    }
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }
    if (hours < 24) {
      return `${hours.toFixed(1)} hrs`;
    }
    return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
  };

  return (
    <div className="space-y-3">
      {/* Weekly Trend */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Weekly Trend
            </h3>
          </div>
          {volumeChange !== 0 && (
            <div
              className={`flex items-center gap-1 text-sm font-semibold ${volumeChange > 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
                }`}
            >
              {volumeChange > 0 ? (
                <ArrowUp className="w-4 h-4" />
              ) : (
                <ArrowDown className="w-4 h-4" />
              )}
              {Math.abs(volumeChange).toFixed(1)}%
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              This Week Avg
            </div>
            <div className="text-2xl font-bold text-amber-600">
              {Math.round(thisWeek.avgDailyVolume)} ml
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {thisWeek.daysWithData} days tracked
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              Last Week Avg
            </div>
            <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
              {Math.round(lastWeek.avgDailyVolume)} ml
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {lastWeek.daysWithData} days tracked
            </div>
          </div>
        </div>
      </div>

      {/* Feeding Insights */}
      <div className="grid grid-cols-3 gap-2">
        {/* Average per Feeding */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            Per Feeding
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {Math.round(thisWeek.avgVolumePerFeeding)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">ml avg</div>
        </div>

        {/* Feedings per Day */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            Per Day
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {thisWeek.avgFeedingsPerDay.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            feedings
          </div>
        </div>

        {/* Time Since Last */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            Last Fed
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {formatHoursSince(timeSinceLastFeeding)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">ago</div>
        </div>
      </div>

      {/* Weekly Total */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              This Week Total
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {thisWeek.totalVolume.toLocaleString()} ml
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              Total Feedings
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {thisWeek.totalFeedings}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
