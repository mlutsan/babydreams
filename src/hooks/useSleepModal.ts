import { useSetAtom } from "jotai";
import type { Dayjs } from "dayjs";
import type { SleepEntry } from "~/types/sleep";
import { sleepModalAtom } from "~/lib/atoms";

export function useSleepModal() {
  const setModalState = useSetAtom(sleepModalAtom);

  const openTrack = () => {
    setModalState({
      open: true,
      mode: "track",
      entry: null,
      initialDate: null,
      allowActiveToggle: false,
    });
  };

  const openAdd = (date: Dayjs, allowActiveToggle = false) => {
    setModalState({
      open: true,
      mode: "add",
      entry: null,
      initialDate: date,
      allowActiveToggle,
    });
  };

  const openEdit = (entry: SleepEntry, allowActiveToggle = false) => {
    setModalState({
      open: true,
      mode: "edit",
      entry,
      initialDate: null,
      allowActiveToggle,
    });
  };

  const close = () => {
    setModalState({
      open: false,
      mode: "track",
      entry: null,
      initialDate: null,
      allowActiveToggle: false,
    });
  };

  return {
    openTrack,
    openAdd,
    openEdit,
    close,
  };
}
