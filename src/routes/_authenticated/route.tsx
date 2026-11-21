import { Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { profileQueryOptions } from "@/lib/coach/queries";
import { AppShell } from "@/components/coach/app-shell";
import { ChatDrawer } from "@/components/coach/chat-drawer";
import { ReplayProvider } from "@/components/coach/replay-context";
import { ViewSkeleton } from "@/components/coach/view-gate";

// The session lives in localStorage, so this gate runs in the browser only.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login", replace: true });
    const profile = await context.queryClient.ensureQueryData(profileQueryOptions(data.user.id));
    if (!profile) {
      await supabase.auth.signOut();
      throw redirect({ to: "/login", search: { error: "no-profile" }, replace: true });
    }
    return { userId: data.user.id, profile };
  },
  pendingComponent: () => (
    <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-8">
      <ViewSkeleton />
    </div>
  ),
  component: AuthedLayout,
});

function AuthedLayout() {
  const { profile, userId } = Route.useRouteContext();
  const { pathname } = useLocation();
  // The assistant is for managers only: never for salespeople, never on /me.
  const showChat = profile.role !== "salesperson" && !pathname.startsWith("/me");
  return (
    <ReplayProvider>
      <AppShell profile={profile} userId={userId}>
        <Outlet />
      </AppShell>
      {/* On /am the assistant sits inline in the right column on wide screens. */}
      {showChat && <ChatDrawer userId={userId} {...(pathname === "/am" ? { fabClassName: "lg:hidden" } : {})} />}
    </ReplayProvider>
  );
}
