/**
 * Sleep Timeline Component - Week View
 * Displays a vertical timeline showing sleep periods across multiple days
 * Each column represents one logical day (from wake-up to wake-up)
 * Y-axis is continuous from earliest to latest time across all days
 */

import { useMemo, useRef, useEffect, useState } from "react";
import dayjs from "dayjs";
import { scaleLinear, scaleBand } from "@visx/scale";
import { Bar } from "@visx/shape";
import { Group } from "@visx/group";
import { AxisLeft, AxisRight } from "@visx/axis";
import { Line } from "@visx/shape";
import { Text } from "@visx/text";
import { defaultStyles, useTooltip, useTooltipInPortal } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import type { DailyStat } from "~/types/sleep";
import { formatDuration, formatDurationHHMM } from "~/lib/date-utils";

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
}

interface DailySleepBar {
  type: "daily";
  date: dayjs.Dayjs;
  totalMinutes: number;
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

export function ResponsiveSleepTimeline({
  allDayStats,
  height = TIMELINE_HEIGHT + BAR_CHART_HEIGHT + GAP_BETWEEN_SECTIONS + 50, // margin top + bottom
}: ResponsiveSleepTimelineProps) {
  const margin = { top: 40, right: 50, bottom: 10, left: 50 };
  const innerHeight = TIMELINE_HEIGHT;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolled = useRef(false);
  const tooltipTimeout = useRef<number | undefined>(undefined);

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
    detectBounds: true,
    zIndex: 1000
  });

  // Transform day stats into sleep bars with time-of-day positioning
  const { sleepBars, minTimeOfDay, maxTimeOfDay, referenceDate } = useMemo(() => {
    const now = dayjs();
    const bars: SleepBar[] = [];
    let minTimeMinutes = Infinity;
    let maxTimeMinutes = -Infinity;


    allDayStats.forEach((dayStat) => {
      const dayStartTimeOfDay = dayStat.startDatetime.hour() * 60 + dayStat.startDatetime.minute();
      const dayEndTimeOfDay =
        dayStat.endDatetime.startOf("day").diff(dayStat.startDatetime.startOf("day"), "days") * 24 * 60
        + dayStat.endDatetime.hour() * 60 + dayStat.endDatetime.minute();
      minTimeMinutes = Math.min(minTimeMinutes, dayStartTimeOfDay);
      maxTimeMinutes = Math.max(dayEndTimeOfDay, maxTimeMinutes);
    });

    allDayStats.forEach((dayStat, dayIndex) => {
      dayStat.entries.forEach((entry, entryIndex) => {
        const sleepStart = entry.realDatetime;

        let sleepEnd: dayjs.Dayjs;
        if (entry.endTime === null) {
          sleepEnd = now;
        } else {
          sleepEnd = entry.realDatetime.startOf("day").add(entry.endTime);
          const startMinutes = Math.floor(entry.startTime.asMinutes());
          const endMinutes = Math.floor(entry.endTime.asMinutes());
          if (endMinutes < startMinutes) {
            sleepEnd = sleepEnd.add(1, "day");
          }
        }

        const durationMinutes = sleepEnd.diff(sleepStart, "minutes");

        const hoursStart = sleepStart.startOf("day").diff(dayStat.startDatetime.startOf("day"), "days") * 24 * 60;
        const hoursEnd = sleepEnd.startOf("day").diff(dayStat.startDatetime.startOf("day"), "days") * 24 * 60;

        const startTimeOfDay = hoursStart + sleepStart.hour() * 60 + sleepStart.minute();
        const endTimeOfDay = hoursEnd + sleepEnd.hour() * 60 + sleepEnd.minute();

        bars.push({
          id: `${dayStat.logicalDate}-${entryIndex}`,
          dayIndex,
          logicalDate: dayStat.logicalDate,
          startMinutes: startTimeOfDay,
          endMinutes: endTimeOfDay,
          cycle: entry.cycle,
          durationMinutes,
          isActive: entry.endTime === null,
          startTime: sleepStart.format("HH:mm"),
          endTime: entry.endTime === null ? "Now" : sleepEnd.format("HH:mm"),
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

  // Calculate daily total sleep in minutes for bar chart
  const dailyTotals = useMemo(() => {
    return allDayStats.map((dayStat) => ({
      date: dayjs(dayStat.logicalDate),
      totalMinutes: dayStat.totalSleepMinutes,
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
  const now = dayjs();
  const currentTimeSimple = now.hour() * 60 + now.minute();
  const currentTimeY = yScale(currentTimeSimple);
  const showCurrentTimeIndicator = currentTimeY >= 0 && currentTimeY <= innerHeight;

  // Handle tooltip show/hide
  const handleBarInteraction = (
    event: React.MouseEvent | React.TouchEvent,
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

    // Get event coordinates relative to SVG
    const eventSvgCoords = localPoint(event);

    // Position tooltip at center of bar horizontally, above the touch point
    const left = barX + barWidth / 2;
    const top = (eventSvgCoords?.y || 0) - 120;

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
    event: React.MouseEvent | React.TouchEvent,
    dayStat: DailyStat,
    barX: number
  ) => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }

    const eventSvgCoords = localPoint(event);
    const left = barX + columnWidth / 2;
    const top = (eventSvgCoords?.y || 0) - 80;

    showTooltip({
      tooltipData: {
        type: "daily",
        date: dayjs(dayStat.logicalDate),
        totalMinutes: dayStat.totalSleepMinutes,
        sessionCount: dayStat.sessionCount,
      },
      tooltipTop: top,
      tooltipLeft: left,
    });
  };

  const handleTotalBarLeave = () => {
    tooltipTimeout.current = window.setTimeout(() => {
      hideTooltip();
    }, 300);
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
                  onMouseMove={(event) => handleBarInteraction(event, bar, x, columnWidth)}
                  onMouseLeave={handleBarLeave}
                  style={{ cursor: "pointer" }}
                  opacity={isHighlighted ? 0.9 : 1}
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

            {/* Daily total sleep bars */}
            {dailyTotals.map((dayTotal, dayIndex) => {
              const x = dayScale(dayIndex.toString()) || 0;
              const barHeight = Math.max(2, BAR_CHART_HEIGHT - barSleepScale(dayTotal.totalMinutes));
              const barY = BAR_CHART_HEIGHT - barHeight;
              const dayStat = allDayStats[dayIndex];

              return (
                <g key={`bar-group-${dayIndex}`}>
                  <Bar
                    x={x}
                    y={barY}
                    width={columnWidth}
                    height={barHeight}
                    fill="#60a5fa"
                    rx={2}
                    onMouseMove={(event) => handleTotalBarInteraction(event, dayStat, x)}
                    onMouseLeave={handleTotalBarLeave}
                    style={{ cursor: "pointer" }}
                  />
                  {/* Sleep duration label inside bar */}
                  {barHeight > 40 && (
                    <Text
                      x={x + columnWidth / 2}
                      y={barY + barHeight - 5}
                      fontSize={10}
                      fontWeight="600"
                      fill="#1e3a8a"
                      textAnchor="middle"
                    >
                      {formatDurationHHMM(dayTotal.totalMinutes)}
                    </Text>
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
          top={tooltipTop}
          left={tooltipLeft}
          style={{ ...defaultStyles, backgroundColor: "" }}
          className="z-1000 bg-gray-200 dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700"
        >
          {"type" in tooltipData && tooltipData.type === "daily" ? (
            <div className="text-sm space-y-1">
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                {tooltipData.date.format("MMM D, YYYY")}
              </div>
              <div className="text-gray-700 dark:text-gray-300">
                Total: {formatDurationHHMM(tooltipData.totalMinutes)}
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {tooltipData.sessionCount} session{tooltipData.sessionCount !== 1 ? "s" : ""}
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
            </div>
          )}
        </TooltipInPortal>
      )}
    </div>
  );
}
