import { useMemo } from "react";
import { useSleepHistory } from "~/hooks/useSleepHistory";
import { computeSleepForecast } from "~/lib/sleep-forecast";
import { useMinuteTick } from "~/hooks/useMinuteTick";

export type UseSleepForecastOptions = {
  windowDays?: number;
  minSamples?: number;
};

export function useSleepForecast(options: UseSleepForecastOptions = {}) {
  const { data, isLoading } = useSleepHistory();
  const now = useMinuteTick();

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
