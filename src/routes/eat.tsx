import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { babyNameAtom, sheetUrlAtom } from "~/lib/atoms";
import { Block, BlockTitle, Button, Preloader } from "konsta/react";
import { EatModal } from "~/components/mobile/EatModal";
import { EatOverviewChart } from "~/components/mobile/EatOverviewChart";
import { EatStepChart } from "~/components/mobile/EatStepChart";
import { Milk } from "lucide-react";
import { EatTodaySummary } from "~/features/eat/components/EatTodaySummary";
import { useEatPageData } from "~/features/eat/hooks/useEatPageData";

export const Route = createFileRoute("/eat")({
  component: Eat,
});

function Eat() {
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const babyName = useAtomValue(babyNameAtom);
  const [modalOpen, setModalOpen] = useState(false);

  const {
    sleepStats,
    eatStats,
    todayEatStat,
    isLoading,
    isError,
    error,
    isHydrated,
    refetch,
    statusCard,
    todaySummary,
  } = useEatPageData();

  const todayStat = todayEatStat;

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
          {statusCard.mode === "with-meals" ? (
            <>
              <div className="text-2xl font-semibold">
                {statusCard.totalVolume} ml
              </div>
              {statusCard.lastMealTime && statusCard.lastMealVolume !== null && (
                <div className="gap-0 flex flex-col items-center mt-2 text-base opacity-70">
                  <div className="">
                    <span className="font-medium">
                      {statusCard.lastMealTime}
                      {" · "}
                      {statusCard.lastMealAgo}
                    </span>
                    {" · "}
                    <span>{statusCard.lastMealVolume} ml</span>
                  </div>
                  <div className="text-xs">
                    last meal
                  </div>
                </div>
              )}
            </>
          ) : statusCard.mode === "no-meals-today" ? (
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
          disabled={isLoading}
          className="w-full bg-amber-500 active:bg-amber-600 mt-4"
        >
          {isLoading ? "Loading..." : "Add Meal"}
        </Button>
      </Block>

      {eatStats.length > 0 && (
        <>
          <EatTodaySummary summary={todaySummary} />
          <Block strong inset>
            <EatStepChart
              dailyStats={eatStats}
              sleepStats={sleepStats}
              todayDate={todayStat?.date}
            />
          </Block>
        </>
      )}

      {/* Meal Overview Chart */}
      {eatStats.length > 0 && (
        <>
          <BlockTitle>History</BlockTitle>
          <Block strong inset>
            <EatOverviewChart
              dailyStats={eatStats}
              todayDate={todayStat?.date}
            />
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
