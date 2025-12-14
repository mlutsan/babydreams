import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addEatEntry } from "~/lib/eat-service";
import { useToast } from "~/hooks/useToast";

/**
 * Reusable hook for eating/meal tracking mutations
 * Handles cache invalidation and error feedback
 */
export function useEatMutation() {
  const queryClient = useQueryClient();
  const { error } = useToast();

  return useMutation({
    mutationFn: addEatEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eatHistory"] });
    },
    onError: (err) => {
      error("Failed to record meal", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });
}
