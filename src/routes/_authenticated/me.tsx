import { createFileRoute, redirect } from "@tanstack/react-router";
import { homeFor } from "@/lib/coach/logic";
import { SalespersonView } from "@/components/coach/salesperson-view";
import { PageIntro, SalespersonGate, useCoachView } from "@/components/coach/view-gate";

export const Route = createFileRoute("/_authenticated/me")({
  beforeLoad: ({ context }) => {
    if (context.profile.role !== "salesperson") throw redirect({ to: homeFor(context.profile.role), replace: true });
  },
  head: () => ({
    meta: [
      { title: "My card · Store Coach" },
      { name: "description", content: "Your daily coaching card, your progress, your mentor and your callbacks." },
      { property: "og:title", content: "My card · Store Coach" },
      { property: "og:description", content: "One thing to do better today, with a colleague to learn from." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MePage,
});

function MePage() {
  const { profile } = Route.useRouteContext();
  const query = useCoachView();
  const first = profile.display_name.split(" ")[0] ?? profile.display_name;
  return (
    <>
      <PageIntro eyebrow="My Store Coach" title={`Namaste, ${first}`} meta="Your card for today, and how you're moving" />
      <SalespersonGate query={query}>{(v) => <SalespersonView view={v} />}</SalespersonGate>
    </>
  );
}
