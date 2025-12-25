/**
 * Eat Overview Chart Component - Timeline View
 * Shows individual meals as circles on a timeline + daily total bar chart
 * Top: Vertical timeline per day with circles (size = meal volume)
 * Bottom: Horizontal bar chart showing daily totals
 */

import { useMemo, useRef, useEffect, useState } from "react";
import dayjs from "dayjs";
import { scaleLinear, scaleBand, scaleSqrt } from "@visx/scale";
import { Bar, Circle, Line } from "@visx/shape";
import { Group } from "@visx/group";
import { AxisLeft, AxisRight } from "@visx/axis";
import { Text } from "@visx/text";
import { defaultStyles, useTooltip, useTooltipInPortal } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import type { DailyEatStat } from "~/lib/eat-service";
import type { DailyStat } from "~/types/sleep";
import { useCurrentTimeMinutes } from "~/hooks/useCurrentTimeMinutes";

interface MealCircle {
  type: "meal";
  id: string;
  dayIndex: number;
  logicalDate: string;
  timeMinutes: number; // Minutes from midnight (0-1440)
  volume: number;
  datetime: dayjs.Dayjs;
  cumulativeVolume: number; // Total volume consumed up to this meal (inclusive)
}

interface DailyBar {
  type: "daily";
  date: dayjs.Dayjs;
  totalVolume: number;
  entryCount: number;
}

type TooltipData = MealCircle | DailyBar;

interface EatOverviewChartProps {
  dailyStats: DailyEatStat[];
  sleepStats?: DailyStat[];
  height?: number;
}

const DAY_COLUMN_WIDTH = 60;
const TIMELINE_HEIGHT = 400;
const BAR_CHART_HEIGHT = 150;
const MARGIN = { top: 40, right: 50, bottom: 40, left: 50 };
const GAP_BETWEEN_SECTIONS = 40;

