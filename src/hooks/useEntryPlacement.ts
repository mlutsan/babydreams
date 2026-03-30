import { useCallback } from "react";
import type { Dayjs } from "dayjs";
import { useAtomValue } from "jotai";
import { cycleSettingsAtom } from "~/lib/atoms";
import { commitPlacement, resolvePlacement, resolveSleepPlacement } from "~/lib/entry-placement";
import { useLogicalDays } from "~/hooks/useLogicalDays";
import { useMinuteTick } from "~/hooks/useMinuteTick";
import type { PlacementDecision, SleepPlacementDecision } from "~/lib/entry-placement";

type ResolveParams = {
  datetime: Dayjs;
  boundaryMinutes?: number;
  now?: Dayjs;
};

type CommitParams = ResolveParams & {
  overrideLogicalDate?: string | null;
};

export type UseEntryPlacementResult = {
  resolvePlacement: (params: ResolveParams) => PlacementDecision;
  resolveSleepPlacement: (params: ResolveParams) => SleepPlacementDecision;
  commitPlacement: (params: CommitParams) => Dayjs;
  isLoading: boolean;
  isHydrated: boolean;
};

export function useEntryPlacement(): UseEntryPlacementResult {
  const { logicalDays, isLoading, isHydrated } = useLogicalDays();
  const cycleSettings = useAtomValue(cycleSettingsAtom);
  const now = useMinuteTick();

  const resolvePlacementWithData = useCallback(
    ({ datetime, boundaryMinutes, now: overrideNow }: ResolveParams) =>
      resolvePlacement({
        datetime,
        logicalDays,
        dayStart: cycleSettings.dayStart,
        now: overrideNow ?? now,
        boundaryMinutes,
      }),
    [logicalDays, cycleSettings.dayStart, now]
  );

  const commitPlacementWithData = useCallback(
    ({ datetime, boundaryMinutes, overrideLogicalDate, now: overrideNow }: CommitParams) =>
      commitPlacement({
        datetime,
        logicalDays,
        dayStart: cycleSettings.dayStart,
        now: overrideNow ?? now,
        boundaryMinutes,
        overrideLogicalDate,
      }),
    [logicalDays, cycleSettings.dayStart, now]
  );

  const resolveSleepPlacementWithData = useCallback(
    ({ datetime, boundaryMinutes, now: overrideNow }: ResolveParams) =>
      resolveSleepPlacement({
        datetime,
        logicalDays,
        dayStart: cycleSettings.dayStart,
        now: overrideNow ?? now,
        boundaryMinutes,
      }),
    [logicalDays, cycleSettings.dayStart, now]
  );

  return {
    resolvePlacement: resolvePlacementWithData,
    resolveSleepPlacement: resolveSleepPlacementWithData,
    commitPlacement: commitPlacementWithData,
    isLoading,
    isHydrated,
  };
}
