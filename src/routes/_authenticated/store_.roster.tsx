import { useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ManagerView } from "@/lib/coach/types";
import { homeFor } from "@/lib/coach/logic";
import { formatDayMonth, formatWeekdayDay, formatShortDate } from "@/lib/coach/format";
import {
  applyMoves,
  decodeOffs,
  encodeOffs,
  offsOnWeddingDates,
  onFloor,
  plannerWeek,
  splitActive,
  suggestMoves,
  toggleOff,
  type RosterPlan,
} from "@/lib/coach/roster";
import { Button } from "@/components/ui/button";
import { EmptyNote, PageHeader } from "@/components/coach/primitives";
import { useActionStatusGroup } from "@/components/coach/use-action-status";
import { ManagerGate, useCoachView } from "@/components/coach/view-gate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store_/roster")({
  beforeLoad: ({ context }) => {
    if (context.profile.role !== "store_lead") throw redirect({ to: homeFor(context.profile.role), replace: true });
  },
  head: () => ({
    meta: [
      { title: "Roster planner · Store Coach by Manyavar" },
      { name: "description", content: "Plan weekly offs for the wedding-date week so the floor stays covered." },
      { property: "og:title", content: "Roster planner · Store Coach by Manyavar" },
      { property: "og:description", content: "Keep weekly offs away from wedding dates, with a one-tap suggestion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RosterPage,
});

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function Planner({ view, storeId }: { view: ManagerView; storeId: string }) {
  const bundle = view.stores[storeId];
  const upcoming = bundle ? (view.upcoming[bundle.meta.state] ?? []) : [];
  const week = useMemo(() => plannerWeek(upcoming, view.date), [upcoming, view.date]);
  const weekStart = week?.days[0] ?? view.date;
  const { active: team, inactive } = splitActive(bundle?.team ?? [], view.team_as_of ?? view.date);
  const teamIds = team.map((t) => t.salesperson_id);
  const [savedRaw, setSaved] = useActionStatusGroup(`roster:${storeId}:${weekStart}:`);

  const saved: RosterPlan = useMemo(
    () => Object.fromEntries(teamIds.map((sp) => [sp, decodeOffs(savedRaw[sp], weekStart)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(savedRaw), weekStart, teamIds.join()],
  );
  const [draft, setDraft] = useState<RosterPlan>(saved);
  const [history, setHistory] = useState<RosterPlan[]>([]);
  const [saving, setSaving] = useState(false);
  const loadedFor = useRef<string | null>(null);

  // Start from the saved plan whenever it arrives or the week changes.
  useEffect(() => {
    const key = `${weekStart}|${JSON.stringify(saved)}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    setDraft(saved);
    setHistory([]);
  }, [saved, weekStart]);

  if (!bundle) return <EmptyNote>This store is not in your view.</EmptyNote>;
  if (!week) {
    return (
      <EmptyNote className="surface py-12 text-base">
        No wedding dates ahead in the {bundle.meta.state} calendar, so there is no week to plan.
      </EmptyNote>
    );
  }

  const nameOf = (sp: string) => team.find((t) => t.salesperson_id === sp)?.name ?? sp;
  const weddingCount = week.days.filter((d) => week.weddingDays.has(d)).length;
  const conflicts = offsOnWeddingDates(draft, week);
  const moves = suggestMoves(draft, week, view.date);
  const outside = Object.entries(draft).flatMap(([sp, offs]) => offs.filter((d) => !week.days.includes(d)).map((d) => ({ sp, d })));
  const dirty = teamIds.some((sp) => encodeOffs(draft[sp] ?? [], weekStart) !== encodeOffs(saved[sp] ?? [], weekStart));

  function change(next: RosterPlan) {
    setHistory((h) => [...h.slice(-30), draft]);
    setDraft(next);
  }

  async function save() {
    setSaving(true);
    const writes = teamIds
      .map((sp) => ({ sp, next: encodeOffs(draft[sp] ?? [], weekStart) }))
      .filter(({ sp, next }) => next !== encodeOffs(saved[sp] ?? [], weekStart))
      .map(({ sp, next }) => setSaved(sp, next));
    const results = await Promise.all(writes);
    setSaving(false);
    // Only confirm once every change is stored; a failed change already shows its own message and rolls back.
    if (results.every(Boolean)) {
      toast.success("Plan saved", { description: `${storeId} · ${formatShortDate(week!.days[0])} – ${formatShortDate(week!.days[6])}` });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        kicker={`Roster planner · ${formatShortDate(week.days[0])} – ${formatShortDate(week.days[6])}`}
        title={weddingCount === 7 ? "Every day this week is a wedding date." : `${weddingCount} of 7 days this week are wedding dates.`}
        actions={
          <>
            <Button variant="white" onClick={() => setHistory((h) => { const prev = h[h.length - 1]; if (prev) setDraft(prev); return h.slice(0, -1); })} disabled={!history.length}>
              Undo
            </Button>
            <Button variant="white" onClick={() => change(applyMoves(draft, moves))} disabled={!moves.length}>
              Apply suggestion
            </Button>
            <Button onClick={() => void save()} disabled={!dirty || saving}>
              {saving && <Loader2 className="animate-spin" />}
              {dirty ? "Save plan" : "Saved"}
            </Button>
          </>
        }
      />

      {conflicts.length > 0 ? (
        <p className="rounded-3xl bg-warn-soft px-6 py-4 text-[1.05rem] leading-relaxed text-warn">
          <b className="font-semibold">
            {conflicts.length} weekly {conflicts.length === 1 ? "off falls" : "offs fall"} on wedding dates.
          </b>{" "}
          {moves.length
            ? `Suggestion: move ${joinNames(moves.map((m) => nameOf(m.sp)))}'s ${moves.length === 1 ? "off" : "offs"} to ${joinNames(
                moves.map((m) => formatWeekdayDay(m.to)),
              )} ${formatDayMonth(moves[moves.length - 1]!.to).split(" ")[1]}, before the wedding dates begin.`
            : "There are no free days left before the wedding dates to move them to."}
        </p>
      ) : (
        <p className="rounded-3xl bg-good-soft px-6 py-4 text-[1.05rem] text-good">
          <b className="font-semibold">No weekly offs on wedding dates.</b> Tap a cell to mark someone off.
        </p>
      )}

      <div className="surface overflow-x-auto p-4 sm:p-7">
        <table className="w-full min-w-[760px] border-separate border-spacing-x-2 border-spacing-y-0 text-[0.95rem]">
          <thead>
            <tr>
              <th className="pb-4 text-left font-normal text-muted-foreground">Salesperson</th>
              {week.days.map((d) => (
                <th key={d} className="pb-4 text-center font-normal">
                  <span className="block text-muted-foreground">{formatWeekdayDay(d)}</span>
                  {week.weddingDays.has(d) ? (
                    <span className="block text-sm font-medium text-warn">Wedding date</span>
                  ) : (
                    <span className="block text-sm text-muted-foreground">&nbsp;</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {team.map((t) => (
              <tr key={t.salesperson_id}>
                <td className="border-t border-border py-2 pr-2 text-foreground">{t.name}</td>
                {week.days.map((d) => {
                  const off = (draft[t.salesperson_id] ?? []).includes(d);
                  return (
                    <td key={d} className="border-t border-border py-2">
                      <button
                        type="button"
                        onClick={() => change(toggleOff(draft, t.salesperson_id, d))}
                        aria-pressed={off}
                        aria-label={`${t.name}, ${formatShortDate(d)}: ${off ? "off" : "present"}`}
                        className={cn(
                          "h-11 w-full rounded-xl text-[0.95rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
                          off ? "bg-warn-soft text-warn" : "bg-secondary text-foreground hover:bg-accent",
                        )}
                      >
                        {off ? "Off" : "Present"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="border-t-2 border-border pt-4 font-semibold text-foreground">On the floor</td>
              {week.days.map((d) => (
                <td key={d} className="tabular border-t-2 border-border pt-4 text-center font-semibold text-foreground">
                  {onFloor(draft, teamIds, d)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {outside.length > 0 && (
        <p className="text-[0.95rem] text-muted-foreground">
          Offs outside this week: {outside.map((o) => `${nameOf(o.sp)} on ${formatShortDate(o.d)}`).join(" · ")}.
        </p>
      )}
      {inactive.length > 0 && (
        <p className="text-[0.95rem] text-muted-foreground">
          Left off the planner: {inactive.map((t) => `${t.name} (${t.last_bill ? `no bill since ${formatShortDate(t.last_bill)}` : "no bills"})`).join(" · ")}.
        </p>
      )}
      <p className="text-[0.95rem] text-muted-foreground">
        Wedding dates come from Manyavar's calendar for {bundle.meta.state}. Store Coach has no shift-roster feed, so this planner starts
        with everyone present: mark the offs you plan, then save. Saved plans stay on your account.
      </p>
    </div>
  );
}

function RosterPage() {
  const { profile } = Route.useRouteContext();
  const query = useCoachView();
  return (
    <div className="flex flex-col gap-6">
      <Link to="/store" className="inline-flex w-fit items-center gap-1 text-lg text-primary hover:underline">
        <ChevronLeft className="size-5" /> Today's huddle
      </Link>
      <ManagerGate query={query}>{(v) => <Planner view={v} storeId={profile.scope_id ?? ""} />}</ManagerGate>
    </div>
  );
}
