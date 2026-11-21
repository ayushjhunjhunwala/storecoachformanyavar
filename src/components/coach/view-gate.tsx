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
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-10 w-72 rounded-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function ViewError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong loading your dashboard.";
  return (
    <div className="coach-card mx-auto flex max-w-lg flex-col items-center gap-3 p-8 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-worse-soft text-worse">
        <AlertTriangle className="size-6" />
      </span>
      <h2 className="text-lg font-bold text-foreground">Your dashboard didn't load</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="flex gap-2">
        <Button onClick={onRetry} variant="default" size="sm">
          <RefreshCw /> Try again
        </Button>
        <SignOutButton variant="outline" />
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

export function PageIntro({ eyebrow, title, meta }: { eyebrow: string; title: ReactNode; meta?: ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-maroon">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{title}</h1>
      {meta && <p className="mt-1 text-sm text-muted-foreground">{meta}</p>}
    </div>
  );
}
