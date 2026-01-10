import dayjs from "dayjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toggleSleep } from "~/lib/sleep-service";
import { appendSheetValues, getSheetValues, updateSheetValues } from "~/server/proxy";
import type { DailyStat, SleepEntry } from "~/types/sleep";

vi.mock("~/server/proxy", () => ({
  getSheetValues: vi.fn(),
  appendSheetValues: vi.fn(),
  updateSheetValues: vi.fn(),
  deleteSheetRow: vi.fn(),
}));

const getSheetValuesMock = vi.mocked(getSheetValues);
const appendSheetValuesMock = vi.mocked(appendSheetValues);
const updateSheetValuesMock = vi.mocked(updateSheetValues);

const sheetUrl = "sheet-url";

function makeStat(date: string): DailyStat {
  return {
    startDatetime: dayjs(date),
    endDatetime: dayjs(date),
    logicalDate: date,
    totalSleepMinutes: 0,
    awakeMinutes: 0,
    daySleepMinutes: 0,
    nightSleepMinutes: 0,
    sessionCount: 1,
    hasActiveSleep: false,
    entries: [{ date: dayjs(date) } as SleepEntry],
  };
}

function getAppendedValues() {
  const call = appendSheetValuesMock.mock.calls[0]?.[0];
  if (!call) {
    throw new Error("appendSheetValues was not called");
  }
  return call.data.values[0];
}

describe("toggleSleep date selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSheetValuesMock.mockResolvedValue({ values: [["Added Date"]] });
    updateSheetValuesMock.mockResolvedValue({});
    appendSheetValuesMock.mockResolvedValue({});
  });

  it("uses lastEntryDate for night sleeps when todayStat is missing", async () => {
    await toggleSleep({
      sheetUrl,
      time: "05:30",
      cycle: "Night",
      what: "Sleep",
      todayStat: null,
      now: dayjs("2024-02-10T05:30:00"),
      lastEntryDate: dayjs("2024-02-09"),
    });

    const values = getAppendedValues();
    expect(values[1]).toBe("2024-02-09");
    expect(values[2]).toBe("05:30");
    expect(values[4]).toBe("Night");
  });

  it("falls back to todayStat date when lastEntryDate is missing", async () => {
    await toggleSleep({
      sheetUrl,
      time: "05:30",
      cycle: "Night",
      what: "Sleep",
      todayStat: makeStat("2024-02-09"),
      now: dayjs("2024-02-10T05:30:00"),
      lastEntryDate: null,
    });

    const values = getAppendedValues();
    expect(values[1]).toBe("2024-02-09");
  });

  it("uses the current date for day sleeps even with an older lastEntryDate", async () => {
    await toggleSleep({
      sheetUrl,
      time: "09:00",
      cycle: "Day",
      what: "Sleep",
      todayStat: null,
      now: dayjs("2024-02-10T09:00:00"),
      lastEntryDate: dayjs("2024-02-09"),
    });

    const values = getAppendedValues();
    expect(values[1]).toBe("2024-02-10");
  });
});
