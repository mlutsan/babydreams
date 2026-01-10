/**
 * Pure forecast model for day sleep windows.
 */

import dayjs, { Dayjs } from "dayjs";
import { computeDailyStats } from "~/lib/sleep-model";
import { calculateSleepDuration, resolveActiveSleepEnd } from "~/lib/sleep-utils";
import type { SleepEntry, DailyStat } from "~/types/sleep";

export type SleepForecastZone = "green" | "yellow" | "red" | "unknown";

export type SleepForecast = {
  windowDays: number;
  napIndex: number | null;
  currentAwakeMinutes: number | null;
  zone: SleepForecastZone;
  thresholds: {
    greenMax: number | null;
    yellowMax: number | null;
  };
  predictedSleepStart: Dayjs | null;
  predictedSleepStartRange: {
    earliest: Dayjs | null;
    latest: Dayjs | null;
  };
  predictedSleepDurationMinutes: number | null;
  predictedSleepDurationRange: {
    shortest: number | null;
    longest: number | null;
  };
  samples: {
    awakeWindows: number;
    sleepDurations: number;
  };
};

export type SleepForecastOptions = {
  now?: Dayjs;
  windowDays?: number;
  minSamples?: number;
};

const NOISE_RATIO_THRESHOLD = 0.35;
const MAX_AWAKE_MINUTES_CAP = 12 * 60;

type EntryEndInfo = {
  endDatetime: Dayjs;
  durationMinutes: number;
  isActive: boolean;
};

type AwakeSleepPair = {
  awakeMinutes: number;
  sleepMinutes: number;
};

function getEntryEndInfo(entry: SleepEntry, now: Dayjs): EntryEndInfo {
  if (entry.endTime === null) {
    const resolved = resolveActiveSleepEnd({
      startDatetime: entry.realDatetime,
      now,
    });
    return {
      endDatetime: resolved.endDatetime,
      durationMinutes: resolved.durationMinutes,
      isActive: resolved.isActive,
    };
  }

  let endDatetime = entry.realDatetime.startOf("day").add(entry.endTime);
  const startMinutes = Math.floor(entry.startTime.asMinutes());
  const endMinutes = Math.floor(entry.endTime.asMinutes());
  if (endMinutes < startMinutes) {
    endDatetime = endDatetime.add(1, "day");
  }

  return {
    endDatetime,
    durationMinutes: calculateSleepDuration(entry.startTime, entry.endTime),
    isActive: false,
  };
}

function quantile(values: number[], q: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  if (next === undefined) {
    return sorted[base];
  }
  return sorted[base] + rest * (next - sorted[base]);
}

function median(values: number[]): number | null {
  return quantile(values, 0.5);
}

function medianAbsoluteDeviation(values: number[]): number | null {
  const med = median(values);
  if (med === null) {
    return null;
  }
  const deviations = values.map((value) => Math.abs(value - med));
  return median(deviations);
}

function isNoisy(values: number[]): boolean {
  if (values.length < 2) {
    return true;
  }
  const med = median(values);
  if (!med || med <= 0) {
    return true;
  }
  const mad = medianAbsoluteDeviation(values);
  if (mad === null) {
    return true;
  }
  return mad / med > NOISE_RATIO_THRESHOLD;
}

function roundMinutes(value: number | null): number | null {
  if (value === null) {
    return null;
  }
  return Math.round(value);
}

function getDayEntriesForStat(stat: DailyStat): SleepEntry[] {
  return stat.entries
    .filter((entry) => entry.cycle === "Day")
    .sort((a, b) => a.realDatetime.unix() - b.realDatetime.unix());
}

function getIndexedSleepDurations(stats: DailyStat[], now: Dayjs): Map<number, number[]> {
  const map = new Map<number, number[]>();
  stats.forEach((stat) => {
    const dayEntries = getDayEntriesForStat(stat);
    dayEntries.forEach((entry, index) => {
      const info = getEntryEndInfo(entry, now);
      const napIndex = index + 1;
      const values = map.get(napIndex) ?? [];
      values.push(info.durationMinutes);
      map.set(napIndex, values);
    });
  });
  return map;
}

