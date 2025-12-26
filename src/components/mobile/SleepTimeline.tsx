/**
 * Sleep Timeline Component - Week View
 * Displays a vertical timeline showing sleep periods across multiple days
 * Each column represents one logical day (from wake-up to wake-up)
 * Y-axis is continuous from earliest to latest time across all days
 */

import { useMemo, useRef, useEffect, useLayoutEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { scaleLinear, scaleBand } from "@visx/scale";
import { Bar } from "@visx/shape";
import { Group } from "@visx/group";
import { AxisLeft, AxisRight } from "@visx/axis";
import { Line } from "@visx/shape";
import { Text } from "@visx/text";
import { defaultStyles, useTooltip, useTooltipInPortal } from "@visx/tooltip";
import { Button } from "konsta/react";
import type { DailyStat, SleepEntry } from "~/types/sleep";
import { formatDuration, formatDurationHHMM } from "~/lib/date-utils";
import { resolveActiveSleepEnd } from "~/lib/sleep-utils";
import { useCurrentTimeMinutes } from "~/hooks/useCurrentTimeMinutes";
import { sheetUrlAtom } from "~/lib/atoms";
import { deleteSleepEntry } from "~/lib/sleep-service";
import { useToast } from "~/hooks/useToast";
import { useSleepModal } from "~/hooks/useSleepModal";
import { Pencil, Trash2 } from "lucide-react";

interface SleepBar {
  id: string;
  dayIndex: number;
  logicalDate: string;
  startMinutes: number; // Minutes from dayStart reference point
  endMinutes: number;
  cycle: "Day" | "Night";
  durationMinutes: number;
  isActive: boolean;
  startTime: string; // For tooltip display
  endTime: string;
  entry: SleepEntry;
  allowActiveToggle: boolean;
}

interface DailySleepBar {
  type: "daily";
  date: dayjs.Dayjs;
  totalMinutes: number;
  dayMinutes: number;
  nightMinutes: number;
  sessionCount: number;
}

type TooltipData = SleepBar | DailySleepBar;

interface ResponsiveSleepTimelineProps {
  allDayStats: DailyStat[];
  height?: number;
}

const DAY_COLUMN_WIDTH = 60; // Width per day column
const TIMELINE_HEIGHT = 400;
const BAR_CHART_HEIGHT = 200;
const GAP_BETWEEN_SECTIONS = 40;
const TOOLTIP_PADDING = 12;

export function ResponsiveSleepTimeline({
  allDayStats,
  height = TIMELINE_HEIGHT + BAR_CHART_HEIGHT + GAP_BETWEEN_SECTIONS + 50, // margin top + bottom
}: ResponsiveSleepTimelineProps) {
  const margin = { top: 40, right: 50, bottom: 40, left: 50 };
  const innerHeight = TIMELINE_HEIGHT;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolled = useRef(false);
  const tooltipTimeout = useRef<number | undefined>(undefined);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const queryClient = useQueryClient();
  const { error } = useToast();
  const { openEdit } = useSleepModal();

  // Track which bar is currently highlighted
  const [highlightedBarId, setHighlightedBarId] = useState<string | null>(null);

  // Tooltip hooks
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<TooltipData>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    scroll: true,
    detectBounds: false,
    zIndex: 1000
  });

  // Transform day stats into sleep bars with time-of-day positioning
  const { sleepBars, minTimeOfDay, maxTimeOfDay, referenceDate } = useMemo(() => {
    const now = dayjs();
    const bars: SleepBar[] = [];
    let minTimeMinutes = Infinity;
    let maxTimeMinutes = -Infinity;
    const todayLogicalDate = dayjs().format("YYYY-MM-DD");
    const mostRecentStatIndex = allDayStats.length - 1;


    allDayStats.forEach((dayStat) => {
      const dayStartTimeOfDay = dayStat.startDatetime.hour() * 60 + dayStat.startDatetime.minute();
      const dayEndTimeOfDay =
        dayStat.endDatetime.startOf("day").diff(dayStat.startDatetime.startOf("day"), "days") * 24 * 60
        + dayStat.endDatetime.hour() * 60 + dayStat.endDatetime.minute();
      minTimeMinutes = Math.min(minTimeMinutes, dayStartTimeOfDay);
      maxTimeMinutes = Math.max(dayEndTimeOfDay, maxTimeMinutes);
    });

    allDayStats.forEach((dayStat, dayIndex) => {
      const allowActiveToggleForDay =
        dayIndex === mostRecentStatIndex && dayStat.logicalDate === todayLogicalDate;
      dayStat.entries.forEach((entry, entryIndex) => {
        const sleepStart = entry.realDatetime;

        let sleepEnd: dayjs.Dayjs;
        let durationMinutes = 0;
        let isActive = false;

        if (entry.endTime === null) {
          const resolved = resolveActiveSleepEnd({
            startDatetime: sleepStart,
            now,
          });
          sleepEnd = resolved.endDatetime;
          durationMinutes = resolved.durationMinutes;
          isActive = resolved.isActive;
        } else {
          sleepEnd = entry.realDatetime.startOf("day").add(entry.endTime);
          const startMinutes = Math.floor(entry.startTime.asMinutes());
          const endMinutes = Math.floor(entry.endTime.asMinutes());
          if (endMinutes < startMinutes) {
            sleepEnd = sleepEnd.add(1, "day");
          }
          durationMinutes = sleepEnd.diff(sleepStart, "minutes");
        }

        const hoursStart = sleepStart.startOf("day").diff(dayStat.startDatetime.startOf("day"), "days") * 24 * 60;
        const hoursEnd = sleepEnd.startOf("day").diff(dayStat.startDatetime.startOf("day"), "days") * 24 * 60;

        const startTimeOfDay = hoursStart + sleepStart.hour() * 60 + sleepStart.minute();
        const endTimeOfDay = hoursEnd + sleepEnd.hour() * 60 + sleepEnd.minute();

        const isLatestEntry = entryIndex === dayStat.entries.length - 1;

        bars.push({
          id: `${dayStat.logicalDate}-${entryIndex}`,
          dayIndex,
          logicalDate: dayStat.logicalDate,
          startMinutes: startTimeOfDay,
          endMinutes: endTimeOfDay,
          cycle: entry.cycle,
          durationMinutes,
          isActive,
          startTime: sleepStart.format("HH:mm"),
          endTime: isActive ? "Now" : sleepEnd.format("HH:mm"),
          entry,
          allowActiveToggle: allowActiveToggleForDay && isLatestEntry,
        });
      });
    });

    // Use a reference date (any date) to format time labels
    const refDate = dayjs().startOf("day");

    return {
      sleepBars: bars,
      minTimeOfDay: minTimeMinutes !== Infinity ? minTimeMinutes : 0,
      maxTimeOfDay: maxTimeMinutes !== -Infinity ? maxTimeMinutes : 1440,
      referenceDate: refDate,
    };
  }, [allDayStats]);

  // Calculate SVG dimensions
  const totalDays = allDayStats.length;
  const svgWidth = totalDays * DAY_COLUMN_WIDTH + margin.left + margin.right;
  const innerWidth = totalDays * DAY_COLUMN_WIDTH;

  // Y scale - linear scale for time-of-day in minutes (0-1440)
  const yScale = scaleLinear({
    domain: [minTimeOfDay, maxTimeOfDay],
    range: [0, innerHeight],
  });

  // Day scale for X-axis (horizontal columns)
  const dayScale = scaleBand({
    domain: allDayStats.map((_, i) => i.toString()),
    range: [0, innerWidth],
    padding: 0.1,
  });

  const columnWidth = dayScale.bandwidth();

  // Color mapping
  const getColor = (bar: SleepBar) => {
    return bar.cycle === "Day"
      ? "#93c5fd" // light blue for day sleep
      : "#003ea1"; // darker blue for night sleep
  };

  // Calculate daily total sleep in minutes for bar chart (split by day/night)
  const dailyTotals = useMemo(() => {
    return allDayStats.map((dayStat) => ({
      date: dayjs(dayStat.logicalDate),
      totalMinutes: dayStat.totalSleepMinutes,
      dayMinutes: dayStat.daySleepMinutes,
      nightMinutes: dayStat.nightSleepMinutes,
    }));
  }, [allDayStats]);

  // Scale for bar chart
  const maxSleepMinutes = Math.max(...dailyTotals.map((d) => d.totalMinutes), 60);
  const barSleepScale = scaleLinear({
    domain: [0, maxSleepMinutes],
    range: [BAR_CHART_HEIGHT, 0],
  });

  // Today index for highlighting
  const todayIndex = allDayStats.findIndex((stat) => {
    return dayjs(stat.logicalDate).isSame(dayjs(), "day");
  });

  // Current time indicator - always show
  const { currentTimeMinutes } = useCurrentTimeMinutes(allDayStats);
  const currentTimeY = yScale(currentTimeMinutes);
  const showCurrentTimeIndicator = currentTimeY >= 0 && currentTimeY <= innerHeight;

  // Handle tooltip show/hide
  const handleBarInteraction = (
    _event: React.MouseEvent | React.TouchEvent,
    bar: SleepBar,
    barX: number,
    barWidth: number
  ) => {
    // Clear any existing timeout
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }

    // Highlight the bar
    setHighlightedBarId(bar.id);

    const barY = yScale(bar.startMinutes);
    const left = margin.left + barX + barWidth / 2;
    const top = margin.top + barY;

    showTooltip({
      tooltipData: bar,
      tooltipTop: top,
      tooltipLeft: left,
    });
  };

  const handleBarLeave = () => {
    // Delay hiding tooltip to prevent flicker
    tooltipTimeout.current = window.setTimeout(() => {
      hideTooltip();
      setHighlightedBarId(null);
    }, 300);
  };

  // Handle total bar tooltip
  const handleTotalBarInteraction = (
    _event: React.MouseEvent | React.TouchEvent,
    dayStat: DailyStat,
    barX: number
  ) => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }
    setHighlightedBarId(null);

    const left = margin.left + barX + columnWidth / 2;
    const barTop = barSleepScale(dayStat.totalSleepMinutes);
    const top = margin.top + TIMELINE_HEIGHT + GAP_BETWEEN_SECTIONS + barTop;

    showTooltip({
      tooltipData: {
        type: "daily",
        date: dayjs(dayStat.logicalDate),
        totalMinutes: dayStat.totalSleepMinutes,
        dayMinutes: dayStat.daySleepMinutes,
        nightMinutes: dayStat.nightSleepMinutes,
        sessionCount: dayStat.sessionCount,
      },
      tooltipTop: top,
      tooltipLeft: left,
    });
  };

  const handleTotalBarLeave = () => {
    tooltipTimeout.current = window.setTimeout(() => {
      hideTooltip();
      setHighlightedBarId(null);
    }, 300);
  };

  useEffect(() => {
    if (tooltipOpen && tooltipData && "type" in tooltipData && tooltipData.type === "daily") {
      setHighlightedBarId(null);
    }
  }, [tooltipOpen, tooltipData]);

  useEffect(() => {
    if (!tooltipOpen) {
      return;
    }

    const handleOutsidePress = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (tooltipRef.current?.contains(target)) {
        return;
      }
      if (target.closest("[data-tooltip-anchor]")) {
        return;
      }
      hideTooltip();
      setHighlightedBarId(null);
    };

    document.addEventListener("mousedown", handleOutsidePress, true);
    document.addEventListener("touchstart", handleOutsidePress, true);

    return () => {
      document.removeEventListener("mousedown", handleOutsidePress, true);
      document.removeEventListener("touchstart", handleOutsidePress, true);
    };
  }, [tooltipOpen, hideTooltip]);

  const deleteMutation = useMutation({
    mutationFn: deleteSleepEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
      hideTooltip();
      setHighlightedBarId(null);
    },
    onError: (err) => {
      error("Failed to delete sleep entry", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });

  const handleEditClick = (bar: SleepBar) => {
    openEdit(bar.entry, bar.allowActiveToggle);
  };

  const handleDeleteClick = (bar: SleepBar) => {
    if (!sheetUrl || !bar.entry.sheetRowIndex) {
      error("Missing sheet row for deletion");
      return;
    }
    if (!window.confirm("Delete this sleep entry?")) {
      return;
    }
    deleteMutation.mutate({ sheetUrl, rowIndex: bar.entry.sheetRowIndex });
  };

  // Auto-scroll to today on initial mount
  useEffect(() => {
    if (scrollContainerRef.current && todayIndex !== -1 && !hasAutoScrolled.current) {
      const todayX = (todayIndex * DAY_COLUMN_WIDTH) + margin.left;
      const containerWidth = scrollContainerRef.current.offsetWidth;

      const scrollLeft = Math.max(
        0,
        todayX - containerWidth / 2 + DAY_COLUMN_WIDTH / 2
      );

      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({
            left: scrollLeft,
            behavior: "smooth",
          });
          hasAutoScrolled.current = true;
        }
      }, 100);
    }
  }, [todayIndex, margin.left]);

  useLayoutEffect(() => {
    if (tooltipOpen && tooltipRef.current) {
      setTooltipSize({
        width: tooltipRef.current.offsetWidth,
        height: tooltipRef.current.offsetHeight,
      });
    }
  }, [tooltipOpen, tooltipData]);

  const tooltipLeftClamped = (() => {
    if (tooltipLeft === undefined || tooltipLeft === null) {
      return tooltipLeft;
    }

    const container = scrollContainerRef.current;
    if (!container || tooltipSize.width === 0) {
      return tooltipLeft;
    }

    const containerWidth = container.offsetWidth;
    const scrollLeft = container.scrollLeft;
    const centerInView = tooltipLeft - scrollLeft;
    const maxLeft = Math.max(TOOLTIP_PADDING, containerWidth - tooltipSize.width - TOOLTIP_PADDING);
    const clampedLeft = Math.min(
      Math.max(centerInView - tooltipSize.width / 2, TOOLTIP_PADDING),
      maxLeft
    );

    return clampedLeft + scrollLeft;
  })();

  const tooltipTopClamped = (() => {
    if (tooltipTop === undefined || tooltipTop === null) {
      return tooltipTop;
    }
    if (tooltipSize.height === 0) {
      return tooltipTop;
    }
    return Math.max(TOOLTIP_PADDING, tooltipTop - tooltipSize.height - TOOLTIP_PADDING);
  })();

  if (allDayStats.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm opacity-50"
      >
        No sleep data available
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Scrollable container */}
      <div
        ref={scrollContainerRef}
        style={{
          width: "100%",
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
        className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
      >
        <svg width={svgWidth} height={height} ref={containerRef}>
          <Group left={margin.left} top={margin.top}>

            {/* Date headers */}
            {allDayStats.map((dayStat, dayIndex) => {
              const x = dayScale(dayIndex.toString()) || 0;
              const date = dayjs(dayStat.logicalDate);
              const isToday = todayIndex === dayIndex;

              return (
                <Group key={`header-${dayIndex}`} left={x + columnWidth / 2}>
                  {/* Month label */}
                  <Text
                    y={-30}
                    fontSize={10}
                    fill="#94a3b8"
                    textAnchor="middle"
                  >
                    {date.format("MMM")}
                  </Text>
                  {/* Date number */}
                  <Text
                    y={-15}
                    fontSize={14}
                    fontWeight={isToday ? "bold" : "normal"}
                    fill={isToday ? "#0ea5e9" : "#64748b"}
                    textAnchor="middle"
                  >
                    {date.format("D")}
                  </Text>
                  {/* Day of week */}
                  <Text
                    y={-3}
                    fontSize={10}
                    fill="#94a3b8"
                    textAnchor="middle"
                  >
                    {date.format("ddd")}
                  </Text>
                </Group>
              );
            })}

            {/* Y-axis (time axis) - Left */}
            <AxisLeft
              scale={yScale}
              numTicks={12}
              tickFormat={(d) => {
                const timeOfDayMinutes = Number(d);
                const actualTime = referenceDate.add(timeOfDayMinutes, "minutes");
                return actualTime.format("HH:mm");
              }}
              stroke="#cbd5e1"
              tickStroke="#cbd5e1"
              tickLabelProps={() => ({
                fill: "#64748b",
                fontSize: 10,
                textAnchor: "end",
                dx: -5,
              })}
            />

            {/* Y-axis (time axis) - Right */}
            <AxisRight
              left={innerWidth}
              scale={yScale}
              numTicks={12}
              tickFormat={(d) => {
                const timeOfDayMinutes = Number(d);
                const actualTime = referenceDate.add(timeOfDayMinutes, "minutes");
                return actualTime.format("HH:mm");
              }}
              stroke="#cbd5e1"
              tickStroke="#cbd5e1"
              tickLabelProps={() => ({
                fill: "#64748b",
                fontSize: 10,
                textAnchor: "start",
                dx: 5,
              })}
            />

            {/* Grid lines */}
            {yScale.ticks(12).map((tick) => {
              const y = yScale(tick);
              return (
                <Line
                  key={`grid-${tick}`}
                  from={{ x: 0, y }}
                  to={{ x: innerWidth, y }}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                  strokeDasharray="2,2"
                />
              );
            })}
            {/* Current time indicator (red line) */}
            {showCurrentTimeIndicator && currentTimeY >= 0 && currentTimeY <= innerHeight && (
              <Line
                from={{ x: 0, y: currentTimeY }}
                to={{ x: innerWidth, y: currentTimeY }}
                stroke="#ef4444"
                strokeWidth={2}
              />
            )}
            {/* Sleep bars */}
            {sleepBars.map((bar) => {
              const x = dayScale(bar.dayIndex.toString()) || 0;
              const barY = yScale(bar.startMinutes);
              const barHeight = Math.max(
                2,
                yScale(bar.endMinutes) - barY
              );

              const isHighlighted = highlightedBarId === bar.id;

              return (
                <Bar
                  key={bar.id}
                  x={x}
                  y={barY}
                  width={columnWidth}
                  height={barHeight}
                  fill={getColor(bar)}
                  stroke={bar.isActive ? "#9fb1ab" : isHighlighted ? "#f59e0b" : "transparent"}
                  strokeWidth={bar.isActive || isHighlighted ? 2 : 0}
                  rx={2}
                  data-tooltip-anchor="sleep"
                  onMouseMove={(event) => handleBarInteraction(event, bar, x, columnWidth)}
                  onMouseLeave={handleBarLeave}
                  onTouchStart={(event) => handleBarInteraction(event, bar, x, columnWidth)}
                  onTouchMove={(event) => handleBarInteraction(event, bar, x, columnWidth)}
                  style={{ cursor: "pointer" }}
                  opacity={isHighlighted ? 0.9 : 1}
                />
              );
            })}


          </Group>

          {/* Bar Chart Section */}
          <Group
            left={margin.left}
            top={margin.top + TIMELINE_HEIGHT + GAP_BETWEEN_SECTIONS}
          >
            {/* Grid lines for bar chart */}
            {barSleepScale.ticks(5).map((tick) => {
              const y = barSleepScale(tick);
              return (
                <Line
                  key={`bar-grid-${tick}`}
                  from={{ x: 0, y }}
                  to={{ x: innerWidth, y }}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                  strokeDasharray="2,2"
                />
              );
            })}

            {/* Daily total sleep bars (stacked: night on bottom, day on top) */}
            {dailyTotals.map((dayTotal, dayIndex) => {
              const x = dayScale(dayIndex.toString()) || 0;
              const dayStat = allDayStats[dayIndex];

              // Calculate heights for stacked bars
              const nightHeight = BAR_CHART_HEIGHT - barSleepScale(dayTotal.nightMinutes);
              const dayHeight = BAR_CHART_HEIGHT - barSleepScale(dayTotal.dayMinutes);

              // Night bar on bottom
              const nightY = BAR_CHART_HEIGHT - nightHeight;
              // Day bar stacked on top of night
              const dayY = nightY - dayHeight;

              return (
                <g
                  key={`bar-group-${dayIndex}`}
                  data-tooltip-anchor="daily"
                  onMouseMove={(event) => handleTotalBarInteraction(event, dayStat, x)}
                  onMouseLeave={handleTotalBarLeave}
                  onTouchStart={(event) => handleTotalBarInteraction(event, dayStat, x)}
                  onTouchMove={(event) => handleTotalBarInteraction(event, dayStat, x)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Night sleep bar (bottom, darker) */}
                  {nightHeight > 0 && (
                    <Bar
                      x={x}
                      y={nightY}
                      width={columnWidth}
                      height={nightHeight}
                      fill="#1e3a8a"
                      rx={dayHeight > 0 ? 0 : 2}
                      ry={dayHeight > 0 ? 0 : 2}
                    />
                  )}
                  {/* Day sleep bar (top, lighter) */}
                  {dayHeight > 0 && (
                    <Bar
                      x={x}
                      y={dayY}
                      width={columnWidth}
                      height={dayHeight}
                      fill="#93c5fd"
                      rx={2}
                      ry={2}
                    />
                  )}
                  {/* Round bottom corners of night bar */}
                  {nightHeight > 0 && (
                    <rect
                      x={x}
                      y={BAR_CHART_HEIGHT - Math.min(4, nightHeight)}
                      width={columnWidth}
                      height={Math.min(4, nightHeight)}
                      fill="#1e3a8a"
                      rx={2}
                      ry={2}
                    />
                  )}
                  {/* Labels at bottom of bar, side by side */}
                  {(dayHeight > 0 || nightHeight > 0) && (
                    <>
                      {/* Day label on left */}
                      {(
                        <Text
                          x={x + columnWidth / 2}
                          //y={BAR_CHART_HEIGHT - 20}
                          y={BAR_CHART_HEIGHT - 20}
                          fontSize={10}
                          fill="white"
                          textAnchor="middle"
                        >
                          {`☀️ ${formatDurationHHMM(dayTotal.dayMinutes ?? 0)}`}
                        </Text>
                      )}
                      {/* Night label on right */}
                      {(
                        <Text
                          x={x + columnWidth / 2}
                          y={BAR_CHART_HEIGHT - 5}
                          fontSize={10}
                          fill="white"
                          textAnchor="middle"
                        >
                          {`🌙 ${formatDurationHHMM(dayTotal.nightMinutes ?? 0)}`}
                        </Text>
                      )}
                    </>
                  )}
                </g>
              );
            })}

            {/* Sleep duration axis (left) */}
            <AxisLeft
              scale={barSleepScale}
              numTicks={5}
              tickFormat={(d) => formatDurationHHMM(Number(d))}
              stroke="#cbd5e1"
              tickStroke="#cbd5e1"
              tickLabelProps={() => ({
                fill: "#64748b",
                fontSize: 10,
                textAnchor: "end",
                dx: -5,
              })}
            />

            {/* Sleep duration axis (right) */}
            <AxisRight
              left={innerWidth}
              scale={barSleepScale}
              numTicks={5}
              tickFormat={(d) => formatDurationHHMM(Number(d))}
              stroke="#cbd5e1"
              tickStroke="#cbd5e1"
              tickLabelProps={() => ({
                fill: "#64748b",
                fontSize: 10,
                textAnchor: "start",
                dx: 5,
              })}
            />
          </Group>
        </svg>
      </div>

      {/* Tooltip */}
      {tooltipOpen && tooltipData && (
        <TooltipInPortal
          top={tooltipTopClamped}
          left={tooltipLeftClamped}
          offsetLeft={0}
          offsetTop={0}
          style={{ ...defaultStyles, backgroundColor: "transparent", pointerEvents: "auto" }}
          className="z-10"
        >
          <div
            ref={tooltipRef}
            className="bg-gray-200 dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700"
            onMouseEnter={() => {
              if (tooltipTimeout.current) {
                clearTimeout(tooltipTimeout.current);
              }
            }}
            onMouseLeave={handleBarLeave}
          >
            {"type" in tooltipData && tooltipData.type === "daily" ? (
              <div className="text-sm space-y-1">
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {tooltipData.date.format("MMM D, YYYY")}
                </div>
                <div className="text-gray-700 dark:text-gray-300">
                  Day: {formatDurationHHMM(tooltipData.dayMinutes)}
                </div>
                <div className="text-gray-700 dark:text-gray-300">
                  Night: {formatDurationHHMM(tooltipData.nightMinutes)}
                </div>
                <div className="text-gray-700 dark:text-gray-300 font-semibold">
                  Total: {formatDurationHHMM(tooltipData.totalMinutes)}
                </div>
              </div>
            ) : (
              <div className="text-sm space-y-1">
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {"cycle" in tooltipData && tooltipData.cycle} Sleep
                  {"isActive" in tooltipData && tooltipData.isActive && " (Active)"}
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-xs">
                  {"logicalDate" in tooltipData && dayjs(tooltipData.logicalDate).format("MMM D, YYYY")}
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  {"startTime" in tooltipData && "endTime" in tooltipData &&
                    `${tooltipData.startTime} → ${tooltipData.endTime}`}
                </div>
                <div className="text-gray-700 dark:text-gray-300">
                  {"durationMinutes" in tooltipData &&
                    `Duration: ${formatDuration(tooltipData.durationMinutes)}`}
                </div>
                {"entry" in tooltipData ? (
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      small
                      outline
                      rounded
                      className="text-red-600 border-red-600 dark:border-red-800"
                      onClick={() => handleDeleteClick(tooltipData)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      small
                      outline
                      rounded
                      onClick={() => handleEditClick(tooltipData)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>

                  </div>
                ) : null}
              </div>
            )}
          </div>
        </TooltipInPortal>
      )}

    </div>
  );
}
