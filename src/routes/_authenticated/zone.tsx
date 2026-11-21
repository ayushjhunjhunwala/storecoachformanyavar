import { useRef } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import type { ManagerView, MarketIssue } from "@/lib/coach/types";
import { addDays, homeFor } from "@/lib/coach/logic";
import { formatNumber, formatPct, formatRange } from "@/lib/coach/format";
import { DrillDown, useDrillState } from "@/components/coach/drill-down";
import { AmList } from "@/components/coach/manager-tables";
import { Card, DataTable, PageHeader } from "@/components/coach/primitives";
import { ManagerGate, useCoachView } from "@/components/coach/view-gate";

export const Route = createFileRoute("/_authenticated/zone")({
  beforeLoad: ({ context }) => {
    if (context.profile.role !== "zonal") throw redirect({ to: homeFor(context.profile.role), replace: true });
  },
  head: () => ({
    meta: [
      { title: "Zone · Store Coach by Manyavar" },
      { name: "description", content: "Market issues, area managers this week, data flags and every store in your zone." },
      { property: "og:title", content: "Zone · Store Coach by Manyavar" },
      { property: "og:description", content: "Market versus store: what's city-wide, what's one store, and who is acting on it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ZonePage,
});

function joinCities(cities: string[]): string {
  if (cities.length <= 1) return cities.join("");
  return `${cities.slice(0, -1).join(", ")} and ${cities[cities.length - 1]}`;
}

function MarketBars({ market, date }: { market: MarketIssue; date: string }) {
  const weekly = market.weekly ?? [];
  const maxAbs = Math.max(0.01, ...weekly.map((v) => Math.abs(v)));
  const n = weekly.length;
  return (
    <Card title={`${market.city} vs the other cities`} aside="Walk-ins vs the same week last year">
      <table className="w-full text-[0.95rem]">
        <caption className="sr-only">
          {market.city} walk-ins compared with the same week last year, last {n} weeks
        </caption>
        <tbody>
          {weekly.map((v, i) => {
            const end = addDays(date, -7 * (n - 1 - i));
            const start = addDays(end, -6);
            return (
              <tr key={end}>
                <th scope="row" className="w-32 py-1.5 pr-3 text-left font-normal text-muted-foreground">
                  {formatRange(start, end)}
                </th>
                <td className="py-1.5">
                  <div className="h-8 rounded-lg bg-secondary">
                    <div className="h-full rounded-lg bg-warn" style={{ width: `${(Math.abs(v) / maxAbs) * 100}%` }} />
                  </div>
                </td>
                <td className="tabular w-20 py-1.5 pl-3 text-right font-semibold text-foreground">
                  {v < 0 ? "−" : "+"}
                  {Math.abs(v * 100).toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-5 text-[1.05rem] leading-relaxed text-foreground/85">{market.text}</p>
    </Card>
  );
}

function StoresTable({ view }: { view: ManagerView }) {
  return (
    <Card title="Stores · last 28 days">
      <DataTable
        minWidth={600}
        columns={[
          { label: "Store" },
          { label: "Bills", align: "right" },
          { label: "Last year", align: "right" },
          { label: "Conversion", align: "right" },
          { label: "Last year", align: "right" },
        ]}
      >
        {view.store_order.map((id) => {
          const k = view.stores[id]?.kpi;
          return (
            <tr key={id}>
              <td className="text-foreground">
                {id}
                {k?.new_store && <span className="ml-2 text-sm text-muted-foreground">new store</span>}
              </td>
              <td className="text-right">{k ? formatNumber(k.bills) : "—"}</td>
              <td className="text-right">{k?.ly_bills ? formatNumber(k.ly_bills) : "—"}</td>
              <td className="text-right">{formatPct(k?.conv)}</td>
              <td className="text-right">{formatPct(k?.ly_conv)}</td>
            </tr>
          );
        })}
      </DataTable>
    </Card>
  );
}

function ZonePage() {
  const { profile } = Route.useRouteContext();
  const query = useCoachView();
  const view = query.data?.kind === "manager" ? query.data : undefined;
  const drill = useDrillState(view);
  const drillRef = useRef<HTMLDivElement>(null);
  const cities = view ? [...new Set(view.area_managers.map((a) => a.city))] : [];
  const marketCities = view?.market.map((m) => m.city) ?? [];
  const title = marketCities.length
    ? `${joinCities(marketCities)} ${marketCities.length === 1 ? "is a market problem, not a store problem." : "are market problems, not store problems."}`
    : "No city is slowing on its own.";

  return (
    <>
      <PageHeader
        kicker={view ? `${profile.scope_id} zone · ${joinCities(cities)} · ${view.store_order.length} stores` : `${profile.scope_id} zone`}
        title={view ? title : `${profile.scope_id} zone`}
      />
      <ManagerGate query={query}>
        {(v) => (
          <div className="flex flex-col gap-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)]">
              <div className="flex flex-col gap-6">
                {v.market.length ? (
                  v.market.map((m) => <MarketBars key={m.city} market={m} date={v.date} />)
                ) : (
                  <Card title="Market check">
                    <p className="text-[1.05rem] leading-relaxed text-foreground/85">
                      No city in your zone is moving on its own this week, so store alerts go to area managers as usual.
                    </p>
                  </Card>
                )}
              </div>
              <div className="flex flex-col gap-6">
                <AmList
                  view={v}
                  onOpen={(id) => {
                    drill.setMode("am");
                    drill.setAmId(id);
                    drillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
                <Card title={`Data flags in ${profile.scope_id}`}>
                  {v.flags.length ? (
                    <ul className="flex flex-col gap-3">
                      {v.flags.map((f) => (
                        <li key={f.store_id + f.type} className="text-[0.95rem] leading-relaxed">
                          <p className="font-semibold text-foreground">
                            {f.store_id}: {f.type}
                          </p>
                          <p className="text-muted-foreground">
                            {f.detail} Routed to {f.routed_to}.
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[1.05rem] text-foreground/85">None this week.</p>
                  )}
                </Card>
              </div>
            </div>
            <StoresTable view={v} />
            <div ref={drillRef} className="scroll-mt-32 border-t border-border pt-10">
              <h2 className="headline mb-6 text-3xl text-foreground sm:text-4xl">Digests and stores</h2>
              <DrillDown
                view={v}
                mode={drill.mode}
                onModeChange={drill.setMode}
                amId={drill.amId}
                onAmChange={drill.setAmId}
                storeId={drill.storeId}
                onStoreChange={drill.setStoreId}
              />
            </div>
          </div>
        )}
      </ManagerGate>
    </>
  );
}
