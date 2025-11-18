/**
 * Sleep Timeline Component
 * Displays a horizontal timeline showing sleep/awake periods throughout the day
 * Uses visx for visualization primitives
 */

import { useMemo, useRef, useEffect } from "react";
import dayjs from "dayjs";
import { scaleTime, scaleBand } from "@visx/scale";
import { Bar } from "@visx/shape";
import { Group } from "@visx/group";
import { AxisBottom } from "@visx/axis";
import { defaultStyles, useTooltip, useTooltipInPortal } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import type { SleepEntry } from "~/lib/sleep-service";
import { formatDuration } from "~/lib/date-utils";

interface TimelineSegment {
  id: string;
  startTime: Date;
  endTime: Date;
  type: "sleep" | "awake";
  cycle: "Day" | "Night";
  durationMinutes: number;
  isActive: boolean;
}

interface SleepTimelineProps {
  entries: SleepEntry[];
  height?: number;
  startDatetime: dayjs.Dayjs; // When the day started (baby woke up)
}

const PIXELS_PER_HOUR = 80; // Width allocated per hour on timeline

export function SleepTimeline({
  entries,
  height = 80,
  startDatetime,
}: SleepTimelineProps) {
  const margin = { top: 10, right: 10, bottom: 30, left: 10 };
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
  } = useTooltip<TimelineSegment>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    scroll: true,
    detectBounds: true,
    zIndex: 1000
  });

  // Transform entries into timeline segments (sleep + awake)
  const segments = useMemo(() => {
    const now = dayjs();
    const result: TimelineSegment[] = [];
    const dayStart = startDatetime; // When the day started (from component prop)

    entries.forEach((entry, index) => {
      const sleepStart = entry.realDatetime;

      let sleepEnd: dayjs.Dayjs;
      if (entry.endTime === null) {
        // Active sleep - end time is now
        sleepEnd = now;
      } else {
        // Completed sleep - calculate end datetime using same base as realDatetime
        sleepEnd = entry.realDatetime.startOf("day").add(entry.endTime);

        // Adjust for midnight crossover (when end time < start time)
        const startMinutes = Math.floor(entry.startTime.asMinutes());
        const endMinutes = Math.floor(entry.endTime.asMinutes());
        if (endMinutes < startMinutes) {
          // Sleep crossed midnight - end time is next day
          sleepEnd = sleepEnd.add(1, "day");
        }
      }

      const durationMinutes = sleepEnd.diff(sleepStart, "minutes");

      // Add awake segment before this sleep
      if (index === 0) {
        // Check if there's awake time from day start to first sleep
        const awakeDuration = sleepStart.diff(dayStart, "minutes");

        if (awakeDuration > 0) {
          result.push({
            id: "awake-start",
            startTime: dayStart.toDate(),
            endTime: sleepStart.toDate(),
            type: "awake",
            cycle: entry.cycle,
            durationMinutes: awakeDuration,
            isActive: false,
          });
        }
      } else {
        // Add awake segment between previous sleep and this one
        const prevSegment = result[result.length - 1];

        if (prevSegment.type === "sleep") {
          const awakeStart = dayjs(prevSegment.endTime);
          const awakeDuration = sleepStart.diff(awakeStart, "minutes");

          let cycle = prevSegment.cycle;

          if (prevSegment.cycle == "Night" && entry.cycle == "Day") {
            cycle = "Day";
          }

          if (awakeDuration > 0) {
            result.push({
              id: `awake-${index}`,
              startTime: awakeStart.toDate(),
              endTime: sleepStart.toDate(),
              type: "awake",
              cycle: cycle,
              durationMinutes: awakeDuration,
              isActive: false,
            });
          }
        }
      }

      // Add sleep segment
      result.push({
        id: `sleep-${index}`,
        startTime: sleepStart.toDate(),
        endTime: sleepEnd.toDate(),
        type: "sleep",
        cycle: entry.cycle,
        durationMinutes,
        isActive: entry.endTime === null,
      });
    });

    return result;
  }, [entries, startDatetime]);

  // Define time range: start to max(start + 12h, last entry end + 1h)
  const { timelineStart, timelineEnd, durationHours } = useMemo(() => {
    const start = startDatetime;
    const min12h = start.add(12, "hours");

    if (segments.length === 0) {
      // No segments - show 12 hours from start
      return {
        timelineStart: start.toDate(),
        timelineEnd: min12h.toDate(),
        durationHours: 12,
      };
    }

    const lastEnd = segments[segments.length - 1].endTime;
    const lastEndDayjs = dayjs(lastEnd);
    const lastEndPlusOne = lastEndDayjs.add(1, "hour");

    // End is whichever is later: start + 12h OR last entry end + 1h
    const end = lastEndPlusOne.isAfter(min12h) ? lastEndPlusOne : min12h;
    const hours = end.diff(start, "hours", true); // true for fractional hours

    return {
      timelineStart: start.toDate(),
      timelineEnd: end.toDate(),
      durationHours: hours,
    };
  }, [segments, startDatetime]);

  // Calculate SVG width based on duration (grows/shrinks with actual hours)
  const svgWidth = Math.ceil(durationHours * PIXELS_PER_HOUR);
  const innerWidth = svgWidth - margin.left - margin.right;

  // Time scale (x-axis)
  const timeScale = scaleTime({
    domain: [timelineStart, timelineEnd],
    range: [0, innerWidth],
  });

  // Y scale - single row for all sleep periods
  const yScale = scaleBand({
    domain: ["sleep"],
    range: [0, innerHeight],
    padding: 0.1,
  });

  const barHeight = yScale.bandwidth();

  // Color mapping
  const getColor = (segment: TimelineSegment) => {
    if (segment.type === "awake") {
      // Awake periods - lighter/grayed colors
      return segment.cycle === "Day"
        ? "#e8ff96"
        : "#cbd5e1"; // light gray for night awake
    } else {
      // Sleep periods
      return segment.cycle === "Day"
        ? "#93c5fd" // light blue for day sleep
        : "#003ea1"; // darker blue for night sleep
    }
  };

  if (segments.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm opacity-50"
      >
        No sleep data for this period
      </div>
    );
  }

  // Handle tooltip show/hide
  const handleMouseMove = (event: React.MouseEvent | React.TouchEvent, segment: TimelineSegment) => {
    const point = localPoint(event) || { x: 0, y: 0 };
    // Offset tooltip above the touch point (60px above for better visibility)
    const tooltipOffset = 60;
    showTooltip({
      tooltipData: segment,
      tooltipLeft: point.x,
      tooltipTop: point.y - tooltipOffset,
    });
  };

  // Auto-scroll to latest entry on initial mount only
  useEffect(() => {
    if (scrollContainerRef.current && segments.length > 0 && !hasAutoScrolled.current) {
      const lastSegment = segments[segments.length - 1];
      const lastEntryX = timeScale(lastSegment.endTime);

      // Calculate scroll position to center the last entry
      const containerWidth = scrollContainerRef.current.offsetWidth;
      const scrollLeft = Math.max(0, lastEntryX + margin.left - containerWidth / 2);

      // Use setTimeout to ensure DOM is fully rendered
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
  }, [segments, timeScale, margin.left]);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Scrollable container */}
      <div
        ref={scrollContainerRef}
        style={{
          width: "100%",
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch", // Smooth scrolling on iOS
        }}
        className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
      >
        <svg width={svgWidth} height={height} ref={containerRef}>
          <Group left={margin.left} top={margin.top}>
            {/* Sleep bars */}
            {segments.map((segment) => {
              const barX = timeScale(segment.startTime);
              const barWidth = Math.max(
                2,
                timeScale(segment.endTime) - barX
              );
              const barY = yScale("sleep") || 0;

              return (
                <Bar
                  key={segment.id}
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  fill={getColor(segment)}
                  stroke={segment.isActive ? "#9fb1ab" : "transparent"}
                  strokeWidth={segment.isActive ? 2 : 0}
                  onMouseMove={(event) => handleMouseMove(event, segment)}
                  onMouseLeave={hideTooltip}
                  onTouchStart={(event) => handleMouseMove(event, segment)}
                  onTouchEnd={hideTooltip}
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
              {tooltipData.type === "awake" ? "Awake" : tooltipData.cycle + " Sleep"}
              {tooltipData.isActive && " (Active)"}
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {dayjs(tooltipData.startTime).format("h:mm A")} → {" "}
              {tooltipData.isActive
                ? "Now"
                : dayjs(tooltipData.endTime).format("h:mm A")}
            </div>
            <div className="text-gray-700 dark:text-gray-300">
              Duration: {formatDuration(tooltipData.durationMinutes)}
            </div>
          </div>
        </TooltipInPortal>
      )}
    </div>
  );
}

/**
 * Wrapper for SleepTimeline
 * No longer uses ParentSize since timeline has fixed width with horizontal scroll
 */
interface ResponsiveSleepTimelineProps {
  entries: SleepEntry[];
  height?: number;
  startDatetime: dayjs.Dayjs;
}

export function ResponsiveSleepTimeline({
  entries,
  height = 80,
  startDatetime,
}: ResponsiveSleepTimelineProps) {
  return (
    <SleepTimeline
      entries={entries}
      startDatetime={startDatetime}
      height={height}
    />
  );
}
