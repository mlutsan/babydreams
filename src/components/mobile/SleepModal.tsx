import { useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import {
  Sheet,
  Toolbar,
  ToolbarPane,
  Link,
  Block,
  Button,
  Segmented,
  SegmentedButton,
} from "konsta/react";
import { X, Edit2 } from "lucide-react";
import { addMinutesToTime, getTimeAgoFromManualInput } from "~/lib/date-utils";
import { babyNameAtom, cycleSettingsAtom, calculateCycleFromTime } from "~/lib/atoms";
import dayjs from "dayjs";

interface SleepModalProps {
  opened: boolean;
  onClose: () => void;
  isSleeping: boolean; // Is baby currently sleeping?
  onConfirm: (time: string, cycle: "Day" | "Night") => void;
  isLoading?: boolean; // Is data being saved?
}

export function SleepModal({
  opened,
  onClose,
  isSleeping,
  onConfirm,
  isLoading = false,
}: SleepModalProps) {
  const babyName = useAtomValue(babyNameAtom);
  const cycleSettings = useAtomValue(cycleSettingsAtom);

  const [selectedTime, setSelectedTime] = useState("");
  const [cycle, setCycle] = useState<"Day" | "Night">("Day");
  const timeInputRef = useRef<HTMLInputElement>(null);

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

  // Reset state when modal opens and auto-calculate cycle
  useEffect(() => {
    if (opened) {
      const now = dayjs().format("HH:mm");
      setSelectedTime(now);
      setCycle(calculateCycleFromTime(now, cycleSettings));
    }
  }, [opened, cycleSettings]);

  // Auto-update cycle when time changes
  useEffect(() => {
    if (selectedTime) {
      const autoCycle = calculateCycleFromTime(selectedTime, cycleSettings);
      setCycle(autoCycle);
    }
  }, [selectedTime, cycleSettings]);

  const handleConfirm = () => {
    if (!selectedTime) {
      return;
    }
    onConfirm(selectedTime, cycle);
  };

  // Calculate relative time for display only
  const getTimeAgoFromSelectedTime = (): number => {
    if (!selectedTime) {
      return 0;
    }
    return getTimeAgoFromManualInput(selectedTime);
  };

  const handleTimeAdjustment = (minutes: number) => {
    if (!selectedTime) {
      return;
    }

    const newTime = addMinutesToTime(selectedTime, minutes);
    setSelectedTime(newTime);
  };

  // Determine the action text based on sleep state
  const actionText = isSleeping ? "wake up" : "fall asleep";
  const displayName = babyName || "baby";
  const modalTitle = `When did ${displayName} ${actionText}?`;

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

          {/* Time Selection - Large centered input */}
          <div className="space-y-1">
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <input
                  ref={timeInputRef}
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="text-center text-4xl font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg px-4 py-2"
                />
                <Edit2
                  className="w-5 h-5 opacity-40 cursor-pointer"
                  onClick={() => timeInputRef.current?.focus()}
                />
              </div>
              <div className="text-sm opacity-70">
                {selectedTime ? (() => {
                  const timeAgo = getTimeAgoFromSelectedTime();
                  if (timeAgo === 0) {
                    return "Now";
                  } else if (timeAgo < 0) {
                    return `${Math.abs(timeAgo)} minutes in future`;
                  } else {
                    return `${timeAgo} minutes ago`;
                  }
                })() : "Select time"}
              </div>
            </div>
          </div>

          {/* Time adjustment buttons */}
          <div className="flex justify-center gap-1">
            <Button
              outline
              rounded
              small
              onClick={() => handleTimeAdjustment(-10)}
            >
              -10 min
            </Button>
            <Button
              outline
              rounded
              small
              onClick={() => handleTimeAdjustment(-5)}
            >
              -5 min
            </Button>
            <Button
              outline
              rounded
              small
              onClick={() => handleTimeAdjustment(5)}
            >
              +5 min
            </Button>
            <Button
              outline
              rounded
              small
              onClick={() => handleTimeAdjustment(10)}
            >
              +10 min
            </Button>
          </div>

          {/* Cycle Selection */}
          <div className="space-y-2">
            <div className="text-sm opacity-70 text-center">Day or night cycle?</div>
            <Segmented rounded strong>
              <SegmentedButton
                active={cycle === "Day"}
                onClick={() => setCycle("Day")}
              >
                Day
              </SegmentedButton>
              <SegmentedButton
                active={cycle === "Night"}
                onClick={() => setCycle("Night")}
              >
                Night
              </SegmentedButton>
            </Segmented>
          </div>

          {/* Confirm Button */}
          <div className="mt-8">
            <Button large rounded onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? "Saving..." : "Confirm"}
            </Button>
          </div>
        </div>
      </Block>
    </Sheet>
  );
}
