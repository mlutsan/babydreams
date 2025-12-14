/**
 * Client-side eating/feeding tracking service
 * Tracks bottle feeding with volume measurements
 */

import dayjs from "dayjs";
import {
  serialNumberToDate,
} from "~/lib/sheets-utils";
import {
  getSheetValues,
  appendSheetValues,
} from "~/server/proxy";

const EAT_SHEET = "Eat";

export type EatEntry = {
  datetime: dayjs.Dayjs;
  cycleDate: dayjs.Dayjs; // Logical date matching sleep cycle
  volume: number; // ml
};

export type DailyEatStat = {
  date: dayjs.Dayjs;
  totalVolume: number;
  entries: EatEntry[];
  entryCount: number;
};

/**
 * Parse a row from the Eat sheet
 */
export function parseRow(row: unknown[]): EatEntry | null {
  if (!row || row.length < 3) {
    return null;
  }

  try {
    // Column A: Date and Time (Excel serial number)
    const datetime = serialNumberToDate(row[0] as number);

    // Column B: Cycle Date (Excel serial number)
    const cycleDate = serialNumberToDate(row[1] as number);

    // Column C: Volume (ml)
    const volume = Number(row[2]);

    if (!datetime.isValid() || !cycleDate.isValid() || isNaN(volume)) {
      return null;
    }

    return {
      datetime,
      cycleDate,
      volume,
    };
  } catch (error) {
    console.error("Error parsing eat entry row:", error);
    return null;
  }
}

/**
 * Get all eating history grouped by cycle date
 */
export async function getEatHistory(sheetUrl: string): Promise<DailyEatStat[]> {
  const range = `${EAT_SHEET}!A:C`;

  try {
    const result = (await getSheetValues({ data: { sheetUrl, range } })) as {
      values?: unknown[][];
    };
    const rows = (result.values as unknown[][]) || [];

    // Skip header row
    const dataRows = rows.slice(1);

    // Parse all entries
    const allEntries: EatEntry[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const entry = parseRow(dataRows[i]);
      if (entry) {
        allEntries.push(entry);
      }
    }

    // Sort by datetime ascending
    allEntries.sort((a, b) => a.datetime.unix() - b.datetime.unix());

    // Group by cycle date (logical day from sleep tracking)
    const statsByDate = new Map<string, DailyEatStat>();

    for (const entry of allEntries) {
      const dateKey = entry.cycleDate.format("YYYY-MM-DD");

      if (!statsByDate.has(dateKey)) {
        statsByDate.set(dateKey, {
          date: entry.cycleDate.startOf("day"),
          totalVolume: 0,
          entries: [],
          entryCount: 0,
        });
      }

      const stat = statsByDate.get(dateKey)!;
      stat.totalVolume += entry.volume;
      stat.entries.push(entry);
      stat.entryCount += 1;
    }

    // Convert to array and sort by date descending (most recent first)
    const stats = Array.from(statsByDate.values()).sort(
      (a, b) => b.date.unix() - a.date.unix()
    );

    return stats;
  } catch (error) {
    throw new Error(
      `Failed to get eat history: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Add a new eating entry
 * This function only validates and saves data - date logic should be in calling code
 */
export async function addEatEntry(params: {
  sheetUrl: string;
  volume: number;
  datetime: dayjs.Dayjs; // Actual moment the meal happened
  cycleDate: dayjs.Dayjs; // Logical date for grouping
}): Promise<void> {
  const { sheetUrl, volume, datetime, cycleDate } = params;

  if (volume < 0 || volume > 200) {
    throw new Error("Volume must be between 0 and 200 ml");
  }

  const cycleDateString = cycleDate.startOf("day").format("YYYY-MM-DD");
  const range = `${EAT_SHEET}!A:C`;
  const values = [[datetime.format("YYYY-MM-DD HH:mm"), cycleDateString, volume]];

  await appendSheetValues({ data: { sheetUrl, range, values } });
}
