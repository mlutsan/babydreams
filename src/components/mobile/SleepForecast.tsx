import React, { useEffect, useMemo, useRef, useState } from "react";
import { Block } from "konsta/react";

/**
 * Awake/Sleep timeline card (mobile-first)
 * - Awake mode: "Active | Wind-down | Put down | Sleep" step bar (non-proportional-safe via min widths)
 * - Late: overlays "Late by" + pushes "now" beyond deadline
 * - Sleeping mode: full-width expected sleep range bar with now marker
 *
 * Tailwind only. You can wrap with Konsta Card/Block/etc as you prefer.
 */

export type Mood = "active" | "sleepSoon" | "overrun";
export type SleepState = "sleeping" | "wakingSoon" | "overdue";

export type ExpectedSleep = {
  medianMin: number; // e.g. 45
  minMin: number; // e.g. 30
  maxMin: number; // e.g. 65
};

export type AwakeModel = {
  mode: "awake";
  mood: Mood;

  /** earliest time to start settling (wind-down start) */
  earliest: Date;
  /** recommended put-down time */
  target: Date;
  /** latest acceptable put-down time (deadline) */
  latest: Date;

  expectedSleep: ExpectedSleep;
};

export type SleepingModel = {
  mode: "sleeping";
  state: SleepState;

  /** actual sleep start */
  sleepStart: Date;

  /** expected duration window (minutes) */
  expectedSleep: ExpectedSleep;
};

export type Props = {
  model: AwakeModel | SleepingModel;

  /** optional: pass a stable "now" for testing; otherwise uses live clock */
  nowOverride?: Date;

  /** update cadence for bar geometry (seconds). Text countdown updates every minute. */
  geometryRefreshSeconds?: number;

  /** optional header label */
  title?: string;

  /** optional: show the secondary line "Next nap: HH:MM (HH:MM—HH:MM)" in awake mode */
  showWindowLine?: boolean;

  /** Tailwind className passthrough */
  className?: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatClock(d: Date): string {
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${hh}:${mm}`;
}

function formatDurationMinToHMM(mins: number): string {
  const sign = mins < 0 ? "-" : "";
  const abs = Math.abs(mins);
  const total = Math.round(abs);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${sign}${pad2(h)}:${pad2(m)}`;
}

function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60000;
}

/** ResizeObserver hook (no external deps) */
function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setWidth(entry.contentRect.width);
      }
    });

    ro.observe(el);

    return () => {
      ro.disconnect();
    };
  }, []);

  return [ref, width];
}

function moodBadge(mood: Mood): { label: string; classes: string; } {
  if (mood === "active") {
    return {
      label: "Active",
      classes:
        "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800",
    };
  }
  if (mood === "sleepSoon") {
    return {
      label: "Sleep soon",
      classes:
        "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800",
    };
  }
  return {
    label: "Overrun",
    classes:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800",
  };
}

function sleepBadge(state: SleepState): { label: string; classes: string; } {
  if (state === "sleeping") {
    return {
      label: "Sleeping",
      classes:
        "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800",
    };
  }
  if (state === "wakingSoon") {
    return {
      label: "Waking soon",
      classes:
        "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800",
    };
  }
  return {
    label: "Overdue",
    classes:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800",
  };
}

type AwakeBarGeometry = {
  // segment widths in px (sum = trackWidth)
  activePx: number;
  windDownPx: number;
  putDownPx: number;
  sleepTailPx: number;

  // boundary x positions in px from left (for placing time labels)
  xEarliest: number;
  xTarget: number;
  xLatest: number;

  // late handling
  isLate: boolean;
  lateByMin: number; // > 0 if late
  lateInMin: number; // > 0 if not late
};

