/**
 * Eat Overview Chart Component
 * Shows daily feeding volume trends over time
 * X-axis: Days
 * Y-axis: Total volume per day
 */

import { useMemo, useRef, useEffect } from "react";
import dayjs from "dayjs";
import { scaleTime, scaleLinear } from "@visx/scale";
import { Bar } from "@visx/shape";
import { Group } from "@visx/group";
import { AxisBottom } from "@visx/axis";
import { defaultStyles, useTooltip, useTooltipInPortal } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import type { DailyEatStat } from "~/lib/eat-service";

interface DailyBar {
  id: string;
  date: Date;
  totalVolume: number;
  entryCount: number;
  x: number;
}

interface EatOverviewChartProps {
  dailyStats: DailyEatStat[];
  height?: number;
}

const PIXELS_PER_DAY = 60;
const BAR_WIDTH = 40;

export function EatOverviewChart({
  dailyStats,
  height = 200,
}: EatOverviewChartProps) {
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerHeight = height - margin.top - margin.bottom;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolled = useRef(false);

  // Tooltip hooks
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<DailyEatStat>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    scroll: true,
    detectBounds: true,
    zIndex: 1000,
  });

  // Sort stats by date ascending
  const sortedStats = useMemo(() => {
    return [...dailyStats].sort((a, b) => a.date.unix() - b.date.unix());
  }, [dailyStats]);

  // Calculate date range and dimensions
  const { chartStart, chartEnd, numDays, maxVolume } = useMemo(() => {
    if (sortedStats.length === 0) {
      const today = dayjs().startOf("day");
      return {
        chartStart: today.subtract(7, "days").toDate(),
        chartEnd: today.toDate(),
        numDays: 7,
        maxVolume: 1000,
      };
    }

    const firstDate = sortedStats[0].date;
    const lastDate = sortedStats[sortedStats.length - 1].date;
    const days = lastDate.diff(firstDate, "days") + 1;
    const max = Math.max(...sortedStats.map((s) => s.totalVolume));

    return {
      chartStart: firstDate.toDate(),
      chartEnd: lastDate.toDate(),
      numDays: Math.max(days, 7),
      maxVolume: Math.ceil(max / 100) * 100, // Round up to nearest 100
    };
  }, [sortedStats]);

  // Calculate SVG width based on number of days
  const svgWidth = Math.ceil(numDays * PIXELS_PER_DAY) + margin.left + margin.right;
  const innerWidth = svgWidth - margin.left - margin.right;

  // Date scale (x-axis)
  const dateScale = scaleTime({
    domain: [chartStart, chartEnd],
    range: [0, innerWidth],
  });

  // Volume scale (y-axis)
  const volumeScale = scaleLinear({
    domain: [0, maxVolume],
    range: [innerHeight, 0],
  });

  // Transform daily stats to bars
  const bars: DailyBar[] = useMemo(() => {
    return sortedStats.map((stat) => ({
      id: `day-${stat.date.format("YYYY-MM-DD")}`,
      date: stat.date.toDate(),
      totalVolume: stat.totalVolume,
      entryCount: stat.entryCount,
      x: dateScale(stat.date.toDate()),
    }));
  }, [sortedStats, dateScale]);

  // Generate grid line values (every 100ml)
  const gridValues = useMemo(() => {
    const values: number[] = [];
    for (let i = 0; i <= maxVolume; i += 100) {
      values.push(i);
    }
    return values;
  }, [maxVolume]);

  // Auto-scroll to latest day on initial mount only
  useEffect(() => {
    if (scrollContainerRef.current && bars.length > 0 && !hasAutoScrolled.current) {
      const lastBar = bars[bars.length - 1];
      const containerWidth = scrollContainerRef.current.offsetWidth;
      const scrollLeft = Math.max(0, lastBar.x + margin.left - containerWidth / 2);

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
  }, [bars, margin.left]);

  // Handle tooltip show/hide
  const handleMouseMove = (
    event: React.MouseEvent | React.TouchEvent,
    stat: DailyEatStat
  ) => {
    const point = localPoint(event) || { x: 0, y: 0 };
    showTooltip({
      tooltipData: stat,
      tooltipLeft: point.x,
      tooltipTop: point.y,
    });
  };

  if (dailyStats.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm opacity-50"
      >
        No feeding data available
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
            {/* Horizontal grid lines */}
            {gridValues.map((value) => {
              const y = volumeScale(value);
              const is500ml = value % 500 == 0;

              return (
                <g key={`grid-${value}`}>
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={y}
                    y2={y}
                    stroke={is500ml ? "#94a3b8" : "#e2e8f0"}
                    strokeWidth={is500ml ? 1 : 0.5}
                    strokeDasharray={is500ml ? "none" : "4 4"}
                    opacity={is500ml ? 0.5 : 0.3}
                  />
                  {/* Label on the right */}
                  {/* <text
                    x={innerWidth + 5}
                    y={y}
                    dy="0.32em"
                    fill="#64748b"
                    fontSize={is500ml ? 11 : 9}
                    fontWeight={is500ml ? 600 : 400}
                  >
                    {value} ml
                  </text> */}
                </g>
              );
            })}

            {/* Volume bars */}
            {bars.map((bar, index) => {
              const barHeight = innerHeight - volumeScale(bar.totalVolume);
              const barY = volumeScale(bar.totalVolume);

              return (
                <Bar
                  key={bar.id}
                  x={bar.x - BAR_WIDTH / 2}
                  y={barY}
                  width={BAR_WIDTH}
                  height={barHeight}
                  fill="#fbbf24"
                  rx={3}
                  onMouseMove={(event) => handleMouseMove(event, sortedStats[index])}
                  onMouseLeave={hideTooltip}
                  onTouchStart={(event) => handleMouseMove(event, sortedStats[index])}
                  onTouchEnd={hideTooltip}
                  style={{ cursor: "pointer" }}
                />
              );
            })}

            {/* Date axis (bottom) */}
            <AxisBottom
              top={innerHeight}
              scale={dateScale}
              numTicks={Math.min(numDays, 10)}
              tickFormat={(d) => dayjs(d as Date).format("MMM D")}
              stroke="#cbd5e1"
              tickStroke="#cbd5e1"
              tickLabelProps={() => ({
                fill: "#64748b",
                fontSize: 11,
                textAnchor: "middle",
              })}
            />

            {/* Volume axis (left) */}
            {/* <AxisLeft
              scale={volumeScale}
              numTicks={5}
              tickFormat={(d) => `${d} ml`}
              stroke="#cbd5e1"
              tickStroke="#cbd5e1"
              tickLabelProps={() => ({
                fill: "#64748b",
                fontSize: 10,
                textAnchor: "end",
                dx: -4,
              })}
            /> */}
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
          <div className="text-sm space-y-1">
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              {dayjs(tooltipData.date).format("MMM D, YYYY")}
            </div>
            <div className="text-gray-700 dark:text-gray-300">
              Total: {tooltipData.totalVolume} ml
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {tooltipData.entryCount} feeding{tooltipData.entryCount !== 1 ? "s" : ""}
            </div>
          </div>
        </TooltipInPortal>
      )}
    </div>
  );
}
