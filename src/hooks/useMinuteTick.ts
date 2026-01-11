import { useAtomValue } from "jotai";
import { minuteTickAtom } from "~/lib/atoms";

export function useMinuteTick() {
  return useAtomValue(minuteTickAtom);
}