function computeAwakeGeometry(args: {
  trackWidth: number;
  now: Date;
  earliest: Date;
  target: Date;
  latest: Date;
}): AwakeBarGeometry {
  const { trackWidth, now, earliest, target, latest } = args;

  const tailPx = clamp(Math.round(trackWidth * 0.18), 52, 120);
  const usable = Math.max(0, trackWidth - tailPx);

  const isLate = now.getTime() > latest.getTime();

  const lateByMin = isLate ? Math.max(0, minutesBetween(latest, now)) : 0;
  const lateInMin = !isLate ? Math.max(0, minutesBetween(now, latest)) : 0;

  // Durations are forward-looking from NOW, not from wake start:
  const dActive = clamp(minutesBetween(now, earliest), 0, 10_000);
  const dWind = clamp(minutesBetween(earliest, target), 0, 10_000);
  const dPut = clamp(minutesBetween(target, latest), 0, 10_000);

  // If late: collapse into "Late" + tail; keep minimum readability.
  if (isLate) {
    const minPut = 72;
    const putDownPx = clamp(usable, minPut, usable);
    const activePx = 0;
    const windDownPx = 0;

    const xEarliest = 0;
    const xTarget = 0;
    const xLatest = putDownPx;

    return {
      activePx,
      windDownPx,
      putDownPx,
      sleepTailPx: trackWidth - putDownPx,
      xEarliest,
      xTarget,
      xLatest,
      isLate,
      lateByMin,
      lateInMin: 0,
    };
  }

  // Raw proportional widths:
  const total = Math.max(1e-6, dActive + dWind + dPut);
  let activePx = Math.round((dActive / total) * usable);
  let windDownPx = Math.round((dWind / total) * usable);
  let putDownPx = Math.round((dPut / total) * usable);

  // Enforce minimum widths for small windows (solves 2h OK vs 8m warn)
  const minWind = 64;
  const minPut = 72;

  // First, ensure windDown and putDown minimums by stealing from active.
  const needWind = Math.max(0, minWind - windDownPx);
  const needPut = Math.max(0, minPut - putDownPx);

  const steal = needWind + needPut;
  if (steal > 0) {
    const canSteal = Math.max(0, activePx - 12); // leave a sliver if possible
    const take = Math.min(canSteal, steal);

    activePx -= take;

    // Allocate to wind/put in order of need
    const takeWind = Math.min(needWind, take);
    windDownPx += takeWind;

    const remaining = take - takeWind;
    putDownPx += Math.min(needPut, remaining);
  }

  // Normalize sum to usable (avoid rounding drift)
  let sum = activePx + windDownPx + putDownPx;
  if (sum !== usable) {
    const diff = usable - sum;
    // Prefer adjusting active, then wind-down
    if (activePx + diff >= 0) {
      activePx += diff;
    } else if (windDownPx + diff >= 0) {
      windDownPx += diff;
    } else {
      putDownPx += diff;
    }
    sum = activePx + windDownPx + putDownPx;
  }

  const sleepTailPx = trackWidth - sum;

  const xEarliest = activePx;
  const xTarget = activePx + windDownPx;
  const xLatest = activePx + windDownPx + putDownPx;

  return {
    activePx,
    windDownPx,
    putDownPx,
    sleepTailPx,
    xEarliest,
    xTarget,
    xLatest,
    isLate: false,
    lateByMin: 0,
    lateInMin,
  };
}

type SleepBarGeometry = {
  trackWidth: number;
  xMinEnd: number;
  xExpectedEnd: number;
  xMaxEnd: number;
  xNow: number;
  isOverdue: boolean;
  overdueByMin: number;
};

