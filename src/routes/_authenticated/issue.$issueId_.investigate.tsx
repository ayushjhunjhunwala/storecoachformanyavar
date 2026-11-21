import { useState } from "react";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check as CheckIcon, ChevronLeft, CircleHelp, FileSearch, Loader2, Scale, Send, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import type { Check, CheckStatus, Fact, Verdict } from "@/lib/coach/evidence";
import { CHALLENGE_PRESETS } from "@/lib/coach/evidence";
import type { ChallengeRecord, InvestigationRecord } from "@/lib/coach/courtroom.types";
import { challengeIssue, getCourtroom, runDetective, runSkeptic } from "@/lib/coach/courtroom.functions";
import { issueActivityQueryOptions } from "@/lib/coach/action-queries";
import { formatDayMonth, formatRupees, formatWhen } from "@/lib/coach/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, Chip, EmptyNote, LeverChip, PageHeader, type ChipTone } from "@/components/coach/primitives";
import { useReplay } from "@/components/coach/replay-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/issue/$issueId_/investigate")({
  beforeLoad: ({ context }) => {
    if (context.profile.role === "salesperson") throw redirect({ to: "/me", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Evidence review · Store Coach by Manyavar" },
      { name: "description", content: "Detective, Skeptic and Verdict for one issue, with every fact, check and AI step saved for audit." },
      { property: "og:title", content: "Evidence review · Store Coach by Manyavar" },
      { property: "og:description", content: "Test an issue against market, calendar, stock, sample and data checks before acting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvestigatePage,
});

const courtroomQuery = (issueId: string) =>
  queryOptions({ queryKey: ["courtroom", issueId], queryFn: () => getCourtroom({ data: { issueId } }), staleTime: 30_000 });

const STATUS_LABEL: Record<CheckStatus, string> = { clear: "Clear", concern: "Concern", unknown: "Can't check", not_relevant: "Not relevant" };
const STATUS_TONE: Record<CheckStatus, ChipTone> = { clear: "good", concern: "warn", unknown: "neutral", not_relevant: "outline" };
const VERDICT_LABEL: Record<Verdict, string> = { supported: "Supported observation", uncertain: "Uncertain", rejected: "Rejected" };
const VERDICT_TONE: Record<Verdict, string> = { supported: "bg-good-soft text-good", uncertain: "bg-warn-soft text-warn", rejected: "bg-bad-soft text-bad" };

function FactChips({ ids, onOpen }: { ids: string[]; onOpen: (id: string) => void }) {
  if (!ids.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onOpen(id)}
          className="tabular rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
          aria-label={`Open fact ${id}`}
        >
          {id}
        </button>
      ))}
    </span>
  );
}

function StageStep({ n, label, state }: { n: number; label: string; state: "done" | "running" | "waiting" }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold",
          state === "done" ? "bg-good-soft text-good" : state === "running" ? "bg-info-soft text-info" : "bg-secondary text-muted-foreground",
        )}
        aria-hidden
      >
        {state === "done" ? <CheckIcon className="size-4" /> : state === "running" ? <Loader2 className="size-4 animate-spin" /> : n}
      </span>
      <span className={cn("text-[0.95rem]", state === "waiting" ? "text-muted-foreground" : "text-foreground")}>
        {label}
        <span className="sr-only">{state === "done" ? ", done" : state === "running" ? ", in progress" : ", waiting"}</span>
      </span>
    </li>
  );
}

function EvidenceDrawer({ open, onOpenChange, facts, focus }: { open: boolean; onOpenChange: (v: boolean) => void; facts: Fact[]; focus: string | null }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-2xl">Evidence</SheetTitle>
          <SheetDescription>Every fact the review could use, with its source. Facts come from the engine's data on or before the review date.</SheetDescription>
        </SheetHeader>
        <ol className="mt-4 flex flex-col gap-3 px-4 pb-8">
          {facts.map((f) => (
            <li key={f.id} className={cn("rounded-2xl border border-border p-4", focus === f.id && "border-primary bg-info-soft")}>
              <p className="flex items-baseline gap-2">
                <span className="tabular rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">{f.id}</span>
                <span className="font-semibold text-foreground">{f.label}</span>
              </p>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground/85">{f.text}</p>
              <p className="mt-1 text-xs text-muted-foreground">{f.source}</p>
            </li>
          ))}
          <li className="rounded-2xl border border-dashed border-border p-4">
            <p className="font-semibold text-foreground">Ghost receipts</p>
            <p className="mt-1 text-[0.95rem] text-muted-foreground">
              Bill lines aren't in this project, so individual receipts missing the add-on can't be shown. Even with them, a bill without an accessory
              doesn't prove it was never offered.
            </p>
          </li>
        </ol>
      </SheetContent>
    </Sheet>
  );
}

