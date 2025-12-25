import { ReactNode, useEffect } from "react";
import { Preloader } from "konsta/react";
import { usePullToRefresh } from "~/hooks/usePullToRefresh";

interface PullToRefreshProps {
  children: ReactNode;
  /**
   * Query keys to invalidate on refresh
   */
  queryKeys?: string[][];
  /**
   * Custom refresh callback
   */
  onRefresh?: () => Promise<void> | void;
  /**
   * Minimum distance (in pixels) to trigger refresh
   * @default 85
   */
  threshold?: number;
  /**
   * Whether pull-to-refresh is enabled
   * @default true
   */
  enabled?: boolean;
  /**
   * Reset scroll position when this key changes
   */
  resetScrollKey?: string;
}

/**
 * Wrapper component that adds pull-to-refresh functionality
 * Displays a loading spinner when pulling down
 */
export function PullToRefresh({
  children,
  queryKeys,
  onRefresh,
  threshold = 85,
  enabled = true,
  resetScrollKey,
}: PullToRefreshProps) {
  const { containerRef, pullChange, isRefreshing } = usePullToRefresh({
    threshold,
    queryKeys,
    onRefresh,
    enabled,
  });

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [resetScrollKey, containerRef]);

  // Calculate opacity and rotation for visual feedback
  const progress = Math.min(pullChange / threshold, 1);
  const rotation = progress * 360;

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-auto relative"
      style={{
        overscrollBehaviorY: "contain",
      }}
    >
      {/* Pull indicator - positioned absolutely to avoid stacking context issues */}
      {(pullChange > 0 || isRefreshing) && (
        <div
          className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none z-10"
          style={{
            height: isRefreshing ? 60 : Math.min(pullChange / 3, 60),
            opacity: isRefreshing ? 1 : progress,
            marginTop: isRefreshing ? 0 : -20,
            transition: isRefreshing ? "all 0.3s ease-out" : "none",
          }}
        >
          <div
            style={{
              transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
            }}
          >
            <Preloader />
          </div>
        </div>
      )}

      {/* Content - NO transform to avoid breaking fixed positioning */}
      <div
        style={{
          paddingTop: isRefreshing ? 60 : Math.min(pullChange / 5, 15),
          transition: isRefreshing ? "padding-top 0.3s ease-out" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
