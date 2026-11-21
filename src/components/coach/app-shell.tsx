import type { ReactNode } from "react";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  History,
  Inbox,
  ListChecks,
  Loader2,
  Map,
  Pause,
  Phone, MessageSquare,
  Play,
  ShieldCheck,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CoachView, ViewProfile } from "@/lib/coach/types";
import { ROLE_LABEL, formatHeaderDate, formatLongDate } from "@/lib/coach/format";
import { homeFor } from "@/lib/coach/logic";
import { viewQueryOptions } from "@/lib/coach/queries";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "./notifications";
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

/** "● Replay  Sat, 31 Oct 2026  ‹ ›  Play" — browses the 31 precomputed daily runs. */
export function ReplayPill({ className }: { className?: string }) {
  const { dates, date, index, playing, setDate, step, togglePlay } = useReplay();
  const fetching = useIsFetching({ queryKey: ["coach-view"] }) > 0;
  const latest = index >= dates.length - 1;
  return (
    <div
      className={cn("flex items-center gap-1 rounded-full bg-secondary py-1 pl-4 pr-1", className)}
      role="group"
      aria-label="Historical replay of the daily runs"
    >
      <span className="replay-dot mr-1.5 shrink-0" data-playing={playing} aria-hidden />
      <span className="font-semibold text-foreground" title="Synthetic historical data, replayed one day at a time">
        {latest && !playing ? "Latest run" : "Replay"}
      </span>
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
      <Button variant="white" size="icon-sm" onClick={() => step(1)} disabled={latest} aria-label="Next day">
        <ChevronRight />
      </Button>
      <Button size="sm" className="ml-1 h-8 px-4" onClick={togglePlay} aria-label={playing ? "Pause replay" : "Play replay"}>
        {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        <span className="hidden sm:inline">{playing ? "Pause" : "Play"}</span>
      </Button>
    </div>
  );
}

export type HqTab = "guardrails" | "runs" | "digests";

interface NavItem {
  label: string;
  to: string;
  search?: Record<string, string>;
  icon: LucideIcon;
  match: (pathname: string, search: Record<string, unknown>) => boolean;
}

const hqTab = (tab: HqTab) => (p: string, s: Record<string, unknown>) => p === "/hq" && ((s["tab"] as string | undefined) ?? "guardrails") === tab;

function navFor(role: ViewProfile["role"]): NavItem[] {
  const actions: NavItem = { label: "Actions", to: "/actions", icon: ListChecks, match: (p) => p === "/actions" };
  switch (role) {
    case "hq":
      return [
        { label: "Guardrails", to: "/hq", search: { tab: "guardrails" }, icon: ShieldCheck, match: hqTab("guardrails") },
        { label: "Runs", to: "/hq", search: { tab: "runs" }, icon: History, match: hqTab("runs") },
        { label: "Digests", to: "/hq", search: { tab: "digests" }, icon: Inbox, match: hqTab("digests") },
        actions,
      ];
    case "zonal":
      return [{ label: "Zone", to: "/zone", icon: Map, match: (p) => p === "/zone" }, actions];
    case "am":
      return [{ label: "Digest", to: "/am", icon: Inbox, match: (p) => p === "/am" || p.startsWith("/issue/") }, actions];
    case "store_lead":
      return [
        { label: "Huddle", to: "/store", icon: Users, match: (p) => p === "/store" },
        { label: "Roster", to: "/store/roster", icon: CalendarDays, match: (p) => p === "/store/roster" },
        actions,
      ];
    default:
      return [
        { label: "Today", to: "/me", icon: Sun, match: (p) => p === "/me" },
        { label: "Callbacks", to: "/me/callbacks", icon: Phone, match: (p) => p === "/me/callbacks" },
        { label: "Practice", to: "/me/practice", icon: MessageSquare, match: (p) => p === "/me/practice" },
      ];
  }
}

function NavLinks({ items, variant }: { items: NavItem[]; variant: "top" | "bottom" }) {
  const { pathname, search } = useLocation();
  const s = search as Record<string, unknown>;
  if (variant === "bottom") {
    return (
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden print:hidden"
        aria-label="Main"
      >
        <ul className="mx-auto flex max-w-lg">
          {items.map((item) => {
            const active = item.match(pathname, s);
            const Icon = item.icon;
            return (
              <li key={item.label} className="flex-1">
                <Link
                  to={item.to}
                  search={item.search as never}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
  return (
    <nav className="hidden md:block" aria-label="Main">
      <ul className="flex gap-1">
        {items.map((item) => {
          const active = item.match(pathname, s);
          return (
            <li key={item.label}>
              <Link
                to={item.to}
                search={item.search as never}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center border-b-2 px-3 text-[0.95rem] transition-colors",
                  active ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ profile, userId, children }: { profile: ViewProfile; userId: string; children: ReactNode }) {
  const { date } = useReplay();
  const view = useQuery(viewQueryOptions(date)).data;
  const items = navFor(profile.role);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:shadow-card">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-xl print:hidden">
        <div className="mx-auto grid max-w-[90rem] grid-cols-[1fr_auto] items-center gap-3 px-4 pt-3 sm:px-8 lg:grid-cols-[1fr_auto_1fr] md:pb-0 pb-3">
          <Link to={homeFor(profile.role)} className="flex items-center gap-3 justify-self-start" aria-label="Store Coach by Manyavar, home">
            <BrandMark />
            <span className="text-lg font-semibold tracking-tight text-foreground">
              Store Coach<span className="hidden font-normal text-muted-foreground sm:inline"> by Manyavar</span>
            </span>
          </Link>
          <div className="hidden lg:block">
            <ReplayPill />
          </div>
          <div className="flex items-center gap-2 justify-self-end sm:gap-4">
            <div className="hidden text-right leading-tight sm:block">
              <p className="font-semibold text-foreground">{headerName(profile)}</p>
              <p className="text-[0.95rem] text-muted-foreground">{scopeLine(profile, view)}</p>
            </div>
            <NotificationsBell userId={userId} />
            <SignOutButton />
          </div>
        </div>
        <div className="mx-auto flex max-w-[90rem] flex-col gap-2 px-4 sm:px-8 md:flex-row md:items-center md:justify-between">
          <NavLinks items={items} variant="top" />
          <div className="flex justify-center pb-3 md:py-2 lg:hidden">
            <ReplayPill />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-8 sm:px-8 sm:py-12">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-[90rem] px-4 pb-24 sm:px-8 md:pb-8 print:pb-0">
        <p className="text-xs text-muted-foreground">
          Store Coach by Manyavar · prototype. Synthetic sample data (Nov 2024 – Oct 2026) replayed one day at a time; not live sales.
          Customer IDs are masked.
        </p>
      </footer>
      <NavLinks items={items} variant="bottom" />
    </div>
  );
}
