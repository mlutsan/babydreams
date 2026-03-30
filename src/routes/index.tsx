"use client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { useState, useEffect, useRef } from "react";
import { babyNameAtom, sheetUrlAtom } from "~/lib/atoms";
import { Block, BlockTitle, Button, Preloader } from "konsta/react";
import { History as HistoryIcon } from "lucide-react";
import { formatDuration } from "~/lib/date-utils";
import { ResponsiveSleepTimeline } from "~/components/mobile/SleepTimeline";
import { useSleepModal } from "~/hooks/useSleepModal";
import { SleepTodaySummary } from "~/features/sleep/components/SleepTodaySummary";
import { useSleepPageData } from "~/features/sleep/hooks/useSleepPageData";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const babyName = useAtomValue(babyNameAtom);
  const { openTrack } = useSleepModal();
  const { sleepStats, isLoading, status, todaySummary } = useSleepPageData();

  // Track rotation angle - increment by 180deg each state change
  // Initialize based on current state: 0 (awake/no data) or 180 (sleeping)
  const [rotationDegrees, setRotationDegrees] = useState(() => {
    return status.mode === "sleeping" ? 180 : 0;
  });
  const previousSleepingRef = useRef<boolean | null>(null);

  // Increment rotation by 180deg on each state change
  useEffect(() => {
    const isSleeping = status.mode === "sleeping";
    if (previousSleepingRef.current !== null && previousSleepingRef.current !== isSleeping) {
      // State changed - add 180 degrees
      setRotationDegrees(prev => prev + 180);
    }
    previousSleepingRef.current = isSleeping;
  }, [status.mode]);

  // Check if sheet URL is configured
  if (!sheetUrl) {
    return (
      <Block strong inset className="text-center">
        <BlockTitle>Welcome to Baby Dreams</BlockTitle>
        <p>Please configure your Google Sheet in Settings first.</p>
      </Block>
    );
  }

  const isSleeping = status.mode === "sleeping";
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
        <div className="flex flex-col items-center gap-3">
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
            {status.mode === "sleeping"
              ? `${displayName} is Sleeping`
              : status.mode === "awake"
                ? `${displayName} is Awake`
                : status.mode === "empty"
                  ? "No sleep data yet"
                  : "Today no sleep data yet"}
          </div>
          {status.sinceTime && status.sinceDurationMinutes !== null && (
            <div className="text-lg opacity-70">
              since {status.sinceTime}
              ({formatDuration(status.sinceDurationMinutes)})
            </div>
          )}
          {!status.sinceTime && (
            <div className="text-sm opacity-70">Start tracking below</div>
          )}
        </div>
        <Button
          large
          rounded
          onClick={openTrack}
          className="w-full mt-4"
        >
          {isSleeping ? "Woke up" : "Fall asleep"}
        </Button>
      </Block>

      <SleepTodaySummary summary={todaySummary} />

      <Block strong inset>
        {sleepStats.length > 0 && (
          <ResponsiveSleepTimeline
            allDayStats={sleepStats}
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
    </>
  );
}
