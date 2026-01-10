import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import type { DailyStat } from "~/types/sleep";
import { getTimeOfDayMinutes, normalizeMinutesSinceStart } from "~/lib/date-utils";

export function getMinStartDatetime(stats?: DailyStat[]): Dayjs | null {
  if (!stats || stats.length === 0) {
    return null;
  }

  return stats.reduce((min, stat) => {
    const minMinutes = getTimeOfDayMinutes(min);
    const statMinutes = getTimeOfDayMinutes(stat.startDatetime);

    if (statMinutes < minMinutes) {
      return stat.startDatetime;
    }

    if (statMinutes === minMinutes && stat.startDatetime.isBefore(min)) {
      return stat.startDatetime;
    }

    return min;
  }, stats[0].startDatetime);
}

export function computeCurrentTimeMinutes(
  now: Dayjs,
  referenceStartMinutes: number | null
) {
  const currentMinutes = getTimeOfDayMinutes(now);
  if (referenceStartMinutes === null) {
    return currentMinutes;
  }

  return normalizeMinutesSinceStart(currentMinutes, referenceStartMinutes);
}

export function useCurrentTimeMinutes(sleepStats?: DailyStat[]) {
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(dayjs());
    }, 60 * 1000);

    return () => window.clearInterval(interval);
  }, []);

  const referenceStart = useMemo(() => getMinStartDatetime(sleepStats), [sleepStats]);
  const referenceStartMinutes = useMemo(() => {
    if (!referenceStart) {
      return null;
    }

    return getTimeOfDayMinutes(referenceStart);
  }, [referenceStart]);

  const currentTimeMinutes = useMemo(() => {
    return computeCurrentTimeMinutes(now, referenceStartMinutes);
  }, [now, referenceStartMinutes]);

  return {
    currentTimeMinutes,
    referenceStartMinutes,
    referenceStart,
  };
}
