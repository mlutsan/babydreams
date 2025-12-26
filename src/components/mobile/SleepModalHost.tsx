import { useAtom } from "jotai";
import { sleepModalAtom } from "~/lib/atoms";
import { SleepModal } from "~/components/mobile/SleepModal";
import { useTodaySleepStat } from "~/hooks/useSleepHistory";

export function SleepModalHost() {
  const [modalState, setModalState] = useAtom(sleepModalAtom);
  const { sleepState } = useTodaySleepStat();

  const handleClose = () => {
    setModalState({
      open: false,
      mode: "track",
      entry: null,
      initialDate: null,
      allowActiveToggle: false,
    });
  };

  return (
    <SleepModal
      opened={modalState.open}
      onClose={handleClose}
      mode={modalState.mode}
      entry={modalState.entry ?? undefined}
      initialDate={modalState.initialDate ?? undefined}
      allowActiveToggle={modalState.allowActiveToggle}
      isSleeping={modalState.mode === "track" ? sleepState?.isActive ?? false : undefined}
    />
  );
}
