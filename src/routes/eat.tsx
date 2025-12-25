import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { sheetUrlAtom, babyNameAtom } from "~/lib/atoms";
import { Block, BlockTitle, Button, Preloader } from "konsta/react";
import { getEatHistory } from "~/lib/eat-service";
import { EatModal } from "~/components/mobile/EatModal";
import { EatOverviewChart } from "~/components/mobile/EatOverviewChart";
import { EatStats } from "~/components/mobile/EatStats";
import { useTodaySleepStat } from "~/hooks/useSleepHistory";
import { Milk } from "lucide-react";
import dayjs from "dayjs";
import { getCycleDateForDatetime } from "~/lib/date-utils";

export const Route = createFileRoute("/eat")({
  component: Eat,
});

function Eat() {
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const babyName = useAtomValue(babyNameAtom);
  const [modalOpen, setModalOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [now, setNow] = useState(dayjs());

  // Wait for atoms to hydrate from storage
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Update 'now' every minute to refresh time since last meal
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(dayjs());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Get today's sleep stat for current cycle date
  const sleepQuery = useTodaySleepStat();
  const {
    isFetched: isSleepFetched,
    allStats: allSleepStats,
  } = sleepQuery;

  // Query for all eating history
  const { data: allStats, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["eatHistory", sheetUrl],
    queryFn: () => getEatHistory(sheetUrl),
    enabled: isHydrated && !!sheetUrl,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchInterval: 60000, // Refresh every minute
  });

  // Find today's stat using sleep's logical date
  const todayStat = useMemo(() => {
    if (!allStats || allStats.length === 0) {
      return null;
    }

    const now = dayjs();

    const todayLogicalDate =
      getCycleDateForDatetime(now, allSleepStats, now).format("YYYY-MM-DD");

    const today = allStats.find((stat) =>
      stat.date.format("YYYY-MM-DD") === todayLogicalDate
    );

    return today || null;
  }, [allStats, allSleepStats]);

  // Calculate time since last meal in HH:mm format (must be before any returns)
  const lastMeal = todayStat?.entries[todayStat.entries.length - 1];
  const timeSinceLastMeal = useMemo(() => {
    if (!lastMeal) {
      return null;
    }

    const diffMinutes = now.diff(lastMeal.datetime, "minutes");
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }, [lastMeal, now]);

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

  if (isError) {
    const message =
      error instanceof Error ? error.message : "Failed to load meal history.";
    return (
      <Block className="text-center py-8 space-y-3">
        <div className="font-semibold">Couldn&apos;t load meals</div>
        <p className="text-sm opacity-70">{message}</p>
        <Button outline onClick={() => refetch()}>
          Retry
        </Button>
      </Block>
    );
  }

  const displayName = babyName || "Baby";

  return (
    <>
      {/* Status Card */}
      <Block strong inset>
        <div className="flex flex-col items-center gap-3">
          <div className="text-5xl">
            <Milk className="w-12 h-12 text-amber-600" />
          </div>
          {todayStat && todayStat.totalVolume > 0 ? (
            <>
              <div className="text-2xl font-semibold">
                {todayStat.totalVolume} ml
              </div>
              {lastMeal && (
                <div className="gap-0 flex flex-col items-center mt-2 text-base opacity-70">
                  <div className="">
                    <span className="font-medium">
                      {lastMeal.datetime.format("HH:mm")}
                      {" · "}
                      {timeSinceLastMeal && `${timeSinceLastMeal}`} ago
                    </span>
                    {" · "}
                    <span>{lastMeal.volume} ml</span>
                  </div>
                  <div className="text-xs">
                    last meal
                  </div>
                </div>
              )}
            </>
          ) : allStats && allStats.length > 0 ? (
            <>
              <div className="text-xl font-semibold">
                Today no meals yet
              </div>
              <div className="text-sm opacity-70">Track {displayName}&apos;s feeding below</div>
            </>
          ) : (
            <>
              <div className="text-xl font-semibold">No meal data yet</div>
              <div className="text-sm opacity-70">Start tracking below</div>
            </>
          )}
        </div>
        <Button
          large
          rounded
          onClick={() => setModalOpen(true)}
          disabled={!isSleepFetched}
          className="w-full bg-amber-500 active:bg-amber-600 mt-4"
        >
          {!isSleepFetched ? "Loading..." : "Add Meal"}
        </Button>
      </Block>

      {/* Weekly Trends & Insights */}
      {allStats && allStats.length > 0 && (
        <EatStats dailyStats={allStats} />
      )}

      {/* Meal Overview Chart */}
      {allStats && allStats.length > 0 && (
        <>
          {/* <BlockTitle>Meal History</BlockTitle> */}
          <Block strong inset>
            <EatOverviewChart dailyStats={allStats} sleepStats={allSleepStats} />
          </Block>
        </>
      )}


      {/* Eat Modal */}
      <EatModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