function Challenge({ issueId, date, challenges }: { issueId: string; date: string; challenges: ChallengeRecord[] }) {
  const queryClient = useQueryClient();
  const ask = useServerFn(challengeIssue);
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState("");
  async function send(payload: { preset?: string; question?: string }, key: string) {
    setBusy(key);
    try {
      const res = await ask({ data: { issueId, date, ...payload } });
      if (!res.ok) toast.error(res.message);
      else if (payload.question) setText("");
      await queryClient.invalidateQueries({ queryKey: ["courtroom", issueId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't get an answer. Try again.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <Card title="Challenge the review" subtitle="Quick checks answer from the rules and the facts, without the AI. Typed questions go to Claude and must cite facts or say the data can't answer.">
      <div className="flex flex-wrap gap-2">
        {CHALLENGE_PRESETS.map((p) => (
          <Button key={p.id} variant="secondary" size="sm" disabled={busy !== null} onClick={() => void send({ preset: p.id }, p.id)}>
            {busy === p.id && <Loader2 className="animate-spin" />}
            {p.label}
          </Button>
        ))}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim().length >= 4) void send({ question: text.trim() }, "free");
        }}
      >
        <label className="flex-1">
          <span className="sr-only">Your question</span>
          <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Ask your own question about this issue" className="h-11 rounded-full" />
        </label>
        <Button type="submit" size="icon" disabled={busy !== null || text.trim().length < 4} aria-label="Send question">
          {busy === "free" ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
      {challenges.length > 0 && (
        <ul className="mt-5 flex flex-col gap-3">
          {challenges.map((c) => (
            <li key={c.id} className="rounded-2xl bg-secondary px-5 py-4">
              <p className="text-sm font-semibold text-foreground">{c.question}</p>
              <p className="mt-1 text-[0.95rem] leading-relaxed text-foreground/85">{c.answer}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.user_name} · {formatWhen(c.created_at)} · {c.provider === "rules" ? "rule check" : c.fallback ? "AI unavailable" : "Claude, checked"}
                {c.fact_ids.length ? ` · facts ${c.fact_ids.join(", ")}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Review({ rec, openFact, skepticRunning }: { rec: InvestigationRecord; openFact: (id: string) => void; skepticRunning: boolean }) {
  const comments = new Map((rec.skeptic?.challenges ?? []).map((c) => [c.check_id, c]));
  const shownChecks = rec.checks.filter((c) => c.status !== "not_relevant");
  const hidden = rec.checks.filter((c) => c.status === "not_relevant");
  return (
    <div className="flex flex-col gap-6">
      <Card
        title={
          <span className="flex items-center gap-2">
            <FileSearch className="size-5 text-primary" aria-hidden /> Detective
          </span>
        }
        aside={rec.detective?.fallback ? "Template (AI unavailable)" : "Claude"}
      >
        {rec.detective ? (
          <div className="flex flex-col gap-4">
            <p className="text-lg leading-relaxed text-foreground">{rec.detective.diagnosis}</p>
            <div className="rounded-2xl bg-secondary px-5 py-4">
              <p className="text-sm font-semibold text-muted-foreground">Hypothesis to confirm</p>
              <p className="mt-1 text-[1.02rem] leading-relaxed text-foreground">{rec.detective.hypothesis}</p>
            </div>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Chip size="sm" tone={rec.detective.confidence === "high" ? "good" : rec.detective.confidence === "medium" ? "info" : "neutral"}>
                {rec.detective.confidence} confidence
              </Chip>
              Cites <FactChips ids={rec.detective.cited_fact_ids} onOpen={openFact} />
            </p>
            <p className="text-[0.95rem] text-muted-foreground">
              <b className="font-semibold text-foreground">What would change this:</b> {rec.detective.would_change_my_mind}
            </p>
          </div>
        ) : (
          <EmptyNote>No diagnosis saved.</EmptyNote>
        )}
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <ShieldQuestion className="size-5 text-primary" aria-hidden /> Skeptic
          </span>
        }
        aside={rec.status === "complete" ? (rec.skeptic?.fallback ? "Rules only (AI unavailable)" : "Rules + Claude") : "Rules"}
        subtitle="Each alternative is tested by a fixed rule on the facts. Claude only comments; it can't change a rule's result."
      >
        <ul className="flex flex-col divide-y divide-border">
          {shownChecks.map((c: Check) => {
            const comment = comments.get(c.id);
            return (
              <li key={c.id} className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">{c.question}</span>
                  <Chip size="sm" tone={STATUS_TONE[c.status]}>
                    {STATUS_LABEL[c.status]}
                  </Chip>
                </p>
                <p className="text-[0.95rem] leading-relaxed text-foreground/85">{c.finding}</p>
                {comment && comment.comment !== c.finding && <p className="text-[0.95rem] leading-relaxed text-muted-foreground">Skeptic: {comment.comment}</p>}
                <FactChips ids={[...new Set([...c.fact_ids, ...(comment?.cited_fact_ids ?? [])])]} onOpen={openFact} />
              </li>
            );
          })}
        </ul>
        {hidden.length > 0 && <p className="mt-4 text-sm text-muted-foreground">Not relevant to this issue: {hidden.map((c) => c.name.toLowerCase()).join(", ")}.</p>}
        {skepticRunning && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> The Skeptic is reviewing the Detective's explanation…
          </p>
        )}
        {rec.skeptic && (
          <div className="mt-5 rounded-2xl bg-secondary px-5 py-4">
            <p className="text-sm font-semibold text-muted-foreground">Strongest alternative</p>
            <p className="mt-1 text-[1.02rem] leading-relaxed text-foreground">{rec.skeptic.strongest_alternative}</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function VerdictCard({ rec }: { rec: InvestigationRecord }) {
  if (!rec.verdict) {
    return (
      <Card title="Verdict">
        <p className="text-[0.95rem] text-muted-foreground">The verdict appears once the Skeptic has finished.</p>
      </Card>
    );
  }
  const concerns = rec.checks.filter((c) => c.status === "concern");
  return (
    <section className="surface p-6 sm:p-7" aria-label="Verdict">
      <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Scale className="size-4" aria-hidden /> Verdict
      </p>
      <p className={cn("mt-3 inline-flex rounded-full px-4 py-1.5 text-lg font-semibold", VERDICT_TONE[rec.verdict])}>{VERDICT_LABEL[rec.verdict]}</p>
      <p className="mt-4 text-[1.05rem] leading-relaxed text-foreground">{rec.verdict_reason}</p>
      {rec.missing.length > 0 && (
        <p className="mt-3 text-[0.95rem] text-muted-foreground">
          <b className="font-semibold text-foreground">Missing evidence:</b> {rec.missing.join(", ").toLowerCase()}.
        </p>
      )}
      {concerns.length > 0 && (
        <p className="mt-2 text-[0.95rem] text-muted-foreground">
          <b className="font-semibold text-foreground">Open alternatives:</b> {concerns.map((c) => c.name.toLowerCase()).join(", ")}.
        </p>
      )}
      {rec.skeptic && rec.skeptic.missing_evidence.length > 0 && (
        <p className="mt-2 text-[0.95rem] text-muted-foreground">
          <b className="font-semibold text-foreground">The Skeptic would also want:</b> {rec.skeptic.missing_evidence.join("; ")}.
        </p>
      )}
      <p className="mt-4 text-xs text-muted-foreground">Decided by fixed rules on the checks, not by an AI vote. A supported observation is not proof of cause.</p>
    </section>
  );
}

function AuditCard({ rec }: { rec: InvestigationRecord }) {
  return (
    <Card title="Decision audit" subtitle="What this review used and how it was checked. Saved and read-only.">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[0.95rem] sm:grid-cols-2">
        {[
          ["Run by", `${rec.created_by_name}, ${formatWhen(rec.created_at)}`],
          ["Data as of", formatDayMonth(rec.as_of)],
          ["Data version", rec.data_version],
          ["Evidence fingerprint", rec.evidence_hash],
          ["AI", rec.fallback ? `${rec.model ?? "none"} (fallback template used)` : (rec.model ?? "none")],
          ["Prompt version", rec.prompt_version],
          ["Time taken", rec.latency_ms != null ? `${(rec.latency_ms / 1000).toFixed(1)} s` : "—"],
          ["Facts / checks", `${rec.facts.length} facts · ${rec.checks.length} checks`],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col border-b border-border py-2">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="break-words text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-4">
        <summary className="cursor-pointer text-[0.95rem] text-primary">Validation log ({rec.validations.length})</summary>
        <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
          {rec.validations.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

function InvestigatePage() {
  const { issueId } = Route.useParams();
  const { date } = useReplay();
  const queryClient = useQueryClient();
  const activity = useQuery(issueActivityQueryOptions(issueId));
  const court = useQuery(courtroomQuery(issueId));
  const detective = useServerFn(runDetective);
  const skeptic = useServerFn(runSkeptic);
  const [stage, setStage] = useState<"idle" | "detective" | "skeptic">("idle");
  const [drawer, setDrawer] = useState<{ open: boolean; focus: string | null }>({ open: false, focus: null });
  const rec = court.data?.investigation ?? null;
  const issue = activity.data?.issue;

  async function start() {
    setStage("detective");
    try {
      const first = await detective({ data: { issueId, date } });
      queryClient.setQueryData(courtroomQuery(issueId).queryKey, (old) => ({ challenges: old?.challenges ?? [], investigation: first }));
      setStage("skeptic");
      const done = await skeptic({ data: { investigationId: first.id } });
      queryClient.setQueryData(courtroomQuery(issueId).queryKey, (old) => ({ challenges: old?.challenges ?? [], investigation: done }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The review stopped. Try again.");
      await queryClient.invalidateQueries({ queryKey: ["courtroom", issueId] });
    } finally {
      setStage("idle");
    }
  }

  async function finishSkeptic(id: string) {
    setStage("skeptic");
    try {
      const done = await skeptic({ data: { investigationId: id } });
      queryClient.setQueryData(courtroomQuery(issueId).queryKey, (old) => ({ challenges: old?.challenges ?? [], investigation: done }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The Skeptic stopped. Try again.");
    } finally {
      setStage("idle");
    }
  }

  const openFact = (id: string) => setDrawer({ open: true, focus: id });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Link to="/issue/$issueId" params={{ issueId }} className="inline-flex w-fit items-center gap-1 text-lg text-primary hover:underline">
        <ChevronLeft className="size-5" /> Back to the issue
      </Link>
      {issue && (
        <div className="flex flex-wrap items-center gap-2">
          <LeverChip lever={issue.lever} />
          <Chip tone="outline">{issue.store_id}</Chip>
          <Chip tone="outline">{formatRupees(issue.rupees)} estimated / 4 weeks</Chip>
        </div>
      )}
      <PageHeader
        title="Evidence review"
        sub={issue?.title}
        actions={
          <>
            {rec && (
              <Button variant="white" onClick={() => setDrawer({ open: true, focus: null })}>
                <CircleHelp /> Evidence ({rec.facts.length})
              </Button>
            )}
            <Button onClick={() => void start()} disabled={stage !== "idle" || activity.isLoading}>
              {stage !== "idle" && <Loader2 className="animate-spin" />}
              {rec ? "Run a fresh review" : "Start the review"}
            </Button>
          </>
        }
      />

      {court.isLoading || activity.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading the saved review…
        </div>
      ) : court.isError || activity.isError ? (
        <EmptyNote className="surface py-12 text-base">
          Couldn't load this review.{" "}
          <button className="text-primary hover:underline" onClick={() => void court.refetch()}>
            Try again
          </button>
        </EmptyNote>
      ) : (
        <>
          {(stage !== "idle" || !rec) && (
            <Card title={stage === "idle" ? "How the review works" : "Review in progress"}>
              <ol className="flex flex-col gap-3">
                <StageStep n={1} label="Gather the facts available on this date and run the eight checks" state={stage === "detective" ? "running" : stage === "skeptic" ? "done" : "waiting"} />
                <StageStep n={2} label="Detective (Claude) proposes an explanation, citing facts" state={stage === "detective" ? "running" : stage === "skeptic" ? "done" : "waiting"} />
                <StageStep n={3} label="Skeptic tests alternatives; the verdict follows fixed rules" state={stage === "skeptic" ? "running" : "waiting"} />
              </ol>
              {stage === "idle" && (
                <p className="mt-4 text-[0.95rem] text-muted-foreground">
                  Uses only data up to {formatDayMonth(date)}. Every step is saved, so reopening this page shows the same review without running it again.
                </p>
              )}
            </Card>
          )}
          {rec && (
            <>
              {rec.status === "detective" && stage === "idle" && (
                <div className="surface flex flex-wrap items-center justify-between gap-3 p-5">
                  <p className="text-[0.95rem] text-foreground">The last review stopped before the Skeptic finished.</p>
                  <Button onClick={() => void finishSkeptic(rec.id)}>Finish the review</Button>
                </div>
              )}
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
                <Review rec={rec} openFact={openFact} skepticRunning={stage === "skeptic"} />
                <div className="flex flex-col gap-6">
                  <VerdictCard rec={rec} />
                  <AuditCard rec={rec} />
                </div>
              </div>
            </>
          )}
          <Challenge issueId={issueId} date={date} challenges={court.data?.challenges ?? []} />
          <EvidenceDrawer open={drawer.open} onOpenChange={(open) => setDrawer((d) => ({ ...d, open }))} facts={rec?.facts ?? []} focus={drawer.focus} />
        </>
      )}
    </div>
  );
}
