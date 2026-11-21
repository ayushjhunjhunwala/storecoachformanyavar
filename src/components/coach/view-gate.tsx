import { useEffect, type ReactNode } from "react";
import { keepPreviousData, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { CoachView, ManagerView, MyView } from "@/lib/coach/types";
import { viewQueryOptions } from "@/lib/coach/queries";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReplay } from "./replay-context";
import { SignOutButton } from "./app-shell";

export function useCoachView(): UseQueryResult<CoachView> {
  const { date, dates, index } = useReplay();
  const queryClient = useQueryClient();
  const query = useQuery({ ...viewQueryOptions(date), placeholderData: keepPreviousData });
  useEffect(() => {
    const next = dates[index + 1];
    if (next) void queryClient.prefetchQuery(viewQueryOptions(next));
  }, [dates, index, queryClient]);
  return query;
}

export function ViewSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-5 w-64 rounded-full bg-border" />
      <Skeleton className="h-12 w-full max-w-xl rounded-2xl bg-border" />
      <div className="mt-2 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-3xl bg-card" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-3xl bg-card" />
      <Skeleton className="h-72 rounded-3xl bg-card" />
    </div>
  );
}

function ViewError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong loading your dashboard.";
  return (
    <div className="surface mx-auto flex max-w-lg flex-col items-center gap-3 p-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-bad-soft text-bad">
        <AlertTriangle className="size-6" />
      </span>
      <h2 className="text-xl font-semibold text-foreground">Your dashboard didn't load</h2>
      <p className="text-[0.95rem] text-muted-foreground">{message}</p>
      <div className="mt-2 flex items-center gap-4">
        <Button onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
        <SignOutButton />
      </div>
    </div>
  );
}

export function ManagerGate({
  query,
  children,
}: {
  query: UseQueryResult<CoachView>;
  children: (view: ManagerView) => ReactNode;
}) {
  if (query.isPending) return <ViewSkeleton />;
  if (query.isError && !query.data) return <ViewError error={query.error} onRetry={() => void query.refetch()} />;
  const view = query.data;
  if (!view || view.kind !== "manager") return <ViewSkeleton />;
  return <>{children(view)}</>;
}

export function SalespersonGate({
  query,
  children,
}: {
  query: UseQueryResult<CoachView>;
  children: (view: MyView) => ReactNode;
}) {
  if (query.isPending) return <ViewSkeleton />;
  if (query.isError && !query.data) return <ViewError error={query.error} onRetry={() => void query.refetch()} />;
  const view = query.data;
  if (!view || view.kind !== "salesperson") return <ViewSkeleton />;
  return <>{children(view)}</>;
}
