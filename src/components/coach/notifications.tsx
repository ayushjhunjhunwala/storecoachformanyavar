import { Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export const notificationsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["notifications", userId],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, title, body, link, read_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
    staleTime: 20_000,
  });

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function NotificationsBell({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const options = notificationsQueryOptions(userId);
  const { data = [], isError, refetch } = useQuery(options);
  const unread = data.filter((n) => !n.read_at).length;

  const mark = useMutation({
    mutationFn: async (ids: string[] | "all") => {
      const now = new Date().toISOString();
      let q = supabase.from("notifications").update({ read_at: now }).eq("user_id", userId).is("read_at", null);
      if (ids !== "all") q = q.in("id", ids);
      const { error } = await q;
      if (error) throw error;
      return now;
    },
    onSuccess: (now, ids) => {
      queryClient.setQueryData<NotificationRow[]>(options.queryKey, (old) =>
        (old ?? []).map((n) => (!n.read_at && (ids === "all" || ids.includes(n.id)) ? { ...n, read_at: now } : n)),
      );
    },
    onError: () => toast.error("Couldn't mark that as read. Try again."),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="tabular absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.7rem] font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] rounded-3xl p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-lg font-semibold text-foreground">Notifications</p>
          <Button variant="link" size="sm" disabled={!unread || mark.isPending} onClick={() => mark.mutate("all")}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {isError ? (
            <div className="px-5 py-8 text-center text-[0.95rem] text-muted-foreground">
              Couldn't load notifications.{" "}
              <button className="text-primary hover:underline" onClick={() => void refetch()}>
                Try again
              </button>
            </div>
          ) : data.length === 0 ? (
            <p className="px-5 py-8 text-center text-[0.95rem] text-muted-foreground">
              Nothing yet. You'll hear here when an action is assigned to you, blocked or done.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.map((n) => (
                <li key={n.id}>
                  <Link
                    to={n.link ?? "/"}
                    onClick={() => !n.read_at && mark.mutate([n.id])}
                    className={cn("flex gap-3 px-5 py-3.5 transition-colors hover:bg-secondary", !n.read_at && "bg-info-soft/60")}
                  >
                    <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-[0.95rem] font-medium leading-snug text-foreground">{n.title}</span>
                      {n.body && <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{n.body}</span>}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {timeAgo(n.created_at)}
                        {!n.read_at && <span className="sr-only">, unread</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">In-app only. Nothing is sent by WhatsApp or email.</p>
      </PopoverContent>
    </Popover>
  );
}
