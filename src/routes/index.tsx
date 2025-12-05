"use client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { useState, useMemo, useEffect, useRef } from "react";
import { sheetUrlAtom, babyNameAtom } from "~/lib/atoms";
import { Block, BlockTitle, Button, Preloader } from "konsta/react";
import { History as HistoryIcon } from "lucide-react";
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

  // Track rotation angle - increment by 180deg each state change
  // Initialize based on current state: 0 (awake/no data) or 180 (sleeping)
  const [rotationDegrees, setRotationDegrees] = useState(() => {
    return sleepState?.isActive ? 180 : 0;
  });
  const previousSleepingRef = useRef<boolean | null>(null);

  // Update 'now' every minute to refresh awake time display
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(dayjs());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Increment rotation by 180deg on each state change
  useEffect(() => {
    const isSleeping = sleepState?.isActive || false;

    if (previousSleepingRef.current !== null && previousSleepingRef.current !== isSleeping) {
      // State changed - add 180 degrees
      setRotationDegrees(prev => prev + 180);
    }

    previousSleepingRef.current = isSleeping;
  }, [sleepState?.isActive]);

  // Check if yesterday's night sleep ended today (when no sleepState exists)
  const yesterdayNightWake = useMemo(() => {
    if (sleepState || !allStats || allStats.length === 0) {
      return null;
    }

    // Get yesterday's stat (second to last, or last if only one exists)
    const yesterdayStat = allStats[allStats.length - 1];
    if (!yesterdayStat) {
      return null;
    }


    // Check if the wake time is today
    const awakeStart = yesterdayStat.endDatetime;
    if (!awakeStart.isSame(now, "day")) {
      return null;
    }

    // Compute awake duration
    const awakeDuration = now.diff(awakeStart, "minutes");

    return {
      awakeStartTime: awakeStart.format("HH:mm"),
      awakeDuration,
    };
  }, [sleepState, allStats, now]);

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

  const todayStats = todayStat || yesterdayNightWake ? {
    sleepMinutes: todayStat?.totalSleepMinutes ?? 0,
    // Include both past awake time and current awake duration
    awakeMinutes: todayStat?.awakeMinutes ?? 0 + currentAwakeDuration + (todayStat ? 0 : yesterdayNightWake?.awakeDuration ?? 0),
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
          {sleepState?.isActive || sleepState?.awakeStartTime || yesterdayNightWake || !sleepState ? (
            <>
              {/* Orbit Animation Container */}
              <div className="relative w-full h-20 flex items-center justify-center overflow-hidden">
                <div
                  className="absolute w-32 h-32 top-8 orbit-container"
                  style={{ transform: `rotate(${rotationDegrees}deg)` }}
                >
                  {/* Sun at top of orbit */}
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl icon-container"
                    style={{ transform: `rotate(${-rotationDegrees}deg)` }}
                  >
                    ☀️
                  </div>
                  {/* Moon at bottom of orbit */}
                  <div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 text-5xl icon-container"
                    style={{ transform: `rotate(${-rotationDegrees}deg)` }}
                  >
                    😴
                  </div>
                </div>
                {/* Bottom blur overlay for fade-out effect */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-3 pointer-events-none"
                  style={{
                    backdropFilter: "blur(4px)",
                    WebkitBackdropFilter: "blur(4px)",
                  }}
                />
              </div>
              <div className="text-xl font-semibold">
                {sleepState?.isActive ? `${displayName} is Sleeping` :
                  sleepState?.awakeStartTime || yesterdayNightWake ? `${displayName} is Awake` :
                    allStats?.length === 0 ? "No sleep data yet" : "Today no sleep data yet"}
              </div>
              {sleepState && (
                <div className="text-lg opacity-70">
                  since {sleepState?.isActive ? sleepState.startTime : sleepState.awakeStartTime} ({formatDuration(sleepState?.isActive ? sleepState.duration : sleepState.awakeDuration)})
                </div>
              )}
              {yesterdayNightWake && (
                <div className="text-lg opacity-70">
                  since {yesterdayNightWake.awakeStartTime} ({formatDuration(yesterdayNightWake.awakeDuration)})
                </div>
              )}
              {!sleepState && !yesterdayNightWake && (
                <div className="text-sm opacity-70">Start tracking below</div>
              )}
            </>
          ) : null}
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
