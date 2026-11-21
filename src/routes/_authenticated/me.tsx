import { createFileRoute, redirect } from "@tanstack/react-router";
import { homeFor } from "@/lib/coach/logic";
import { SalespersonView } from "@/components/coach/salesperson-view";
import { SalespersonGate, useCoachView } from "@/components/coach/view-gate";

export const Route = createFileRoute("/_authenticated/me")({
  beforeLoad: ({ context }) => {
    if (context.profile.role !== "salesperson") throw redirect({ to: homeFor(context.profile.role), replace: true });
  },
  head: () => ({
    meta: [
      { title: "Today · Store Coach by Manyavar" },
      { name: "description", content: "Your one thing for today, your progress against your own history, your mentor and your callbacks." },
      { property: "og:title", content: "Today · Store Coach by Manyavar" },
      { property: "og:description", content: "One thing to do better today, with a colleague to learn from." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MePage,
});

function MePage() {
  const query = useCoachView();
  return <SalespersonGate query={query}>{(v) => <SalespersonView view={v} />}</SalespersonGate>;
}
