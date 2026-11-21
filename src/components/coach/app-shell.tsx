import type { ReactNode } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { ChevronLeft, ChevronRight, Loader2, LogOut, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ViewProfile } from "@/lib/coach/types";
import { ROLE_LABEL, formatDayMonth, formatLongDate } from "@/lib/coach/format";
import { Button } from "@/components/ui/button";
import { useReplay } from "./replay-context";

export function BrandMark({ className = "size-9" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-xl bg-marigold font-extrabold text-accent-foreground shadow-sm ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-[60%]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20V10l8-6 8 6v10" />
        <path d="M9 20v-5h6v5" />
        <path d="M12 4v3" />
      </svg>
    </span>
  );
}

function scopeLabel(profile: ViewProfile): string {
  switch (profile.role) {
    case "zonal":
      return `${profile.scope_id} zone`;
    case "am":
      return profile.scope_id ?? "";
    case "store_lead":
      return profile.scope_id ?? "";
    case "salesperson":
      return profile.scope_id ?? "";
    default:
      return "All stores";
  }
}

export function SignOutButton({ variant = "header" }: { variant?: "header" | "outline" }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }
  return (
    <Button variant={variant} size="sm" onClick={signOut}>
      <LogOut /> Sign out
    </Button>
  );
}

function ReplayBar() {
  const { dates, date, index, playing, setDate, step, togglePlay } = useReplay();
  const fetching = useIsFetching({ queryKey: ["coach-view"] }) > 0;
  const first = dates[0] ?? date;
  const last = dates[dates.length - 1] ?? date;
  return (
    <div className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="flex shrink-0 items-center gap-2 rounded-full bg-on-maroon/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-on-maroon">
          <span className="live-dot" /> <span className="hidden min-[420px]:inline">Live replay</span>
          <span className="min-[420px]:hidden">Live</span>
        </span>
        <span className="tabular whitespace-nowrap text-sm font-bold text-on-maroon sm:min-w-[9.5rem] sm:text-base" aria-live="polite">
          {formatLongDate(date)}
        </span>
        {fetching && <Loader2 className="size-4 animate-spin text-on-maroon-muted" aria-label="Loading" />}
        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          <Button variant="header" size="icon" className="size-8" onClick={() => step(-1)} disabled={index <= 0} aria-label="Previous day">
            <ChevronLeft />
          </Button>
          <Button
            variant="marigold"
            size="sm"
            className="h-8 px-2.5 sm:min-w-[5.5rem] sm:px-3"
            onClick={togglePlay}
            aria-label={playing ? "Pause replay" : "Play replay"}
          >
            {playing ? <Pause /> : <Play />}
            <span className="hidden sm:inline">{playing ? "Pause" : "Play"}</span>
          </Button>
          <Button
            variant="header"
            size="icon"
            className="size-8"
            onClick={() => step(1)}
            disabled={index >= dates.length - 1}
            aria-label="Next day"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="flex flex-1 items-center gap-3">
        <span className="hidden text-xs text-on-maroon-muted md:inline">{formatDayMonth(first)}</span>
        <SliderPrimitive.Root
          className="relative flex h-6 flex-1 touch-none select-none items-center"
          min={0}
          max={dates.length - 1}
          step={1}
          value={[Math.max(0, index)]}
          onValueChange={([v]) => {
            const d = v == null ? undefined : dates[v];
            if (d) setDate(d);
          }}
        >
          <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-on-maroon/20">
            <SliderPrimitive.Range className="absolute h-full bg-marigold" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            aria-label="Replay date"
            className="block size-5 rounded-full border-2 border-on-maroon bg-marigold shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marigold/60" />
        </SliderPrimitive.Root>
        <span className="hidden text-xs text-on-maroon-muted md:inline">{formatDayMonth(last)}</span>
        <span className="tabular text-xs font-semibold text-on-maroon-muted">
          Day {index + 1}/{dates.length}
        </span>
      </div>
    </div>
  );
}

export function AppShell({ profile, children }: { profile: ViewProfile; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="header-band">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 pb-3 pt-4 sm:px-6">
          <BrandMark />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-extrabold leading-none tracking-tight">Store Coach</p>
            <p className="mt-1 truncate text-xs text-on-maroon-muted sm:text-sm">
              Manyavar · 20 stores · 6 area managers · runs by itself every morning
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-bold">{profile.display_name}</p>
              <p className="text-xs text-on-maroon-muted">
                {ROLE_LABEL[profile.role]} · {scopeLabel(profile)}
              </p>
            </div>
            <SignOutButton />
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-2 sm:hidden">
          <p className="text-xs text-on-maroon-muted">
            <b className="text-on-maroon">{profile.display_name}</b> · {ROLE_LABEL[profile.role]} · {scopeLabel(profile)}
          </p>
        </div>
      </header>
      <div className="sticky top-0 z-30 border-y border-on-maroon/10 bg-maroon-deep shadow-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <ReplayBar />
        </div>
      </div>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      <footer className="border-t border-border bg-ivory">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          Synthetic Manyavar sample data (Nov 2024 – Oct 2026), replayed one day at a time. Customer IDs are masked.
        </p>
      </footer>
    </div>
  );
}
