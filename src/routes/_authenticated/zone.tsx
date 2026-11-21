import { useRef } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Database, MapPinned } from "lucide-react";
import { homeFor } from "@/lib/coach/logic";
import { formatRupees, formatShortDate } from "@/lib/coach/format";
import { AmScorecard, RunLogTable, followupCounts } from "@/components/coach/manager-tables";
import { DrillDown, useDrillState } from "@/components/coach/drill-down";
import { NotRaised } from "@/components/coach/hq-overview";
import { Panel, SectionHeading, StatTile } from "@/components/coach/primitives";
import { ManagerGate, PageIntro, useCoachView } from "@/components/coach/view-gate";

export const Route = createFileRoute("/_authenticated/zone")({
  beforeLoad: ({ context }) => {
    if (context.profile.role !== "zonal") throw redirect({ to: homeFor(context.profile.role), replace: true });
  },
  head: () => ({
    meta: [
      { title: "Zone dashboard · Store Coach" },
      { name: "description", content: "Market issues, data flags and the area manager scorecard for your zone." },
      { property: "og:title", content: "Zone dashboard · Store Coach" },
      { property: "og:description", content: "Market issues, data flags and area manager follow-ups for one zone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ZonePage,
});

function ZonePage() {
  const { profile } = Route.useRouteContext();
  const query = useCoachView();
  const view = query.data?.kind === "manager" ? query.data : undefined;
  const drill = useDrillState(view);
  const drillRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <PageIntro
        eyebrow="Zone dashboard"
        title={`${profile.scope_id} zone`}
        meta={view ? `${view.store_order.length} stores · ${view.area_managers.map((a) => a.city).join(", ")}` : undefined}
      />
      <ManagerGate query={query}>
        {(v) => {
          const weekNow = v.weeks[v.weeks.length - 1];
          const count = Object.values(weekNow?.by_am ?? {}).reduce((s, x) => s + x.count, 0);
          const rupees = Object.values(weekNow?.by_am ?? {}).reduce((s, x) => s + x.rupees, 0);
          const fu = followupCounts(v.followups);
          const measured = fu.improved + fu.no_change + fu.worse;
          return (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile label="Stores in zone" value={v.store_order.length} hint={`${v.area_managers.length} area managers`} />
                <StatTile label="Issues this week" value={count} hint={`Digest of ${formatShortDate(v.digest_date)}`} />
                <StatTile label="At stake this week" value={formatRupees(rupees)} hint="per 4 weeks, summed" />
                <StatTile
                  label="Follow-ups improved"
                  value={`${fu.improved} / ${measured}`}
                  tone={fu.improved >= fu.worse ? "good" : "bad"}
                  hint={`${fu.no_change} no change · ${fu.worse} worse`}
                />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel
                  title={
                    <span className="flex items-center gap-2">
                      <MapPinned className="size-4 text-teal" /> Market issues sent to you
                    </span>
                  }
                  subtitle="A whole city moving together. Store alerts for it are held back."
                >
                  {v.market.length ? (
                    <ul className="flex flex-col gap-3">
                      {v.market.map((m) => (
                        <li key={m.city} className="rounded-xl border-l-4 border-teal bg-teal-soft px-4 py-3 text-sm leading-relaxed">
                          <p className="font-bold text-foreground">{m.city}</p>
                          <p className="text-foreground/90">{m.text}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No city-wide slowdown in your zone on this date.</p>
                  )}
                </Panel>
                <Panel
                  title={
                    <span className="flex items-center gap-2">
                      <Database className="size-4 text-marigold-ink" /> Data flags
                    </span>
                  }
                  subtitle="Routed to Data/IT, never to an area manager."
                >
                  {v.flags.length ? (
                    <ul className="flex flex-col gap-3">
                      {v.flags.map((f) => (
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
                    <p className="text-sm text-muted-foreground">No data problems in your zone on this date.</p>
                  )}
                </Panel>
              </div>

              <AmScorecard
                view={v}
                title="Area manager scorecard"
                onOpen={(id) => {
                  drill.setMode("am");
                  drill.setAmId(id);
                  drillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />

              <div ref={drillRef} className="scroll-mt-28">
                <SectionHeading>Digests and stores in your zone</SectionHeading>
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

              <NotRaised view={v} scope="zone" />
              <RunLogTable runs={v.runs} />
            </div>
          );
        }}
      </ManagerGate>
    </>
  );
}