function computeSleepGeometry(args: {
  trackWidth: number;
  now: Date;
  sleepStart: Date;
  minEnd: Date;
  expectedEnd: Date;
  maxEnd: Date;
}): SleepBarGeometry {
  const { trackWidth, now, sleepStart, minEnd, expectedEnd, maxEnd } = args;

  const startMs = sleepStart.getTime();
  const maxMs = Math.max(maxEnd.getTime(), startMs + 60_000);
  const span = maxMs - startMs;

  const pos = (t: Date): number => {
    const x = ((t.getTime() - startMs) / span) * trackWidth;
    return clamp(x, 0, trackWidth);
  };

  const xMinEnd = pos(minEnd);
  const xExpectedEnd = pos(expectedEnd);
  const xMaxEnd = pos(maxEnd);
  const xNow = pos(now);

  const isOverdue = now.getTime() > maxEnd.getTime();
  const overdueByMin = isOverdue ? Math.max(0, minutesBetween(maxEnd, now)) : 0;

  return { trackWidth, xMinEnd, xExpectedEnd, xMaxEnd, xNow, isOverdue, overdueByMin };
}

type AwakeForecastViewProps = {
  model: AwakeModel;
  nowText: Date;
  nowGeom: Date;
  showWindowLine: boolean;
};

