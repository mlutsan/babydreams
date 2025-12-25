import { useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import {
  Sheet,
  Toolbar,
  ToolbarPane,
  Link,
  Block,
  Button,
  Toggle,
  Segmented,
  SegmentedButton,
} from "konsta/react";
import { X, Edit2, Trash2 } from "lucide-react";
import { addMinutesToTime, getTimeAgoFromManualInput } from "~/lib/date-utils";
import { babyNameAtom, sheetUrlAtom, cycleSettingsAtom, calculateCycleFromTime } from "~/lib/atoms";
import { useTodaySleepStat } from "~/hooks/useSleepHistory";
import { useSleepMutation } from "~/hooks/useSleepMutation";
import { addSleepEntryManual, updateSleepEntry, deleteSleepEntry } from "~/lib/sleep-service";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "~/hooks/useToast";
import dayjs from "dayjs";
import type { SleepEntry } from "~/types/sleep";

type SleepModalMode = "track" | "edit" | "add";

interface SleepModalProps {
  opened: boolean;
  onClose: () => void;
  isSleeping?: boolean;
  mode?: SleepModalMode;
  entry?: SleepEntry;
  initialDate?: dayjs.Dayjs;
  allowActiveToggle?: boolean;
}

interface SleepTrackFormProps {
  selectedTime: string;
  cycle: "Day" | "Night";
  isSleeping: boolean;
  isSaving: boolean;
  onTimeChange: (value: string) => void;
  onCycleChange: (value: "Day" | "Night") => void;
  onAdjustTime: (minutes: number) => void;
  onConfirm: () => void;
}

function SleepTrackForm({
  selectedTime,
  cycle,
  isSleeping,
  isSaving,
  onTimeChange,
  onCycleChange,
  onAdjustTime,
  onConfirm,
}: SleepTrackFormProps) {
  const timeInputRef = useRef<HTMLInputElement>(null);

  const getTimeAgoFromSelectedTime = (): number => {
    if (!selectedTime) {
      return 0;
    }
    return getTimeAgoFromManualInput(selectedTime);
  };

  return (
    <>
      <div className="space-y-1">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <input
              ref={timeInputRef}
              type="time"
              value={selectedTime}
              onChange={(e) => onTimeChange(e.target.value)}
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

      <div className="flex justify-center gap-1">
        <Button
          outline
          rounded
          small
          onClick={() => onAdjustTime(-10)}
        >
          -10 min
        </Button>
        <Button
          outline
          rounded
          small
          onClick={() => onAdjustTime(-5)}
        >
          -5 min
        </Button>
        <Button
          outline
          rounded
          small
          onClick={() => onAdjustTime(5)}
        >
          +5 min
        </Button>
        <Button
          outline
          rounded
          small
          onClick={() => onAdjustTime(10)}
        >
          +10 min
        </Button>
      </div>

      {!isSleeping && (
        <div className="space-y-2">
          <div className="text-sm opacity-70 text-center">Day or night cycle?</div>
          <Segmented rounded strong>
            <SegmentedButton
              active={cycle === "Day"}
              onClick={() => onCycleChange("Day")}
            >
              Day
            </SegmentedButton>
            <SegmentedButton
              active={cycle === "Night"}
              onClick={() => onCycleChange("Night")}
            >
              Night
            </SegmentedButton>
          </Segmented>
        </div>
      )}

      <div className="mt-8">
        <Button large rounded onClick={onConfirm} disabled={isSaving}>
          {isSaving ? "Saving..." : "Confirm"}
        </Button>
      </div>
    </>
  );
}

interface SleepEditFormProps {
  startTime: string;
  endTime: string;
  cycle: "Day" | "Night";
  isActive: boolean;
  allowActiveToggle: boolean;
  isSaving: boolean;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onCycleChange: (value: "Day" | "Night") => void;
  onActiveToggle: (value: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
}

function SleepEditForm({
  startTime,
  endTime,
  cycle,
  isActive,
  allowActiveToggle,
  isSaving,
  onStartTimeChange,
  onEndTimeChange,
  onCycleChange,
  onActiveToggle,
  onSave,
}: SleepEditFormProps) {
  const canSave = startTime !== "" && (isActive || endTime !== "");

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="text-xs opacity-70">Start</div>
          <input
            type="time"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-base"
          />
        </div>
        <div className="space-y-1">
          <div className="text-xs opacity-70">End</div>
          <input
            type="time"
            value={endTime}
            onChange={(e) => onEndTimeChange(e.target.value)}
            disabled={isActive}
            className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-base disabled:opacity-60"
          />
        </div>
      </div>
      {allowActiveToggle ? (
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Still sleeping</span>
          <Toggle
            checked={isActive}
            onChange={(e) => onActiveToggle(e.target.checked)}
          />
        </div>
      ) : null}

      <Segmented rounded strong>
        <SegmentedButton
          active={cycle === "Day"}
          onClick={() => onCycleChange("Day")}
        >
          Day
        </SegmentedButton>
        <SegmentedButton
          active={cycle === "Night"}
          onClick={() => onCycleChange("Night")}
        >
          Night
        </SegmentedButton>
      </Segmented>

      <div className="flex justify-end gap-2">
        <Button
          large
          rounded
          onClick={onSave}
          disabled={!canSave || isSaving}
        >
          Save
        </Button>
      </div>
    </>
  );
}

export function SleepModal({
  opened,
  onClose,
  isSleeping,
  mode,
  entry,
  initialDate,
  allowActiveToggle = false,
}: SleepModalProps) {
  const babyName = useAtomValue(babyNameAtom);
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const cycleSettings = useAtomValue(cycleSettingsAtom);
  const { todayStat } = useTodaySleepStat();
  const mutation = useSleepMutation();
  const queryClient = useQueryClient();
  const { error } = useToast();

  const resolvedMode: SleepModalMode = mode ?? (entry ? "edit" : "track");
  const isTrackMode = resolvedMode === "track";
  const isEditMode = resolvedMode === "edit";
  const isAddMode = resolvedMode === "add";

  const [selectedTime, setSelectedTime] = useState("");
  const [trackCycle, setTrackCycle] = useState<"Day" | "Night">("Day");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [editCycle, setEditCycle] = useState<"Day" | "Night">("Day");
  const [isActive, setIsActive] = useState(false);

  const addMutation = useMutation({
    mutationFn: addSleepEntryManual,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
      onClose();
    },
    onError: (err) => {
      error("Failed to add sleep entry", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateSleepEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
      onClose();
    },
    onError: (err) => {
      error("Failed to update sleep entry", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSleepEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
      onClose();
    },
    onError: (err) => {
      error("Failed to delete sleep entry", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });

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

  useEffect(() => {
    if (!opened) {
      return;
    }

    if (isTrackMode) {
      const now = dayjs().format("HH:mm");
      setSelectedTime(now);
      setTrackCycle(calculateCycleFromTime(now, cycleSettings));
      return;
    }

    const defaultStartTime = entry
      ? entry.startTime.format("HH:mm")
      : dayjs().format("HH:mm");
    const defaultEndTime = entry?.endTime ? entry.endTime.format("HH:mm") : "";
    const defaultCycle = entry
      ? entry.cycle
      : calculateCycleFromTime(defaultStartTime, cycleSettings);

    setStartTime(defaultStartTime);
    setEndTime(defaultEndTime);
    setEditCycle(defaultCycle);
    setIsActive(isEditMode && allowActiveToggle && defaultEndTime === "");
  }, [opened, isTrackMode, isEditMode, entry, cycleSettings, allowActiveToggle]);

  useEffect(() => {
    if (isTrackMode && selectedTime) {
      const autoCycle = calculateCycleFromTime(selectedTime, cycleSettings);
      setTrackCycle(autoCycle);
    }
  }, [selectedTime, cycleSettings, isTrackMode]);

  useEffect(() => {
    if (!allowActiveToggle) {
      setIsActive(false);
    }
  }, [allowActiveToggle]);

  useEffect(() => {
    if (isActive) {
      setEndTime("");
    }
  }, [isActive]);

  const handleConfirm = () => {
    if (!selectedTime || !sheetUrl) {
      return;
    }

    mutation.mutate(
      {
        sheetUrl,
        time: selectedTime,
        cycle: trackCycle,
        what: isSleeping ? "Awake" : "Sleep",
        todayStat: todayStat || null,
      },
      {
        onSuccess: onClose,
      }
    );
  };

  const handleSave = () => {
    if (!sheetUrl) {
      error("Missing sheet URL");
      return;
    }

    if (!startTime || (!isActive && !endTime)) {
      return;
    }

    if (isEditMode) {
      if (!entry?.sheetRowIndex) {
        error("Missing row index for update");
        return;
      }
      updateMutation.mutate({
        sheetUrl,
        rowIndex: entry.sheetRowIndex,
        date: entry.date,
        startTime,
        endTime: isActive ? "" : endTime,
        cycle: editCycle,
      });
      return;
    }

    if (isAddMode) {
      if (!initialDate) {
        error("Missing date for new entry");
        return;
      }
      addMutation.mutate({
        sheetUrl,
        date: initialDate,
        startTime,
        endTime: isActive ? "" : endTime,
        cycle: editCycle,
      });
    }
  };

  const handleDelete = () => {
    if (!entry?.sheetRowIndex || !sheetUrl) {
      error("Missing row index for deletion");
      return;
    }
    if (!window.confirm("Delete this sleep entry?")) {
      return;
    }
    deleteMutation.mutate({ sheetUrl, rowIndex: entry.sheetRowIndex });
  };

  const handleTimeAdjustment = (minutes: number) => {
    if (!selectedTime) {
      return;
    }

    const newTime = addMinutesToTime(selectedTime, minutes);
    setSelectedTime(newTime);
  };

  const actionText = isSleeping ? "wake up" : "fall asleep";
  const displayName = babyName || "baby";
  const modalTitle = isTrackMode
    ? `When did ${displayName} ${actionText}?`
    : isEditMode
      ? "Edit sleep entry"
      : "Add sleep entry";

  const dateLabel = isTrackMode
    ? null
    : entry?.date.format("MMM D, YYYY")
    ?? initialDate?.format("MMM D, YYYY")
    ?? null;

  const isSaving = mutation.isPending || addMutation.isPending || updateMutation.isPending;

  return (
    <Sheet
      className="pb-safe"
      opened={opened}
      onBackdropClick={onClose}
    >
      <Toolbar top className="justify-between flex-row-reverse ios:pt-4" innerClassName={isEditMode ? "w-full" : ""}>
        {isEditMode && <ToolbarPane>
          <Link
            iconOnly
            onClick={handleDelete}
            className="text-red-600"
            aria-label="Delete entry"
          >
            <Trash2 className="w-6 h-6" />
          </Link>
        </ToolbarPane>}
        <ToolbarPane className="self-end">
          <Link iconOnly onClick={onClose}>
            <X className="w-6 h-6" />
          </Link>
        </ToolbarPane>
      </Toolbar>

      <Block className="ios:mt-4">
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-xl font-semibold">{modalTitle}</h3>
            {dateLabel ? (
              <div className="text-sm opacity-70 mt-1">{dateLabel}</div>
            ) : null}
          </div>

          {isTrackMode ? (
            <SleepTrackForm
              selectedTime={selectedTime}
              cycle={trackCycle}
              isSleeping={!!isSleeping}
              isSaving={mutation.isPending}
              onTimeChange={setSelectedTime}
              onCycleChange={setTrackCycle}
              onAdjustTime={handleTimeAdjustment}
              onConfirm={handleConfirm}
            />
          ) : (
            <SleepEditForm
              startTime={startTime}
              endTime={endTime}
              cycle={editCycle}
              isActive={isActive}
              allowActiveToggle={allowActiveToggle}
              isSaving={isSaving}
              onStartTimeChange={setStartTime}
              onEndTimeChange={setEndTime}
              onCycleChange={setEditCycle}
              onActiveToggle={setIsActive}
              onSave={handleSave}
              onCancel={onClose}
            />
          )}
        </div>
      </Block>
    </Sheet>
  );
}
