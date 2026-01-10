import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toggleSleep } from "~/lib/sleep-service";
import { useToast } from "~/hooks/useToast";

/**
 * Reusable hook for sleep tracking mutations
 * Handles cache invalidation and error feedback
 */
export function useSleepMutation() {
  const queryClient = useQueryClient();
  const { error } = useToast();

  return useMutation({
    mutationFn: toggleSleep,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
    },
    onError: (err) => {
      error("Failed to track sleep", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });
}
