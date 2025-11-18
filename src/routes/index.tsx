import { createFileRoute, Link } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sheetUrlAtom, babyNameAtom } from "~/lib/atoms";
import { Block, BlockTitle, Button, Preloader } from "konsta/react";
import { Moon, Sun, History as HistoryIcon } from "lucide-react";
import { getHistory } from "~/lib/history-service";
import { addSleepEntry } from "~/lib/sleep-service";
import { formatDuration, formatDurationHHMM } from "~/lib/date-utils";
import { SleepModal } from "~/components/mobile/SleepModal";
import { ResponsiveSleepTimeline } from "~/components/mobile/SleepTimeline";
import { useToast } from "~/hooks/useToast";
import dayjs from "dayjs";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const babyName = useAtomValue(babyNameAtom);
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Wait for atoms to hydrate from storage
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Query for all history data (shared with history page)
  const { data: allStats, isLoading } = useQuery({
    queryKey: ["history", sheetUrl],
    queryFn: () => getHistory(sheetUrl),
    enabled: isHydrated && !!sheetUrl,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchInterval: 60000, // Refresh every minute
  });

  // Find today's stat from the history
  const todayStat = useMemo(() => {
    if (!allStats || allStats.length === 0) {
      return null;
    }

    const now = dayjs();
    // Find the stat where endDatetime is today
    return allStats.find(stat => stat.endDatetime.isSame(now, "day")) || null;
  }, [allStats]);

  // Extract state and stats from today's data using the last entry
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

  const todayStats = todayStat ? {
    sleepMinutes: todayStat.totalSleepMinutes,
    awakeMinutes: todayStat.awakeMinutes,
  } : null;

  // Mutation for tracking
  const trackMutation = useMutation({
    mutationFn: addSleepEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
      success("Sleep tracked successfully!");
      setModalOpen(false);
    },
    onError: (err) => {
      error("Failed to track sleep", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });

  const handleTrackSleep = (timeAgo: number, cycle: "Day" | "Night") => {
    if (!sheetUrl) {
      return;
    }

    trackMutation.mutate({
      sheetUrl,
      timeAgo,
      cycle,
    });
  };

  // Show loading while atoms hydrate from storage
  if (!isHydrated) {
    return (
      <Block className="text-center py-8">
        <Preloader />
      </Block>
    );
  }

  // After hydration, check if sheet URL is configured
  if (!sheetUrl) {
    return (
      <Block strong inset className="text-center">
        <BlockTitle>Welcome to Baby Dreams</BlockTitle>
        <p>Please configure your Google Sheet in Settings first.</p>
      </Block>
    );
  }

  const isSleeping = sleepState?.isActive || false;
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
              <div className="text-xl font-semibold">No sleep data yet</div>
              <div className="text-sm opacity-70">Start tracking below</div>
            </>
          )}
        </div>
        {/* </Card> */}
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

      {/* Action Button */}
      <Block inset>
        <Button
          large
          rounded
          onClick={() => setModalOpen(true)}
          disabled={trackMutation.isPending}
          className="w-full"
        >
          {trackMutation.isPending
            ? "Tracking..."
            : isSleeping
              ? "Woke up"
              : "Fall asleep"}
        </Button>
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
