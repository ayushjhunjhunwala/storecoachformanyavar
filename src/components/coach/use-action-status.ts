import { useCallback } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const authed = getRouteApi("/_authenticated");

type StatusMap = Record<string, string>;

export const actionStatusQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["action-status", userId],
    queryFn: async (): Promise<StatusMap> => {
      const { data, error } = await supabase.from("action_status").select("item_key, status").eq("user_id", userId);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.item_key, r.status]));
    },
    staleTime: 5 * 60_000,
  });

function useStatusMutation(userId: string) {
  const queryClient = useQueryClient();
  const options = actionStatusQueryOptions(userId);
  return useMutation({
    mutationFn: async ({ key, next }: { key: string; next: string | null }) => {
      if (next === null) {
        const { error } = await supabase.from("action_status").delete().eq("user_id", userId).eq("item_key", key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("action_status")
          .upsert(
            { user_id: userId, item_key: key, status: next, updated_at: new Date().toISOString() },
            { onConflict: "user_id,item_key" },
          );
        if (error) throw error;
      }
    },
    onMutate: async ({ key, next }) => {
      await queryClient.cancelQueries({ queryKey: options.queryKey });
      const previous = queryClient.getQueryData<StatusMap>(options.queryKey);
      queryClient.setQueryData<StatusMap>(options.queryKey, (old) => {
        const copy = { ...(old ?? {}) };
        if (next === null) delete copy[key];
        else copy[key] = next;
        return copy;
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(options.queryKey, context.previous);
      toast.error("That didn't save. Check your connection and try again.");
    },
  });
}

/**
 * A tick saved to the signed-in person's account (Mark done, Dismiss, Done, Not today,
 * callback outcomes). Updates instantly and rolls back with a message if saving fails.
 */
export function useActionStatus<T extends string>(itemKey: string) {
  const { userId } = authed.useRouteContext();
  const { data } = useQuery(actionStatusQueryOptions(userId));
  const mutation = useStatusMutation(userId);
  const status = (data?.[itemKey] as T | undefined) ?? null;
  const { mutate } = mutation;
  const setStatus = useCallback((next: T | null) => mutate({ key: itemKey, next }), [mutate, itemKey]);
  return [status, setStatus, mutation.isPending] as const;
}

/** Every tick whose key starts with a prefix, plus a setter for any key. */
export function useActionStatusGroup(prefix: string) {
  const { userId } = authed.useRouteContext();
  const { data } = useQuery(actionStatusQueryOptions(userId));
  const mutation = useStatusMutation(userId);
  const entries = Object.fromEntries(
    Object.entries(data ?? {})
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => [k.slice(prefix.length), v]),
  );
  const { mutateAsync } = mutation;
  /** Resolves true once the server has stored it, false if it failed (the failure is already shown). */
  const set = useCallback(
    (suffix: string, next: string | null): Promise<boolean> =>
      mutateAsync({ key: prefix + suffix, next }).then(
        () => true,
        () => false,
      ),
    [mutateAsync, prefix],
  );
  return [entries, set] as const;
}

/** Item keys, kept in one place so every screen reads the same tick. */
export const statusKey = {
  issue: (issueId: string) => `issue:${issueId}`,
  card: (date: string, salespersonId: string) => `card:${date}:${salespersonId}`,
  callback: (storeId: string, cust: string, date: string) => `callback:${storeId}:${cust}:${date}`,
  mentors: (storeId: string, date: string) => `mentors:${storeId}:${date}`,
  /** Prefix; the suffix is the learner's salesperson id and the value the new mentor's id. */
  mentorSwaps: (storeId: string, date: string) => `mentor-swap:${storeId}:${date}:`,
};
