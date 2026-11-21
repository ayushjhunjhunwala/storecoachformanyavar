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
      { title: "Store Coach · Manyavar daily coaching" },
      {
        name: "description",
        content: "Sign in to Store Coach: weekly ranked actions for Manyavar area managers and a daily card for every salesperson.",
      },
      { property: "og:title", content: "Store Coach · Manyavar daily coaching" },
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
    <div className="header-band flex min-h-screen flex-col items-center justify-center gap-4">
      <BrandMark className="size-14" />
      <p className="text-2xl font-extrabold tracking-tight">Store Coach</p>
      <p className="text-sm text-on-maroon-muted">Opening your dashboard…</p>
    </div>
  );
}