function getIndexedWakeWindows(stats: DailyStat[], now: Dayjs): Map<number, number[]> {
  const map = new Map<number, number[]>();

  stats.forEach((stat) => {
    const dayEntries = getDayEntriesForStat(stat);
    if (dayEntries.length === 0) {
      return;
    }

    const firstWindow = dayEntries[0].realDatetime.diff(stat.startDatetime, "minutes");
    if (firstWindow > 0) {
      map.set(1, [...(map.get(1) ?? []), firstWindow]);
    }

    for (let i = 1; i < dayEntries.length; i += 1) {
      const prev = dayEntries[i - 1];
      const next = dayEntries[i];
      const prevEnd = getEntryEndInfo(prev, now);
      if (prevEnd.isActive) {
        continue;
      }
      const windowMinutes = next.realDatetime.diff(prevEnd.endDatetime, "minutes");
      if (windowMinutes > 0) {
        const index = i + 1;
        const values = map.get(index) ?? [];
        values.push(windowMinutes);
        map.set(index, values);
      }
    }
  });

  return map;
}

function getIndexedAwakeSleepPairs(stats: DailyStat[], now: Dayjs): Map<number, AwakeSleepPair[]> {
  const map = new Map<number, AwakeSleepPair[]>();

  stats.forEach((stat) => {
    const dayEntries = getDayEntriesForStat(stat);
    if (dayEntries.length === 0) {
      return;
    }

    for (let i = 0; i < dayEntries.length; i += 1) {
      const entry = dayEntries[i];
      const entryEnd = getEntryEndInfo(entry, now);
      if (entryEnd.isActive) {
        continue;
      }

      let awakeMinutes = 0;
      if (i === 0) {
        awakeMinutes = entry.realDatetime.diff(stat.startDatetime, "minutes");
      } else {
        const prev = dayEntries[i - 1];
        const prevEnd = getEntryEndInfo(prev, now);
        if (prevEnd.isActive) {
          continue;
        }
        awakeMinutes = entry.realDatetime.diff(prevEnd.endDatetime, "minutes");
      }

      if (awakeMinutes <= 0) {
        continue;
      }

      const napIndex = i + 1;
      const values = map.get(napIndex) ?? [];
      values.push({
        awakeMinutes,
        sleepMinutes: entryEnd.durationMinutes,
      });
      map.set(napIndex, values);
    }
  });

  return map;
}

function flattenIndexedValues(map: Map<number, number[]>): number[] {
  const values: number[] = [];
  map.forEach((entries) => {
    values.push(...entries);
  });
  return values;
}

function findOptimalAwakeWindow(params: {
  pairs: AwakeSleepPair[];
  minAwakeMinutes: number | null;
  maxAwakeMinutes: number | null;
  bucketMinutes: number;
  minSamples: number;
}): {
  awakeMinutes: number | null;
  durationMedian: number | null;
  durationP40: number | null;
  durationP70: number | null;
  sampleCount: number;
} {
  const {
    pairs,
    minAwakeMinutes,
    maxAwakeMinutes,
    bucketMinutes,
    minSamples,
  } = params;

  const bucketMap = new Map<number, number[]>();

  pairs.forEach((pair) => {
    if (minAwakeMinutes !== null && pair.awakeMinutes < minAwakeMinutes) {
      return;
    }
    if (maxAwakeMinutes !== null && pair.awakeMinutes > maxAwakeMinutes) {
      return;
    }

    const bucket = Math.round(pair.awakeMinutes / bucketMinutes) * bucketMinutes;
    const values = bucketMap.get(bucket) ?? [];
    values.push(pair.sleepMinutes);
    bucketMap.set(bucket, values);
  });

  let bestBucket: number | null = null;
  let bestMedian: number | null = null;
  let bestSampleCount = 0;
  let bestP40: number | null = null;
  let bestP70: number | null = null;

  bucketMap.forEach((durations, bucket) => {
    if (durations.length < minSamples) {
      return;
    }
    const medianDuration = roundMinutes(quantile(durations, 0.5));
    if (medianDuration === null) {
      return;
    }

    const shouldReplace =
      bestMedian === null
      || medianDuration > bestMedian
      || (medianDuration === bestMedian && bucket < (bestBucket ?? Infinity))
      || (medianDuration === bestMedian && bucket === bestBucket && durations.length > bestSampleCount);

    if (shouldReplace) {
      bestBucket = bucket;
      bestMedian = medianDuration;
      bestSampleCount = durations.length;
      bestP40 = roundMinutes(quantile(durations, 0.4));
      bestP70 = roundMinutes(quantile(durations, 0.7));
    }
  });

  return {
    awakeMinutes: bestBucket,
    durationMedian: bestMedian,
    durationP40: bestP40,
    durationP70: bestP70,
    sampleCount: bestSampleCount,
  };
}

