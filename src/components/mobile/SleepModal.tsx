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
} from "konsta/react";
import { X } from "lucide-react";
import { formatTimeAgoLabel, getTimeAgo } from "~/lib/date-utils";

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
  const [timeAgo, setTimeAgo] = useState(0); // 0 = now, 30 = 30 min ago
  const [cycle, setCycle] = useState<"Day" | "Night">(currentCycle);

  // Reset state when modal opens to fix Range slider positioning
  useEffect(() => {
    if (opened) {
      setTimeAgo(0);
      setCycle(currentCycle);
    }
  }, [opened, currentCycle]);

  const handleConfirm = () => {
    onConfirm(timeAgo, cycle);
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

          {/* Time Selection with Range Slider */}
          <div className="space-y-4">
            {/* <div className="flex items-center justify-between text-sm opacity-70 px-1">
              <span>30 min ago</span>
              <span>Now</span>
            </div> */}

            <List strong inset>
              <ListItem
                innerClassName="flex items-center"
                innerChildren={
                  <Range
                    value={30 - timeAgo} // Invert so right side is "now"
                    min={0}
                    max={30}
                    step={1}
                    onChange={(e) => setTimeAgo(30 - parseInt(e.target.value, 10))}
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