function AwakeForecastView({ model, nowText, nowGeom, showWindowLine }: AwakeForecastViewProps) {
  const [trackRef, trackWidth] = useElementWidth<HTMLDivElement>();
  const isLateNow = nowText.getTime() > model.latest.getTime();

  const minToTarget = Math.max(0, Math.ceil(minutesBetween(nowText, model.target)));
  const minToLatest = Math.max(0, Math.ceil(minutesBetween(nowText, model.latest)));
  const lateByMin = Math.max(0, Math.ceil(minutesBetween(model.latest, nowText)));

  const headline = isLateNow
    ? `Late by ${formatDurationMinToHMM(lateByMin)}`
    : `Nap in ${formatDurationMinToHMM(minToTarget)}`;

  const windowLine =
    showWindowLine === true
      ? `Next nap: ${formatClock(model.target)} (${formatClock(model.earliest)} — ${formatClock(model.latest)})`
      : "";

  const expectedLine = `Expected sleep: ${formatDurationMinToHMM(model.expectedSleep.medianMin)} (${formatDurationMinToHMM(
    model.expectedSleep.minMin
  )} — ${formatDurationMinToHMM(model.expectedSleep.maxMin)})`;

  const subAction = isLateNow
    ? `Put down now (overdue by ${formatDurationMinToHMM(lateByMin)})`
    : `Put down by ${formatClock(model.latest)} (late in ${formatDurationMinToHMM(minToLatest)})`;

  const geom = useMemo(() => {
    return computeAwakeGeometry({
      trackWidth: Math.max(0, trackWidth),
      now: nowGeom,
      earliest: model.earliest,
      target: model.target,
      latest: model.latest,
    });
  }, [trackWidth, nowGeom, model.earliest, model.target, model.latest]);

  return (
    <>
      <div className="mt-4 text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">{headline}</div>

      {windowLine ? <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">{windowLine}</div> : null}

      <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">{subAction}</div>

      {/* Step labels */}
      <div className="mt-5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex gap-3">
          <span className="text-gray-700 dark:text-gray-200">Active</span>
          <span>|</span>
          <span className="text-gray-700 dark:text-gray-200">Wind-down</span>
          <span>|</span>
          <span className="text-gray-700 dark:text-gray-200">Put down</span>
          <span>|</span>
          <span className="text-gray-700 dark:text-gray-200">Sleep</span>
        </div>

        {!geom.isLate ? (
          <div className="text-gray-500 dark:text-gray-400">
            {/* Late in <span className="text-gray-700 dark:text-gray-200">{formatDurationMinToHMM(geom.lateInMin)}</span> */}
          </div>
        ) : (
          <div className="text-red-600 dark:text-red-300">
            {/* Late by <span className="text-red-700 dark:text-red-200">{formatDurationMinToHMM(geom.lateByMin)}</span> */}
          </div>
        )}
      </div>

      {/* Bar */}
      <div className="mt-2">
        <div
          ref={trackRef}
          className={[
            "relative h-4 w-full overflow-hidden rounded-none",
            "bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
          ].join(" ")}
        >
          {/* Segments */}
          <div className="absolute inset-0 flex">
            {/* Active */}
            {geom.activePx > 0 ? (
              <div
                style={{ width: geom.activePx }}
                className={["h-full", geom.isLate ? "bg-red-500/30" : "bg-emerald-500/35"].join(" ")}
              />
            ) : null}

            {/* Wind-down */}
            {geom.windDownPx > 0 ? (
              <div
                style={{ width: geom.windDownPx }}
                className={["h-full", geom.isLate ? "bg-red-500/30" : "bg-emerald-500/20"].join(" ")}
              />
            ) : null}

            {/* Put down */}
            {geom.putDownPx > 0 ? (
              <div
                style={{ width: geom.putDownPx }}
                className={["h-full", geom.isLate ? "bg-red-500/45" : "bg-amber-500/35"].join(" ")}
              />
            ) : null}

            {/* Sleep tail (fade) */}
            {geom.sleepTailPx > 0 ? (
              <div
                style={{ width: geom.sleepTailPx }}
                className={[
                  "h-full",
                  geom.isLate
                    ? "bg-gradient-to-r from-red-500/45 to-red-500/10"
                    : "bg-gradient-to-r from-gray-400/30 to-transparent",
                ].join(" ")}
              />
            ) : null}
          </div>

          {/* Boundary markers */}
          {!geom.isLate ? (
            <>
              <div
                className="absolute top-0 h-full w-[2px] bg-gray-500/50 dark:bg-white/35"
                style={{ left: geom.xEarliest }}
                aria-hidden="true"
              />
              <div
                className="absolute top-0 h-full w-[2px] bg-gray-600/70 dark:bg-white/55"
                style={{ left: geom.xTarget }}
                aria-hidden="true"
              />
              <div
                className="absolute top-0 h-full w-[2px] bg-gray-700/80 dark:bg-white/65"
                style={{ left: geom.xLatest }}
                aria-hidden="true"
              />
            </>
          ) : (
            <div
              className="absolute top-0 h-full w-[2px] bg-gray-700/80 dark:bg-white/70"
              style={{ left: geom.xLatest }}
              aria-hidden="true"
            />
          )}

          {/* Now marker: a small caret at left; if late, show it pushed beyond deadline */}
          {!geom.isLate ? (
            <div className="absolute -top-2 left-0">
              <div className="h-0 w-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-gray-700 dark:border-b-white/80" />
            </div>
          ) : (
            <div className="absolute -top-2" style={{ left: Math.min(trackWidth + 6, trackWidth + 6) }}>
              <div className="h-0 w-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-red-500/90" />
            </div>
          )}
        </div>

        {/* Times under bar (aligned to boundaries) */}
        <div className="relative mt-2 h-6 text-xs text-gray-500 dark:text-gray-400">
          {!geom.isLate ? (
            <>
              <div className="absolute left-0 -translate-x-0">{formatClock(model.earliest)}</div>

              <div className="absolute" style={{ left: geom.xTarget }}>
                <div className="-translate-x-1/2 text-gray-700 dark:text-gray-200">{formatClock(model.target)}</div>
              </div>

              <div className="absolute" style={{ left: geom.xLatest }}>
                <div className="-translate-x-1/2 text-gray-700 dark:text-gray-200">{formatClock(model.latest)}</div>
              </div>
            </>
          ) : (
            <>
              <div className="absolute left-0 text-red-600 dark:text-red-300">Deadline {formatClock(model.latest)}</div>
              <div className="absolute right-0 text-red-600 dark:text-red-300">+{formatDurationMinToHMM(geom.lateByMin)}</div>
            </>
          )}
        </div>

        {/* Expected sleep compact line (awake mode) */}
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">{expectedLine}</div>

        {/* Tiny expected sleep range bar (optional but works well) */}
        <ExpectedSleepMiniBar expected={model.expectedSleep} />
      </div>
    </>
  );
}

type SleepingForecastViewProps = {
  model: SleepingModel;
  nowText: Date;
  nowGeom: Date;
};

function SleepingForecastView({ model, nowText, nowGeom }: SleepingForecastViewProps) {
  const [trackRef, trackWidth] = useElementWidth<HTMLDivElement>();

  const minEnd = useMemo(() => {
    return new Date(model.sleepStart.getTime() + model.expectedSleep.minMin * 60_000);
  }, [model.sleepStart, model.expectedSleep.minMin]);

  const expectedEnd = useMemo(() => {
    return new Date(model.sleepStart.getTime() + model.expectedSleep.medianMin * 60_000);
  }, [model.sleepStart, model.expectedSleep.medianMin]);

  const maxEnd = useMemo(() => {
    return new Date(model.sleepStart.getTime() + model.expectedSleep.maxMin * 60_000);
  }, [model.sleepStart, model.expectedSleep.maxMin]);

  const isOverdueNow = nowText.getTime() > maxEnd.getTime();
  const minToExpectedEnd = Math.max(0, Math.ceil(minutesBetween(nowText, expectedEnd)));
  const overdueByMin = Math.max(0, Math.ceil(minutesBetween(maxEnd, nowText)));

  const headline = isOverdueNow
    ? `Overdue by ${formatDurationMinToHMM(overdueByMin)}`
    : `Wake in ~${formatDurationMinToHMM(minToExpectedEnd)}`;

  const expectedLine = `Expected: ${formatDurationMinToHMM(model.expectedSleep.medianMin)} (${formatDurationMinToHMM(
    model.expectedSleep.minMin
  )} — ${formatDurationMinToHMM(model.expectedSleep.maxMin)})`;

  const geom = useMemo(() => {
    return computeSleepGeometry({
      trackWidth: Math.max(0, trackWidth),
      now: nowGeom,
      sleepStart: model.sleepStart,
      minEnd,
      expectedEnd,
      maxEnd,
    });
  }, [trackWidth, nowGeom, model.sleepStart, minEnd, expectedEnd, maxEnd]);

  const elapsedMin = Math.max(0, minutesBetween(model.sleepStart, nowText));
  const remainingToExpectedMin = Math.max(0, minutesBetween(nowText, expectedEnd));

  return (
    <>
      <div className="mt-4 text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">{headline}</div>

      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Started: <span className="text-gray-700 dark:text-gray-200">{formatClock(model.sleepStart)}</span> · Elapsed:{" "}
        <span className="text-gray-700 dark:text-gray-200">{formatDurationMinToHMM(elapsedMin)}</span> · ~Remaining:{" "}
        <span className="text-gray-700 dark:text-gray-200">{formatDurationMinToHMM(remainingToExpectedMin)}</span>
      </div>

      <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">{expectedLine}</div>

      {/* Sleep range bar */}
      <div className="mt-5">
        <div
          ref={trackRef}
          className={[
            "relative h-4 w-full overflow-hidden rounded-full",
            "bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
          ].join(" ")}
        >
          {/* Range band from min to max */}
          <div
            className={[
              "absolute top-0 h-full",
              geom.isOverdue ? "bg-red-500/25" : "bg-emerald-500/18",
            ].join(" ")}
            style={{ left: geom.xMinEnd, width: Math.max(2, geom.xMaxEnd - geom.xMinEnd) }}
          />

          {/* Expected marker */}
          <div
            className="absolute top-0 h-full w-[2px] bg-gray-700/80 dark:bg-white/80"
            style={{ left: geom.xExpectedEnd }}
            aria-hidden="true"
          />

          {/* Now marker */}
          <div
            className={[
              "absolute -top-2",
              geom.isOverdue ? "text-red-500" : "text-gray-700 dark:text-white/90",
            ].join(" ")}
            style={{ left: geom.xNow }}
          >
            <div className="h-0 w-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-current" />
          </div>
        </div>

        {/* Times row */}
        <div className="relative mt-2 h-6 text-xs text-gray-500 dark:text-gray-400">
          <div className="absolute left-0 text-gray-500 dark:text-gray-400">Start {formatClock(model.sleepStart)}</div>

          <div className="absolute" style={{ left: geom.xMinEnd }}>
            <div className="-translate-x-1/2">{formatClock(minEnd)}</div>
          </div>

          <div className="absolute" style={{ left: geom.xExpectedEnd }}>
            <div className="-translate-x-1/2 text-gray-700 dark:text-gray-200">{formatClock(expectedEnd)}</div>
          </div>

          <div className="absolute" style={{ left: geom.xMaxEnd }}>
            <div className="-translate-x-1/2">{formatClock(maxEnd)}</div>
          </div>
        </div>
      </div>
    </>
  );
}

export function SleepForecastCard({
  model,
  nowOverride,
  geometryRefreshSeconds = 60,
  title = "Awake Window",
  showWindowLine = true,
  className = "",
}: Props) {
  // Live clock for countdown text (updates every minute)
  const [nowText, setNowText] = useState<Date>(() => nowOverride ?? new Date());

  // Separate "geometry now" (updates slower to avoid jittery bar widths)
  const [nowGeom, setNowGeom] = useState<Date>(() => nowOverride ?? new Date());

  useEffect(() => {
    if (nowOverride) {
      setNowText(nowOverride);
      setNowGeom(nowOverride);
      return;
    }

    const textRefreshMs = 60_000;
    const geomRefreshMs = Math.max(60, geometryRefreshSeconds) * 1000;

    const t1 = window.setInterval(() => {
      setNowText(new Date());
    }, textRefreshMs);

    const t2 = window.setInterval(() => {
      setNowGeom(new Date());
    }, geomRefreshMs);

    return () => {
      window.clearInterval(t1);
      window.clearInterval(t2);
    };
  }, [nowOverride, geometryRefreshSeconds]);

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="text-gray-900 dark:text-gray-100 text-base font-semibold tracking-tight">{title}</div>

      {model.mode === "awake" ? (
        <span
          className={[
            "inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-semibold",
            moodBadge(model.mood).classes,
          ].join(" ")}
        >
          <span>{moodBadge(model.mood).label}</span>
        </span>
      ) : (
        <span
          className={[
            "inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-semibold",
            sleepBadge(model.state).classes,
          ].join(" ")}
        >
          <span className="text-sm leading-none">●</span>
          <span>{sleepBadge(model.state).label}</span>
        </span>
      )}
    </div>
  );

  return (
    <Block strong inset className={["space-y-3", className].join(" ")}>
      {header}
      {model.mode === "awake" ? (
        <AwakeForecastView model={model} nowText={nowText} nowGeom={nowGeom} showWindowLine={showWindowLine} />
      ) : (
        <SleepingForecastView model={model} nowText={nowText} nowGeom={nowGeom} />
      )}
    </Block>
  );
}

/** Small, optional expected sleep range bar for Awake mode (kept simple and readable on mobile) */
function ExpectedSleepMiniBar({ expected }: { expected: ExpectedSleep; }) {
  // mini bar is conceptual: show min..max with dot at median
  const min = expected.minMin;
  const max = Math.max(expected.maxMin, min + 1);
  const median = clamp(expected.medianMin, min, max);

  const pct = (v: number) => {
    return ((v - min) / (max - min)) * 100;
  };

  const medianPct = pct(median);

  return (
    <div className="mt-2">
      <div className="relative h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-400/30 to-transparent" />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-amber-400 border border-white/30"
          style={{ left: `calc(${medianPct}% - 6px)` }}
          aria-hidden="true"
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{formatDurationMinToHMM(min)}</span>
        <span className="text-gray-700 dark:text-gray-200">{formatDurationMinToHMM(median)}</span>
        <span>{formatDurationMinToHMM(max)}</span>
      </div>
    </div>
  );
}
