/**
 * Modal for adding a feeding entry
 * Shows volume slider (0-200ml)
 */

import { useState } from "react";
import { Sheet, Button, Range, Block } from "konsta/react";

interface EatModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (volume: number) => void;
}

export function EatModal({ opened, onClose, onConfirm }: EatModalProps) {
  const [volume, setVolume] = useState(100); // Default 100ml

  const handleConfirm = () => {
    onConfirm(volume);
  };

  return (
    <Sheet
      className="pb-safe"
      opened={opened}
      onBackdropClick={onClose}
    >
      <div className="p-4">
        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">Add Feeding</h2>
        </div>

        {/* Volume Display */}
        <div className="text-center mb-8">
          <div className="text-6xl font-bold text-amber-600">
            {volume}
          </div>
          <div className="text-xl text-gray-600 dark:text-gray-400 mt-2">
            ml
          </div>
        </div>

        {/* Volume Slider */}
        <Block className="mb-6">
          <div className="mb-2 text-sm text-gray-600 dark:text-gray-400 flex justify-between">
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
        </Block>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            large
            rounded
            outline
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            large
            rounded
            onClick={handleConfirm}
            className="bg-amber-500 active:bg-amber-600"
          >
            Confirm
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
