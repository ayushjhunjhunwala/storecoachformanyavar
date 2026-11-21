import { useState, type FormEvent } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { profileQueryOptions } from "@/lib/coach/queries";
import { homeFor } from "@/lib/coach/logic";
import { ROLE_LABEL } from "@/lib/coach/format";
import { BrandMark } from "@/components/coach/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEMO_PASSWORD = "Demo@2026";
const DEMO_ACCOUNTS = [
  { role: "hq", email: "hq@storecoach.demo", scope: "All 20 stores" },
  { role: "zonal", email: "zonal.north@storecoach.demo", scope: "North zone" },
  { role: "am", email: "am01@storecoach.demo", scope: "Lucknow · AM-01" },
  { role: "store_lead", email: "lead.lko02@storecoach.demo", scope: "LKO-02" },
  { role: "salesperson", email: "sp1019@storecoach.demo", scope: "SP1019 · LKO-02" },
] as const;

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { error?: string } =>
    typeof search["error"] === "string" ? { error: search["error"] } : {},
  head: () => ({
    meta: [
      { title: "Sign in · Store Coach" },
      {
        name: "description",
        content: "Sign in to Store Coach with your Manyavar account to see your own dashboard.",
      },
      { property: "og:title", content: "Sign in · Store Coach" },
      { property: "og:description", content: "Every stakeholder signs in and sees only their own Store Coach dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const profile = await context.queryClient.ensureQueryData(profileQueryOptions(data.user.id));
    if (profile) throw redirect({ to: homeFor(profile.role), replace: true });
  },
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    search.error === "no-profile" ? "This account has no Store Coach role. Ask HQ to seed it." : null,
  );

  async function signIn(e: string, p: string) {
    setBusy(e);
    setError(null);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: e.trim(), password: p });
    if (authError || !data.user) {
      setBusy(null);
      setError(
        authError?.message === "Invalid login credentials"
          ? "That email and password don't match. Demo accounts appear after HQ presses Seed demo users."
          : (authError?.message ?? "Sign-in failed."),
      );
      return;
    }
    const profile = await queryClient.fetchQuery(profileQueryOptions(data.user.id));
    if (!profile) {
      await supabase.auth.signOut();
      setBusy(null);
      setError("This account has no Store Coach role. Ask HQ to seed it.");
      return;
    }
    navigate({ to: homeFor(profile.role), replace: true });
  }

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    void signIn(email, password);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="header-band relative flex flex-col justify-between gap-10 px-6 py-8 sm:px-10 lg:py-12">
        <div className="flex items-center gap-3">
          <BrandMark className="size-11" />
          <div>
            <p className="text-2xl font-extrabold leading-none tracking-tight">Store Coach</p>
            <p className="mt-1 text-sm text-on-maroon-muted">Manyavar · 20 stores · 6 area managers</p>
          </div>
        </div>
        <div className="max-w-xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-marigold">Runs by itself every morning</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Five ranked actions a week. One card a day.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-on-maroon-muted sm:text-lg">
            Area managers see which stores need them and how many rupees are at stake. Every salesperson gets one thing to
            do better today, with a named colleague to learn from.
          </p>
        </div>
        <dl className="grid max-w-xl grid-cols-3 gap-4 text-sm">
          {[
            ["≤ 5", "issues per manager a week"],
            ["≤ 60", "words on every card"],
            ["7 days", "to every follow-up"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-2xl border border-on-maroon/15 bg-on-maroon/5 p-3">
              <dt className="rupee-figure text-2xl text-marigold">{v}</dt>
              <dd className="mt-1 text-xs leading-snug text-on-maroon-muted">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex items-center justify-center bg-background px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use your Store Coach account. You'll land on your own dashboard.</p>

          <form onSubmit={onSubmit} className="coach-card mt-6 flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@storecoach.demo"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="rounded-lg bg-worse-soft px-3 py-2 text-sm text-worse">{error}</p>}
            <Button type="submit" disabled={busy !== null} className="h-11 text-base">
              {busy === email && busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              Sign in
            </Button>
          </form>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Demo accounts</h3>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <KeyRound className="size-3.5" /> Password <code className="font-semibold text-foreground">{DEMO_PASSWORD}</code>
              </span>
            </div>
            <ul className="mt-2 flex flex-col gap-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.email}>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      setEmail(a.email);
                      setPassword(DEMO_PASSWORD);
                      void signIn(a.email, DEMO_PASSWORD);
                    }}
                    className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors hover:border-marigold hover:bg-marigold-soft disabled:opacity-60"
                  >
                    <span className="w-24 shrink-0 text-xs font-bold uppercase tracking-wide text-maroon">
                      {ROLE_LABEL[a.role]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{a.email}</span>
                      <span className="block text-xs text-muted-foreground">{a.scope}</span>
                    </span>
                    {busy === a.email ? (
                      <Loader2 className="size-4 animate-spin text-maroon" />
                    ) : (
                      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-maroon" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Synthetic data only. Every store lead signs in as lead.&lt;store id&gt;@storecoach.demo (e.g. lead.blr03) and every
              salesperson as their id (e.g. sp1019).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
