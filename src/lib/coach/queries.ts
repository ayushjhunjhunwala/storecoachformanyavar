import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCardStatuses, getView } from "./coach.functions";
import type { ViewProfile } from "./types";
import { fetchViewProfile } from "./profile";

export const viewQueryOptions = (date: string) =>
  queryOptions({
    queryKey: ["coach-view", date],
    queryFn: () => getView({ data: { date } }),
    staleTime: 10 * 60_000,
    retry: (count, error) => !/forbidden|no store coach|403/i.test(String(error)) && count < 2,
  });

export const profileQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["coach-profile", userId],
    queryFn: (): Promise<ViewProfile | null> => fetchViewProfile(supabase, userId),
    staleTime: Infinity,
  });

export const chatHistoryQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["coach-chat", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, question, answer, replay_date, provider, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return [...(data ?? [])].reverse();
    },
    staleTime: 60_000,
  });

export const cardStatusQueryOptions = (date: string) =>
  queryOptions({
    queryKey: ["card-status", date],
    queryFn: () => getCardStatuses({ data: { date } }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
