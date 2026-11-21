import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { FollowupHistory, Issue, ManagerView } from "@/lib/coach/types";
import { followupKey, homeFor } from "@/lib/coach/logic";
import { RESULT_LABEL, formatDayMonth, formatNumber, formatPct, formatRupees, formatWeekdayDayMonth } from "@/lib/coach/format";
import { IssueActions } from "@/components/coach/issue-card";
import { Card, Chip, EmptyNote, LeverChip, resultText } from "@/components/coach/primitives";
import { ManagerGate, useCoachView } from "@/components/coach/view-gate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/issue/$issueId")({
  beforeLoad: ({ context }) => {
    if (context.profile.role === "salesperson") throw redirect({ to: "/me", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Issue detail · Store Coach by Manyavar" },
      { name: "description", content: "Why the issue was raised, how the rupees are worked out, what to do and how it has moved since." },
      { property: "og:title", content: "Issue detail · Store Coach by Manyavar" },
      { property: "og:description", content: "One issue: why, the rupee maths, the action and its 7-day follow-ups." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IssuePage,
});

/** "1.00× when sent → 0.92× in the 7 days after" → "0.92×". */
function afterValue(h: FollowupHistory): string {
  const m = h.text.match(/→\s*([^\s]+)\s+in the 7 days/);
  return m?.[1] ?? "";
}

/** "Store bills vs all other stores, same week: 1.00× when sent…" → the measure before the colon. */
function measureName(h: FollowupHistory | undefined): string | null {
  if (!h) return null;
  const i = h.text.indexOf(":");
  return i > 0 ? h.text.slice(0, i) : null;
}

/** The advice sentence(s) after "in the 7 days after." */
function advice(h: FollowupHistory | undefined): string | null {
  if (!h) return null;
  const m = h.text.match(/in the 7 days after\.\s*(.*)$/);
  return m?.[1] ?? h.text;
}

function BackLink({ role }: { role: string }) {
  const home = homeFor(role);
  const label = role === "am" ? "This week's digest" : role === "store_lead" ? "Today's huddle" : "Back to dashboard";
  return (
    <Link to={home} className="inline-flex items-center gap-1 text-lg text-primary hover:underline">
      <ChevronLeft className="size-5" /> {label}
    </Link>
  );
}

function IssueDetail({ issue, view }: { issue: Issue; view: ManagerView }) {
  const followup = view.followups.find((f) => f.key === followupKey(issue));
  const history = followup?.history ?? [];
  const latest = history[history.length - 1];
  const kpi = view.stores[issue.store_id]?.kpi;
  const mathLines = issue.math
    .split(/;\s*/)
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2">
        <LeverChip lever={issue.lever} />
        <Chip tone="outline">{issue.store_id}</Chip>
        <Chip tone="outline">#{issue.rank} this week</Chip>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h1 className="headline max-w-3xl text-4xl text-foreground sm:text-[3.4rem]">{issue.title}</h1>
        <div className="text-right">
          <p className="figure text-5xl text-foreground sm:text-6xl">{formatRupees(issue.rupees)}</p>
          <p className="mt-2 text-muted-foreground">at stake / 4 weeks</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Why">
            <p className="text-[1.05rem] leading-relaxed text-foreground/80 sm:text-lg">{issue.cause}</p>
          </Card>

          {kpi && (
            <Card title={`${issue.store_id} now`} aside={`Last 28 days to ${formatWeekdayDayMonth(view.date)}`}>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Conversion", value: formatPct(kpi.conv), sub: kpi.new_store ? "new store" : `${formatPct(kpi.ly_conv)} last year` },
                  { label: "Bills", value: formatNumber(kpi.bills), sub: kpi.ly_bills ? `${formatNumber(kpi.ly_bills)} last year` : "no last year" },
                  { label: "Items per bill", value: kpi.ipb.toFixed(2), sub: `${kpi.ipb_tier.toFixed(2)} tier ${kpi.tier}` },
                  { label: "Average bill", value: formatRupees(kpi.atv), sub: `${formatRupees(kpi.atv_tier)} tier ${kpi.tier}` },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl bg-secondary px-4 py-3">
                    <dt className="text-sm text-muted-foreground">{s.label}</dt>
                    <dd className="figure mt-1.5 text-2xl text-foreground">{s.value}</dd>
                    <dd className="mt-1 text-xs text-muted-foreground">{s.sub}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          <Card title="How the rupees are worked out">
            <pre className="whitespace-pre-wrap rounded-2xl bg-secondary px-5 py-4 font-mono text-[0.95rem] leading-relaxed text-foreground">
              {mathLines.join("\n")}
            </pre>
            <p className="mt-3 text-sm text-muted-foreground">Measure tracked after sending: {issue.kpi}</p>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <section className="surface p-6 sm:p-7" aria-label="Do this">
            <p className="text-sm font-semibold text-primary">
              Do this · {issue.when} · {issue.who}
            </p>
            <p className="mt-3 text-lg leading-relaxed text-foreground">{issue.action}</p>
            <div className="mt-6">
              <IssueActions issue={issue} layout="stack" />
            </div>
          </section>

          <Card title="Follow-ups" subtitle={measureName(latest) ? `${measureName(latest)} (1.00× = same pace)` : undefined}>
            {history.length === 0 ? (
              <p className="text-[1.05rem] text-muted-foreground">
                Sent {followup ? formatDayMonth(followup.sends[followup.sends.length - 1] ?? followup.first_sent) : formatDayMonth(view.digest_date)}. The
                number is measured again 7 days after sending.
              </p>
            ) : (
              <>
                <ul className="flex flex-col gap-3">
                  {history.map((h) => (
                    <li key={h.on} className="flex flex-wrap items-baseline justify-between gap-x-3 text-[1.02rem]">
                      <span className="text-foreground">
                        Sent {formatDayMonth(h.sent_on)} → {formatDayMonth(h.on)}
                      </span>
                      <span className={cn("font-semibold", resultText[h.result])}>
                        {afterValue(h)} · {RESULT_LABEL[h.result]?.toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ul>
                {advice(latest) && <p className="mt-4 text-[1.02rem] leading-relaxed text-foreground/80">{advice(latest)}</p>}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function IssuePage() {
  const { issueId } = Route.useParams();
  const { profile } = Route.useRouteContext();
  const query = useCoachView();
  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto w-full max-w-6xl">
        <BackLink role={profile.role} />
      </div>
      <ManagerGate query={query}>
        {(v) => {
          const issue = v.digest.find((i) => i.id === issueId);
          if (!issue) {
            return (
              <div className="mx-auto w-full max-w-6xl">
                <EmptyNote className="surface py-12 text-base">
                  This issue isn't in the digest for {formatWeekdayDayMonth(v.date)}. Go back to see this week's issues.
                </EmptyNote>
              </div>
            );
          }
          return <IssueDetail issue={issue} view={v} />;
        }}
      </ManagerGate>
    </div>
  );
}
