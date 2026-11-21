import { useMemo } from "react";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Printer, Search } from "lucide-react";
import type { BoardItem } from "@/lib/coach/actions.types";
import { actionBoardQueryOptions } from "@/lib/coach/action-queries";
import { homeFor } from "@/lib/coach/logic";
import { RESULT_LABEL, formatDayMonth, formatRupees, formatShortDate } from "@/lib/coach/format";
import { STATE_LABEL, boardColumn, csvCell } from "@/lib/coach/workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActionSummary, StateChip } from "@/components/coach/action-panel";
import { Card, DataTable, EmptyNote, LeverChip, PageHeader, StatTile, resultText } from "@/components/coach/primitives";
import { useReplay } from "@/components/coach/replay-context";
import { cn } from "@/lib/utils";

type Column = "todo" | "active" | "blocked" | "closed";
interface BoardSearch {
  q?: string;
  store?: string;
  lever?: string;
  owner?: string;
  week?: string;
  status?: Column;
  outcome?: string;
  due?: "overdue" | "followup";
  view?: "list" | "board";
}

const str = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length < 120 ? v : undefined);

export const Route = createFileRoute("/_authenticated/actions")({
  validateSearch: (s: Record<string, unknown>): BoardSearch => {
    const out: BoardSearch = {};
    const q = str(s["q"]);
    if (q) out.q = q;
    for (const key of ["store", "lever", "owner", "week", "outcome"] as const) {
      const v = str(s[key]);
      if (v) out[key] = v;
    }
    const status = str(s["status"]);
    if (status === "todo" || status === "active" || status === "blocked" || status === "closed") out.status = status;
    const due = str(s["due"]);
    if (due === "overdue" || due === "followup") out.due = due;
    if (s["view"] === "board") out.view = "board";
    return out;
  },
  beforeLoad: ({ context }) => {
    if (context.profile.role === "salesperson") throw redirect({ to: homeFor(context.profile.role), replace: true });
  },
  head: () => ({
    meta: [
      { title: "Actions · Store Coach by Manyavar" },
      { name: "description", content: "Every weekly issue's action: who has it, when it's due, what's blocked, and how the 7-day follow-up turned out." },
      { property: "og:title", content: "Actions · Store Coach by Manyavar" },
      { property: "og:description", content: "Track assigned, blocked, done and follow-up-due actions across your stores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActionsPage,
});

const COLUMN_LABEL: Record<Column, string> = { todo: "To assign", active: "In progress", blocked: "Blocked", closed: "Closed" };
const ALL = "__all";

function isOverdue(item: BoardItem, date: string): boolean {
  const a = item.action;
  return !!a && !!a.due_date && a.due_date < date && boardColumn(a.state) !== "closed" && a.state !== "open";
}
function isFollowupDue(item: BoardItem, date: string): boolean {
  return !item.outcome && !!item.followup_due && item.followup_due <= date;
}
function outcomeKey(item: BoardItem, date: string): string {
  if (item.outcome) return item.outcome.result;
  return item.followup_due && item.followup_due > date ? "pending" : "not_measured";
}
function outcomeLabel(item: BoardItem, date: string): string {
  const k = outcomeKey(item, date);
  if (k === "pending") return `Pending · measured ${formatShortDate(item.followup_due)}`;
  if (k === "not_measured") return "Not measured";
  return RESULT_LABEL[k] ?? k;
}

function exportCsv(items: BoardItem[], date: string) {
  const header = ["Week", "Store", "Lever", "Issue", "Action", "Estimated ₹ at stake (4 weeks)", "Status", "Owner", "Due", "Block or dismiss reason", "Follow-up"];
  const lines = items.map((i) =>
    [
      i.week_date,
      i.issue.store_id,
      i.issue.lever,
      i.issue.title,
      i.issue.action,
      Math.round(i.issue.rupees),
      STATE_LABEL[i.action?.state ?? "open"],
      i.action?.assignee_name ?? "",
      i.action?.due_date ?? "",
      i.action?.block_reason ?? i.action?.dismiss_reason ?? "",
      outcomeLabel(i, date),
    ]
      .map(csvCell)
      .join(","),
  );
  const blob = new Blob([`\ufeff${[header.map(csvCell).join(","), ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `store-coach-actions-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
      <SelectTrigger className="h-11 w-full rounded-full bg-card px-4 text-[0.95rem] sm:w-auto sm:min-w-40" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ActionsPage() {
  const { profile } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { date } = useReplay();
  const board = useQuery(actionBoardQueryOptions(date));
  const set = (patch: { [K in keyof BoardSearch]?: BoardSearch[K] | undefined }) =>
    void navigate({
      search: (prev: BoardSearch) => {
        const next: Record<string, unknown> = { ...prev, ...patch };
        for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
        return next as BoardSearch;
      },
      replace: true,
    });

  const items = board.data?.items ?? [];
  const owners = useMemo(
    () => [...new Set(items.map((i) => i.action?.assignee_name).filter((n): n is string => !!n))].sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.q?.toLowerCase();
    return items
      .filter((i) => {
        if (search.store && i.issue.store_id !== search.store) return false;
        if (search.lever && i.issue.lever !== search.lever) return false;
        if (search.week && i.week_date !== search.week) return false;
        if (search.owner === "unassigned" && i.action?.assignee_name) return false;
        if (search.owner && search.owner !== "unassigned" && i.action?.assignee_name !== search.owner) return false;
        if (search.status && boardColumn(i.action?.state ?? "open") !== search.status) return false;
        if (search.outcome && outcomeKey(i, date) !== search.outcome) return false;
        if (search.due === "overdue" && !isOverdue(i, date)) return false;
        if (search.due === "followup" && !isFollowupDue(i, date)) return false;
        if (q && !`${i.issue.title} ${i.issue.store_id} ${i.issue.action} ${i.issue.cause}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.week_date.localeCompare(a.week_date) || a.issue.rank - b.issue.rank);
  }, [items, search, date]);

  const counts = useMemo(() => {
    const c = { todo: 0, active: 0, blocked: 0, closed: 0, overdue: 0, followup: 0 };
    for (const i of items) {
      c[boardColumn(i.action?.state ?? "open")] += 1;
      if (isOverdue(i, date)) c.overdue += 1;
      if (isFollowupDue(i, date)) c.followup += 1;
    }
    return c;
  }, [items, date]);

  const filtersOn = Object.keys(search).some((k) => k !== "view");
  const view = search.view ?? "list";

  return (
    <>
      <PageHeader
        kicker={`${profile.role === "store_lead" ? profile.scope_id : "Your stores"} · weekly issues sent up to ${formatDayMonth(date)}`}
        title="Actions"
        actions={
          <div className="flex gap-2 print:hidden">
            <Button variant="white" onClick={() => exportCsv(filtered, date)} disabled={!filtered.length}>
              <Download /> Export CSV
            </Button>
            <Button variant="white" onClick={() => window.print()} disabled={!filtered.length}>
              <Printer /> Print
            </Button>
          </div>
        }
      />

      {board.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading actions…
        </div>
      ) : board.isError ? (
        <EmptyNote className="surface py-12 text-base">
          Couldn't load actions.{" "}
          <button className="text-primary hover:underline" onClick={() => void board.refetch()}>
            Try again
          </button>
        </EmptyNote>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 print:hidden">
            {(
              [
                { label: "To assign", value: counts.todo, on: () => set({ status: "todo", due: undefined }) },
                { label: "In progress", value: counts.active, on: () => set({ status: "active", due: undefined }) },
                { label: "Blocked", value: counts.blocked, on: () => set({ status: "blocked", due: undefined }), tone: counts.blocked ? "bad" : "neutral" },
                { label: "Overdue", value: counts.overdue, on: () => set({ due: "overdue", status: undefined }), tone: counts.overdue ? "bad" : "neutral" },
                { label: "Follow-up due", value: counts.followup, on: () => set({ due: "followup", status: undefined }) },
              ] as const
            ).map((t) => (
              <button key={t.label} type="button" onClick={t.on} className="rounded-3xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring">
                <StatTile label={t.label} value={t.value} tone={"tone" in t ? t.tone : "neutral"} />
              </button>
            ))}
          </div>

          <div className="surface flex flex-col gap-3 p-4 sm:p-5 print:hidden">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative flex-1">
                <span className="sr-only">Search actions</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={search.q ?? ""}
                  onChange={(e) => set({ q: e.target.value || undefined })}
                  placeholder="Search issues, stores or actions"
                  className="h-11 rounded-full pl-10"
                />
              </label>
              <div className="flex rounded-full bg-secondary p-1" role="tablist" aria-label="View">
                {(["list", "board"] as const).map((v) => (
                  <button
                    key={v}
                    role="tab"
                    aria-selected={view === v}
                    onClick={() => set({ view: v === "list" ? undefined : v })}
                    className={cn(
                      "min-h-9 rounded-full px-4 text-[0.95rem] capitalize",
                      view === v ? "bg-card font-semibold text-foreground shadow-card" : "text-muted-foreground",
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {board.data && board.data.stores.length > 1 && (
                <FilterSelect label="Stores" value={search.store} onChange={(v) => set({ store: v })} options={board.data.stores.map((s) => ({ value: s, label: s }))} />
              )}
              <FilterSelect label="Levers" value={search.lever} onChange={(v) => set({ lever: v })} options={(board.data?.levers ?? []).map((l) => ({ value: l, label: l }))} />
              <FilterSelect
                label="Owners"
                value={search.owner}
                onChange={(v) => set({ owner: v })}
                options={[{ value: "unassigned", label: "Unassigned" }, ...owners.map((o) => ({ value: o, label: o }))]}
              />
              <FilterSelect
                label="Weeks"
                value={search.week}
                onChange={(v) => set({ week: v })}
                options={[...(board.data?.weeks ?? [])].reverse().map((w) => ({ value: w, label: `Week of ${formatDayMonth(w)}` }))}
              />
              <FilterSelect
                label="Statuses"
                value={search.status}
                onChange={(v) => set({ status: v as Column | undefined })}
                options={(Object.keys(COLUMN_LABEL) as Column[]).map((c) => ({ value: c, label: COLUMN_LABEL[c] }))}
              />
              <FilterSelect
                label="Outcomes"
                value={search.outcome}
                onChange={(v) => set({ outcome: v })}
                options={[
                  { value: "improved", label: "Improved" },
                  { value: "no_change", label: "No change" },
                  { value: "worse", label: "Worse" },
                  { value: "pending", label: "Pending" },
                  { value: "not_measured", label: "Not measured" },
                ]}
              />
              {filtersOn && (
                <Button variant="link" onClick={() => void navigate({ search: view === "board" ? { view: "board" } : {}, replace: true })}>
                  Clear filters
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {filtered.length} of {items.length} issues. Status is what was done; outcome is the 7-day measurement, which shows movement, not
              cause.
            </p>
          </div>

          {filtered.length === 0 ? (
            <EmptyNote className="surface py-12 text-base">No issues match these filters.</EmptyNote>
          ) : view === "board" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {(Object.keys(COLUMN_LABEL) as Column[]).map((col) => {
                const colItems = filtered.filter((i) => boardColumn(i.action?.state ?? "open") === col);
                return (
                  <section key={col} className="rounded-3xl bg-secondary/70 p-3" aria-label={COLUMN_LABEL[col]}>
                    <h2 className="flex items-center justify-between px-2 pb-3 pt-1 font-semibold text-foreground">
                      {COLUMN_LABEL[col]} <span className="tabular text-muted-foreground">{colItems.length}</span>
                    </h2>
                    <ul className="flex flex-col gap-3">
                      {colItems.map((i) => (
                        <li key={i.issue.id} className="surface p-4">
                          <div className="flex items-center justify-between gap-2">
                            <LeverChip lever={i.issue.lever} />
                            <span className="figure text-lg text-foreground">{formatRupees(i.issue.rupees)}</span>
                          </div>
                          <Link
                            to="/issue/$issueId"
                            params={{ issueId: i.issue.id }}
                            className="mt-2 block font-semibold leading-snug text-foreground hover:underline"
                          >
                            {i.issue.title}
                          </Link>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {i.issue.store_id} · week of {formatDayMonth(i.week_date)}
                          </p>
                          <p className="mt-2 text-sm">
                            <ActionSummary action={i.action} />
                          </p>
                          {isOverdue(i, date) && <p className="mt-1 text-sm font-semibold text-bad">Overdue</p>}
                        </li>
                      ))}
                      {colItems.length === 0 && <li className="px-2 pb-2 text-sm text-muted-foreground">Nothing here.</li>}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <Card title="Issues and actions" aside={`${filtered.length} shown`}>
              <DataTable
                minWidth={980}
                columns={[
                  { label: "Week" },
                  { label: "Issue" },
                  { label: "₹ / 4 weeks", align: "right" },
                  { label: "Status" },
                  { label: "Owner · due" },
                  { label: "Follow-up" },
                ]}
              >
                {filtered.map((i) => (
                  <tr key={i.issue.id}>
                    <td className="whitespace-nowrap text-muted-foreground">{formatDayMonth(i.week_date)}</td>
                    <td>
                      <Link to="/issue/$issueId" params={{ issueId: i.issue.id }} className="font-semibold text-foreground hover:underline">
                        {i.issue.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {i.issue.store_id} · {i.issue.lever}
                      </p>
                    </td>
                    <td className="text-right font-semibold">{formatRupees(i.issue.rupees)}</td>
                    <td>
                      <StateChip action={i.action} />
                      {isOverdue(i, date) && <p className="mt-1 text-sm font-semibold text-bad">Overdue</p>}
                    </td>
                    <td className="text-sm">
                      <ActionSummary action={i.action} />
                    </td>
                    <td className={cn("text-sm", i.outcome ? resultText[i.outcome.result] : "text-muted-foreground")}>{outcomeLabel(i, date)}</td>
                  </tr>
                ))}
              </DataTable>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
