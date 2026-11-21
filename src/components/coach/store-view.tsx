import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import type { CallbackView, Issue, ManagerView, StoreBundle, TeamRow } from "@/lib/coach/types";
import {
  FOCUS_LABEL,
  cardBody,
  formatDateWithYear,
  formatNumber,
  formatPct,
  formatRupees,
  formatRupeesPrecise,
  formatShortDate,
} from "@/lib/coach/format";
import { cardStatusQueryOptions } from "@/lib/coach/queries";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MentorPairs } from "./mentor-pairs";
import { Card, DataTable, EmptyNote, PageHeader, StatTile } from "./primitives";
import { BoardActionControls } from "./action-panel";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function flagRow(t: TeamRow): boolean {
  return (t.wkend_off ?? 0) >= 0.5 || (t.disc ?? 0) >= 0.03;
}

function KpiTiles({ bundle, view }: { bundle: StoreBundle; view: ManagerView }) {
  const k = bundle.kpi;
  if (!k) return <EmptyNote>No store numbers for this date.</EmptyNote>;
  const tier = bundle.meta.tier;
  const diwaliAhead = Object.values(view.upcoming)
    .flat()
    .some((u) => u.festival === "Diwali" && u.date > view.date);
  const convUp = k.conv != null && k.conv_tier != null ? k.conv >= k.conv_tier : null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Conversion · 28 days"
        value={formatPct(k.conv)}
        tone={convUp == null ? "neutral" : convUp ? "good" : "bad"}
        {...(convUp == null ? {} : { arrow: convUp ? ("up" as const) : ("down" as const) })}
        delta={
          k.new_store
            ? `${formatPct(k.conv_tier)} ${tier} peers · new store`
            : `${formatPct(k.conv_tier)} ${tier} peers · ${formatPct(k.ly_conv)} last year`
        }
      />
      <StatTile
        label="Items per bill"
        value={k.ipb.toFixed(2)}
        tone={k.ipb >= k.ipb_tier ? "good" : "bad"}
        arrow={k.ipb >= k.ipb_tier ? "up" : "down"}
        delta={`${k.ipb_tier.toFixed(2)} ${tier} peers`}
      />
      <StatTile
        label="Average bill"
        value={formatRupeesPrecise(k.atv)}
        tone={k.atv >= k.atv_tier ? "good" : "bad"}
        arrow={k.atv >= k.atv_tier ? "up" : "down"}
        delta={`${formatRupeesPrecise(k.atv_tier)} ${tier} peers`}
      />
      <StatTile
        label="Bills · 28 days"
        value={formatNumber(k.bills)}
        delta={
          k.new_store || !k.ly_bills
            ? `New store, opened ${formatDateWithYear(bundle.meta.opened_on)}`
            : `${formatNumber(k.ly_bills)} same weeks last year${diwaliAhead ? " (Diwali shift)" : ""}`
        }
      />
    </div>
  );
}

function ActionBanner({ issue, amName, interactive }: { issue: Issue; amName: string; interactive: boolean }) {
  return (
    <div className="surface flex flex-col gap-4 p-6 sm:p-7">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-primary">From {amName}, this week</p>
        <p className="mt-1 text-[1.05rem] leading-relaxed text-foreground sm:text-lg">{issue.action}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          <Link to="/issue/$issueId" params={{ issueId: issue.id }} className="hover:underline">
            {issue.title}
          </Link>{" "}
          · {issue.when}
        </p>
      </div>
      {interactive && <BoardActionControls issue={issue} />}
    </div>
  );
}

