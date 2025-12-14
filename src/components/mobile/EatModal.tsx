/**
 * Modal for adding a meal entry
 * Self-contained: handles mutation internally
 */

import { useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { Sheet, Button, Range, Block, Toolbar, ToolbarPane, Link } from "konsta/react";
import { X } from "lucide-react";
import { babyNameAtom, sheetUrlAtom } from "~/lib/atoms";
import { useTodaySleepStat } from "~/hooks/useSleepHistory";
import { useEatMutation } from "~/hooks/useEatMutation";
import dayjs from "dayjs";
import { addMinutesToTime, getTimeAgoFromManualInput } from "~/lib/date-utils";

interface EatModalProps {
  opened: boolean;
  onClose: () => void;
}

export function EatModal({ opened, onClose }: EatModalProps) {
  const babyName = useAtomValue(babyNameAtom);
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const { todayStat, isFetched } = useTodaySleepStat();
  const mutation = useEatMutation();

  // Determine current cycle date from sleep stats
  const currentCycleDate = todayStat?.startDatetime ?? (isFetched ? dayjs() : null);
  const [volume, setVolume] = useState(100); // Default 100ml
  const [selectedTime, setSelectedTime] = useState("");
  const timeInputRef = useRef<HTMLInputElement>(null);

  const displayName = babyName || "baby";
  const modalTitle = `How much did ${displayName} eat?`;

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

  // Reset time when opening
  useEffect(() => {
    if (opened) {
      setSelectedTime(dayjs().format("HH:mm"));
    }
  }, [opened]);

  // Handle touch/click anywhere on slider track
  const handleSliderInteraction = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();

    let clientX: number;
    if ("touches" in e) {
      clientX = e.touches[0]?.clientX || 0;
    } else {
      clientX = e.clientX;
    }

    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newValue = Math.round(percentage * 200 / 10) * 10; // Round to nearest 10
    setVolume(newValue);
  };

  const handleConfirm = () => {
    if (!selectedTime || !sheetUrl || !currentCycleDate) {
      return;
    }

    const [hours, minutes] = selectedTime.split(":").map(Number);
    let datetime = dayjs().hour(hours).minute(minutes).second(0);

    // Tracking is always about the past.
    // If computed datetime is significantly in the future (>60 min grace), it must be yesterday.
    // Example: now is 00:05, user enters 23:55 → should be yesterday at 23:55
    if (datetime.isAfter(dayjs().add(60, "minute"))) {
      datetime = datetime.subtract(1, "day");
    }

    mutation.mutate(
      {
        sheetUrl,
        volume,
        datetime,
        cycleDate: currentCycleDate,
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
                onTouchStart={handleSliderInteraction}
                onTouchMove={handleSliderInteraction}
                onClick={handleSliderInteraction}
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

          {/* Confirm Button */}
          <div className="mt-8">
            <Button
              large
              rounded
              onClick={handleConfirm}
              disabled={mutation.isPending || !currentCycleDate}
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
