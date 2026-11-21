import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { homeFor } from "@/lib/coach/logic";
import { AmDigest } from "@/components/coach/am-digest";
import { ChatCard } from "@/components/coach/chat-drawer";
import { StoreView } from "@/components/coach/store-view";
import { ManagerGate, useCoachView } from "@/components/coach/view-gate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/am")({
  beforeLoad: ({ context }) => {
    if (context.profile.role !== "am") throw redirect({ to: homeFor(context.profile.role), replace: true });
  },
  head: () => ({
    meta: [
      { title: "This week's digest · Store Coach by Manyavar" },
      { name: "description", content: "Your ranked issues for the week, rupees at stake, actions with who and when, and 7-day follow-ups." },
      { property: "og:title", content: "This week's digest · Store Coach by Manyavar" },
      { property: "og:description", content: "Up to five ranked issues a week, each with the action, who and when." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AmPage,
});

function AmPage() {
  const { profile, userId } = Route.useRouteContext();
  const query = useCoachView();
  const view = query.data?.kind === "manager" ? query.data : undefined;
  const [storeId, setStoreId] = useState("");
  useEffect(() => {
    if (view && !view.stores[storeId]) setStoreId(view.store_order[0] ?? "");
  }, [view, storeId]);

  return (
    <ManagerGate query={query}>
      {(v) => (
        <div className="flex flex-col gap-14">
          <AmDigest view={v} amId={profile.scope_id ?? ""} chat={<ChatCard userId={userId} className="hidden lg:block" />} />
          <section aria-labelledby="my-stores" className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-10">
              <h2 id="my-stores" className="headline text-3xl text-foreground sm:text-4xl">
                Your stores
              </h2>
              <div className="flex flex-wrap gap-1 rounded-full bg-secondary p-1" role="tablist" aria-label="Choose a store">
                {v.store_order.map((id) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={id === storeId}
                    onClick={() => setStoreId(id)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-[0.95rem] transition-colors",
                      id === storeId ? "bg-card font-semibold text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
            {storeId && <StoreView view={v} storeId={storeId} />}
          </section>
        </div>
      )}
    </ManagerGate>
  );
}
