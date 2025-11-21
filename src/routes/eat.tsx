import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sheetUrlAtom } from "~/lib/atoms";
import { Block, BlockTitle, Button, Preloader } from "konsta/react";
import { Plus } from "lucide-react";
import { getEatHistory, addEatEntry } from "~/lib/eat-service";
import { getHistory } from "~/lib/history-service";
import { EatModal } from "~/components/mobile/EatModal";
import { EatOverviewChart } from "~/components/mobile/EatOverviewChart";
import { EatStats } from "~/components/mobile/EatStats";
import { useToast } from "~/hooks/useToast";
import dayjs from "dayjs";

export const Route = createFileRoute("/eat")({
  component: Eat,
});

function Eat() {
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Wait for atoms to hydrate from storage
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Query for sleep history to get current cycle date
  const { data: sleepStats } = useQuery({
    queryKey: ["history", sheetUrl],
    queryFn: () => getHistory(sheetUrl),
    enabled: isHydrated && !!sheetUrl,
    staleTime: 5 * 60 * 1000,
  });

  // Query for all eating history
  const { data: allStats, isLoading } = useQuery({
    queryKey: ["eatHistory", sheetUrl],
    queryFn: () => getEatHistory(sheetUrl),
    enabled: isHydrated && !!sheetUrl,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchInterval: 60000, // Refresh every minute
  });

  // Find today's and yesterday's stats
  const { todayStat, yesterdayStat } = useMemo(() => {
    if (!allStats || allStats.length === 0) {
      return { todayStat: null, yesterdayStat: null };
    }

    const now = dayjs();
    const yesterday = now.subtract(1, "day");

    const today = allStats.find((stat) =>
      stat.date.isSame(now, "day")
    );
    const yest = allStats.find((stat) =>
      stat.date.isSame(yesterday, "day")
    );

    return { todayStat: today || null, yesterdayStat: yest || null };
  }, [allStats]);

  // Mutation for adding entry
  const addMutation = useMutation({
    mutationFn: addEatEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eatHistory"] });
      success("Meal recorded successfully!");
      setModalOpen(false);
    },
    onError: (err) => {
      error("Failed to record meal", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });

  // Determine current cycle date from sleep stats
  const currentCycleDate = useMemo(() => {
    if (!sleepStats || sleepStats.length === 0) {
      // No sleep data - use current calendar date
      return dayjs();
    }

    const now = dayjs();
    // Find today's sleep stat
    const todaySleepStat = sleepStats.find((stat) =>
      stat.endDatetime.isSame(now, "day")
    );

    if (todaySleepStat) {
      // Use the cycle date from today's sleep stat
      return todaySleepStat.startDatetime;
    }

    // Fallback to current date
    return dayjs();
  }, [sleepStats]);

  const handleAddFeeding = (volume: number) => {
    if (!sheetUrl) {
      return;
    }

    addMutation.mutate({
      sheetUrl,
      volume,
      cycleDate: currentCycleDate,
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
        <BlockTitle>Welcome to Meal Tracker</BlockTitle>
        <p>Please configure your Google Sheet in Settings first.</p>
      </Block>
    );
  }

  if (isLoading) {
    return (
      <Block className="text-center py-8">
        <Preloader />
      </Block>
    );
  }

  return (
    <>
      {/* Daily Stats */}
      <BlockTitle>Daily Stats</BlockTitle>
      <Block strong inset>
        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Today */}
          <div className="text-center">
            <div className="text-sm font-medium mb-2 opacity-70">Today</div>
            {todayStat ? (
              <>
                <div className="text-3xl font-bold text-amber-600 mb-1">
                  {todayStat.totalVolume} ml
                </div>
                <div className="text-xs opacity-60">
                  {todayStat.entryCount} meal{todayStat.entryCount !== 1 ? "s" : ""}
                </div>
              </>
            ) : (
              <div className="text-sm opacity-40">No data</div>
            )}

          </div>

          {/* Yesterday */}
          <div className="text-center">
            <div className="text-sm font-medium mb-2 opacity-70">Yesterday</div>
            {yesterdayStat ? (
              <>
                <div className="text-3xl font-bold text-gray-700 dark:text-gray-300 mb-1">
                  {yesterdayStat.totalVolume} ml
                </div>
                <div className="text-xs opacity-60">
                  {yesterdayStat.entryCount} meal{yesterdayStat.entryCount !== 1 ? "s" : ""}
                </div>
              </>
            ) : (
              <div className="text-sm opacity-40">No data</div>
            )}
          </div>
        </div>

        <Button
          large
          rounded
          onClick={() => setModalOpen(true)}
          disabled={addMutation.isPending}
          className="w-full bg-amber-500 active:bg-amber-600 mt-4"
        >
          <Plus className="w-5 h-5 mr-2" />
          {addMutation.isPending ? "Nom nom nom..." : "Add Meal"}
        </Button>
      </Block>

      {/* Weekly Trends & Insights */}
      {allStats && allStats.length > 0 && (
        <>
          <BlockTitle>Insights</BlockTitle>
          <Block strong inset>
            <EatStats dailyStats={allStats} />
          </Block>
        </>
      )}

      {/* Feeding Overview Chart */}
      {allStats && allStats.length > 0 && (
        <>
          <BlockTitle>Feeding History</BlockTitle>
          <Block strong inset>
            <EatOverviewChart dailyStats={allStats} height={240} />
          </Block>
        </>
      )}

      {/* Add Feeding Button */}
      <Block inset>

      </Block>

      {/* Eat Modal */}
      <EatModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleAddFeeding}
      />
    </>
  );
}
