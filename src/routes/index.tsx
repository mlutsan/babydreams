import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sheetUrlAtom, babyNameAtom } from "~/lib/atoms";
import { Block, BlockTitle, Button, Preloader } from "konsta/react";
import { Moon, Sun } from "lucide-react";
import { getSleepScreenData, addSleepEntry } from "~/lib/sleep-service";
import { formatDuration, formatDurationHHMM } from "~/lib/date-utils";
import { SleepModal } from "~/components/mobile/SleepModal";
import { useToast } from "~/hooks/useToast";

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

  // Query for sleep screen data (only after hydration)
  const { data: sleepData, isLoading } = useQuery({
    queryKey: ["sleepScreenData", sheetUrl],
    queryFn: () => getSleepScreenData(sheetUrl),
    enabled: isHydrated && !!sheetUrl,
    refetchInterval: 60000, // Refresh every minute
  });

  // Extract state and stats from combined data
  const sleepState = sleepData?.state;
  const todayStats = sleepData?.stats;

  // Mutation for tracking
  const trackMutation = useMutation({
    mutationFn: addSleepEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sleepScreenData"] });
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

    // Determine new state (opposite of current state)
    const newState = sleepState?.state === "Sleep" ? "Wake" : "Sleep";

    trackMutation.mutate({
      today: new Date(),
      sheetUrl,
      endTime: new Date(),
      timeAgo,
      cycle,
      newState,
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

  const isSleeping = sleepState?.state === "Sleep";
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
                {isSleeping ? <Moon className="w-12 h-12" /> : <Sun className="w-12 h-12" />}
              </div>
              <div className="text-xl font-semibold">
                {displayName} is {isSleeping ? "Sleeping" : "Awake"}
              </div>
              <div className="text-lg opacity-70">
                since {sleepState.startTime} ({formatDuration(sleepState.duration)})
              </div>
            </>
          ) : (
            <>
              <div className="text-5xl">
                <Moon className="w-16 h-16 opacity-30" />
              </div>
              <div className="text-xl font-semibold">No active tracking</div>
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
        currentState={sleepState?.state || null}
        currentCycle={sleepState?.cycle || "Day"}
        onConfirm={handleTrackSleep}
      />
    </>
  );
}
