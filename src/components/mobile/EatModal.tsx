/**
 * Modal for adding a meal entry
 * Self-contained: handles mutation internally
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { useAtomValue } from "jotai";
import { Sheet, Button, Range, Block, Toolbar, ToolbarPane, Link, Segmented, SegmentedButton } from "konsta/react";
import { X } from "lucide-react";
import { babyNameAtom, cycleSettingsAtom, sheetUrlAtom } from "~/lib/atoms";
import { useTodaySleepStat } from "~/hooks/useSleepHistory";
import { useEatMutation } from "~/hooks/useEatMutation";
import { useMinuteTick } from "~/hooks/useMinuteTick";
import dayjs from "dayjs";
import {
  addMinutesToTime,
  getTimeAgoFromManualInput,
  getCycleDateForDatetime,
  MINUTES_PER_DAY,
  timeToMinutes,
} from "~/lib/date-utils";

interface EatModalProps {
  opened: boolean;
  onClose: () => void;
}

type MealDayOption = "today" | "yesterday";

function resolveSelectedDatetime(time: string): dayjs.Dayjs {
  const [hours, minutes] = time.split(":").map(Number);
  let datetime = dayjs().hour(hours).minute(minutes).second(0);

  // Tracking is always about the past.
  // If computed datetime is significantly in the future (>60 min grace), it must be yesterday.
  // Example: now is 00:05, user enters 23:55 → should be yesterday at 23:55
  if (datetime.isAfter(dayjs().add(60, "minute"))) {
    datetime = datetime.subtract(1, "day");
  }

  return datetime;
}

export function EatModal({ opened, onClose }: EatModalProps) {
  const babyName = useAtomValue(babyNameAtom);
  const cycleSettings = useAtomValue(cycleSettingsAtom);
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const { allStats: allSleepStats } = useTodaySleepStat();
  const mutation = useEatMutation();
  const uiNow = useMinuteTick();

  const [volume, setVolume] = useState(100); // Default 100ml
  const [selectedTime, setSelectedTime] = useState("");
  const [cycleDay, setCycleDay] = useState<MealDayOption>("today");
  const [cycleDayManual, setCycleDayManual] = useState(false);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);
  const daySelectionWindowMinutes = 120;

  const today = uiNow.format("YYYY-MM-DD");

  const hasCalendarTodayStat = useMemo(() => {
    if (!allSleepStats || allSleepStats.length === 0) {
      return false;
    }
    return allSleepStats.some((stat) => stat.logicalDate === today);
  }, [allSleepStats, today]);

  const displayName = babyName || "baby";
  const modalTitle = `How much did ${displayName} eat?`;

  const showDaySelection = useMemo(() => {
    const timeValue = selectedTime || uiNow.format("HH:mm");
    const selectedMinutes = timeToMinutes(timeValue);
    const dayStartMinutes = timeToMinutes(cycleSettings.dayStart);
    const diff = Math.abs(selectedMinutes - dayStartMinutes);
    const distance = Math.min(diff, MINUTES_PER_DAY - diff);
    return distance <= daySelectionWindowMinutes && !hasCalendarTodayStat;
  }, [selectedTime, cycleSettings.dayStart, hasCalendarTodayStat, uiNow]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (opened) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [opened]);

  // Reset time and cycle day when opening
  useEffect(() => {
    if (!opened) {
      initializedRef.current = false;
      return;
    }

    if (initializedRef.current) {
      return;
    }

    setSelectedTime(uiNow.format("HH:mm"));
    setCycleDayManual(false);

    const defaultCycleDate = getCycleDateForDatetime(uiNow, allSleepStats, uiNow);
    setCycleDay(defaultCycleDate.isSame(uiNow, "day") ? "today" : "yesterday");
    initializedRef.current = true;
  }, [opened, allSleepStats, uiNow]);

  useEffect(() => {
    if (!opened || showDaySelection || !cycleDayManual) {
      return;
    }
    setCycleDayManual(false);
  }, [opened, showDaySelection, cycleDayManual]);

  useEffect(() => {
    if (!opened || cycleDayManual || !selectedTime) {
      return;
    }

    const datetime = resolveSelectedDatetime(selectedTime);
    const defaultCycleDate = getCycleDateForDatetime(datetime, allSleepStats, uiNow);
    setCycleDay(defaultCycleDate.isSame(uiNow, "day") ? "today" : "yesterday");
  }, [opened, cycleDayManual, selectedTime, allSleepStats, uiNow]);

  const handleConfirm = () => {
    if (!selectedTime || !sheetUrl) {
      return;
    }

    const datetime = resolveSelectedDatetime(selectedTime);

    const now = dayjs();
    const cycleDate =
      cycleDay === "today" ? now.startOf("day") : now.subtract(1, "day").startOf("day");

    mutation.mutate(
      {
        sheetUrl,
        volume,
        datetime,
        cycleDate,
      },
      {
        onSuccess: onClose,
      }
    );
  };

  const handleTimeAdjustment = (minutes: number) => {
    if (!selectedTime) {
      return;
    }
    const newTime = addMinutesToTime(selectedTime, minutes);
    setSelectedTime(newTime);
  };

  const getTimeAgo = () => {
    if (!selectedTime) {
      return "Select time";
    }
    const minutesAgo = getTimeAgoFromManualInput(selectedTime);
    if (minutesAgo === 0) {
      return "Now";
    }
    if (minutesAgo < 0) {
      return `${Math.abs(minutesAgo)} min ahead`;
    }
    return `${minutesAgo} min ago`;
  };

  return (
    <Sheet
      className="pb-safe"
      opened={opened}
      onBackdropClick={onClose}
    >
      <Toolbar top className="justify-end ios:pt-4">
        <div className="ios:hidden" />
        <ToolbarPane>
          <Link iconOnly onClick={onClose}>
            <X className="w-6 h-6" />
          </Link>
        </ToolbarPane>
      </Toolbar>

      <Block className="ios:mt-4">
        <div className="space-y-4">
          {/* Title */}
          <div className="text-center">
            <h3 className="text-xl font-semibold">{modalTitle}</h3>
          </div>
          {/* Volume Display */}
          <div className="text-center">
            <div className="text-6xl font-bold text-amber-600">
              {volume}
            </div>
            <div className="text-xl text-gray-600 dark:text-gray-400 mt-2">
              ml
            </div>
          </div>

          {/* Volume Slider */}
          <div className="space-y-2">
            <div className="text-sm opacity-70 flex justify-between px-4">
              <span>0 ml</span>
              <span>200 ml</span>
            </div>
            <div className="flex items-center gap-4 px-4">
              <Range
                value={volume}
                min={0}
                max={200}
                step={10}
                onChange={(e) => setVolume(Number(e.target.value))}
              //onTouchStart={handleSliderInteraction}
              //onTouchMove={handleSliderInteraction}
              //onClick={handleSliderInteraction}
              />
            </div>
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <div className="flex justify-center">
              <div className="flex items-center gap-2">
                <input
                  ref={timeInputRef}
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="text-center text-3xl font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-lg px-3 py-1"
                />
              </div>
            </div>
            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              {getTimeAgo()}
            </div>
            <div className="flex justify-center gap-1">
              <Button outline rounded small onClick={() => handleTimeAdjustment(-10)}>-10 min</Button>
              <Button outline rounded small onClick={() => handleTimeAdjustment(-5)}>-5 min</Button>
              <Button outline rounded small onClick={() => handleTimeAdjustment(5)}>+5 min</Button>
              <Button outline rounded small onClick={() => handleTimeAdjustment(10)}>+10 min</Button>
            </div>
          </div>

          {/* Day Selection */}
          {showDaySelection && (
            <div className="space-y-2">
              <div className="text-sm opacity-70 text-center">Log this meal for</div>
              <Segmented rounded strong>
                <SegmentedButton
                  active={cycleDay === "today"}
                  onClick={() => {
                    setCycleDay("today");
                    setCycleDayManual(true);
                  }}
                >
                  Today
                </SegmentedButton>
                <SegmentedButton
                  active={cycleDay === "yesterday"}
                  onClick={() => {
                    setCycleDay("yesterday");
                    setCycleDayManual(true);
                  }}
                >
                  Yesterday
                </SegmentedButton>
              </Segmented>
            </div>
          )}

          {/* Confirm Button */}
          <div className="mt-8">
            <Button
              large
              rounded
              onClick={handleConfirm}
              disabled={mutation.isPending}
              className="bg-amber-500 active:bg-amber-600"
            >
              {mutation.isPending ? "Om-nom-noming..." : "Confirm"}
            </Button>
          </div>
        </div>
      </Block>
    </Sheet>
  );
}
