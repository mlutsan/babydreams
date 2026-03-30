/**
 * Modal for adding a meal entry
 * Self-contained: handles mutation internally
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { useAtomValue } from "jotai";
import { Sheet, Button, Range, Block, Toolbar, ToolbarPane, Link, Segmented, SegmentedButton } from "konsta/react";
import { X } from "lucide-react";
import { babyNameAtom, sheetUrlAtom } from "~/lib/atoms";
import { useEatMutation } from "~/hooks/useEatMutation";
import { useMinuteTick } from "~/hooks/useMinuteTick";
import dayjs from "dayjs";
import {
  addMinutesToTime,
  getTimeAgoFromManualInput,
} from "~/lib/date-utils";
import { useEntryPlacement } from "~/hooks/useEntryPlacement";

interface EatModalProps {
  opened: boolean;
  onClose: () => void;
}

function resolveSelectedDatetime(time: string, now: dayjs.Dayjs = dayjs()): dayjs.Dayjs {
  const [hours, minutes] = time.split(":").map(Number);
  let datetime = now.hour(hours).minute(minutes).second(0);

  // Tracking is always about the past.
  // If computed datetime is significantly in the future (>60 min grace), it must be yesterday.
  // Example: now is 00:05, user enters 23:55 → should be yesterday at 23:55
  if (datetime.isAfter(now.add(60, "minute"))) {
    datetime = datetime.subtract(1, "day");
  }

  return datetime;
}

export function EatModal({ opened, onClose }: EatModalProps) {
  const babyName = useAtomValue(babyNameAtom);
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const mutation = useEatMutation();
  const uiNow = useMinuteTick();
  const {
    resolvePlacement,
    commitPlacement,
    isLoading: isPlacementLoading,
  } = useEntryPlacement();

  const [volume, setVolume] = useState(100); // Default 100ml
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedLogicalDate, setSelectedLogicalDate] = useState<string | null>(null);
  const [cycleDayManual, setCycleDayManual] = useState(false);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);
  const daySelectionWindowMinutes = 120;

  const displayName = babyName || "baby";
  const modalTitle = `How much did ${displayName} eat?`;

  const placementDecision = useMemo(() => {
    if (!selectedTime) {
      return null;
    }
    const selectedDatetime = resolveSelectedDatetime(selectedTime, uiNow);
    return resolvePlacement({
      datetime: selectedDatetime,
      boundaryMinutes: daySelectionWindowMinutes,
    });
  }, [selectedTime, uiNow, resolvePlacement]);

  const showDaySelection = placementDecision?.isAmbiguous ?? false;

  const resolvedSelectedLogicalDate =
    selectedLogicalDate ?? placementDecision?.logicalDate ?? null;

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
    setSelectedLogicalDate(null);
    setCycleDayManual(false);
    initializedRef.current = true;
  }, [opened, uiNow]);

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

    if (placementDecision?.logicalDate) {
      setSelectedLogicalDate(placementDecision.logicalDate);
    }
  }, [opened, cycleDayManual, selectedTime, placementDecision]);

  const handleConfirm = () => {
    if (!selectedTime || !sheetUrl) {
      return;
    }

    const datetime = resolveSelectedDatetime(selectedTime, dayjs());
    const now = dayjs();
    const overrideLogicalDate =
      cycleDayManual && showDaySelection
        ? (selectedLogicalDate ?? placementDecision?.logicalDate ?? null)
        : null;
    const cycleDate = commitPlacement({
      datetime,
      overrideLogicalDate,
      boundaryMinutes: daySelectionWindowMinutes,
      now,
    });

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
            <div className="space-y-2 mt-8">
              <Segmented rounded strong className="">
                {placementDecision?.options?.map((option) => (
                  <SegmentedButton
                    key={option.logicalDate}
                    active={resolvedSelectedLogicalDate === option.logicalDate}
                    onClick={() => {
                      setSelectedLogicalDate(option.logicalDate);
                      setCycleDayManual(true);
                    }}
                  >
                    {option.label}
                  </SegmentedButton>
                ))}
              </Segmented>
            </div>
          )}

          {/* Confirm Button */}
          <div className="mt-8">
            <Button
              large
              rounded
              onClick={handleConfirm}
              disabled={mutation.isPending || isPlacementLoading}
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
