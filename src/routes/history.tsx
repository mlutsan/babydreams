import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { sheetUrlAtom } from "~/lib/atoms";
import {
  Block,
  BlockTitle,
  Button,
  Card,
  Preloader,
} from "konsta/react";
import { Plus, Pencil, ExternalLinkIcon } from "lucide-react";
import { getHistory } from "~/lib/history-service";
import { formatDuration } from "~/lib/date-utils";
import dayjs from "dayjs";
import type { SleepEntry, DailyStat } from "~/types/sleep";
import { HistoryDayCard } from "~/components/history/HistoryDayCard";
import { SleepModal } from "~/components/mobile/SleepModal";
import { calculateSleepDuration, resolveActiveSleepEnd } from "~/lib/sleep-utils";

export const Route = createFileRoute("/history")({
  component: History,
});

const MAX_DAYS = 30;

function History() {
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const [isHydrated, setIsHydrated] = useState(false);
  const [expandedDayIds, setExpandedDayIds] = useState<string[]>([]);
  const [sleepModalOpen, setSleepModalOpen] = useState(false);
  const [sleepModalMode, setSleepModalMode] = useState<"add" | "edit">("add");
  const [sleepModalEntry, setSleepModalEntry] = useState<SleepEntry | null>(null);
  const [sleepModalDate, setSleepModalDate] = useState<dayjs.Dayjs | null>(null);
  const [sleepModalAllowActive, setSleepModalAllowActive] = useState(false);

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

  const statsSorted = useMemo(() => {
    if (!allStats) {
      return [];
    }
    return [...allStats].sort(
      (a, b) => a.startDatetime.unix() - b.startDatetime.unix()
    );
  }, [allStats]);

  const statsByLogicalDate = useMemo(() => {
    return new Map(statsSorted.map((stat) => [stat.logicalDate, stat]));
  }, [statsSorted]);

  const daysToDisplay = useMemo(() => {
    const days: Array<{ logicalDate: string; stat?: DailyStat; }> = [];
    for (let i = 0; i < MAX_DAYS; i += 1) {
      const logicalDate = dayjs().subtract(i, "day").format("YYYY-MM-DD");
      days.push({
        logicalDate,
        stat: statsByLogicalDate.get(logicalDate),
      });
    }
    return days;
  }, [statsByLogicalDate]);

  const mostRecentLogicalDate = daysToDisplay[0]?.logicalDate;
  const windowStart = dayjs().subtract(MAX_DAYS - 1, "day").startOf("day");
  const hasOlderData = statsSorted.some((stat) =>
    dayjs(stat.logicalDate).isBefore(windowStart, "day")
  );

  useEffect(() => {
    if (daysToDisplay.length > 0 && expandedDayIds.length === 0) {
      setExpandedDayIds([daysToDisplay[0].logicalDate]);
    }
  }, [daysToDisplay, expandedDayIds.length]);

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

  const now = dayjs();

  const toggleExpanded = (dayId: string) => {
    setExpandedDayIds((prev) =>
      prev.includes(dayId) ? prev.filter((id) => id !== dayId) : [...prev, dayId]
    );
  };

  const entryKey = (entry: SleepEntry, entryIndex: number) => {
    if (entry.sheetRowIndex) {
      return `row-${entry.sheetRowIndex}`;
    }
    return `${entry.realDatetime.unix()}-${entryIndex}`;
  };

  const openAddModal = (logicalDate: string, allowActiveToggle: boolean) => {
    setSleepModalMode("add");
    setSleepModalEntry(null);
    setSleepModalDate(dayjs(logicalDate));
    setSleepModalAllowActive(allowActiveToggle);
    setSleepModalOpen(true);
    if (!expandedDayIds.includes(logicalDate)) {
      setExpandedDayIds((prev) => [...prev, logicalDate]);
    }
  };

  const openEditModal = (entry: SleepEntry, allowActiveToggle: boolean) => {
    setSleepModalMode("edit");
    setSleepModalEntry(entry);
    setSleepModalDate(null);
    setSleepModalAllowActive(allowActiveToggle);
    setSleepModalOpen(true);
  };

  const closeSleepModal = () => {
    setSleepModalOpen(false);
    setSleepModalEntry(null);
    setSleepModalDate(null);
  };

  return (
    <>
      {isLoading ? (
        <Block className="text-center py-8">
          <Preloader />
        </Block>
      ) : daysToDisplay.length > 0 ? (
        <>
          <div className="space-y-4">
            {daysToDisplay.map((day) => {
              const isToday = dayjs(day.logicalDate).isSame(now, "day");
              const isYesterday = dayjs(day.logicalDate).isSame(now.subtract(1, "day"), "day");
              const dateRange = isToday
                ? "Today"
                : isYesterday
                  ? "Yesterday"
                  : day.stat
                    ? `${day.stat.startDatetime.format("MMM D")}${!day.stat.startDatetime.isSame(day.stat.endDatetime, "day")
                      ? ` - ${day.stat.endDatetime.format("MMM D")}`
                      : ""
                    }`
                    : dayjs(day.logicalDate).format("MMM D");
              const summary = day.stat
                ? `☀️ ${formatDuration(day.stat.daySleepMinutes)} • 🌙 ${formatDuration(day.stat.nightSleepMinutes)}`
                : "No entries yet";
              const isExpanded = expandedDayIds.includes(day.logicalDate);
              const entriesSorted = [...(day.stat?.entries ?? [])].sort(
                (a, b) => b.realDatetime.unix() - a.realDatetime.unix()
              );
              const isMostRecentStat = day.logicalDate === mostRecentLogicalDate;
              const isStatToday = dayjs(day.logicalDate).isSame(now, "day");
              const allowActiveToggleForDay = isMostRecentStat && isStatToday;

              return (
                <HistoryDayCard
                  key={day.logicalDate}
                  title={dateRange}
                  summary={summary}
                  isExpanded={isExpanded}
                  onToggle={() => toggleExpanded(day.logicalDate)}
                  actions={
                    <Button
                      small
                      rounded
                      className="min-w-0 px-2 py-2"
                      onClick={() => openAddModal(day.logicalDate, allowActiveToggleForDay)}
                      aria-label="Add entry"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  }
                >
                  <div className="space-y-2">
                    {!day.stat || entriesSorted.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-500">
                        No entries yet
                      </div>
                    ) : null}
                    {entriesSorted.map((entry, entryIndex) => {
                      const key = entryKey(entry, entryIndex);
                      const startLabel = entry.startTime.format("HH:mm");
                      let endLabel = entry.endTime ? entry.endTime.format("HH:mm") : "Now";
                      let durationMinutes = 0;
                      let statusLabel = "";

                      if (entry.endTime) {
                        durationMinutes = calculateSleepDuration(entry.startTime, entry.endTime);
                      } else {
                        const resolved = resolveActiveSleepEnd({
                          startDatetime: entry.realDatetime,
                          now,
                        });
                        durationMinutes = resolved.durationMinutes;
                        if (resolved.wasCapped) {
                          endLabel = resolved.endDatetime.format("HH:mm");
                          statusLabel = "Auto-ended";
                        } else {
                          statusLabel = "Active";
                        }
                      }

                      const allowActiveToggle = allowActiveToggleForDay && entryIndex === 0;
                      return (
                        <div
                          key={key}
                          className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2"
                        >
                          <div className="space-y-1">
                            <div className="text-sm font-semibold">
                              {startLabel} - {endLabel}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {formatDuration(durationMinutes)} • {entry.cycle}
                            </div>
                            {statusLabel ? (
                              <div className="text-xs text-amber-600">
                                {statusLabel}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-row gap-1">
                            <Button
                              onClick={() => openEditModal(entry, allowActiveToggle)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </HistoryDayCard>
              );
            })}
          </div>
          {hasOlderData ? (

            <Card className="pt-4" header="For older data:">
              <Button
                large
                rounded
                onClick={() => window.open(sheetUrl, "_blank", "noopener,noreferrer")}
              >
                Open Google Sheets
                <ExternalLinkIcon className="ml-2" />
              </Button>
            </Card>
          ) : null}
        </>
      ) : (
        <Block strong inset className="text-center">
          <div className="py-8 opacity-70">
            <div className="text-base">No sleep data available</div>
          </div>
        </Block>
      )}

      <SleepModal
        opened={sleepModalOpen}
        onClose={closeSleepModal}
        mode={sleepModalMode}
        entry={sleepModalEntry ?? undefined}
        initialDate={sleepModalDate ?? undefined}
        allowActiveToggle={sleepModalAllowActive}
      />
    </>
  );
}
