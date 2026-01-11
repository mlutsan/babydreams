/**
 * Eat Step Chart
 * Shows today's cumulative intake vs historical percentile band.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import dayjs from "dayjs";
import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { AreaClosed, Line, LinePath, Circle } from "@visx/shape";
import { Group } from "@visx/group";
import { AxisBottom, AxisRight } from "@visx/axis";
import { Brush } from "@visx/brush";
import type { Bounds, BrushHandleRenderProps } from "@visx/brush";
import { defaultStyles, useTooltip, useTooltipInPortal } from "@visx/tooltip";
import { curveMonotoneX, curveStepAfter } from "@visx/curve";
import { Info } from "lucide-react";
import { useMinuteTick } from "~/hooks/useMinuteTick";
import type { DailyEatStat } from "~/lib/eat-service";
import type { DailyStat } from "~/types/sleep";
import { cycleSettingsAtom } from "~/lib/atoms";
import {
  getTimeOfDayMinutes,
  MINUTES_PER_DAY,
  normalizeMinutesSinceStart,
  timeToMinutes,
} from "~/lib/date-utils";

interface StepPoint {
  timeMinutes: number;
  volume: number;
  cumulativeVolume: number;
  datetime: dayjs.Dayjs;
}

interface StepSegment extends StepPoint {
  prevCumulativeVolume: number;
}

interface BandPoint {
  minute: number;
  p25: number;
  p50: number;
  p75: number;
}

interface MealTooltipData {
  datetime: dayjs.Dayjs;
  volume: number;
  cumulativeVolume: number;
}

interface EatStepChartProps {
  dailyStats: DailyEatStat[];
  sleepStats?: DailyStat[];
  todayDate?: dayjs.Dayjs;
  height?: number;
}

const STEP_CHART_HEIGHT = 240;
const STEP_MARGIN = { top: 24, right: 54, bottom: 36, left: 14 };
const OVERVIEW_HEIGHT = 40;
const OVERVIEW_GAP = 1;
const OVERVIEW_MARGIN = {
  top: 4,
  right: STEP_MARGIN.right,
  bottom: 8,
  left: STEP_MARGIN.left,
};
const DEFAULT_VIEW_WINDOW_MINUTES = 10 * 60;
const MIN_VIEW_WINDOW_MINUTES = 4 * 60;
const BAND_GRID_MINUTES = 60;

const BAND_FILL = "#bfdbfe";
const BAND_STROKE = "#60a5fa";
const TODAY_STROKE = "#f59e0b";
const YESTERDAY_STROKE = "#94a3b8";
const CURRENT_TIME_STROKE = "rgba(239, 68, 68, 0.7)";
const BAND_CURVE = curveMonotoneX;

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = index - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function normalizeViewRange(
  start: number,
  end: number,
  bounds: { min: number; max: number; },
  minWidth: number
) {
  const sortedStart = Math.min(start, end);
  const sortedEnd = Math.max(start, end);
  const boundsWidth = bounds.max - bounds.min;
  const desiredWidth = Math.min(Math.max(sortedEnd - sortedStart, minWidth), boundsWidth);

  let viewStart = sortedStart;
  let viewEnd = viewStart + desiredWidth;

  if (viewEnd > bounds.max) {
    viewEnd = bounds.max;
    viewStart = viewEnd - desiredWidth;
  }

  if (viewStart < bounds.min) {
    viewStart = bounds.min;
    viewEnd = viewStart + desiredWidth;
  }

  return { start: viewStart, end: viewEnd };
}

function getBandDataInView(
  bandData: BandPoint[],
  viewStart: number,
  viewEnd: number
) {
  if (bandData.length === 0) {
    return [];
  }

  const inside: BandPoint[] = [];
  let left: BandPoint | null = null;
  let right: BandPoint | null = null;

  bandData.forEach((point) => {
    if (point.minute <= viewStart) {
      left = point;
    }
    if (point.minute <= viewEnd) {
      right = point;
    }
    if (point.minute >= viewStart && point.minute <= viewEnd) {
      inside.push(point);
    }
  });

  const result: BandPoint[] = [];
  const withMinute = (point: BandPoint, minute: number): BandPoint => ({
    minute,
    p25: point.p25,
    p50: point.p50,
    p75: point.p75,
  });

  if (left && (inside.length === 0 || inside[0].minute > viewStart)) {
    result.push(withMinute(left, viewStart));
  }

  result.push(...inside);

  if (right) {
    const last = result[result.length - 1];
    if (!last || last.minute < viewEnd) {
      result.push(withMinute(right, viewEnd));
    }
  }

  return result;
}

export function EatStepChart({
  dailyStats,
  sleepStats,
  todayDate,
  height = STEP_CHART_HEIGHT,
}: EatStepChartProps) {
  const cycleSettings = useAtomValue(cycleSettingsAtom);
  const now = useMinuteTick();
  const tooltipTimeout = useRef<number | undefined>(undefined);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const hintButtonRef = useRef<HTMLButtonElement>(null);

  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<MealTooltipData>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    zIndex: 1000,
  });

  const sortedDailyStats = useMemo(() => {
    return [...dailyStats].sort((a, b) => a.date.unix() - b.date.unix());
  }, [dailyStats]);

  if (sortedDailyStats.length === 0) {
    return null;
  }

  const today = (todayDate ?? now).startOf("day");
  const todayStat = sortedDailyStats.find((stat) => stat.date.isSame(today, "day")) ?? null;
  const yesterday = today.subtract(1, "day");
  const yesterdayStat =
    sortedDailyStats.find((stat) => stat.date.isSame(yesterday, "day")) ?? null;
  const windowStart = today.subtract(6, "day");
  const windowEnd = today;
  const windowDates = Array.from({ length: 7 }, (_, index) => windowStart.add(index, "day"));

  const sleepStatsByDate = useMemo(() => {
    const map = new Map<string, DailyStat>();
    if (sleepStats) {
      sleepStats.forEach((stat) => {
        map.set(stat.logicalDate, stat);
      });
    }
    return map;
  }, [sleepStats]);

  const sleepStartMinutes = windowDates
    .map((date) => sleepStatsByDate.get(date.format("YYYY-MM-DD")))
    .filter((stat): stat is DailyStat => !!stat)
    .map((stat) => getTimeOfDayMinutes(stat.startDatetime));

  const todayMealMinutesRaw =
    todayStat?.entries.map((entry) => getTimeOfDayMinutes(entry.datetime)) ?? [];
  const firstMealMinuteRaw =
    todayMealMinutesRaw.length > 0 ? Math.min(...todayMealMinutesRaw) : null;

  const dayStartMinutes = timeToMinutes(cycleSettings.dayStart);
  const referenceStartMinutes =
    sleepStartMinutes.length > 0
      ? Math.min(...sleepStartMinutes)
      : Math.min(dayStartMinutes, firstMealMinuteRaw ?? dayStartMinutes);

  const normalizeMinutes = useCallback(
    (timeMinutes: number) => normalizeMinutesSinceStart(timeMinutes, referenceStartMinutes),
    [referenceStartMinutes]
  );

  const todayMealMinutes = todayMealMinutesRaw.map(normalizeMinutes);
  const lastMealMinute = todayMealMinutes.length > 0 ? Math.max(...todayMealMinutes) : null;

  const nowMinutes = normalizeMinutes(getTimeOfDayMinutes(now));

  const startMinutes = referenceStartMinutes;

  const todayKey = today.format("YYYY-MM-DD");
  const todaySleepStat = sleepStatsByDate.get(todayKey) ?? null;
  const todaySleepEndMinutes = todaySleepStat
    ? (() => {
      const startMinutesOfDay = getTimeOfDayMinutes(todaySleepStat.startDatetime);
      const startNormalized = normalizeMinutesSinceStart(startMinutesOfDay, startMinutes);
      const durationMinutes = Math.max(
        0,
        todaySleepStat.endDatetime.diff(todaySleepStat.startDatetime, "minute")
      );
      return startNormalized + durationMinutes;
    })()
    : null;

  const baselineEnd = startMinutes + MINUTES_PER_DAY;
  const maxEndCandidate = Math.max(
    todaySleepEndMinutes ?? 0,
    lastMealMinute ?? 0,
    nowMinutes,
    baselineEnd
  );

  const endMinutes = Math.max(maxEndCandidate, startMinutes + BAND_GRID_MINUTES);
  const viewBounds = useMemo(
    () => ({ min: startMinutes, max: endMinutes }),
    [startMinutes, endMinutes]
  );
  const viewBoundsMin = viewBounds.min;
  const viewBoundsMax = viewBounds.max;

  const autoViewRange = useMemo(() => {
    const defaultEnd = Math.min(viewBoundsMax, Math.max(viewBoundsMin, nowMinutes));
    const defaultStart = Math.max(viewBoundsMin, defaultEnd - DEFAULT_VIEW_WINDOW_MINUTES);
    return normalizeViewRange(defaultStart, defaultEnd, viewBounds, MIN_VIEW_WINDOW_MINUTES);
  }, [nowMinutes, viewBounds, viewBoundsMin, viewBoundsMax]);

  const [viewRange, setViewRange] = useState(() => autoViewRange);
  const [hasCustomView, setHasCustomView] = useState(false);
  const [brushKey, setBrushKey] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const viewStart = viewRange.start;
  const viewEnd = viewRange.end;

  useEffect(() => {
    const nextRange = hasCustomView
      ? normalizeViewRange(viewStart, viewEnd, viewBounds, MIN_VIEW_WINDOW_MINUTES)
      : autoViewRange;

    if (nextRange.start !== viewStart || nextRange.end !== viewEnd) {
      setViewRange(nextRange);
      setBrushKey((prev) => prev + 1);
    }
  }, [
    autoViewRange,
    hasCustomView,
    viewBounds,
    viewStart,
    viewEnd,
  ]);

  const gridMinutes = useMemo(() => {
    const grid: number[] = [];
    for (let minute = startMinutes; minute <= endMinutes; minute += BAND_GRID_MINUTES) {
      grid.push(minute);
    }
    return grid.length > 0 ? grid : [startMinutes];
  }, [startMinutes, endMinutes]);

  const windowStats = useMemo(() => {
    return sortedDailyStats.filter((stat) => {
      const isWithinWindow =
        (stat.date.isSame(windowStart, "day") || stat.date.isAfter(windowStart)) &&
        (stat.date.isSame(windowEnd, "day") || stat.date.isBefore(windowEnd));
      return isWithinWindow;
    });
  }, [sortedDailyStats, windowStart, windowEnd]);

  const bandStats = useMemo(() => {
    return windowStats.filter(
      (stat) =>
        !stat.date.isSame(today, "day") && stat.entries.length > 0 && stat.totalVolume > 0
    );
  }, [windowStats, today]);

  const bandData = useMemo<BandPoint[]>(() => {
    if (bandStats.length === 0) {
      return [];
    }

    const seriesByDay = bandStats.map((stat) => {
      const entries = [...stat.entries].sort(
        (a, b) =>
          normalizeMinutes(getTimeOfDayMinutes(a.datetime))
          - normalizeMinutes(getTimeOfDayMinutes(b.datetime))
      );
      let cumulative = 0;
      let entryIndex = 0;
      const series: number[] = [];

      gridMinutes.forEach((minute) => {
        while (entryIndex < entries.length) {
          const entryMinute = normalizeMinutes(getTimeOfDayMinutes(entries[entryIndex].datetime));
          if (entryMinute <= minute) {
            cumulative += entries[entryIndex].volume;
            entryIndex += 1;
            continue;
          }
          break;
        }
        series.push(cumulative);
      });

      return series;
    });

    return gridMinutes.map((minute, index) => {
      const values = seriesByDay.map((series) => series[index] ?? 0);
      return {
        minute,
        p25: percentile(values, 0.25),
        p50: percentile(values, 0.5),
        p75: percentile(values, 0.75),
      };
    });
  }, [bandStats, gridMinutes, normalizeMinutes]);

  const entriesWithMinutes = useMemo(() => {
    if (!todayStat) {
      return [];
    }

    return [...todayStat.entries]
      .map((entry) => ({
        entry,
        minute: normalizeMinutes(getTimeOfDayMinutes(entry.datetime)),
      }))
      .sort((a, b) => a.minute - b.minute);
  }, [todayStat, normalizeMinutes]);

  const yesterdayEntriesWithMinutes = useMemo(() => {
    if (!yesterdayStat) {
      return [];
    }

    return [...yesterdayStat.entries]
      .map((entry) => ({
        entry,
        minute: normalizeMinutes(getTimeOfDayMinutes(entry.datetime)),
      }))
      .sort((a, b) => a.minute - b.minute);
  }, [yesterdayStat, normalizeMinutes]);

  const totalVolumeFull = useMemo(() => {
    if (todayStat) {
      return todayStat.totalVolume;
    }
    return entriesWithMinutes.reduce((sum, item) => sum + item.entry.volume, 0);
  }, [todayStat, entriesWithMinutes]);

  const { linePoints, stepPoints, stepSegments, volumeAtViewEnd } = useMemo(() => {
    let baseCumulative = 0;
    let running = 0;
    const stepPoints: StepPoint[] = [];
    const stepSegments: StepSegment[] = [];

    entriesWithMinutes.forEach(({ entry, minute }) => {
      if (minute < viewStart) {
        baseCumulative += entry.volume;
        running += entry.volume;
        return;
      }
      if (minute <= viewEnd) {
        const prev = running;
        running += entry.volume;
        stepPoints.push({
          timeMinutes: minute,
          volume: entry.volume,
          cumulativeVolume: running,
          datetime: entry.datetime,
        });
        stepSegments.push({
          timeMinutes: minute,
          volume: entry.volume,
          cumulativeVolume: running,
          prevCumulativeVolume: prev,
          datetime: entry.datetime,
        });
      }
    });

    const hasLine = baseCumulative > 0 || stepPoints.length > 0;
    const linePoints = hasLine
      ? [
        { timeMinutes: viewStart, cumulativeVolume: baseCumulative },
        ...stepPoints.map((point) => ({
          timeMinutes: point.timeMinutes,
          cumulativeVolume: point.cumulativeVolume,
        })),
        { timeMinutes: viewEnd, cumulativeVolume: running },
      ]
      : [];

    return {
      linePoints,
      stepPoints,
      stepSegments,
      volumeAtViewEnd: running,
    };
  }, [entriesWithMinutes, viewStart, viewEnd]);

  const fullLinePoints = useMemo(() => {
    let baseCumulative = 0;
    let running = 0;
    const points: Array<{ timeMinutes: number; cumulativeVolume: number; }> = [];

    entriesWithMinutes.forEach(({ entry, minute }) => {
      if (minute < startMinutes) {
        baseCumulative += entry.volume;
        running += entry.volume;
        return;
      }
      if (minute <= endMinutes) {
        running += entry.volume;
        points.push({ timeMinutes: minute, cumulativeVolume: running });
      }
    });

    return points.length > 0
      ? [
        { timeMinutes: startMinutes, cumulativeVolume: baseCumulative },
        ...points,
      ]
      : [];
  }, [entriesWithMinutes, startMinutes, endMinutes]);

  const yesterdayLinePoints = useMemo(() => {
    let baseCumulative = 0;
    let running = 0;
    const points: Array<{ timeMinutes: number; cumulativeVolume: number; }> = [];

    yesterdayEntriesWithMinutes.forEach(({ entry, minute }) => {
      if (minute < viewStart) {
        baseCumulative += entry.volume;
        running += entry.volume;
        return;
      }
      if (minute <= viewEnd) {
        running += entry.volume;
        points.push({ timeMinutes: minute, cumulativeVolume: running });
      }
    });

    const hasLine = baseCumulative > 0 || points.length > 0;
    return hasLine
      ? [
        { timeMinutes: viewStart, cumulativeVolume: baseCumulative },
        ...points,
        { timeMinutes: viewEnd, cumulativeVolume: running },
      ]
      : [];
  }, [yesterdayEntriesWithMinutes, viewStart, viewEnd]);

  const bandDataView = useMemo(
    () => getBandDataInView(bandData, viewStart, viewEnd),
    [bandData, viewStart, viewEnd]
  );

  const maxBandVolumeView = bandDataView.reduce((max, point) => Math.max(max, point.p75), 0);
  const maxBandVolumeFull = bandData.reduce((max, point) => Math.max(max, point.p75), 0);
  const maxYesterdayVolumeView = yesterdayLinePoints.reduce(
    (max, point) => Math.max(max, point.cumulativeVolume),
    0
  );
  const maxVolume = Math.max(100, maxBandVolumeView, volumeAtViewEnd, maxYesterdayVolumeView);
  const maxVolumeFull = Math.max(100, maxBandVolumeFull, totalVolumeFull);
  const showCurrentTimeIndicator = nowMinutes >= viewStart && nowMinutes <= viewEnd;
  const showCurrentTimeOverview = nowMinutes >= startMinutes && nowMinutes <= endMinutes;

  const xTickValues = useMemo(() => {
    const ticks: number[] = [];
    const firstTick = Math.ceil(viewStart / 60) * 60;
    const step = 90;

    for (let tick = firstTick; tick <= viewEnd; tick += step) {
      ticks.push(tick);
    }

    if (ticks.length === 0) {
      ticks.push(viewStart, viewEnd);
    }

    return ticks;
  }, [viewStart, viewEnd]);

  const handleStepInteraction = (point: StepPoint, left: number, top: number) => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }

    showTooltip({
      tooltipData: {
        datetime: point.datetime,
        volume: point.volume,
        cumulativeVolume: point.cumulativeVolume,
      },
      tooltipLeft: left,
      tooltipTop: top,
    });
  };

  const handleStepLeave = () => {
    tooltipTimeout.current = window.setTimeout(() => {
      hideTooltip();
    }, 250);
  };

  const handleBrushChange = (bounds: Bounds | null) => {
    if (!bounds) {
      return;
    }

    const nextRange = normalizeViewRange(
      bounds.x0,
      bounds.x1,
      viewBounds,
      MIN_VIEW_WINDOW_MINUTES
    );

    if (nextRange.start === viewStart && nextRange.end === viewEnd) {
      return;
    }

    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }
    hideTooltip();
    setHasCustomView(true);
    setViewRange(nextRange);
  };

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
      if (tooltipTimeout.current) {
        clearTimeout(tooltipTimeout.current);
      }
      hideTooltip();
    };

    document.addEventListener("mousedown", handleOutsidePress, true);
    document.addEventListener("touchstart", handleOutsidePress, true);

    return () => {
      document.removeEventListener("mousedown", handleOutsidePress, true);
      document.removeEventListener("touchstart", handleOutsidePress, true);
    };
  }, [tooltipOpen, hideTooltip]);

  useEffect(() => {
    if (!showHint) {
      return;
    }

    const handleOutsidePress = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (hintRef.current?.contains(target) || hintButtonRef.current?.contains(target)) {
        return;
      }
      setShowHint(false);
    };

    document.addEventListener("mousedown", handleOutsidePress, true);
    document.addEventListener("touchstart", handleOutsidePress, true);

    return () => {
      document.removeEventListener("mousedown", handleOutsidePress, true);
      document.removeEventListener("touchstart", handleOutsidePress, true);
    };
  }, [showHint]);

  const totalHeight = height + OVERVIEW_HEIGHT + OVERVIEW_GAP;

  return (
    <div className="relative" style={{ height: totalHeight }}>

      <ParentSize>
        {({ width }) => {
          const innerWidth = Math.max(0, width - STEP_MARGIN.left - STEP_MARGIN.right);
          const innerHeight = height - STEP_MARGIN.top - STEP_MARGIN.bottom;
          const overviewInnerWidth = Math.max(
            0,
            width - OVERVIEW_MARGIN.left - OVERVIEW_MARGIN.right
          );
          const overviewInnerHeight = OVERVIEW_HEIGHT - OVERVIEW_MARGIN.top - OVERVIEW_MARGIN.bottom;
          const showOverview = overviewInnerWidth > 0 && overviewInnerHeight > 0;

          if (innerWidth <= 0 || innerHeight <= 0) {
            return null;
          }

          const xScale = scaleLinear({
            domain: [viewStart, viewEnd],
            range: [0, innerWidth],
          });

          const yScale = scaleLinear({
            domain: [0, maxVolume],
            range: [innerHeight, 0],
            nice: true,
          });

          const xScaleFull = scaleLinear({
            domain: [startMinutes, endMinutes],
            range: [0, overviewInnerWidth],
          });

          const yScaleFull = scaleLinear({
            domain: [0, maxVolumeFull],
            range: [overviewInnerHeight, 0],
            nice: true,
          });

          const brushInitialPosition = {
            start: { x: xScaleFull(viewStart), y: 0 },
            end: { x: xScaleFull(viewEnd), y: overviewInnerHeight },
          };

          return (
            <>
              <svg width={width} height={height} ref={containerRef}>
                <Group left={STEP_MARGIN.left} top={STEP_MARGIN.top}>

                  {showCurrentTimeIndicator && (
                    <Line
                      from={{ x: xScale(nowMinutes), y: 0 }}
                      to={{ x: xScale(nowMinutes), y: innerHeight }}
                      stroke={CURRENT_TIME_STROKE}
                      strokeWidth={1.5}
                      strokeDasharray="4,2"
                    />
                  )}

                  {yScale.ticks(4).map((tick) => {
                    const y = yScale(tick);
                    return (
                      <Line
                        key={`step-grid-${tick}`}
                        from={{ x: 0, y }}
                        to={{ x: innerWidth, y }}
                        stroke="#e2e8f0"
                        strokeWidth={1}
                        strokeDasharray="2,2"
                      />
                    );
                  })}

                  {bandDataView.length > 0 && (
                    <AreaClosed
                      data={bandDataView}
                      x={(d) => xScale(d.minute)}
                      y0={(d) => yScale(d.p25)}
                      y1={(d) => yScale(d.p75)}
                      yScale={yScale}
                      curve={BAND_CURVE}
                      fill={BAND_FILL}
                      fillOpacity={0.35}
                      stroke="none"
                    />
                  )}

                  {/* {bandDataView.length > 0 && (
                    <LinePath
                      data={bandDataView}
                      x={(d) => xScale(d.minute)}
                      y={(d) => yScale(d.p50)}
                      curve={curveStepAfter}
                      stroke={BAND_STROKE}
                      strokeWidth={1.5}
                      strokeDasharray="4,2"
                    />
                  )} */}

                  {yesterdayLinePoints.length > 0 && (
                    <LinePath
                      data={yesterdayLinePoints}
                      x={(d) => xScale(d.timeMinutes)}
                      y={(d) => yScale(d.cumulativeVolume)}
                      curve={curveStepAfter}
                      stroke={YESTERDAY_STROKE}
                      strokeWidth={2}
                      strokeOpacity={0.6}
                    />
                  )}

                  <LinePath
                    data={linePoints}
                    x={(d) => xScale(d.timeMinutes)}
                    y={(d) => yScale(d.cumulativeVolume)}
                    curve={curveStepAfter}
                    stroke={TODAY_STROKE}
                    strokeWidth={3}
                  />

                  {stepPoints.map((point) => {
                    const cx = xScale(point.timeMinutes);
                    const cy = yScale(point.cumulativeVolume);
                    return (
                      <Circle
                        key={`step-point-${point.datetime.unix()}`}
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill={TODAY_STROKE}
                        stroke="#fff"
                        strokeWidth={1}
                        data-tooltip-anchor="eat-step"
                        onMouseMove={() =>
                          handleStepInteraction(
                            point,
                            cx + STEP_MARGIN.left,
                            cy + STEP_MARGIN.top - 60
                          )
                        }
                        onMouseLeave={handleStepLeave}
                        onTouchStart={() =>
                          handleStepInteraction(
                            point,
                            cx + STEP_MARGIN.left,
                            cy + STEP_MARGIN.top - 60
                          )
                        }
                        onTouchEnd={handleStepLeave}
                        style={{ cursor: "pointer" }}
                      />
                    );
                  })}

                  {stepSegments.map((point) => {
                    const x = xScale(point.timeMinutes);
                    const y =
                      (yScale(point.prevCumulativeVolume) + yScale(point.cumulativeVolume)) / 2;
                    const label = `${point.volume}`;
                    const radius = Math.min(18, 8 + label.length * 2);
                    const shouldPlaceLeft = x > innerWidth - radius - 6;
                    const labelX = shouldPlaceLeft ? x - radius - 6 : x + radius + 6;

                    return (
                      <g key={`step-label-${point.datetime.unix()}`} pointerEvents="none">
                        <circle
                          cx={labelX}
                          cy={y}
                          r={radius}
                          fill={TODAY_STROKE}
                          stroke="#b45309"
                          strokeWidth={1}
                        />
                        <text
                          x={labelX}
                          y={y}
                          fill="#fff"
                          fontSize={10}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}


                  <AxisRight
                    left={innerWidth}
                    scale={yScale}
                    numTicks={4}
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

                  <AxisBottom
                    top={innerHeight}
                    scale={xScale}
                    tickValues={xTickValues}
                    tickFormat={(d) =>
                      now.startOf("day").add(Number(d), "minute").format("HH:mm")
                    }
                    stroke="#cbd5e1"
                    tickStroke="#cbd5e1"
                    tickLabelProps={() => ({
                      fill: "#64748b",
                      fontSize: 10,
                      textAnchor: "middle",
                      dy: 4,
                    })}
                  />
                </Group>
              </svg>

              {showOverview && (
                <div style={{ marginTop: OVERVIEW_GAP }}>
                  <svg width={width} height={OVERVIEW_HEIGHT}>
                    <Group left={OVERVIEW_MARGIN.left} top={OVERVIEW_MARGIN.top}>
                      {bandData.length > 0 && (
                        <AreaClosed
                          data={bandData}
                          x={(d) => xScaleFull(d.minute)}
                          y0={(d) => yScaleFull(d.p25)}
                          y1={(d) => yScaleFull(d.p75)}
                          yScale={yScaleFull}
                          curve={BAND_CURVE}
                          fill={BAND_FILL}
                          fillOpacity={0.2}
                          stroke="none"
                        />
                      )}

                      {/* {bandData.length > 0 && (
                        <LinePath
                          data={bandData}
                          x={(d) => xScaleFull(d.minute)}
                          y={(d) => yScaleFull(d.p50)}
                          curve={curveStepAfter}
                          stroke={BAND_STROKE}
                          strokeWidth={1}
                          strokeDasharray="4,2"
                        />
                      )} */}

                      <LinePath
                        data={fullLinePoints}
                        x={(d) => xScaleFull(d.timeMinutes)}
                        y={(d) => yScaleFull(d.cumulativeVolume)}
                        curve={curveStepAfter}
                        stroke={TODAY_STROKE}
                        strokeWidth={2}
                      />

                      {showCurrentTimeOverview && (
                        <Line
                          from={{ x: xScaleFull(nowMinutes), y: 0 }}
                          to={{ x: xScaleFull(nowMinutes), y: overviewInnerHeight }}
                          stroke={CURRENT_TIME_STROKE}
                          strokeWidth={1}
                          strokeDasharray="4,2"
                        />
                      )}

                      <Brush
                        key={brushKey}
                        xScale={xScaleFull}
                        yScale={yScaleFull}
                        width={overviewInnerWidth}
                        height={overviewInnerHeight}
                        brushDirection="horizontal"
                        disableDraggingSelection={false}
                        initialBrushPosition={brushInitialPosition}
                        disableDraggingOverlay={true}
                        handleSize={8}
                        selectedBoxStyle={{
                          fill: "#0ea5e9",
                          fillOpacity: 0.15,
                          stroke: "#0ea5e9",
                          strokeWidth: 1,
                          strokeOpacity: 0.8,
                        }}
                        onBrushStart={() => {
                          if (tooltipTimeout.current) {
                            clearTimeout(tooltipTimeout.current);
                          }
                          hideTooltip();
                        }}
                        onChange={handleBrushChange}
                        renderBrushHandle={(props) => <BrushHandle {...props} />}
                      />
                    </Group>
                  </svg>
                </div>
              )}
            </>
          );
        }}
      </ParentSize>
      <div className="absolute right-2 bottom-2 z-20">
        <button
          ref={hintButtonRef}
          type="button"
          aria-label="Chart explanation"
          onClick={() => setShowHint((prev) => !prev)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border-0 border-gray-200 bg-white/80 text-gray-500 shadow-sm hover:text-gray-700 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-300"
        >
          <Info className="h-4 w-4" />
        </button>
        {showHint && (
          <div
            ref={hintRef}
            className="absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 bg-white/95 p-2 text-xs text-gray-700 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-200"
          >
            <div className="flex items-center gap-2">
              <span className={"h-2.5 w-2.5 rounded-full opacity-35"} style={{ backgroundColor: BAND_FILL }} />
              <span>last 7d avg</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full opacity-60" style={{ backgroundColor: YESTERDAY_STROKE }} />
              <span>yesterday</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full opacity-90" style={{ backgroundColor: TODAY_STROKE }} />
              <span>today</span>
            </div>
          </div>
        )}
      </div>

      {tooltipOpen && tooltipData && (
        <TooltipInPortal
          top={tooltipTop}
          left={tooltipLeft}
          style={{ ...defaultStyles, backgroundColor: "" }}
          className="z-1000 bg-gray-200 dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700"
        >
          <div ref={tooltipRef} className="text-sm space-y-1">
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              {tooltipData.datetime.format("HH:mm")} · +{tooltipData.volume} ml
            </div>
            <div className="text-gray-700 dark:text-gray-300">
              Total: {tooltipData.cumulativeVolume} ml
            </div>
            <div className="text-gray-600 dark:text-gray-400 text-xs">
              {tooltipData.datetime.format("MMM D, YYYY")}
            </div>
          </div>
        </TooltipInPortal>
      )}
    </div>
  );
}

function BrushHandle({ x, height, isBrushActive }: BrushHandleRenderProps) {
  const pathWidth = 8;
  const pathHeight = 15;
  if (!isBrushActive) {
    return null;
  }
  return (
    <Group left={x + pathWidth / 2} top={(height - pathHeight) / 2}>
      <path
        fill="#f2f2f2"
        d="M -4.5 0.5 L 3.5 0.5 L 3.5 15.5 L -4.5 15.5 L -4.5 0.5 M -1.5 4 L -1.5 12 M 0.5 4 L 0.5 12"
        stroke="#999999"
        strokeWidth="1"
        style={{ cursor: "ew-resize" }}
      />
    </Group>
  );
}
