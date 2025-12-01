"use client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { useState, useMemo, useEffect } from "react";
import { sheetUrlAtom, babyNameAtom } from "~/lib/atoms";
import { Block, BlockTitle, Button, Preloader } from "konsta/react";
import { Moon, Sun, History as HistoryIcon } from "lucide-react";
import { formatDuration, formatDurationHHMM } from "~/lib/date-utils";
import { SleepModal } from "~/components/mobile/SleepModal";
import { ResponsiveSleepTimeline } from "~/components/mobile/SleepTimeline";
import { useTodaySleepStat } from "~/hooks/useSleepHistory";
import { useSleepMutation } from "~/hooks/useSleepMutation";
import dayjs from "dayjs";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const babyName = useAtomValue(babyNameAtom);
  const [modalOpen, setModalOpen] = useState(false);
  const [now, setNow] = useState(dayjs());

  // Use the shared sleep history hook
  const { todayStat, sleepState, isLoading, allStats } = useTodaySleepStat();

  // Update 'now' every minute to refresh awake time display
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(dayjs());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Calculate current awake duration in real-time
  const currentAwakeDuration = useMemo(() => {
    if (!sleepState || sleepState.isActive) {
      return 0;
    }

    // Get the latest stat entry (could be today or yesterday)
    const latestStat = allStats?.[allStats.length - 1];
    const lastEntry = latestStat?.entries[latestStat.entries.length - 1];

    if (!lastEntry?.endTime) {
      return 0;
    }

    const awakeStart = lastEntry.date.startOf("day").add(lastEntry.endTime);
    return Math.round((now.unix() - awakeStart.unix()) / 60);
  }, [sleepState, allStats, now]);

  const todayStats = todayStat ? {
    sleepMinutes: todayStat.totalSleepMinutes,
    // Include both past awake time and current awake duration
    awakeMinutes: todayStat.awakeMinutes + currentAwakeDuration,
  } : null;

  // Calculate historical averages for comparison (last 7 days excluding today)
  const historicalAvg = useMemo(() => {
    if (!allStats || allStats.length < 2) {
      return null;
    }

    const recentStats = allStats.slice(-8, -1); // Last 7 days before today
    if (recentStats.length === 0) {
      return null;
    }

    const avgSleep = Math.round(
      recentStats.reduce((sum, stat) => sum + stat.totalSleepMinutes, 0) / recentStats.length
    );
    const avgSessions = Math.round(
      recentStats.reduce((sum, stat) => sum + stat.sessionCount, 0) / recentStats.length
    );

    return { avgSleep, avgSessions };
  }, [allStats]);

  // Use the reusable sleep mutation hook
  const trackMutation = useSleepMutation();

  // Check if sheet URL is configured
  if (!sheetUrl) {
    return (
      <Block strong inset className="text-center">
        <BlockTitle>Welcome to Baby Dreams</BlockTitle>
        <p>Please configure your Google Sheet in Settings first.</p>
      </Block>
    );
  }

  const isSleeping = sleepState?.isActive || false;

  const handleTrackSleep = (time: string, cycle: "Day" | "Night") => {
    if (!sheetUrl) {
      return;
    }

    trackMutation.mutate(
      {
        sheetUrl,
        time,
        cycle,
        what: isSleeping ? "Awake" : "Sleep",
        todayStat: todayStat || null,
      },
      {
        onSuccess: () => {
          setModalOpen(false);
        },
      }
    );
  };
  const displayName = babyName || "Baby";

  if (isLoading) {
    return (
      <Block className="text-center py-8">
        <Preloader />
      </Block>
    );
  }

  return (
    <>
      {/* Status Card */}
      <Block strong inset>
        {/* <Card className="text-center py-1"> */}
        <div className="flex flex-col items-center gap-3">
          {sleepState?.isActive ? (
            <>
              <div className="text-5xl">
                😴
              </div>
              <div className="text-xl font-semibold">
                {displayName} is Sleeping
              </div>
              <div className="text-lg opacity-70">
                since {sleepState.startTime} ({formatDuration(sleepState.duration)})
              </div>
            </>
          ) : sleepState?.awakeStartTime ? (
            <>
              <div className="text-5xl">
                <Sun className="w-12 h-12" />
              </div>
              <div className="text-xl font-semibold">
                {displayName} is Awake
              </div>
              <div className="text-lg opacity-70">
                since {sleepState.awakeStartTime} ({formatDuration(sleepState.awakeDuration)})
              </div>
            </>
          ) : (
            <>
              <div className="text-5xl">
                <Moon className="w-16 h-16 opacity-30" />
              </div>
              {allStats?.length == 0 ?
                <div className="text-xl font-semibold">No sleep data yet</div>
                : <div className="text-xl font-semibold">Today no sleep data yet</div>}

              <div className="text-sm opacity-70">Start tracking below</div>
            </>
          )}
        </div>
        <Button
          large
          rounded
          onClick={() => setModalOpen(true)}
          disabled={trackMutation.isPending}
          className="w-full mt-4"
        >
          {trackMutation.isPending
            ? "Tracking..."
            : isSleeping
              ? "Woke up"
              : "Fall asleep"}
        </Button>
        {/* </Card> */}
      </Block>

      {/* Today's Stats */}
      <BlockTitle>Today</BlockTitle>
      <Block strong inset>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center py-4">
            <div className="text-sm opacity-70 mb-1">Total Sleep</div>
            <div className="text-2xl font-semibold">
              {formatDurationHHMM(todayStats?.sleepMinutes || 0)}
            </div>
          </div>
          <div className="text-center py-4">
            <div className="text-sm opacity-70 mb-1">Awake Time</div>
            <div className="text-2xl font-semibold">
              {formatDurationHHMM(todayStats?.awakeMinutes || 0)}
            </div>
          </div>
        </div>

        {todayStat && (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                <div className="opacity-70 text-xs mb-1">Day Sleep</div>
                <div className="font-semibold">
                  {formatDuration(todayStat.daySleepMinutes)}
                </div>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-2">
                <div className="opacity-70 text-xs mb-1">Night Sleep</div>
                <div className="font-semibold">
                  {formatDuration(todayStat.nightSleepMinutes)}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                <div className="opacity-70 text-xs mb-1">Sleep Sessions</div>
                <div className="font-semibold">
                  {todayStat.sessionCount}
                  {historicalAvg && (
                    <span className={`ml-1 text-xs ${todayStat.sessionCount > historicalAvg.avgSessions
                      ? "text-orange-600"
                      : todayStat.sessionCount < historicalAvg.avgSessions
                        ? "text-green-600"
                        : "text-gray-500"
                      }`}>
                      {todayStat.sessionCount > historicalAvg.avgSessions
                        ? "↑"
                        : todayStat.sessionCount < historicalAvg.avgSessions
                          ? "↓"
                          : "→"}
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2">
                <div className="opacity-70 text-xs mb-1">Longest Nap</div>
                <div className="font-semibold">
                  {formatDuration(
                    Math.max(
                      ...todayStat.entries.map(e =>
                        e.endTime
                          ? Math.floor(e.endTime.asMinutes() - e.startTime.asMinutes())
                          : 0
                      ),
                      0
                    )
                  )}
                </div>
              </div>
            </div>

            {historicalAvg && (
              <div className="text-xs opacity-70 text-center pt-2 border-t border-gray-200 dark:border-gray-700">
                7-day avg: {formatDuration(historicalAvg.avgSleep)} sleep, {historicalAvg.avgSessions} sessions
                {todayStat.totalSleepMinutes > historicalAvg.avgSleep + 30 && (
                  <span className="ml-2 text-green-600 font-medium">Great day!</span>
                )}
                {todayStat.totalSleepMinutes < historicalAvg.avgSleep - 30 && (
                  <span className="ml-2 text-orange-600 font-medium">Below average</span>
                )}
              </div>
            )}
          </>
        )}
      </Block>

      <Block strong inset>
        {allStats && allStats.length > 0 && (
          <ResponsiveSleepTimeline
            allDayStats={allStats}
          />
        )}
      </Block>

      {/* History Link */}
      <Block inset>
        <Link to="/history">
          <Button
            large
            rounded
            outline
            className="w-full"
          >
            <HistoryIcon className="w-5 h-5 mr-2" />
            View History
          </Button>
        </Link>
      </Block>

      {/* Sleep Modal */}
      <SleepModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        isSleeping={isSleeping}
        onConfirm={handleTrackSleep}
        isLoading={trackMutation.isPending}
      />
    </>
  );
}
