import { Info, MessageSquareText, PhoneCall, Users } from "lucide-react";
import type { ManagerView, StoreBundle, TeamRow } from "@/lib/coach/types";
import { followupKey } from "@/lib/coach/logic";
import {
  FOCUS_LABEL,
  formatDateWithYear,
  RESULT_LABEL,
  formatNumber,
  formatPct,
  formatRupees,
  formatShortDate,
} from "@/lib/coach/format";
import { cn } from "@/lib/utils";
import { EmptyNote, LeverChip, Panel, StatTile, resultTone } from "./primitives";

const KIND_LABEL: Record<string, string> = {
  praise: "Praise",
  kur: "Jacket with kurta",
  ipb: "Items per bill",
  disc: "Discount",
  shw: "Sherwani add-ons",
};

function flagRow(t: TeamRow): boolean {
  return (t.wkend_off ?? 0) >= 0.5 || (t.disc ?? 0) >= 0.03;
}

function compare(value: number | null | undefined, ref: number | null | undefined): "good" | "bad" | "default" {
  if (value == null || ref == null) return "default";
  return value >= ref ? "good" : "bad";
}

export function StoreView({ view, storeId }: { view: ManagerView; storeId: string }) {
  const bundle: StoreBundle | undefined = view.stores[storeId];
  if (!bundle) return <EmptyNote>This store is not in your view.</EmptyNote>;
  const k = bundle.kpi;
  const issues = view.digest.filter((i) => i.store_id === storeId).sort((a, b) => a.rank - b.rank);
  const followups = new Map(view.followups.map((f) => [f.key, f]));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
            {storeId} <span className="font-semibold text-muted-foreground">· {bundle.meta.city}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Tier {bundle.meta.tier} · opened {formatDateWithYear(bundle.meta.opened_on)}
            {bundle.lead_name ? ` · store lead ${bundle.lead_name}` : ""} · last 4 weeks
          </p>
        </div>
      </div>

      {k ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Conversion"
            value={formatPct(k.conv)}
            tone={compare(k.conv, k.conv_tier)}
            hint={
              <>
                Tier {formatPct(k.conv_tier)} · last year {formatPct(k.ly_conv)}
              </>
            }
          />
          <StatTile
            label="Items per bill"
            value={k.ipb.toFixed(2)}
            tone={compare(k.ipb, k.ipb_tier)}
            hint={<>Tier {k.ipb_tier.toFixed(2)}</>}
          />
          <StatTile
            label="Average bill"
            value={formatRupees(k.atv)}
            tone={compare(k.atv, k.atv_tier)}
            hint={<>Tier {formatRupees(k.atv_tier)}</>}
          />
          <StatTile
            label="Bills"
            value={formatNumber(k.bills)}
            tone={k.ly_bills ? compare(k.bills, k.ly_bills) : "default"}
            hint={k.ly_bills ? <>vs {formatNumber(k.ly_bills)} same weeks last year</> : <>No last-year bills</>}
          />
        </div>
      ) : (
        <EmptyNote>No store numbers for this date.</EmptyNote>
      )}

      {(bundle.flags.length > 0 || k?.new_store) && (
        <div className="flex flex-col gap-2">
          {k?.new_store && (
            <p className="flex items-start gap-2 rounded-xl border border-teal/30 bg-teal-soft px-4 py-3 text-sm text-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-teal" />
              <span>
                <b>Data note:</b> new store, opened {formatDateWithYear(bundle.meta.opened_on)}. It is compared with{" "}
                {bundle.meta.tier}-tier peers only, not with last year.
              </span>
            </p>
          )}
          {bundle.flags.map((f) => (
            <p
              key={f.type}
              className="flex items-start gap-2 rounded-xl border border-marigold/40 bg-marigold-soft px-4 py-3 text-sm text-foreground"
            >
              <Info className="mt-0.5 size-4 shrink-0 text-marigold-ink" />
              <span>
                <b>Data note:</b> {f.type}. {f.detail} Routed to {f.routed_to}.
              </span>
            </p>
          ))}
        </div>
      )}

      <Panel title="This week's actions from your area manager" subtitle={`Digest of ${formatShortDate(view.digest_date)}`}>
        {issues.length ? (
          <ul className="flex flex-col gap-3">
            {issues.map((i) => {
              const f = followups.get(followupKey(i));
              return (
                <li key={i.id} className="rounded-xl border border-border bg-ivory p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <LeverChip lever={i.lever} />
                    <span className="font-bold text-foreground">{i.title}</span>
                    <span className="ml-auto rupee-figure text-lg text-maroon">{formatRupees(i.rupees)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">{i.action}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {i.when} · {i.who}
                  </p>
                  {f?.latest && (
                    <p className={cn("mt-2 rounded-lg border px-2.5 py-1.5 text-xs", resultTone[f.latest.result])}>
                      <b>
                        Follow-up {formatShortDate(f.latest.on)} · {RESULT_LABEL[f.latest.result]}:
                      </b>{" "}
                      <span className="text-foreground/85">{f.latest.text}</span>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No actions for {storeId} this week.</p>
        )}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title={
            <span className="flex items-center gap-2">
              <MessageSquareText className="size-4 text-maroon" /> Huddle sheet
            </span>
          }
          subtitle={`Today's cards, ${bundle.cards.length} people`}
        >
          {bundle.cards.length ? (
            <ul className="flex max-h-[34rem] flex-col gap-2 overflow-y-auto pr-1">
              {bundle.cards.map((c) => (
                <li key={c.sp} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{c.name}</span>
                    <span className="flex items-center gap-1.5">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.7rem] font-bold text-secondary-foreground">
                        {KIND_LABEL[c.kind] ?? c.kind}
                      </span>
                      <span className="tabular text-xs text-muted-foreground">{c.words} words</span>
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/90">{c.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No cards for this date.</p>
          )}
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel
            title={
              <span className="flex items-center gap-2">
                <Users className="size-4 text-teal" /> Mentor pairs
              </span>
            }
          >
            {bundle.mentors.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {bundle.mentors.map((m) => (
                  <li key={m.mentee + m.mentor} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="font-semibold text-foreground">{m.mentee_name}</span>
                      <span className="text-muted-foreground"> learns from </span>
                      <span className="font-semibold text-foreground">{m.mentor_name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {FOCUS_LABEL[m.focus] ?? m.focus} · {formatPct(m.overlap, 0)} shifts together
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No mentor pairs today.</p>
            )}
          </Panel>

          <Panel
            title={
              <span className="flex items-center gap-2">
                <PhoneCall className="size-4 text-maroon" /> Top callbacks
              </span>
            }
            subtitle={`Top ${bundle.callbacks.items.length} of ${formatNumber(bundle.callbacks.total)} past customers to call`}
          >
            {bundle.callbacks.items.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {bundle.callbacks.items.map((c) => (
                  <li key={c.cust + c.date} className="grid grid-cols-[1fr_auto] gap-x-3 py-2 text-sm">
                    <span className="font-semibold text-foreground">
                      {c.cust} <span className="font-normal text-muted-foreground">· {formatDateWithYear(c.date)}</span>
                    </span>
                    <span className="tabular font-bold text-maroon">{formatRupees(c.value)}</span>
                    <span className="col-span-2 text-xs text-muted-foreground">
                      {c.bought} · served by {c.served_by}
                      {c.owner_name ? ` · call: ${c.owner_name}` : " · call: unassigned"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No callbacks listed.</p>
            )}
          </Panel>
        </div>
      </div>

      <TeamTable team={bundle.team} asOf={view.team_as_of} />
    </div>
  );
}

export function TeamTable({ team, asOf }: { team: TeamRow[]; asOf: string | null }) {
  return (
    <Panel
      title="Team"
      subtitle={`${team.length} people · stats as of ${formatShortDate(asOf)} · shaded: weekend off ≥ 50% or discount ≥ 3%`}
      bodyClassName="px-0 py-0 sm:px-0"
    >
      {team.length === 0 ? (
        <div className="p-4">
          <EmptyNote>No team stats yet.</EmptyNote>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-semibold">Name</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Bills 28d</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Items/bill</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Kurta + jacket</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Discount</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Weekend off</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Repeat</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {team.map((t) => (
                  <tr
                    key={t.salesperson_id}
                    className={cn("border-b border-border/60 last:border-0", flagRow(t) && "bg-worse-soft")}
                  >
                    <td className="px-5 py-2.5 font-semibold text-foreground">{t.name}</td>
                    <td className="px-3 py-2.5 text-right">{t.bills28}</td>
                    <td className="px-3 py-2.5 text-right">{t.ipb == null ? "—" : t.ipb.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {formatPct(t.kur_rate)} <span className="text-xs text-muted-foreground">of {t.kur}</span>
                    </td>
                    <td className={cn("px-3 py-2.5 text-right", (t.disc ?? 0) >= 0.03 && "font-bold text-worse")}>
                      {formatPct(t.disc)}
                    </td>
                    <td className={cn("px-3 py-2.5 text-right", (t.wkend_off ?? 0) >= 0.5 && "font-bold text-worse")}>
                      {formatPct(t.wkend_off, 0)}
                    </td>
                    <td className="px-5 py-2.5 text-right">{formatPct(t.repeat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col divide-y divide-border md:hidden">
            {team.map((t) => (
              <li key={t.salesperson_id} className={cn("px-4 py-3", flagRow(t) && "bg-worse-soft")}>
                <p className="font-semibold text-foreground">{t.name}</p>
                <dl className="tabular mt-1 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Bills 28d</dt>
                    <dd className="font-semibold">{t.bills28}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Items/bill</dt>
                    <dd className="font-semibold">{t.ipb == null ? "—" : t.ipb.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Kurta + jacket</dt>
                    <dd className="font-semibold">{formatPct(t.kur_rate)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Discount</dt>
                    <dd className={cn("font-semibold", (t.disc ?? 0) >= 0.03 && "text-worse")}>{formatPct(t.disc)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Weekend off</dt>
                    <dd className={cn("font-semibold", (t.wkend_off ?? 0) >= 0.5 && "text-worse")}>
                      {formatPct(t.wkend_off, 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Repeat</dt>
                    <dd className="font-semibold">{formatPct(t.repeat)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
