import type { ReactNode } from "react";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Loader2, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CoachView, ViewProfile } from "@/lib/coach/types";
import { ROLE_LABEL, formatHeaderDate, formatLongDate } from "@/lib/coach/format";
import { homeFor } from "@/lib/coach/logic";
import { viewQueryOptions } from "@/lib/coach/queries";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReplay } from "./replay-context";

export function BrandMark({ className = "size-9" }: { className?: string }) {
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground", className)}>
      <svg viewBox="0 0 24 24" className="size-[52%]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
        <path d="M5 20h14" />
        <path d="M8 16v-5" />
        <path d="M12 16V7" />
        <path d="M16 16v-3" />
      </svg>
    </span>
  );
}

/** "Area manager · Lucknow", "Store lead · LKO-02", "North · Uttar Pradesh", "Retail operations". */
export function scopeLine(profile: ViewProfile, view: CoachView | undefined): string {
  const manager = view?.kind === "manager" ? view : undefined;
  switch (profile.role) {
    case "hq":
      return "Retail operations";
    case "zonal": {
      const states = manager ? [...new Set(manager.store_order.map((id) => manager.stores[id]?.meta.state).filter(Boolean))] : [];
      return [profile.scope_id, states.join(", ")].filter(Boolean).join(" · ");
    }
    case "am": {
      const am = manager?.area_managers.find((a) => a.area_manager_id === profile.scope_id);
      return `${ROLE_LABEL["am"]} · ${am?.city ?? profile.scope_id ?? ""}`;
    }
    case "store_lead":
      return `${ROLE_LABEL["store_lead"]} · ${profile.scope_id ?? ""}`;
    default:
      return `${ROLE_LABEL["salesperson"]} · ${view?.kind === "salesperson" ? view.store_id : (profile.scope_id ?? "")}`;
  }
}

function headerName(profile: ViewProfile): string {
  if (profile.role === "hq") return "HQ";
  if (profile.role === "zonal") return ROLE_LABEL["zonal"] ?? "Zonal head";
  return profile.display_name;
}

export function SignOutButton({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }
  return (
    <Button variant="link" onClick={signOut} className={cn("h-auto text-[0.95rem]", className)}>
      Sign out
    </Button>
  );
}

/** "● Live  Sat, 31 Oct 2026  ‹ ›  Play" — replays the 31 daily runs. */
export function ReplayPill({ className }: { className?: string }) {
  const { dates, date, index, playing, setDate, step, togglePlay } = useReplay();
  const fetching = useIsFetching({ queryKey: ["coach-view"] }) > 0;
  return (
    <div
      className={cn("flex items-center gap-1 rounded-full bg-secondary py-1 pl-4 pr-1", className)}
      role="group"
      aria-label="Replay the daily runs"
    >
      <span className="live-dot mr-1.5 shrink-0" aria-hidden />
      <span className="font-semibold text-foreground">Live</span>
      <label className="relative ml-2 mr-1 flex min-w-0 items-center">
        <span className="sr-only">Replay date</span>
        <span className="tabular truncate text-muted-foreground" aria-live="polite">
          {formatHeaderDate(date)}
        </span>
        <select
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Jump to a day"
        >
          {dates.map((d) => (
            <option key={d} value={d}>
              {formatLongDate(d)}
            </option>
          ))}
        </select>
      </label>
      <span className="grid w-4 place-items-center" aria-hidden>
        {fetching && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      </span>
      <Button variant="white" size="icon-sm" onClick={() => step(-1)} disabled={index <= 0} aria-label="Previous day">
        <ChevronLeft />
      </Button>
      <Button
        variant="white"
        size="icon-sm"
        onClick={() => step(1)}
        disabled={index >= dates.length - 1}
        aria-label="Next day"
      >
        <ChevronRight />
      </Button>
      <Button size="sm" className="ml-1 h-8 px-4" onClick={togglePlay} aria-label={playing ? "Pause replay" : "Play replay"}>
        {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        <span className="hidden sm:inline">{playing ? "Pause" : "Play"}</span>
      </Button>
    </div>
  );
}

const HQ_TABS = [
  { tab: "guardrails", label: "Guardrails" },
  { tab: "runs", label: "Runs" },
  { tab: "digests", label: "Digests" },
] as const;

export type HqTab = (typeof HQ_TABS)[number]["tab"];

export function HqTabs({ active }: { active: HqTab }) {
  return (
    <nav className="flex rounded-full bg-secondary p-1" aria-label="HQ sections">
      {HQ_TABS.map((t) => (
        <Link
          key={t.tab}
          to="/hq"
          search={{ tab: t.tab }}
          className={cn(
            "rounded-full px-4 py-1.5 text-[0.95rem] transition-colors sm:px-5",
            active === t.tab ? "bg-card font-semibold text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
          )}
          aria-current={active === t.tab ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ profile, children }: { profile: ViewProfile; children: ReactNode }) {
  const { date } = useReplay();
  const { pathname, search } = useLocation();
  const view = useQuery({ ...viewQueryOptions(date), enabled: false }).data;
  const isHqHome = profile.role === "hq" && pathname === "/hq";
  const hqTab = ((search as { tab?: string }).tab ?? "guardrails") as HqTab;
  const center = isHqHome ? <HqTabs active={hqTab} /> : <ReplayPill />;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-xl">
        <div className="mx-auto grid max-w-[90rem] grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:px-8 lg:grid-cols-[1fr_auto_1fr]">
          <Link to={homeFor(profile.role)} className="flex items-center gap-3 justify-self-start" aria-label="Store Coach by Manyavar, home">
            <BrandMark />
            <span className="text-lg font-semibold tracking-tight text-foreground">
              Store Coach<span className="hidden font-normal text-muted-foreground sm:inline"> by Manyavar</span>
            </span>
          </Link>
          <div className="hidden lg:block">{center}</div>
          <div className="flex items-center gap-4 justify-self-end">
            <div className="hidden text-right leading-tight sm:block">
              <p className="font-semibold text-foreground">{headerName(profile)}</p>
              <p className="text-[0.95rem] text-muted-foreground">{scopeLine(profile, view)}</p>
            </div>
            <SignOutButton />
          </div>
        </div>
        <div className="flex justify-center px-4 pb-3 lg:hidden">{center}</div>
      </header>
      <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-8 sm:px-8 sm:py-12">{children}</main>
      <footer className="mx-auto w-full max-w-[90rem] px-4 pb-8 sm:px-8">
        <p className="text-xs text-muted-foreground">
          Synthetic Manyavar sample data (Nov 2024 – Oct 2026), replayed one day at a time. Customer IDs are masked.
        </p>
      </footer>
    </div>
  );
}
