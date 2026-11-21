import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { profileQueryOptions } from "@/lib/coach/queries";
import { homeFor } from "@/lib/coach/logic";
import { BrandMark } from "@/components/coach/app-shell";

// The session lives in the browser, so the role-based redirect runs client-side.
export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Store Coach by Manyavar · daily store coaching" },
      {
        name: "description",
        content: "Sign in to Store Coach: weekly ranked actions for Manyavar area managers and a daily card for every salesperson.",
      },
      { property: "og:title", content: "Store Coach by Manyavar · daily store coaching" },
      {
        property: "og:description",
        content: "Weekly ranked actions for Manyavar area managers and a daily card for every salesperson.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login", replace: true });
    const profile = await context.queryClient.ensureQueryData(profileQueryOptions(data.user.id));
    throw redirect({ to: profile ? homeFor(profile.role) : "/login", replace: true });
  },
  pendingComponent: Splash,
  component: Splash,
});

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <BrandMark className="size-14 rounded-2xl" />
      <p className="headline text-3xl text-foreground">Store Coach by Manyavar</p>
      <p className="text-sm text-muted-foreground">Opening your dashboard…</p>
    </div>
  );
}
