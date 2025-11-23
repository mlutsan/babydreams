import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface UsePullToRefreshOptions {
  /**
   * Minimum distance (in pixels) to trigger refresh
   * @default 120
   */
  threshold?: number;
  /**
   * Query keys to invalidate on refresh
   * If not provided, all queries will be invalidated
   */
  queryKeys?: string[][];
  /**
   * Callback function to run on refresh
   */
  onRefresh?: () => Promise<void> | void;
}

/**
 * Hook for implementing pull-to-refresh functionality
 * Integrates with TanStack Query to invalidate queries
 */
export function usePullToRefresh(options: UsePullToRefreshOptions = {}) {
  const { threshold = 120, queryKeys, onRefresh } = options;
  const queryClient = useQueryClient();

  const [startPoint, setStartPoint] = useState(0);
  const [pullChange, setPullChange] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start if scrolled to top
      if (container.scrollTop === 0) {
        setStartPoint(e.touches[0].pageY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startPoint === 0 || isRefreshing) return;

      const currentPoint = e.touches[0].pageY;
      const pullDistance = currentPoint - startPoint;

      // Only allow pulling down when at top
      if (pullDistance > 0 && container.scrollTop === 0) {
        setPullChange(pullDistance);
      }
    };

    const handleTouchEnd = async () => {
      if (pullChange > threshold && !isRefreshing) {
        setIsRefreshing(true);

        try {
          // Call custom refresh callback if provided
          if (onRefresh) {
            await onRefresh();
          }

          // Invalidate queries
          if (queryKeys && queryKeys.length > 0) {
            await Promise.all(
              queryKeys.map((key) =>
                queryClient.invalidateQueries({ queryKey: key })
              )
            );
          } else {
            // Invalidate all queries if no specific keys provided
            await queryClient.invalidateQueries();
          }
        } finally {
          // Reset state after refresh completes
          setTimeout(() => {
            setIsRefreshing(false);
            setPullChange(0);
            setStartPoint(0);
          }, 300);
        }
      } else {
        // Reset if threshold not met
        setPullChange(0);
        setStartPoint(0);
      }
    };

    container.addEventListener("touchstart", handleTouchStart);
    container.addEventListener("touchmove", handleTouchMove);
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [startPoint, pullChange, threshold, isRefreshing, queryClient, queryKeys, onRefresh]);

  return {
    containerRef,
    pullChange,
    isRefreshing,
    isPulling: pullChange > 0,
  };
}
