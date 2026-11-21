import { useRef } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { homeFor } from "@/lib/coach/logic";
import { formatDayMonth } from "@/lib/coach/format";
import { ReplayPill, type HqTab } from "@/components/coach/app-shell";
import { DrillDown, useDrillState } from "@/components/coach/drill-down";
import { HqTiles, NotRaised } from "@/components/coach/hq-overview";
import { AmScorecard, RunLogTable } from "@/components/coach/manager-tables";
import { PageHeader } from "@/components/coach/primitives";
import { SeedPanel } from "@/components/coach/seed-panel";
import { ManagerGate, useCoachView } from "@/components/coach/view-gate";

const TABS: HqTab[] = ["guardrails", "runs", "digests"];

export const Route = createFileRoute("/_authenticated/hq")({
  validateSearch: (search: Record<string, unknown>): { tab?: HqTab } => {
    const tab = search["tab"];
    return typeof tab === "string" && (TABS as string[]).includes(tab) ? { tab: tab as HqTab } : {};
  },
  beforeLoad: ({ context }) => {
    if (context.profile.role !== "hq") throw redirect({ to: homeFor(context.profile.role), replace: true });
  },
  head: () => ({
    meta: [
      { title: "HQ insights · Store Coach by Manyavar" },
      { name: "description", content: "Guardrails, daily run history and every area manager's digest across the 20-store network." },
      { property: "og:title", content: "HQ insights · Store Coach by Manyavar" },
      { property: "og:description", content: "What the engine raised, what it chose not to raise, and how every run went." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HqPage,
});

function HqPage() {
  const { tab = "guardrails" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const query = useCoachView();
  const view = query.data?.kind === "manager" ? query.data : undefined;
  const drill = useDrillState(view);
  const drillRef = useRef<HTMLDivElement>(null);
  const first = view?.dates[0];
  const kicker = view && first ? `${formatDayMonth(first)} – ${formatDayMonth(view.date)} ${view.date.slice(0, 4)} · ${view.store_order.length} stores` : undefined;

  return (
    <>
      <PageHeader
        kicker={kicker}
        title={tab === "runs" ? "Runs" : tab === "digests" ? "Digests" : "Insights"}
        actions={<ReplayPill />}
      />
      <ManagerGate query={query}>
        {(v) => {
          if (tab === "runs") {
            return (
              <div className="flex flex-col gap-6">
                <RunLogTable runs={v.runs} title="Every daily run" />
                <SeedPanel />
              </div>
            );
          }
          if (tab === "digests") {
            return (
              <div className="flex flex-col gap-10">
                <AmScorecard
                  view={v}
                  onOpen={(id) => {
                    drill.setMode("am");
                    drill.setAmId(id);
                    drillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
                <div ref={drillRef} className="scroll-mt-32">
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
            );
          }
          return (
            <div className="flex flex-col gap-10">
              <HqTiles view={v} />
              <NotRaised view={v} />
              <RunLogTable runs={v.runs} limit={3} />
              <p className="text-[0.95rem] text-muted-foreground">
                Looking for one area manager's issues?{" "}
                <button type="button" className="text-primary hover:underline" onClick={() => void navigate({ search: { tab: "digests" } })}>
                  Open digests
                </button>
                .
              </p>
            </div>
          );
        }}
      </ManagerGate>
    </>
  );
}