type AwakeQuantiles = {
  p40: number | null;
  p50: number | null;
  p60: number | null;
  p70: number | null;
  p85: number | null;
};

type DurationQuantiles = {
  p40: number | null;
  p50: number | null;
  p70: number | null;
};

function computeAwakeQuantiles(values: number[]): AwakeQuantiles {
  return {
    p40: roundMinutes(quantile(values, 0.4)),
    p50: roundMinutes(quantile(values, 0.5)),
    p60: roundMinutes(quantile(values, 0.6)),
    p70: roundMinutes(quantile(values, 0.7)),
    p85: roundMinutes(quantile(values, 0.85)),
  };
}

function computeDurationQuantiles(values: number[]): DurationQuantiles {
  return {
    p40: roundMinutes(quantile(values, 0.4)),
    p50: roundMinutes(quantile(values, 0.5)),
    p70: roundMinutes(quantile(values, 0.7)),
  };
}

function blendValue(primary: number | null, fallback: number | null, weight: number) {
  if (primary === null) {
    return fallback;
  }
  if (fallback === null) {
    return primary;
  }
  return roundMinutes(primary * weight + fallback * (1 - weight));
}

function blendAwakeQuantiles(
  primary: AwakeQuantiles,
  fallback: AwakeQuantiles,
  weight: number
): AwakeQuantiles {
  return {
    p40: blendValue(primary.p40, fallback.p40, weight),
    p50: blendValue(primary.p50, fallback.p50, weight),
    p60: blendValue(primary.p60, fallback.p60, weight),
    p70: blendValue(primary.p70, fallback.p70, weight),
    p85: blendValue(primary.p85, fallback.p85, weight),
  };
}

function blendDurationQuantiles(
  primary: DurationQuantiles,
  fallback: DurationQuantiles,
  weight: number
): DurationQuantiles {
  return {
    p40: blendValue(primary.p40, fallback.p40, weight),
    p50: blendValue(primary.p50, fallback.p50, weight),
    p70: blendValue(primary.p70, fallback.p70, weight),
  };
}

