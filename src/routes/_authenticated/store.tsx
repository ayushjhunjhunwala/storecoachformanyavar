import { createFileRoute, redirect } from "@tanstack/react-router";
import { homeFor } from "@/lib/coach/logic";
import { StoreView } from "@/components/coach/store-view";
import { ManagerGate, PageIntro, useCoachView } from "@/components/coach/view-gate";

export const Route = createFileRoute("/_authenticated/store")({
  beforeLoad: ({ context }) => {
    if (context.profile.role !== "store_lead") throw redirect({ to: homeFor(context.profile.role), replace: true });
  },
  head: () => ({
    meta: [
      { title: "Store lead · Store Coach" },
      { name: "description", content: "Huddle sheet, team table, mentors, callbacks and this week's actions for your store." },
      { property: "og:title", content: "Store lead · Store Coach" },
      { property: "og:description", content: "Everything a store lead needs for the morning huddle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const { profile } = Route.useRouteContext();
  const query = useCoachView();
  return (
    <>
      <PageIntro eyebrow="Store lead" title={profile.display_name} meta={`Morning huddle for ${profile.scope_id}`} />
      <ManagerGate query={query}>{(v) => <StoreView view={v} storeId={profile.scope_id ?? ""} />}</ManagerGate>
    </>
  );
}
