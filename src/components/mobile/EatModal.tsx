/**
 * Modal for adding a meal entry
 * Shows volume slider (0-200ml)
 */

import { useState } from "react";
import { useAtomValue } from "jotai";
import { Sheet, Button, Range, Block, Toolbar, ToolbarPane, Link } from "konsta/react";
import { X } from "lucide-react";
import { babyNameAtom } from "~/lib/atoms";

interface EatModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (volume: number) => void;
  isLoading?: boolean; // Is data being saved?
}

export function EatModal({ opened, onClose, onConfirm, isLoading = false }: EatModalProps) {
  const babyName = useAtomValue(babyNameAtom);
  const [volume, setVolume] = useState(100); // Default 100ml

  const displayName = babyName || "baby";
  const modalTitle = `How much did ${displayName} eat?`;

  const handleConfirm = () => {
    onConfirm(volume);
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

          {/* Volume Slider */}
          <div className="space-y-2">
            <div className="text-sm opacity-70 flex justify-between">
              <span>0 ml</span>
              <span>200 ml</span>
            </div>
            <Range
              value={volume}
              min={0}
              max={200}
              step={10}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="k-color-amber-500"
            />
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


          {/* Confirm Button */}
          <div className="mt-8">
            <Button
              large
              rounded
              onClick={handleConfirm}
              disabled={isLoading}
              className="bg-amber-500 active:bg-amber-600"
            >
              {isLoading ? "Saving..." : "Confirm"}
            </Button>
          </div>
        </div>
      </Block>
    </Sheet>
  );
}