function CardsOnFloor({ bundle, date }: { bundle: StoreBundle; date: string }) {
  const statuses = useQuery(cardStatusQueryOptions(date));
  const maxWords = Math.max(0, ...bundle.cards.map((c) => c.words));
  return (
    <Card
      title="Cards on the floor today"
      aside={
        bundle.cards.length
          ? `${bundle.cards.length} people · ${maxWords < 60 ? "all under 60 words" : `longest ${maxWords} words`}`
          : undefined
      }
    >
      {bundle.cards.length === 0 ? (
        <p className="text-[1.05rem] text-muted-foreground">No cards for this date.</p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {bundle.cards.map((c) => {
            const s = statuses.data?.[c.sp];
            return (
              <li key={c.sp} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[9.5rem_minmax(0,1fr)_auto]">
                <div>
                  <p className="text-[1.05rem] font-semibold text-foreground">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{FOCUS_LABEL[c.kind] ?? c.kind}</p>
                </div>
                <p className="text-[1.02rem] leading-relaxed text-foreground">{cardBody(c.text, c.name)}</p>
                <p
                  className={cn(
                    "text-sm sm:text-right",
                    s === "done" ? "font-medium text-good" : s === "not_today" ? "font-medium text-warn" : "text-muted-foreground",
                  )}
                >
                  {statuses.isPending ? "…" : s === "done" ? "Done" : s === "not_today" ? "Not today" : "Pending"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function CallbacksCard({ bundle, view }: { bundle: StoreBundle; view: ManagerView }) {
  const state = bundle.meta.state;
  const firstWedding = (view.upcoming[state] ?? []).find((u) => u.wedding && u.date > view.date);
  const month = firstWedding ? MONTH_NAMES[Number(firstWedding.date.slice(5, 7)) - 1] : null;
  const items: CallbackView[] = bundle.callbacks.items;
  return (
    <Card
      title={month ? `Call before the ${month} wedding dates` : "Customers to call"}
      subtitle={`${formatNumber(bundle.callbacks.total)} past customers haven't been back. Top ${items.length} by value.`}
    >
      {items.length === 0 ? (
        <p className="text-[1.05rem] text-muted-foreground">No callbacks listed.</p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {items.map((c) => (
            <li key={c.cust + c.date} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="tabular text-[1.02rem] text-foreground">{c.cust}</span>
                <span className="tabular font-semibold text-foreground">{formatRupees(c.value)}</span>
              </div>
              <p className="text-sm text-muted-foreground">{c.bought}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateWithYear(c.date)} · served by {c.served_by} · {c.owner_name ? `call: ${c.owner_name}` : "unassigned"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function StoreView({
  view,
  storeId,
  mode = "manager",
}: {
  view: ManagerView;
  storeId: string;
  /** "lead" is the store lead's own huddle page; "manager" embeds it in another dashboard. */
  mode?: "lead" | "manager";
}) {
  const bundle: StoreBundle | undefined = view.stores[storeId];
  if (!bundle) return <EmptyNote>This store is not in your view.</EmptyNote>;
  const issues = view.digest.filter((i) => i.store_id === storeId).sort((a, b) => a.rank - b.rank);
  const am = view.area_managers.find((a) => a.area_manager_id === bundle.meta.area_manager_id);
  const amName = am?.name ?? "your area manager";
  const kicker = `${storeId} · ${bundle.meta.city} · tier ${bundle.meta.tier}`;
  const lead = mode === "lead";

  return (
    <div className="flex flex-col gap-6">
      {lead ? (
        <PageHeader
          kicker={kicker}
          title="Today's huddle"
          actions={
            <Button variant="white" asChild>
              <Link to="/store/roster">
                <CalendarDays /> Roster planner
              </Link>
            </Button>
          }
        />
      ) : (
        <div>
          <p className="text-[0.95rem] text-muted-foreground">
            {bundle.lead_name ? `Store lead ${bundle.lead_name}` : "Store"} · opened {formatDateWithYear(bundle.meta.opened_on)}
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-foreground">{kicker}</h2>
        </div>
      )}

      <KpiTiles bundle={bundle} view={view} />

      {bundle.flags.map((f) => (
        <p key={f.type} className="rounded-2xl bg-warn-soft px-5 py-3.5 text-[0.95rem] leading-relaxed text-warn">
          <b className="font-semibold">Data note: {f.type}.</b> {f.detail} Routed to {f.routed_to}.
        </p>
      ))}

      {issues.length ? (
        issues.map((i) => <ActionBanner key={i.id} issue={i} amName={amName} interactive={lead} />)
      ) : (
        <div className="surface p-6 sm:p-7">
          <p className="text-sm font-semibold text-primary">From {amName}, this week</p>
          <p className="mt-1 text-[1.05rem] text-muted-foreground">No actions for {storeId} in the digest of {formatShortDate(view.digest_date)}.</p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
        <CardsOnFloor bundle={bundle} date={view.date} />
        <div className="flex flex-col gap-6">
          <MentorPairs storeId={storeId} date={view.date} mentors={bundle.mentors} team={bundle.team} interactive={lead} />
          <CallbacksCard bundle={bundle} view={view} />
        </div>
      </div>

      <TeamTable team={bundle.team} asOf={view.team_as_of} />
    </div>
  );
}

export function TeamTable({ team, asOf }: { team: TeamRow[]; asOf: string | null }) {
  return (
    <Card
      title="Team"
      aside={`${team.length} people · as of ${formatShortDate(asOf)}`}
      subtitle="Shaded: weekend off at least 50% or discount at least 3%."
    >
      {team.length === 0 ? (
        <EmptyNote>No team stats yet.</EmptyNote>
      ) : (
        <DataTable
          minWidth={720}
          columns={[
            { label: "Name" },
            { label: "Bills · 28 days", align: "right" },
            { label: "Items per bill", align: "right" },
            { label: "Kurta + jacket", align: "right" },
            { label: "Discount", align: "right" },
            { label: "Weekend off", align: "right" },
            { label: "Repeat", align: "right" },
          ]}
        >
          {team.map((t) => (
            <tr key={t.salesperson_id} className={cn(flagRow(t) && "bg-bad-soft")}>
              <td className="font-medium text-foreground">{t.name}</td>
              <td className="text-right">{t.bills28}</td>
              <td className="text-right">{t.ipb == null ? "—" : t.ipb.toFixed(2)}</td>
              <td className="text-right">
                {formatPct(t.kur_rate)} <span className="text-sm text-muted-foreground">of {t.kur}</span>
              </td>
              <td className={cn("text-right", (t.disc ?? 0) >= 0.03 && "font-semibold text-bad")}>{formatPct(t.disc)}</td>
              <td className={cn("text-right", (t.wkend_off ?? 0) >= 0.5 && "font-semibold text-bad")}>{formatPct(t.wkend_off, 0)}</td>
              <td className="text-right">{formatPct(t.repeat)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </Card>
  );
}
