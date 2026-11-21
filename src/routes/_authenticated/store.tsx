import { createFileRoute, redirect } from "@tanstack/react-router";
import { homeFor } from "@/lib/coach/logic";
import { StoreView } from "@/components/coach/store-view";
import { ManagerGate, useCoachView } from "@/components/coach/view-gate";

export const Route = createFileRoute("/_authenticated/store")({
  beforeLoad: ({ context }) => {
    if (context.profile.role !== "store_lead") throw redirect({ to: homeFor(context.profile.role), replace: true });
  },
  head: () => ({
    meta: [
      { title: "Today's huddle · Store Coach by Manyavar" },
      { name: "description", content: "Your store's numbers, this week's action, today's cards, mentor pairs and customers to call." },
      { property: "og:title", content: "Today's huddle · Store Coach by Manyavar" },
      { property: "og:description", content: "Run the morning huddle from each person's card, with mentors and callbacks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const { profile } = Route.useRouteContext();
  const query = useCoachView();
  return <ManagerGate query={query}>{(v) => <StoreView view={v} storeId={profile.scope_id ?? ""} mode="lead" />}</ManagerGate>;
}
