import { Block, BlockTitle } from "konsta/react";
import type { EatTodaySummaryData } from "~/features/eat/hooks/useEatPageData";

interface EatTodaySummaryProps {
  summary: EatTodaySummaryData;
}

export function EatTodaySummary({ summary }: EatTodaySummaryProps) {
  return (
    <>
      <BlockTitle>Today</BlockTitle>
      <Block strong inset className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Last Meal</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {summary.lastMealTime}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {summary.lastMealAgo}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">vs Yesterday</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {summary.yesterdayByNowVolume} ml
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              total: {summary.yesterdayTotalVolume} ml
            </div>
          </div>
        </div>
      </Block>
    </>
  );
}
