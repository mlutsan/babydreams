import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import type { DailyStat } from "~/types/sleep";

const MINUTES_PER_DAY = 24 * 60;

function getMinStartDatetime(stats?: DailyStat[]): Dayjs | null {
  if (!stats || stats.length === 0) {
    return null;
  }

  return stats.reduce((min, stat) => {
    return stat.startDatetime.isBefore(min) ? stat.startDatetime : min;
  }, stats[0].startDatetime);
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

    return referenceStart.hour() * 60 + referenceStart.minute();
  }, [referenceStart]);

  const currentTimeMinutes = useMemo(() => {
    const currentMinutes = now.hour() * 60 + now.minute();
    if (referenceStartMinutes === null) {
      return currentMinutes;
    }

    return currentMinutes < referenceStartMinutes
      ? currentMinutes + MINUTES_PER_DAY
      : currentMinutes;
  }, [now, referenceStartMinutes]);

  return {
    currentTimeMinutes,
    referenceStartMinutes,
    referenceStart,
  };
}
