import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { systemClock } from "~/lib/clock";
import type { Clock } from "~/lib/clock";

const ClockContext = createContext<Clock>(systemClock);

export function ClockProvider({
  clock = systemClock,
  children,
}: {
  clock?: Clock;
  children: ReactNode;
}) {
  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>;
}

export function useClock(): Clock {
  return useContext(ClockContext);
}
