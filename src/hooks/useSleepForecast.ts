import { useMemo, useState, useEffect } from "react";
import dayjs from "dayjs";
import { useSleepHistory } from "~/hooks/useSleepHistory";
import { computeSleepForecast } from "~/lib/sleep-forecast";

export type UseSleepForecastOptions = {
  windowDays?: number;
  minSamples?: number;
};

export function useSleepForecast(options: UseSleepForecastOptions = {}) {
  const { data, isLoading } = useSleepHistory();
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(dayjs());
    }, 60 * 1000);

    return () => window.clearInterval(interval);
  }, []);

  const entries = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.flatMap((stat) => stat.entries);
  }, [data]);

  const forecast = useMemo(() => {
    return computeSleepForecast(entries, {
      now,
      windowDays: options.windowDays,
      minSamples: options.minSamples,
    });
  }, [entries, options.windowDays, options.minSamples, now]);

  return {
    forecast,
    isLoading,
  };
}
