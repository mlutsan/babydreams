import dayjs from "dayjs";
import { describe, expect, it, vi } from "vitest";
import { parseRow as parseEatRow } from "~/lib/eat-service";
import { buildLogicalDays } from "~/lib/logical-day";
import {
  buildWallClockDateTimeFromMinutes,
  dateToSerialNumber,
  formatDateTimeForSheet,
  serialNumberToDate,
  serialNumberToDateTime,
} from "~/lib/sheets-utils";
import { getSleepEntryEndInfo, parseRow as parseSleepRow } from "~/lib/sleep-utils";

vi.mock("~/server/proxy", () => ({
  getSheetValues: vi.fn(),
  appendSheetValues: vi.fn(),
  updateSheetValues: vi.fn(),
  deleteSheetRow: vi.fn(),
}));

const SPRING_FORWARD_MEAL_SERIAL = 46110.77361111111; // 2026-03-29 18:34
const FALL_BACK_MEAL_SERIAL = 46320.77361111111; // 2026-10-25 18:34
const SPRING_FORWARD_DATE_SERIAL = 46110; // 2026-03-29
const DAY_AFTER_SPRING_FORWARD_SERIAL = 46111; // 2026-03-30

describe("sheet wall-clock conversions", () => {
  it("parses spring-forward datetime serials without shifting the displayed hour", () => {
    const parsed = serialNumberToDateTime(SPRING_FORWARD_MEAL_SERIAL);

    expect(parsed.format("YYYY-MM-DD HH:mm")).toBe("2026-03-29 18:34");
  });

  it("keeps date-only serials pinned to local midnight across DST changes", () => {
    expect(serialNumberToDate(SPRING_FORWARD_DATE_SERIAL).format("YYYY-MM-DD HH:mm")).toBe(
      "2026-03-29 00:00"
    );
    expect(serialNumberToDate(DAY_AFTER_SPRING_FORWARD_SERIAL).format("YYYY-MM-DD HH:mm")).toBe(
      "2026-03-30 00:00"
    );
  });

  it("round-trips local wall-clock datetimes on spring-forward and fall-back days", () => {
    const springRoundTrip = serialNumberToDateTime(
      dateToSerialNumber(new Date(2026, 2, 29, 18, 34))
    );
    const fallRoundTrip = serialNumberToDateTime(
      dateToSerialNumber(new Date(2026, 9, 25, 18, 34))
    );

    expect(springRoundTrip.format("YYYY-MM-DD HH:mm")).toBe("2026-03-29 18:34");
    expect(fallRoundTrip.format("YYYY-MM-DD HH:mm")).toBe("2026-10-25 18:34");
  });

  it("builds wall-clock times from minutes without DST drift", () => {
    const built = buildWallClockDateTimeFromMinutes(dayjs("2026-03-29"), 18 * 60 + 34);

    expect(built.format("YYYY-MM-DD HH:mm")).toBe("2026-03-29 18:34");
    expect(formatDateTimeForSheet(built)).toBe("2026-03-29 18:34");
  });
});

describe("meal and sleep DST regressions", () => {
  it("shows the last meal at 18:34 and computes 00:04 ago at 18:38", () => {
    const meal = parseEatRow([SPRING_FORWARD_MEAL_SERIAL, SPRING_FORWARD_DATE_SERIAL, 120]);
    const now = dayjs("2026-03-29T18:38:00");

    expect(meal).not.toBeNull();
    expect(meal?.datetime.format("HH:mm")).toBe("18:34");
    expect(now.diff(meal!.datetime, "minute")).toBe(4);
  });

  it("parses sleep rows without shifting start/end times on the spring-forward day", () => {
    const sleep = parseSleepRow([
      SPRING_FORWARD_DATE_SERIAL,
      SPRING_FORWARD_DATE_SERIAL,
      SPRING_FORWARD_MEAL_SERIAL,
      46110.79513888889, // 19:05
      "Day",
      "",
    ]);

    expect(sleep).not.toBeNull();
    expect(sleep?.realDatetime.format("YYYY-MM-DD HH:mm")).toBe("2026-03-29 18:34");
    expect(sleep?.endDatetime?.format("YYYY-MM-DD HH:mm")).toBe("2026-03-29 19:05");
  });

  it("keeps active sleep duration correct after the spring-forward transition", () => {
    const sleep = parseSleepRow([
      SPRING_FORWARD_DATE_SERIAL,
      SPRING_FORWARD_DATE_SERIAL,
      SPRING_FORWARD_MEAL_SERIAL,
      "",
      "Day",
      "",
    ]);
    const now = dayjs("2026-03-29T18:38:00");

    expect(sleep).not.toBeNull();

    const endInfo = getSleepEntryEndInfo(sleep!, now);
    expect(endInfo.durationMinutes).toBe(4);
    expect(endInfo.endDatetime.format("YYYY-MM-DD HH:mm")).toBe("2026-03-29 18:38");
  });

  it("keeps fallback logical-day boundaries on the intended wall-clock hour", () => {
    const days = buildLogicalDays({
      eatEntries: [
        {
          datetime: dayjs("2026-03-29T08:15:00"),
          cycleDate: dayjs("2026-03-29"),
          volume: 60,
        },
      ],
      dayStart: "08:00",
      now: dayjs("2026-03-29T12:00:00"),
    });

    expect(days).toHaveLength(1);
    expect(days[0].startDatetime.format("YYYY-MM-DD HH:mm")).toBe("2026-03-29 08:00");
    expect(days[0].endDatetime.format("YYYY-MM-DD HH:mm")).toBe("2026-03-30 08:00");
  });

  it("parses fall-back datetime serials without shifting the displayed hour", () => {
    const parsed = serialNumberToDateTime(FALL_BACK_MEAL_SERIAL);

    expect(parsed.format("YYYY-MM-DD HH:mm")).toBe("2026-10-25 18:34");
  });
});
