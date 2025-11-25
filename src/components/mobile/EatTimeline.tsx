/**
 * Eat Timeline Component
 * Displays a horizontal timeline showing feeding events as vertical bars
 * Bar height represents volume
 */

import { useMemo, useRef, useEffect } from "react";
import dayjs from "dayjs";
import { scaleTime, scaleLinear } from "@visx/scale";
import { Bar } from "@visx/shape";
import { Group } from "@visx/group";
import { AxisBottom } from "@visx/axis";
import { defaultStyles, useTooltip, useTooltipInPortal } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import type { EatEntry } from "~/lib/eat-service";

interface TimelineBar {
  id: string;
  time: Date;
  volume: number;
  x: number;
}

interface EatTimelineProps {
  entries: EatEntry[];
  height?: number;
  startDatetime: dayjs.Dayjs; // When the day started
}

const PIXELS_PER_HOUR = 80;
const BAR_WIDTH = 24; // Fixed width for feeding bars

export function EatTimeline({
  entries,
  height = 80,
  startDatetime,
}: EatTimelineProps) {
  const margin = { top: 10, right: 10, bottom: 30, left: 10 };
  const innerHeight = height - margin.top - margin.bottom;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolled = useRef(false);
  const tooltipTimeout = useRef<number | undefined>(undefined);

  // Tooltip hooks
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<EatEntry>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    scroll: true,
    detectBounds: true,
    zIndex: 1000
  });

  // Define time range: start to max(start + 12h, last entry + 1h)
  const { timelineStart, timelineEnd, durationHours } = useMemo(() => {
    const start = startDatetime;
    const min12h = start.add(12, "hours");

    if (entries.length === 0) {
      return {
        timelineStart: start.toDate(),
        timelineEnd: min12h.toDate(),
        durationHours: 12,
      };
    }

    const lastEntry = entries[entries.length - 1];
    const lastEntryTime = lastEntry.datetime;
    const lastTimePlusOne = lastEntryTime.add(1, "hour");

    const end = lastTimePlusOne.isAfter(min12h) ? lastTimePlusOne : min12h;
    const hours = end.diff(start, "hours", true);

    return {
      timelineStart: start.toDate(),
      timelineEnd: end.toDate(),
      durationHours: hours,
    };
  }, [entries, startDatetime]);

  // Calculate SVG width based on duration
  const svgWidth = Math.ceil(durationHours * PIXELS_PER_HOUR);
  const innerWidth = svgWidth - margin.left - margin.right;

  // Time scale (x-axis)
  const timeScale = scaleTime({
    domain: [timelineStart, timelineEnd],
    range: [0, innerWidth],
  });

  // Volume scale (y-axis) - 0 to 200ml
  const volumeScale = scaleLinear({
    domain: [0, 200],
    range: [innerHeight, 0],
  });

  // Transform entries to bars
  const bars: TimelineBar[] = useMemo(() => {
    return entries.map((entry, index) => ({
      id: `eat-${index}`,
      time: entry.datetime.toDate(),
      volume: entry.volume,
      x: timeScale(entry.datetime.toDate()),
    }));
  }, [entries, timeScale]);

  // Auto-scroll to latest entry on initial mount only
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
  const handleBarInteraction = (
    event: React.MouseEvent | React.TouchEvent,
    entry: EatEntry,
    barX: number
  ) => {
    // Clear any existing timeout
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }

    // Get event coordinates relative to SVG
    const eventSvgCoords = localPoint(event);

    // Position tooltip at center of bar horizontally, above the touch point
    const left = barX;
    const top = (eventSvgCoords?.y || 0) - 120;

    showTooltip({
      tooltipData: entry,
      tooltipTop: top,
      tooltipLeft: left,
    });
  };

  const handleBarLeave = () => {
    // Delay hiding tooltip to prevent flicker
    tooltipTimeout.current = window.setTimeout(() => {
      hideTooltip();
    }, 300);
  };

  if (entries.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm opacity-50"
      >
        No feeding data for this period
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
            {/* Meal bars */}
            {bars.map((bar, index) => {
              const barHeight = innerHeight - volumeScale(bar.volume);
              const barY = volumeScale(bar.volume);

              return (
                <Bar
                  key={bar.id}
                  x={bar.x - BAR_WIDTH / 2}
                  y={barY}
                  width={BAR_WIDTH}
                  height={barHeight}
                  fill="#fbbf24"
                  rx={3}
                  onMouseMove={(event) => handleBarInteraction(event, entries[index], bar.x)}
                  onMouseLeave={handleBarLeave}
                  style={{ cursor: "pointer" }}
                />
              );
            })}

            {/* Time axis */}
            <AxisBottom
              top={innerHeight}
              scale={timeScale}
              numTicks={durationHours}
              tickFormat={(d) => dayjs(d as Date).format("HH:mm")}
              stroke="#cbd5e1"
              tickStroke="#cbd5e1"
              tickLabelProps={() => ({
                fill: "#64748b",
                fontSize: 10,
                textAnchor: "middle",
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
          <div className="text-sm space-y-1">
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              Meal
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {dayjs(tooltipData.datetime).format("h:mm A")}
            </div>
            <div className="text-gray-700 dark:text-gray-300">
              Volume: {tooltipData.volume} ml
            </div>
          </div>
        </TooltipInPortal>
      )}
    </div>
  );
}

/**
 * Wrapper for EatTimeline
 */
interface ResponsiveEatTimelineProps {
  entries: EatEntry[];
  height?: number;
  startDatetime: dayjs.Dayjs;
}

export function ResponsiveEatTimeline({
  entries,
  height = 80,
  startDatetime,
}: ResponsiveEatTimelineProps) {
  return (
    <EatTimeline
      entries={entries}
      startDatetime={startDatetime}
      height={height}
    />
  );
}
