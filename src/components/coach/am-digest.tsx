import { CalendarHeart, Database, MapPinned, Star } from "lucide-react";
import type { ManagerView } from "@/lib/coach/types";
import { followupKey } from "@/lib/coach/logic";
import { formatPct, formatRupees, formatShortDate } from "@/lib/coach/format";
import { IssueCard } from "./issue-card";
import { EmptyNote, Panel } from "./primitives";


export function AmDigest({ view, amId, interactive = true }: { view: ManagerView; amId: string; interactive?: boolean }) {
  const am = view.area_managers.find((a) => a.area_manager_id === amId);
  const issues = view.digest
    .filter((i) => i.area_manager_id === amId)
    .sort((a, b) => a.rank - b.rank);
  const total = issues.reduce((sum, i) => sum + i.rupees, 0);
  const followups = new Map(view.followups.map((f) => [f.key, f]));
  const storeIds = new Set(
    view.store_order.filter((id) => view.stores[id]?.meta.area_manager_id === amId),
  );
  const firstStore = [...storeIds][0];
  const state = firstStore ? view.stores[firstStore]?.meta.state : undefined;
  const market = view.market.filter((m) => m.city === am?.city);
  const flags = view.flags.filter((f) => storeIds.has(f.store_id));
  const roles = view.roles.filter((r) => r.city === am?.city);
  const upcoming = (state ? view.upcoming[state] : undefined) ?? [];
  const maxAlerts = am?.max_alerts_per_week ?? "5";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="coach-card flex flex-wrap items-end justify-between gap-3 p-4 sm:p-5">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">
              Weekly digest · sent {formatShortDate(view.digest_date)} · {am?.name ?? amId} ({am?.city})
            </p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {issues.length} {issues.length === 1 ? "issue" : "issues"} this week ·{" "}
              <span className="text-maroon">{formatRupees(total)}</span> at stake
            </p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
            Max {maxAlerts} a week, ranked by ₹
          </span>
        </div>
        {issues.length === 0 ? (
          <EmptyNote>No issues for {am?.name ?? amId} this week. The engine found nothing worth an action.</EmptyNote>
        ) : (
          issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              followup={followups.get(followupKey(issue))}
              date={view.date}
              interactive={interactive}
            />
          ))
        )}
      </div>

      <aside className="flex flex-col gap-4">
        <Panel
          title={
            <span className="flex items-center gap-2">
              <MapPinned className="size-4 text-teal" /> Held back · market issue
            </span>
          }
          subtitle="A whole city slowing is sent to the zonal head, not you."
        >
          {market.length ? (
            market.map((m) => (
              <p key={m.city} className="text-sm leading-relaxed text-foreground">
                {m.text}
              </p>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nothing held back for {am?.city} today.</p>
          )}
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <Database className="size-4 text-marigold-ink" /> Held back · data issue
            </span>
          }
          subtitle="Sent to Data/IT so you are never blamed for a broken sensor."
        >
          {flags.length ? (
            <ul className="flex flex-col gap-3">
              {flags.map((f) => (
                <li key={f.store_id + f.type} className="text-sm">
                  <p className="font-semibold text-foreground">
                    {f.store_id} · {f.type}
                  </p>
                  <p className="leading-relaxed text-muted-foreground">{f.detail}</p>
                  <p className="mt-0.5 text-xs font-semibold text-marigold-ink">Routed to {f.routed_to}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No data problems in your stores today.</p>
          )}
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <Star className="size-4 text-maroon" /> Role models · repeat customers
            </span>
          }
        >
          {roles.length ? (
            <ul className="flex flex-col gap-2">
              {roles.map((r) => (
                <li key={r.sp} className="flex items-baseline justify-between gap-3 text-sm">
                  <span>
                    <span className="font-semibold text-foreground">{r.name}</span>{" "}
                    <span className="text-muted-foreground">{r.store_id}</span>
                  </span>
                  <span className="tabular text-right">
                    <span className="font-bold text-maroon">{formatPct(r.rate)}</span>
                    <span className="text-muted-foreground"> vs {formatPct(r.city_med)} city</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No role model named in {am?.city} today.</p>
          )}
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <CalendarHeart className="size-4 text-maroon" /> Wedding dates ahead
            </span>
          }
          subtitle={state}
        >
          {upcoming.length ? (
            <div className="flex flex-wrap gap-1.5">
              {upcoming.slice(0, 14).map((u) => (
                <span
                  key={u.date}
                  className={
                    u.festival
                      ? "rounded-full bg-marigold px-2.5 py-1 text-xs font-bold text-accent-foreground"
                      : "rounded-full bg-maroon-soft px-2.5 py-1 text-xs font-semibold text-maroon"
                  }
                >
                  {formatShortDate(u.date)}
                  {u.festival ? ` · ${u.festival}` : ""}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No dates in the calendar ahead.</p>
          )}
        </Panel>
      </aside>
    </div>
  );
}
