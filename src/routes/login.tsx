import { useState, type FormEvent } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { profileQueryOptions } from "@/lib/coach/queries";
import { homeFor } from "@/lib/coach/logic";
import { BrandMark } from "@/components/coach/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DEMO_PASSWORD = "Demo@2026";
const DEMO_DOMAIN = "@storecoach.demo";
const DEMO_ACCOUNTS = [
  { label: "HQ", user: "hq" },
  { label: "Zonal head", user: "zonal.north" },
  { label: "Area manager", user: "am01" },
  { label: "Store lead", user: "lead.lko02" },
  { label: "Salesperson", user: "sp1019" },
] as const;

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { error?: string } =>
    typeof search["error"] === "string" ? { error: search["error"] } : {},
  head: () => ({
    meta: [
      { title: "Sign in · Store Coach by Manyavar" },
      {
        name: "description",
        content: "Sign in to Store Coach: five actions on Monday, one card every morning, proof a week later.",
      },
      { property: "og:title", content: "Sign in · Store Coach by Manyavar" },
      { property: "og:description", content: "Five actions on Monday. One card every morning. Proof a week later." },
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
    search.error === "no-profile" ? "This account has no Store Coach role yet. Ask HQ to set up the demo accounts." : null,
  );

  async function signIn(e: string, p: string) {
    setBusy(e);
    setError(null);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: e.trim(), password: p });
    if (authError || !data.user) {
      setBusy(null);
      setError(
        authError?.message === "Invalid login credentials"
          ? "That email and password don't match."
          : (authError?.message ?? "Sign-in failed. Please try again."),
      );
      return;
    }
    const profile = await queryClient.fetchQuery(profileQueryOptions(data.user.id));
    if (!profile) {
      await supabase.auth.signOut();
      setBusy(null);
      setError("This account has no Store Coach role yet. Ask HQ to set up the demo accounts.");
      return;
    }
    navigate({ to: homeFor(profile.role), replace: true });
  }

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    void signIn(email, password);
  }

  return (
    <div className="flex min-h-screen items-center bg-background px-5 py-12 sm:px-10">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1fr_minmax(0,30rem)] lg:gap-20">
        <section className="max-w-xl">
          <div className="flex items-center gap-3">
            <BrandMark className="size-11 rounded-2xl" />
            <span className="text-lg font-semibold text-muted-foreground">Store Coach by Manyavar</span>
          </div>
          <h1 className="headline mt-6 text-5xl text-foreground sm:text-7xl">
            Store Coach <span className="block text-muted-foreground">by Manyavar</span>
          </h1>
          <p className="mt-5 text-xl leading-snug text-muted-foreground sm:text-2xl">
            Five actions on Monday. One card every morning. Proof a week later.
          </p>
        </section>

        <section className="rounded-[2rem] bg-card p-7 shadow-float sm:p-9">
          <h2 className="text-3xl font-semibold text-foreground">Sign in</h2>
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-[0.95rem] font-normal text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`am01${DEMO_DOMAIN}`}
                className="h-12 rounded-2xl px-4 text-base shadow-none md:text-base"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-[0.95rem] font-normal text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-2xl px-4 text-base shadow-none md:text-base"
              />
            </div>
            {error && (
              <p role="alert" className="rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={busy !== null} className="h-12 rounded-2xl text-lg">
              {busy !== null && busy === email ? <Loader2 className="animate-spin" /> : null}
              Continue
            </Button>
          </form>

          <div className="mt-7 border-t border-border pt-5">
            <p className="text-[0.95rem] font-semibold text-muted-foreground">Demo accounts · password {DEMO_PASSWORD}</p>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((a) => {
                const full = `${a.user}${DEMO_DOMAIN}`;
                return (
                  <li key={a.user}>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        setEmail(full);
                        setPassword(DEMO_PASSWORD);
                        void signIn(full, DEMO_PASSWORD);
                      }}
                      aria-label={`Sign in as ${a.label} (${full})`}
                      className={cn(
                        "flex h-full w-full items-center justify-between gap-2 rounded-2xl bg-secondary px-4 py-2.5 text-left transition-colors hover:bg-accent disabled:opacity-60",
                        busy === full && "ring-2 ring-ring",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block text-foreground">{a.label}</span>
                        <span className="block truncate text-muted-foreground">{a.user}@</span>
                      </span>
                      {busy === full && <Loader2 className="size-4 shrink-0 animate-spin text-primary" />}
                    </button>
                  </li>
                );
              })}
              <li className="flex items-start rounded-2xl bg-secondary px-4 py-2.5 text-muted-foreground">{DEMO_DOMAIN}</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
