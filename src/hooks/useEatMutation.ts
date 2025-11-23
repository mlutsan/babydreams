import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addEatEntry } from "~/lib/eat-service";
import { useToast } from "~/hooks/useToast";

/**
 * Reusable hook for eating/meal tracking mutations
 * Handles success/error toasts and cache invalidation
 */
export function useEatMutation() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: addEatEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eatHistory"] });
      success("Meal recorded successfully!");
    },
    onError: (err) => {
      error("Failed to record meal", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });
}
