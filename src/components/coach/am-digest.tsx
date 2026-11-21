import type { ReactNode } from "react";
import type { ManagerView } from "@/lib/coach/types";
import { followupKey } from "@/lib/coach/logic";
import { describeUpcoming, formatPct, formatRupees, formatWeekdayDayMonth } from "@/lib/coach/format";
import { IssueCard } from "./issue-card";
import { Card, Chip, EmptyNote, PageHeader } from "./primitives";

export function digestHeadline(count: number, rupees: number): string {
  if (count === 0) return "No issues this week.";
  return `${count} ${count === 1 ? "issue" : "issues"}. ${formatRupees(rupees)} at stake.`;
}

export function AmDigest({
  view,
  amId,
  chat,
  showManager = false,
  interactive = true,
}: {
  view: ManagerView;
  amId: string;
  /** Inline Ask Store Coach card, shown at the top of the right column. */
  chat?: ReactNode;
  /** Name the area manager in the line above the headline (HQ / zone drill-down). */
  showManager?: boolean;
  interactive?: boolean;
}) {
  const am = view.area_managers.find((a) => a.area_manager_id === amId);
  const issues = view.digest.filter((i) => i.area_manager_id === amId).sort((a, b) => a.rank - b.rank);
  const total = issues.reduce((sum, i) => sum + i.rupees, 0);
  const followups = new Map(view.followups.map((f) => [f.key, f]));
  const storeIds = view.store_order.filter((id) => view.stores[id]?.meta.area_manager_id === amId);
  const state = storeIds[0] ? view.stores[storeIds[0]]?.meta.state : undefined;
  const market = view.market.filter((m) => m.city === am?.city);
  const flags = view.flags.filter((f) => storeIds.includes(f.store_id));
  const roles = view.roles.filter((r) => r.city === am?.city);
  const upcoming = (state ? view.upcoming[state] : undefined) ?? [];
  const upcomingText = describeUpcoming(upcoming);
  const maxAlerts = am?.max_alerts_per_week ?? "5";

  const kicker = [
    `Week of ${formatWeekdayDayMonth(view.digest_date)}`,
    showManager && am ? `${am.name}, ${am.city}` : null,
    storeIds.join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-10">
      <div className="flex min-w-0 flex-col gap-6">
        <PageHeader
          kicker={kicker}
          title={digestHeadline(issues.length, total)}
          sub={
            issues.length
              ? `Ranked by rupees over the next 4 weeks. At most ${maxAlerts} a week.`
              : `Nothing in ${am?.city ?? "these stores"} is worth an action this week. At most ${maxAlerts} a week.`
          }
        />
        {issues.length === 0 ? (
          <EmptyNote className="surface py-10 text-base">The engine checked every store and found nothing to raise.</EmptyNote>
        ) : (
          issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} followup={followups.get(followupKey(issue))} date={view.date} interactive={interactive} />
          ))
        )}
      </div>

      <aside className="flex flex-col gap-6 lg:pt-2">
        {chat}
        <Card title="Recognise this week">
          {roles.length ? (
            <ul className="flex flex-col gap-3">
              {roles.map((r) => (
                <li key={r.sp} className="text-[1.05rem] leading-relaxed text-foreground">
                  <b className="font-semibold">{r.name}</b>, {r.store_id}: {formatPct(r.rate)} of first-time customers came back, against{" "}
                  {formatPct(r.city_med)} for {r.city}.
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[1.05rem] text-muted-foreground">No one stands out in {am?.city ?? "these stores"} on this date.</p>
          )}
        </Card>

        <Card title="Wedding dates ahead">
          <p className="text-[1.05rem] leading-relaxed text-foreground/85">
            {upcomingText ? `${upcomingText}. Keep weekly offs away from these dates.` : "No wedding dates or festivals in the calendar ahead."}
          </p>
        </Card>

        {market.length > 0 && (
          <Card title="Held back: market" aside={<Chip tone="info" size="sm">To zonal head</Chip>}>
            {market.map((m) => (
              <p key={m.city} className="text-[0.95rem] leading-relaxed text-foreground/85">
                {m.text}
              </p>
            ))}
          </Card>
        )}

        {flags.length > 0 && (
          <Card title="Held back: data" aside={<Chip tone="warn" size="sm">To Data/IT</Chip>}>
            <ul className="flex flex-col gap-3">
              {flags.map((f) => (
                <li key={f.store_id + f.type} className="text-[0.95rem] leading-relaxed">
                  <p className="font-semibold text-foreground">
                    {f.store_id}: {f.type}
                  </p>
                  <p className="text-muted-foreground">{f.detail}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </aside>
    </div>
  );
}
