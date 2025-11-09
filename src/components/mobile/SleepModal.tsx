import { useState, useEffect } from "react";
import {
  Sheet,
  Toolbar,
  ToolbarPane,
  Link,
  Block,
  Button,
  Segmented,
  SegmentedButton,
  Range,
  List,
  ListItem,
  ListInput,
} from "konsta/react";
import { X, Clock } from "lucide-react";
import { formatTimeAgoLabel, getTimeAgo, timeToMinutes } from "~/lib/date-utils";
import dayjs from "dayjs";

interface SleepModalProps {
  opened: boolean;
  onClose: () => void;
  currentState: "Sleep" | "Wake" | null;
  currentCycle: "Day" | "Night";
  onConfirm: (timeAgo: number, cycle: "Day" | "Night") => void;
}

export function SleepModal({
  opened,
  onClose,
  currentState,
  currentCycle,
  onConfirm,
}: SleepModalProps) {
  const [inputMode, setInputMode] = useState<"quick" | "manual">("quick");
  const [timeAgo, setTimeAgo] = useState(0); // 0 = now, 30 = 30 min ago
  const [manualTime, setManualTime] = useState("");
  const [cycle, setCycle] = useState<"Day" | "Night">(currentCycle);

  // Reset state when modal opens to fix Range slider positioning
  useEffect(() => {
    if (opened) {
      setInputMode("quick");
      setTimeAgo(0);
      setManualTime("");
      setCycle(currentCycle);
    }
  }, [opened, currentCycle]);

  // Calculate timeAgo from manual time input
  const getTimeAgoFromManualInput = (time: string): number => {
    if (!time) {
      return 0;
    }

    const now = dayjs();
    const currentMinutes = now.hour() * 60 + now.minute();
    const inputMinutes = timeToMinutes(time);

    let diff = currentMinutes - inputMinutes;

    // If negative, the time is from yesterday (crossed midnight)
    if (diff < 0) {
      diff += 24 * 60;
    }

    return diff;
  };

  const handleConfirm = () => {
    const calculatedTimeAgo = inputMode === "manual" && manualTime
      ? getTimeAgoFromManualInput(manualTime)
      : timeAgo;

    onConfirm(calculatedTimeAgo, cycle);
  };

  // Determine the action text based on current state
  const actionText = currentState === "Sleep" ? "wake up" : "fall asleep";
  const modalTitle = `When did baby ${actionText}?`;

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
        <div className="space-y-6">
          {/* Title */}
          <div className="text-center">
            <h3 className="text-xl font-semibold">{modalTitle}</h3>
          </div>

          {/* Input Mode Toggle */}
          <div className="space-y-2">
            <div className="text-sm opacity-70 text-center">Time input method</div>
            <Segmented rounded strong>
              <SegmentedButton
                active={inputMode === "quick"}
                onClick={() => setInputMode("quick")}
              >
                Quick
              </SegmentedButton>
              <SegmentedButton
                active={inputMode === "manual"}
                onClick={() => setInputMode("manual")}
              >
                <Clock className="w-4 h-4 mr-1 inline" />
                Manual
              </SegmentedButton>
            </Segmented>
          </div>

          {/* Time Selection - Quick Mode (Slider) */}
          {inputMode === "quick" && (
            <div className="space-y-4">
              <List strong inset>
                <ListItem
                  innerClassName="flex items-center"
                  innerChildren={
                    <Range
                      value={60 - timeAgo} // Invert so right side is "now"
                      min={0}
                      max={60}
                      step={1}
                      onChange={(e) => setTimeAgo(60 - parseInt(e.target.value, 10))}
                    />
                  }
                />
              </List>

              <div className="text-center text-lg font-medium">
                {formatTimeAgoLabel(timeAgo)}
                <span className="text-sm opacity-70 ml-2">
                  ({getTimeAgo(timeAgo)})
                </span>
              </div>
            </div>
          )}

          {/* Time Selection - Manual Mode (Time Input) */}
          {inputMode === "manual" && (
            <div className="space-y-4">
              <List strong inset>
                <ListInput
                  label="Time"
                  type="time"
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                  placeholder="HH:MM"
                  info={manualTime ? `${getTimeAgoFromManualInput(manualTime)} minutes ago` : "Enter exact time"}
                />
              </List>

              {manualTime && (
                <div className="text-center text-lg font-medium">
                  {formatTimeAgoLabel(getTimeAgoFromManualInput(manualTime))}
                  <span className="text-sm opacity-70 ml-2">
                    (at {manualTime})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Cycle Selection */}
          <div className="space-y-2">
            <div className="text-sm opacity-70 text-center">Is it his day or night cycle?</div>
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
            <Button large rounded onClick={handleConfirm}>
              Confirm
            </Button>
          </div>
        </div>
      </Block>
    </Sheet>
  );
}
