"use client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { sheetUrlAtom, babyNameAtom } from "~/lib/atoms";
import { Block, BlockTitle, Button, Preloader } from "konsta/react";
import { Moon, Sun, History as HistoryIcon } from "lucide-react";
import { formatDuration, formatDurationHHMM } from "~/lib/date-utils";
import { SleepModal } from "~/components/mobile/SleepModal";
import { ResponsiveSleepTimeline } from "~/components/mobile/SleepTimeline";
import { useTodaySleepStat } from "~/hooks/useSleepHistory";
import { useSleepMutation } from "~/hooks/useSleepMutation";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const babyName = useAtomValue(babyNameAtom);
  const [modalOpen, setModalOpen] = useState(false);

  // Use the shared sleep history hook
  const { todayStat, sleepState, isLoading, allStats } = useTodaySleepStat();

  const todayStats = todayStat ? {
    sleepMinutes: todayStat.totalSleepMinutes,
    awakeMinutes: todayStat.awakeMinutes,
  } : null;

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

  const handleTrackSleep = (timeAgo: number, cycle: "Day" | "Night") => {
    if (!sheetUrl) {
      return;
    }

    trackMutation.mutate(
      {
        sheetUrl,
        timeAgo,
        cycle,
        what: isSleeping ? "Awake" : "Sleep",
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
                <Moon className="w-12 h-12" />
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

      {/* Action Button */}
      <Block inset>

      </Block>

      {/* Today's Stats */}
      <BlockTitle>Today</BlockTitle>
      <Block strong inset>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center py-4">
            <div className="text-sm opacity-70 mb-1">Awake</div>
            <div className="text-2xl font-semibold">
              {formatDurationHHMM(todayStats?.awakeMinutes || 0)}
            </div>
          </div>
          <div className="text-center py-4">
            <div className="text-sm opacity-70 mb-1">Sleep</div>
            <div className="text-2xl font-semibold">
              {formatDurationHHMM(todayStats?.sleepMinutes || 0)}
            </div>
          </div>
        </div>

        {todayStat && todayStat.entries.length > 0 && (
          <>
            <ResponsiveSleepTimeline
              entries={todayStat.entries}
              startDatetime={todayStat.startDatetime}
              height={80}
            />
          </>
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
        currentCycle={sleepState?.cycle || "Day"}
        onConfirm={handleTrackSleep}
      />
    </>
  );
}
