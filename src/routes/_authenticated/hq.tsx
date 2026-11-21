import { useRef } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { homeFor } from "@/lib/coach/logic";
import { HqTiles, NotRaised } from "@/components/coach/hq-overview";
import { AmScorecard, RunLogTable } from "@/components/coach/manager-tables";
import { DrillDown, useDrillState } from "@/components/coach/drill-down";
import { SeedPanel } from "@/components/coach/seed-panel";
import { SectionHeading } from "@/components/coach/primitives";
import { ManagerGate, PageIntro, useCoachView } from "@/components/coach/view-gate";

export const Route = createFileRoute("/_authenticated/hq")({
  beforeLoad: ({ context }) => {
    if (context.profile.role !== "hq") throw redirect({ to: homeFor(context.profile.role), replace: true });
  },
  head: () => ({
    meta: [
      { title: "HQ dashboard · Store Coach" },
      { name: "description", content: "Guardrails, run log and every area manager digest across the Manyavar network." },
      { property: "og:title", content: "HQ dashboard · Store Coach" },
      { property: "og:description", content: "Guardrails, run log and every digest across 20 Manyavar stores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HqPage,
});

function HqPage() {
  const query = useCoachView();
  const view = query.data?.kind === "manager" ? query.data : undefined;
  const drill = useDrillState(view, { am: "AM-01", store: "LKO-02" });
  const drillRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <PageIntro eyebrow="HQ dashboard" title="The whole network, one replay" meta="Guardrails, run log and every digest" />
      <ManagerGate query={query}>
        {(v) => (
          <div className="flex flex-col gap-6">
            <HqTiles view={v} />
            <AmScorecard
              view={v}
              title="Issues per area manager"
              onOpen={(id) => {
                drill.setMode("am");
                drill.setAmId(id);
                drillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
            <NotRaised view={v} />
            <div ref={drillRef} className="scroll-mt-28">
              <SectionHeading>Look inside any digest or store</SectionHeading>
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
            <RunLogTable runs={v.runs} />
            <SeedPanel />
          </div>
        )}
      </ManagerGate>
    </>
  );
}
