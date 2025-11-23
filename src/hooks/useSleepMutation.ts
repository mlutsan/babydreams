import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addSleepEntry } from "~/lib/sleep-service";
import { useToast } from "~/hooks/useToast";

/**
 * Reusable hook for sleep tracking mutations
 * Handles success/error toasts and cache invalidation
 */
export function useSleepMutation() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: addSleepEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
      success("Sleep tracked successfully!");
    },
    onError: (err) => {
      error("Failed to track sleep", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });
}