export function computeSleepForecast(
  entries: SleepEntry[],
  options: SleepForecastOptions = {}
): SleepForecast {
  const now = options.now ?? dayjs();
  const windowDays = options.windowDays ?? 7;
  const minSamples = options.minSamples ?? 5;

  if (!entries || entries.length === 0) {
    return {
      windowDays,
      napIndex: null,
      currentAwakeMinutes: null,
      zone: "unknown",
      thresholds: { greenMax: null, yellowMax: null },
      predictedSleepStart: null,
      predictedSleepStartRange: { earliest: null, latest: null },
      predictedSleepDurationMinutes: null,
      predictedSleepDurationRange: { shortest: null, longest: null },
      samples: { awakeWindows: 0, sleepDurations: 0 },
    };
  }

  const stats = computeDailyStats(entries, { now });
  if (stats.length === 0) {
    return {
      windowDays,
      napIndex: null,
      currentAwakeMinutes: null,
      zone: "unknown",
      thresholds: { greenMax: null, yellowMax: null },
      predictedSleepStart: null,
      predictedSleepStartRange: { earliest: null, latest: null },
      predictedSleepDurationMinutes: null,
      predictedSleepDurationRange: { shortest: null, longest: null },
      samples: { awakeWindows: 0, sleepDurations: 0 },
    };
  }
  const recentStats = stats.slice(-windowDays);

  const indexedWakeRecent = getIndexedWakeWindows(recentStats, now);
  const indexedWakeAll = getIndexedWakeWindows(stats, now);
  const indexedDurationRecent = getIndexedSleepDurations(recentStats, now);
  const indexedDurationAll = getIndexedSleepDurations(stats, now);
  const indexedPairsRecent = getIndexedAwakeSleepPairs(recentStats, now);
  const indexedPairsAll = getIndexedAwakeSleepPairs(stats, now);

  const globalAwakeWindows = flattenIndexedValues(indexedWakeAll);
  const globalSleepDurations = flattenIndexedValues(indexedDurationAll);

  const latestStat = stats[stats.length - 1];
  const latestDayEntries = latestStat ? getDayEntriesForStat(latestStat) : [];
  const napIndex = latestDayEntries.length + 1;

  const selectWeight = (count: number) => {
    if (count <= 0) {
      return 0;
    }
    const ratio = count / minSamples;
    return Math.min(0.7, Math.max(0.3, ratio));
  };

  const selectAwakeQuantiles = () => {
    const recentValues = indexedWakeRecent.get(napIndex) ?? [];
    const allValues = indexedWakeAll.get(napIndex) ?? [];
    const primaryValues = recentValues.length >= minSamples ? recentValues : allValues;
    if (primaryValues.length === 0) {
      return {
        quantiles: computeAwakeQuantiles(globalAwakeWindows),
        sampleCount: globalAwakeWindows.length,
      };
    }

    const primaryQuantiles = computeAwakeQuantiles(primaryValues);
    if (primaryValues.length >= minSamples && !isNoisy(primaryValues)) {
      return { quantiles: primaryQuantiles, sampleCount: primaryValues.length };
    }

    if (globalAwakeWindows.length === 0) {
      return { quantiles: primaryQuantiles, sampleCount: primaryValues.length };
    }

    const fallbackQuantiles = computeAwakeQuantiles(globalAwakeWindows);
    const weight = selectWeight(primaryValues.length);
    return {
      quantiles: blendAwakeQuantiles(primaryQuantiles, fallbackQuantiles, weight),
      sampleCount: primaryValues.length,
    };
  };

  const selectDurationQuantiles = () => {
    const recentValues = indexedDurationRecent.get(napIndex) ?? [];
    const allValues = indexedDurationAll.get(napIndex) ?? [];
    const primaryValues = recentValues.length >= minSamples ? recentValues : allValues;
    if (primaryValues.length === 0) {
      return {
        quantiles: computeDurationQuantiles(globalSleepDurations),
        sampleCount: globalSleepDurations.length,
      };
    }

    const primaryQuantiles = computeDurationQuantiles(primaryValues);
    if (primaryValues.length >= minSamples && !isNoisy(primaryValues)) {
      return { quantiles: primaryQuantiles, sampleCount: primaryValues.length };
    }

    if (globalSleepDurations.length === 0) {
      return { quantiles: primaryQuantiles, sampleCount: primaryValues.length };
    }

    const fallbackQuantiles = computeDurationQuantiles(globalSleepDurations);
    const weight = selectWeight(primaryValues.length);
    return {
      quantiles: blendDurationQuantiles(primaryQuantiles, fallbackQuantiles, weight),
      sampleCount: primaryValues.length,
    };
  };

  const { quantiles: awakeQuantiles, sampleCount: awakeSampleCount } = selectAwakeQuantiles();
  const { quantiles: durationQuantiles, sampleCount: durationSampleCount } = selectDurationQuantiles();

  const awakeP40 = awakeQuantiles.p40;
  const awakeP50 = awakeQuantiles.p50;
  const awakeP60 = awakeQuantiles.p60;
  const awakeP70 = awakeQuantiles.p70;
  const awakeP85 = awakeQuantiles.p85;

  const durationP40 = durationQuantiles.p40;
  const durationP50 = durationQuantiles.p50;
  const durationP70 = durationQuantiles.p70;

  const recentPairs = indexedPairsRecent.get(napIndex) ?? [];
  const allPairs = indexedPairsAll.get(napIndex) ?? [];
  const pairValues = recentPairs.length >= minSamples ? recentPairs : allPairs;

  const optimal = findOptimalAwakeWindow({
    pairs: pairValues,
    minAwakeMinutes: awakeP40,
    maxAwakeMinutes: awakeP85,
    bucketMinutes: 10,
    minSamples: Math.max(2, Math.floor(minSamples / 2)),
  });

  const targetAwakeMinutes = optimal.awakeMinutes ?? awakeP50;

  const sortedEntries = [...entries].sort(
    (a, b) => a.realDatetime.unix() - b.realDatetime.unix()
  );
  const lastEntry = sortedEntries[sortedEntries.length - 1];

  let currentAwakeMinutes: number | null = null;
  let lastSleepEnd: Dayjs | null = null;
  if (lastEntry) {
    const lastEndInfo = getEntryEndInfo(lastEntry, now);
    if (!lastEndInfo.isActive) {
      lastSleepEnd = lastEndInfo.endDatetime;
      const rawAwakeMinutes = Math.max(0, Math.round(now.diff(lastEndInfo.endDatetime, "minutes")));
      currentAwakeMinutes = Math.min(rawAwakeMinutes, MAX_AWAKE_MINUTES_CAP);
    }
  }

  let zone: SleepForecastZone = "unknown";
  if (currentAwakeMinutes !== null && awakeP60 !== null && awakeP85 !== null) {
    if (currentAwakeMinutes <= awakeP60) {
      zone = "green";
    } else if (currentAwakeMinutes <= awakeP85) {
      zone = "yellow";
    } else {
      zone = "red";
    }
  }

  let predictedSleepStart: Dayjs | null = null;
  let predictedEarliest: Dayjs | null = null;
  let predictedLatest: Dayjs | null = null;
  if (lastSleepEnd && targetAwakeMinutes !== null) {
    predictedSleepStart = lastSleepEnd.add(targetAwakeMinutes, "minutes");
    if (awakeP40 !== null) {
      predictedEarliest = lastSleepEnd.add(awakeP40, "minutes");
    }
    if (awakeP70 !== null) {
      predictedLatest = lastSleepEnd.add(awakeP70, "minutes");
    }

    if (predictedSleepStart.isBefore(now)) {
      predictedSleepStart = now;
    }
    if (predictedEarliest && predictedEarliest.isBefore(now)) {
      predictedEarliest = now;
    }
    if (predictedLatest && predictedLatest.isBefore(now)) {
      predictedLatest = now;
    }
  }

  const predictedDurationMinutes = optimal.durationMedian ?? durationP50;
  const predictedDurationShortest = optimal.durationP40 ?? durationP40;
  const predictedDurationLongest = optimal.durationP70 ?? durationP70;

  return {
    windowDays,
    napIndex,
    currentAwakeMinutes,
    zone,
    thresholds: {
      greenMax: awakeP60,
      yellowMax: awakeP85,
    },
    predictedSleepStart,
    predictedSleepStartRange: {
      earliest: predictedEarliest,
      latest: predictedLatest,
    },
    predictedSleepDurationMinutes: predictedDurationMinutes,
    predictedSleepDurationRange: {
      shortest: predictedDurationShortest,
      longest: predictedDurationLongest,
    },
    samples: {
      awakeWindows: awakeSampleCount,
      sleepDurations: durationSampleCount,
    },
  };
}
