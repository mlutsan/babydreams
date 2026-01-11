/**
 * Eat Overview Chart Component
 * Daily total bar chart
 */

import { useMemo, useRef, useEffect } from "react";
import type { Dayjs } from "dayjs";
import { useMinuteTick } from "~/hooks/useMinuteTick";
import { scaleLinear, scaleBand } from "@visx/scale";
import { Bar, Line } from "@visx/shape";
import { Group } from "@visx/group";
import { AxisLeft, AxisRight } from "@visx/axis";
import { Text } from "@visx/text";
import { defaultStyles, useTooltip, useTooltipInPortal } from "@visx/tooltip";
import type { DailyEatStat } from "~/lib/eat-service";

interface EatOverviewChartProps {
  dailyStats: DailyEatStat[];
  todayDate?: Dayjs;
}

interface DailyTooltipData {
  date: Dayjs;
  totalVolume: number;
  entryCount: number;
}

const DAY_COLUMN_WIDTH = 60;
const BAR_CHART_HEIGHT = 150;
const BAR_MARGIN = { top: 50, right: 50, bottom: 40, left: 50 };

export function EatOverviewChart({ dailyStats, todayDate }: EatOverviewChartProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolled = useRef(false);
  const barTooltipTimeout = useRef<number | undefined>(undefined);
  const now = useMinuteTick();

  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<DailyTooltipData>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    scroll: true,
    detectBounds: true,
    zIndex: 1000,
  });

  const sortedDailyStats = useMemo(() => {
    return [...dailyStats].sort((a, b) => a.date.unix() - b.date.unix());
  }, [dailyStats]);

  if (sortedDailyStats.length === 0) {
    return (
      <div
        style={{ height: BAR_CHART_HEIGHT }}
        className="flex items-center justify-center text-sm opacity-50"
      >
        No meal data available
      </div>
    );
  }

  const today = (todayDate ?? now).startOf("day");
  const todayIndex = sortedDailyStats.findIndex((stat) => stat.date.isSame(today, "day"));

  const totalDays = sortedDailyStats.length;
  const barInnerWidth = totalDays * DAY_COLUMN_WIDTH;
  const barSvgWidth = barInnerWidth + BAR_MARGIN.left + BAR_MARGIN.right;
  const barSvgHeight = BAR_MARGIN.top + BAR_CHART_HEIGHT + BAR_MARGIN.bottom;

  const dayScale = scaleBand({
    domain: sortedDailyStats.map((_, i) => i.toString()),
    range: [0, barInnerWidth],
    padding: 0.1,
  });

  const columnWidth = dayScale.bandwidth();
  const maxVolumeForBars = Math.max(...sortedDailyStats.map((s) => s.totalVolume), 100);
  const barVolumeScale = scaleLinear({
    domain: [0, maxVolumeForBars],
    range: [BAR_CHART_HEIGHT, 0],
    nice: true,
  });

  const handleBarInteraction = (dayStat: DailyEatStat, left: number, top: number) => {
    if (barTooltipTimeout.current) {
      clearTimeout(barTooltipTimeout.current);
    }

    showTooltip({
      tooltipData: {
        date: dayStat.date,
        totalVolume: dayStat.totalVolume,
        entryCount: dayStat.entryCount,
      },
      tooltipLeft: left,
      tooltipTop: top,
    });
  };

  const handleBarLeave = () => {
    barTooltipTimeout.current = window.setTimeout(() => {
      hideTooltip();
    }, 250);
  };

  useEffect(() => {
    if (scrollContainerRef.current && todayIndex !== -1 && !hasAutoScrolled.current) {
      const todayX = todayIndex * DAY_COLUMN_WIDTH + BAR_MARGIN.left;
      const containerWidth = scrollContainerRef.current.offsetWidth;

      const scrollLeft = Math.max(0, todayX - containerWidth / 2 + DAY_COLUMN_WIDTH / 2);

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

  return (
    <div className="space-y-4">

      <div className="relative">
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
          <svg width={barSvgWidth} height={barSvgHeight} ref={containerRef}>
            <Group left={BAR_MARGIN.left} top={BAR_MARGIN.top}>
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

              {barVolumeScale.ticks(5).map((tick) => {
                const y = barVolumeScale(tick);
                return (
                  <Line
                    key={`bar-grid-${tick}`}
                    from={{ x: 0, y }}
                    to={{ x: barInnerWidth, y }}
                    stroke="#e2e8f0"
                    strokeWidth={1}
                    strokeDasharray="2,2"
                  />
                );
              })}

              {sortedDailyStats.map((dayStat, dayIndex) => {
                const x = dayScale(dayIndex.toString()) || 0;
                const barHeight = BAR_CHART_HEIGHT - barVolumeScale(dayStat.totalVolume);
                const barY = barVolumeScale(dayStat.totalVolume);
                const tooltipLeft = BAR_MARGIN.left + x + columnWidth / 2;
                const tooltipTop = BAR_MARGIN.top + barY - 40;

                return (
                  <g key={`bar-group-${dayIndex}`}>
                    <Bar
                      x={x}
                      y={barY}
                      width={columnWidth}
                      height={barHeight}
                      fill="#fbbf24"
                      rx={2}
                      onMouseMove={() => handleBarInteraction(dayStat, tooltipLeft, tooltipTop)}
                      onMouseLeave={handleBarLeave}
                      onTouchStart={() => handleBarInteraction(dayStat, tooltipLeft, tooltipTop)}
                      onTouchEnd={handleBarLeave}
                      style={{ cursor: "pointer" }}
                    />
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

              <AxisRight
                left={barInnerWidth}
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

        {tooltipOpen && tooltipData && (
          <TooltipInPortal
            top={tooltipTop}
            left={tooltipLeft}
            style={{ ...defaultStyles, backgroundColor: "" }}
            className="z-1000 bg-gray-200 dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700"
          >
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
          </TooltipInPortal>
        )}
      </div>
    </div>
  );
}
