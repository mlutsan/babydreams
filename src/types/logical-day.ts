import type { Dayjs } from "dayjs";
import type { DailyStat } from "~/types/sleep";
import type { DailyEatStat } from "~/lib/eat-service";

export type LogicalDaySource = "sleep" | "fallback";

export type LogicalDay = {
  logicalDate: string;
  startDatetime: Dayjs;
  endDatetime: Dayjs;
  sleep: DailyStat | null;
  eat: DailyEatStat | null;
  source: LogicalDaySource;
};
