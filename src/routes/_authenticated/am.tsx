import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { homeFor } from "@/lib/coach/logic";
import { AmDigest } from "@/components/coach/am-digest";
import { StoreView } from "@/components/coach/store-view";
import { SectionHeading } from "@/components/coach/primitives";
import { ManagerGate, PageIntro, useCoachView } from "@/components/coach/view-gate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/am")({
  beforeLoad: ({ context }) => {
    if (context.profile.role !== "am") throw redirect({ to: homeFor(context.profile.role), replace: true });
  },
  head: () => ({
    meta: [
      { title: "Area manager digest · Store Coach" },
      { name: "description", content: "Your weekly ranked issues, rupees at stake, follow-ups and store views." },
      { property: "og:title", content: "Area manager digest · Store Coach" },
      { property: "og:description", content: "Up to five ranked issues a week with the action, who and when." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AmPage,
});

function AmPage() {
  const { profile } = Route.useRouteContext();
  const query = useCoachView();
  const view = query.data?.kind === "manager" ? query.data : undefined;
  const [storeId, setStoreId] = useState("");
  useEffect(() => {
    if (view && !view.stores[storeId]) setStoreId(view.store_order[0] ?? "");
  }, [view, storeId]);
  const am = view?.area_managers[0];

  return (
    <>
      <PageIntro
        eyebrow="Area manager"
        title={profile.display_name}
        meta={am ? `${am.city} · ${am.area_manager_id} · ${am.stores}` : profile.scope_id}
      />
      <ManagerGate query={query}>
        {(v) => (
          <div className="flex flex-col gap-8">
            <AmDigest view={v} amId={profile.scope_id ?? ""} />
            <section>
              <SectionHeading
                aside={
                  <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Choose a store">
                    {v.store_order.map((id) => (
                      <button
                        key={id}
                        role="tab"
                        aria-selected={id === storeId}
                        onClick={() => setStoreId(id)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-sm font-semibold transition-colors",
                          id === storeId
                            ? "border-maroon bg-maroon text-on-maroon"
                            : "border-border bg-card text-foreground hover:border-maroon/40",
                        )}
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                }
              >
                My stores
              </SectionHeading>
              {storeId && <StoreView view={v} storeId={storeId} />}
            </section>
          </div>
        )}
      </ManagerGate>
    </>
  );
}
