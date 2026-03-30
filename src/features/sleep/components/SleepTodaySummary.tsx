import { Block, BlockTitle } from "konsta/react";
import { formatDurationHHMM } from "~/lib/date-utils";
import type { SleepTodaySummaryData } from "~/features/sleep/hooks/useSleepPageData";

interface SleepTodaySummaryProps {
  summary: SleepTodaySummaryData;
}

export function SleepTodaySummary({ summary }: SleepTodaySummaryProps) {
  return (
    <>
      <BlockTitle>Today</BlockTitle>
      <Block strong inset>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center py-4">
            <div className="text-sm opacity-70 mb-1">Total Sleep</div>
            <div className="text-2xl font-semibold">
              {formatDurationHHMM(summary.totalSleepMinutes)}
            </div>
          </div>
          <div className="text-center py-4">
            <div className="text-sm opacity-70 mb-1">Total Awake</div>
            <div className="text-2xl font-semibold">
              {formatDurationHHMM(summary.awakeMinutes)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
            <div className="opacity-70 text-xs mb-1">Day Sleep</div>
            <div className="font-semibold">
              {formatDurationHHMM(summary.daySleepMinutes)}
            </div>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-2">
            <div className="opacity-70 text-xs mb-1">Night Sleep</div>
            <div className="font-semibold">
              {formatDurationHHMM(summary.nightSleepMinutes)}
            </div>
          </div>
        </div>
      </Block>
    </>
  );
}
