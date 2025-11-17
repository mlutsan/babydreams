import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { sheetUrlAtom } from "~/lib/atoms";
import {
  Block,
  BlockTitle,
  List,
  ListItem,
  Preloader,
  Segmented,
  SegmentedButton,
} from "konsta/react";
import { Moon } from "lucide-react";
import { getHistory } from "~/lib/history-service";
import { formatDuration } from "~/lib/date-utils";
import dayjs from "dayjs";

export const Route = createFileRoute("/history")({
  component: History,
});

function History() {
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const [selectedPeriod, setSelectedPeriod] = useState<"recent" | "all">("recent");
  const [isHydrated, setIsHydrated] = useState(false);

  // Wait for atoms to hydrate from storage
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Query for all history - loaded once and cached
  const { data: allStats, isLoading } = useQuery({
    queryKey: ["history", sheetUrl],
    queryFn: () => getHistory(sheetUrl),
    enabled: isHydrated && !!sheetUrl,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Filter stats based on selected period
  const filteredStats = useMemo(() => {
    if (!allStats) {
      return [];
    }

    if (selectedPeriod === "recent") {
      // Show last 7 days
      const sevenDaysAgo = dayjs().subtract(7, "days");
      return allStats.filter(stat => stat.startDatetime.isAfter(sevenDaysAgo));
    }

    return allStats;
  }, [allStats, selectedPeriod]);

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
        <BlockTitle>No Sheet Configured</BlockTitle>
        <p>Please configure your Google Sheet in Settings first.</p>
      </Block>
    );
  }

  // Reverse to show most recent first
  const statsToDisplay = [...filteredStats].reverse();

  return (
    <>

      {/* Period Selector */}
      <Block>
        <Segmented rounded strong>
          <SegmentedButton
            active={selectedPeriod === "recent"}
            onClick={() => setSelectedPeriod("recent")}
          >
            Last 7 Days
          </SegmentedButton>
          <SegmentedButton
            active={selectedPeriod === "all"}
            onClick={() => setSelectedPeriod("all")}
          >
            All Time
          </SegmentedButton>
        </Segmented>
      </Block>

      {isLoading ? (
        <Block className="text-center py-8">
          <Preloader />
        </Block>
      ) : statsToDisplay.length > 0 ? (
        <>
          <BlockTitle>Daily Sleep Stats</BlockTitle>
          <List strongIos insetIos>
            {statsToDisplay.map((stat, index) => {
              const dateRange = `${stat.startDatetime.format("MMM D")}${!stat.startDatetime.isSame(stat.endDatetime, "day")
                ? ` - ${stat.endDatetime.format("MMM D")}`
                : ""
              }`;

              return (
                <ListItem
                  key={index}
                  title={dateRange}
                  after={formatDuration(stat.totalSleepMinutes)}
                  subtitle={
                    <div className="space-y-2 mt-2">
                      {/* Total Stats */}
                      <div className="flex gap-4 text-xs">
                        <span>😴 {formatDuration(stat.totalSleepMinutes)}</span>
                        <span>👁️ {formatDuration(stat.awakeMinutes)}</span>
                        <span>📊 {stat.sessionCount} sessions</span>
                      </div>

                      {/* Day/Night Breakdown */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1">
                          <div className="text-xs opacity-70">☀️ Day Sleep</div>
                          <div className="text-xs font-semibold">
                            {formatDuration(stat.daySleepMinutes)}
                          </div>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded px-2 py-1">
                          <div className="text-xs opacity-70">🌙 Night Sleep</div>
                          <div className="text-xs font-semibold">
                            {formatDuration(stat.nightSleepMinutes)}
                          </div>
                        </div>
                      </div>

                      {/* Active indicator */}
                      {stat.hasActiveSleep && (
                        <div className="text-xs bg-green-100 dark:bg-green-900 px-2 py-1 rounded inline-block">
                          🟢 Currently sleeping
                        </div>
                      )}
                    </div>
                  }
                  media={
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900">
                      <Moon className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                    </div>
                  }
                />
              );
            })}
          </List>
        </>
      ) : (
        <Block strong inset className="text-center">
          <div className="py-8 opacity-70">
            <div className="text-4xl mb-2">😴</div>
            <div>No sleep data available</div>
          </div>
        </Block>
      )}
    </>
  );
}