export function EatOverviewChart({
  dailyStats,
  sleepStats,
  height = TIMELINE_HEIGHT + BAR_CHART_HEIGHT + MARGIN.top + MARGIN.bottom + GAP_BETWEEN_SECTIONS,
}: EatOverviewChartProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolled = useRef(false);
  const tooltipTimeout = useRef<number | undefined>(undefined);
  const [highlightedCircleId, setHighlightedCircleId] = useState<string | null>(null);

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
    zIndex: 1000,
  });

  // Sort daily stats by date (ascending - oldest to newest)
  const sortedDailyStats = useMemo(() => {
    return [...dailyStats].sort((a, b) => a.date.unix() - b.date.unix());
  }, [dailyStats]);

  // Create a map of sleep stats by logical date for quick lookup
  const sleepStatsByDate = useMemo(() => {
    const map = new Map<string, DailyStat>();
    if (sleepStats) {
      sleepStats.forEach((stat) => {
        map.set(stat.logicalDate, stat);
      });
    }
    return map;
  }, [sleepStats]);

  // Transform daily stats into meal circles
  const { mealCircles, minTime, maxTime } = useMemo(() => {
    const circles: MealCircle[] = [];
    let minMinutes = Infinity;
    let maxMinutes = -Infinity;

    // If sleep stats are available, use their time boundaries for alignment
    if (sleepStats && sleepStats.length > 0) {
      sleepStats.forEach((sleepStat) => {
        const dayStartTimeOfDay = sleepStat.startDatetime.hour() * 60 + sleepStat.startDatetime.minute();
        const dayEndTimeOfDay =
          sleepStat.endDatetime.startOf("day").diff(sleepStat.startDatetime.startOf("day"), "days") * 24 * 60
          + sleepStat.endDatetime.hour() * 60 + sleepStat.endDatetime.minute();
        minMinutes = Math.min(minMinutes, dayStartTimeOfDay);
        maxMinutes = Math.max(dayEndTimeOfDay, maxMinutes);
      });
    }

    sortedDailyStats.forEach((dayStat, dayIndex) => {
      // Sort entries by datetime to calculate cumulative volume correctly
      const sortedEntries = [...dayStat.entries].sort((a, b) =>
        a.datetime.unix() - b.datetime.unix()
      );

      let cumulativeVolume = 0;

      sortedEntries.forEach((entry, entryIndex) => {
        // Get the corresponding sleep stat for this logical day
        const logicalDateStr = dayStat.date.format("YYYY-MM-DD");
        const sleepStat = sleepStatsByDate.get(logicalDateStr);

        let timeMinutes: number;

        if (sleepStat) {
          // Calculate position relative to logical day start (same as sleep chart)
          const mealDatetime = entry.datetime;
          const dayOffset = mealDatetime.startOf("day").diff(sleepStat.startDatetime.startOf("day"), "days") * 24 * 60;
          timeMinutes = dayOffset + mealDatetime.hour() * 60 + mealDatetime.minute();
        } else {
          // Fallback: use simple time-of-day
          timeMinutes = entry.datetime.hour() * 60 + entry.datetime.minute();
        }

        // If no sleep stats, track min/max from meals
        if (!sleepStats || sleepStats.length === 0) {
          minMinutes = Math.min(minMinutes, timeMinutes);
          maxMinutes = Math.max(maxMinutes, timeMinutes);
        }

        // Add this meal's volume to cumulative total
        cumulativeVolume += entry.volume;

        circles.push({
          type: "meal",
          id: `${dayStat.date.format("YYYY-MM-DD")}-${entryIndex}`,
          dayIndex,
          logicalDate: logicalDateStr,
          timeMinutes,
          volume: entry.volume,
          datetime: entry.datetime,
          cumulativeVolume,
        });
      });
    });

    return {
      mealCircles: circles,
      minTime: minMinutes !== Infinity ? minMinutes : 0,
      maxTime: maxMinutes !== -Infinity ? maxMinutes : 1440,
    };
  }, [sortedDailyStats, sleepStats, sleepStatsByDate]);

  // Calculate SVG dimensions
  const totalDays = sortedDailyStats.length;
  const svgWidth = totalDays * DAY_COLUMN_WIDTH + MARGIN.left + MARGIN.right;
  const innerWidth = totalDays * DAY_COLUMN_WIDTH;

  // Scales for timeline
  const timeScale = scaleLinear({
    domain: [minTime, maxTime],
    range: [0, TIMELINE_HEIGHT],
  });

  const dayScale = scaleBand({
    domain: sortedDailyStats.map((_, i) => i.toString()),
    range: [0, innerWidth],
    padding: 0.1,
  });

  const columnWidth = dayScale.bandwidth();

  // Scale for circle radius (volume → radius)
  const radiusScale = scaleSqrt({
    domain: [0, Math.max(...mealCircles.map((c) => c.volume), 200)],
    range: [3, 20], // Min 3px, max 15px radius
  });

  // Scales for bar chart
  const maxVolume = Math.max(...sortedDailyStats.map((s) => s.totalVolume), 100);
  const barVolumeScale = scaleLinear({
    domain: [0, maxVolume],
    range: [BAR_CHART_HEIGHT, 0],
  });

  // Current time indicator - always show
  const { currentTimeMinutes } = useCurrentTimeMinutes(sleepStats);
  const currentTimeY = timeScale(currentTimeMinutes);
  const showCurrentTimeIndicator = currentTimeY >= 0 && currentTimeY <= TIMELINE_HEIGHT;

  // Today index for highlighting
  const todayIndex = sortedDailyStats.findIndex((stat) =>
    dayjs(stat.date).isSame(dayjs(), "day")
  );

  // Calculate cumulative volume eaten by current time for each day
  const volumeByCurrentTime = useMemo(() => {
    const result: Map<number, number> = new Map();

    sortedDailyStats.forEach((dayStat, dayIndex) => {
      let cumulativeVolume = 0;

      dayStat.entries.forEach((entry) => {
        const dayOffset = entry.datetime.startOf("day").diff(entry.cycleDate.startOf("day"), "days") * 24 * 60;

        const entryTimeMinutes = dayOffset + entry.datetime.hour() * 60 + entry.datetime.minute();
        if (entryTimeMinutes <= currentTimeMinutes) {
          cumulativeVolume += entry.volume;
        }
      });

      result.set(dayIndex, cumulativeVolume);
    });

    return result;
  }, [sortedDailyStats, currentTimeMinutes]);

  // Handle tooltip
  const handleCircleInteraction = (
    event: React.MouseEvent | React.TouchEvent,
    circle: MealCircle,
    circleX: number
  ) => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }

    setHighlightedCircleId(circle.id);

    const eventSvgCoords = localPoint(event);
    const left = circleX;
    const top = (eventSvgCoords?.y || 0) - 120;

    showTooltip({
      tooltipData: circle,
      tooltipTop: top,
      tooltipLeft: left,
    });
  };

  const handleCircleLeave = () => {
    tooltipTimeout.current = window.setTimeout(() => {
      hideTooltip();
      setHighlightedCircleId(null);
    }, 300);
  };

  // Handle bar tooltip
  const handleBarInteraction = (
    event: React.MouseEvent | React.TouchEvent,
    dayStat: DailyEatStat,
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
        date: dayStat.date,
        totalVolume: dayStat.totalVolume,
        entryCount: dayStat.entryCount,
      },
      tooltipTop: top,
      tooltipLeft: left,
    });
  };

  const handleBarLeave = () => {
    tooltipTimeout.current = window.setTimeout(() => {
      hideTooltip();
    }, 300);
  };

  // Auto-scroll to today
  useEffect(() => {
    if (scrollContainerRef.current && todayIndex !== -1 && !hasAutoScrolled.current) {
      const todayX = todayIndex * DAY_COLUMN_WIDTH + MARGIN.left;
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
  }, [todayIndex]);

  if (sortedDailyStats.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm opacity-50"
      >
        No meal data available
      </div>
    );
  }

  const referenceDate = dayjs().startOf("day");

  return (
    <div style={{ position: "relative", width: "100%" }}>
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
          {/* Timeline Section */}
          <Group left={MARGIN.left} top={MARGIN.top}>
            {/* Date headers */}
            {sortedDailyStats.map((dayStat, dayIndex) => {
              const x = dayScale(dayIndex.toString()) || 0;
              const date = dayStat.date;
              const isToday = todayIndex === dayIndex;

              return (
                <Group key={`header-${dayIndex}`} left={x + columnWidth / 2}>
                  <Text y={-30} fontSize={10} fill="#94a3b8" textAnchor="middle">
                    {date.format("MMM")}
                  </Text>
                  <Text
                    y={-15}
                    fontSize={14}
                    fontWeight={isToday ? "bold" : "normal"}
                    fill={isToday ? "#0ea5e9" : "#64748b"}
                    textAnchor="middle"
                  >
                    {date.format("D")}
                  </Text>
                  <Text y={-3} fontSize={10} fill="#94a3b8" textAnchor="middle">
                    {date.format("ddd")}
                  </Text>
                </Group>
              );
            })}

            {/* Y-axis - Time (left) */}
            <AxisLeft
              scale={timeScale}
              numTicks={12}
              tickFormat={(d) => {
                const minutes = Number(d);
                const time = referenceDate.add(minutes, "minutes");
                return time.format("HH:mm");
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

            {/* Y-axis - Time (right) */}
            <AxisRight
              left={innerWidth}
              scale={timeScale}
              numTicks={12}
              tickFormat={(d) => {
                const minutes = Number(d);
                const time = referenceDate.add(minutes, "minutes");
                return time.format("HH:mm");
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
            {timeScale.ticks(12).map((tick) => {
              const y = timeScale(tick);
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

            {/* Meal circles */}
            {mealCircles.map((circle) => {
              const x = dayScale(circle.dayIndex.toString()) || 0;
              const cx = x + columnWidth / 2;
              const cy = timeScale(circle.timeMinutes);
              const radius = radiusScale(circle.volume);
              const isHighlighted = highlightedCircleId === circle.id;

              return (
                <Circle
                  key={circle.id}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="#fbbf24"
                  stroke={isHighlighted ? "#f59e0b" : "#fbbf24"}
                  strokeWidth={isHighlighted ? 2 : 0}
                  opacity={isHighlighted ? 0.9 : 0.8}
                  onMouseMove={(event) => handleCircleInteraction(event, circle, cx)}
                  onMouseLeave={handleCircleLeave}
                  style={{ cursor: "pointer" }}
                />
              );
            })}

            {/* Current time indicator with volume labels */}
            {showCurrentTimeIndicator && (
              <>
                <Line
                  from={{ x: 0, y: currentTimeY }}
                  to={{ x: innerWidth, y: currentTimeY }}
                  stroke="#ef4444"
                  strokeWidth={2}
                />
                {/* Volume labels above the line for each day */}
                {sortedDailyStats.map((_, dayIndex) => {
                  const x = dayScale(dayIndex.toString()) || 0;
                  const volume = volumeByCurrentTime.get(dayIndex) || 0;
                  if (volume === 0) {
                    return null;
                  }
                  const labelX = x + columnWidth / 2;
                  const labelY = currentTimeY - 6;
                  const labelWidth = String(volume).length * 7 + 6;
                  return (
                    <g key={`time-label-${dayIndex}`}>
                      {/* Background pill */}
                      <rect
                        x={labelX - labelWidth / 2}
                        y={labelY - 10}
                        width={labelWidth}
                        height={14}
                        rx={4}
                        fill="black"
                        fillOpacity={0.55}
                      />
                      <Text
                        x={labelX}
                        y={labelY}
                        fontSize={10}
                        fontWeight="600"
                        fill="darkgrey"
                        textAnchor="middle"
                      >
                        {volume}
                      </Text>
                    </g>
                  );
                })}
              </>
            )}
          </Group>

          {/* Bar Chart Section */}
          <Group
            left={MARGIN.left}
            top={MARGIN.top + TIMELINE_HEIGHT + GAP_BETWEEN_SECTIONS}
          >
            {/* Grid lines for bar chart */}
            {barVolumeScale.ticks(5).map((tick) => {
              const y = barVolumeScale(tick);
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

            {/* Daily total bars */}
            {sortedDailyStats.map((dayStat, dayIndex) => {
              const x = dayScale(dayIndex.toString()) || 0;
              const barHeight = BAR_CHART_HEIGHT - barVolumeScale(dayStat.totalVolume);
              const barY = barVolumeScale(dayStat.totalVolume);

              return (
                <g key={`bar-group-${dayIndex}`}>
                  <Bar
                    x={x}
                    y={barY}
                    width={columnWidth}
                    height={barHeight}
                    fill="#fbbf24"
                    rx={2}
                    onMouseMove={(event) => handleBarInteraction(event, dayStat, x)}
                    onMouseLeave={handleBarLeave}
                    style={{ cursor: "pointer" }}
                  />
                  {/* Volume label inside bar */}
                  {barHeight > 20 && (
                    <Text
                      x={x + columnWidth / 2}
                      y={barY + barHeight - 5}
                      fontSize={10}
                      fontWeight="600"
                      fill="#78350f"
                      textAnchor="middle"
                    >
                      {dayStat.totalVolume}
                    </Text>
                  )}
                </g>
              );
            })}

            {/* Volume axis (left) */}
            <AxisLeft
              scale={barVolumeScale}
              numTicks={5}
              tickFormat={(d) => `${d} ml`}
              stroke="#cbd5e1"
              tickStroke="#cbd5e1"
              tickLabelProps={() => ({
                fill: "#64748b",
                fontSize: 10,
                textAnchor: "end",
                dx: -5,
              })}
            />

            {/* Volume axis (right) */}
            <AxisRight
              left={innerWidth}
              scale={barVolumeScale}
              numTicks={5}
              tickFormat={(d) => `${d} ml`}
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
          {tooltipData.type === "meal" ? (
            <div className="text-sm space-y-1">
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                {tooltipData.datetime.format("HH:mm")} · {tooltipData.volume} ml
              </div>
              <div className="text-gray-700 dark:text-gray-300">
                Total: {tooltipData.cumulativeVolume} ml
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-xs">
                {tooltipData.datetime.format("MMM D, YYYY")}
              </div>
            </div>
          ) : (
            <div className="text-sm space-y-1">
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                {tooltipData.date.format("MMM D, YYYY")}
              </div>
              <div className="text-gray-700 dark:text-gray-300">
                Total: {tooltipData.totalVolume} ml
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {tooltipData.entryCount} meal{tooltipData.entryCount !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </TooltipInPortal>
      )}
    </div>
  );
}
