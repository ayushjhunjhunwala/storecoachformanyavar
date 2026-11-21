import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { Check, ChevronLeft } from "lucide-react";
import type { CallbackItem, MyView } from "@/lib/coach/types";
import { homeFor } from "@/lib/coach/logic";
import { firstName, formatDateWithYear, formatDayMonth, formatRupees } from "@/lib/coach/format";
import { Button } from "@/components/ui/button";
import { EmptyNote } from "@/components/coach/primitives";
import { statusKey, useActionStatus } from "@/components/coach/use-action-status";
import { SalespersonGate, useCoachView } from "@/components/coach/view-gate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/me_/callbacks")({
  beforeLoad: ({ context }) => {
    if (context.profile.role !== "salesperson") throw redirect({ to: homeFor(context.profile.role), replace: true });
  },
  head: () => ({
    meta: [
      { title: "My callbacks · Store Coach by Manyavar" },
      { name: "description", content: "Past customers handed to you to call, with what they bought and an outcome for each call." },
      { property: "og:title", content: "My callbacks · Store Coach by Manyavar" },
      { property: "og:description", content: "Masked customer callbacks with honest outcomes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CallbacksPage,
});

const OUTCOMES = [
  { key: "will_visit", label: "Will visit" },
  { key: "not_now", label: "Not now" },
  { key: "no_answer", label: "No answer" },
  { key: "wrong_number", label: "Wrong number" },
] as const;
type Outcome = (typeof OUTCOMES)[number]["key"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthSpan(items: CallbackItem[]): string {
  const months = [...new Set(items.map((i) => i.date.slice(0, 7)))].sort();
  const label = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
  if (!months.length) return "";
  if (months.length === 1) return label(months[0]!);
  return `${label(months[0]!)} – ${label(months[months.length - 1]!)}`;
}

function CallbackCard({ item, storeId }: { item: CallbackItem; storeId: string }) {
  const [outcome, setOutcome] = useActionStatus<Outcome>(statusKey.callback(storeId, item.cust, item.date));
  const bought = item.bought.toLowerCase().replace(/^./, (c) => c.toUpperCase());
  return (
    <article className="surface p-6 sm:p-7" aria-label={`Customer ${item.cust}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="tabular text-2xl font-semibold text-foreground">Customer {item.cust}</h2>
        <span className="figure text-2xl text-foreground">{formatRupees(item.value)}</span>
      </div>
      <p className="mt-2 text-[1.05rem] text-muted-foreground">
        {formatDateWithYear(item.date)} · {bought}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3" role="group" aria-label="Call outcome">
        {OUTCOMES.map((o, i) => {
          const selected = outcome === o.key;
          return (
            <Button
              key={o.key}
              size="xl"
              variant={selected ? "default" : i === 0 && !outcome ? "default" : "secondary"}
              className={cn("h-14 rounded-2xl", outcome && !selected && "opacity-70")}
              aria-pressed={selected}
              onClick={() => setOutcome(selected ? null : o.key)}
            >
              {selected && <Check className="size-5" />}
              {o.label}
            </Button>
          );
        })}
      </div>
      {outcome && <p className="mt-3 text-sm text-muted-foreground">Saved. Tap it again to clear.</p>}
    </article>
  );
}

function Callbacks({ view }: { view: MyView }) {
  const items = view.callbacks.items;
  const servedBy = [...new Set(items.map((i) => i.served_by))];
  const firstWedding = view.upcoming.find((u) => u.wedding && u.date > view.date);
  const intro = items.length
    ? `${servedBy.length === 1 ? `${servedBy[0]}'s` : "Past"} customers from ${monthSpan(items)}, now yours, ${firstName(view.name)}.${
        firstWedding ? ` Call before ${formatDayMonth(firstWedding.date)}.` : ""
      }`
    : "No past customers have been handed to you yet. Your store lead assigns them from the huddle.";
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Link to="/me" className="inline-flex w-fit items-center gap-1 text-lg text-primary hover:underline">
        <ChevronLeft className="size-5" /> Today
      </Link>
      <div className="mb-2">
        <h1 className="headline text-5xl text-foreground sm:text-6xl">My callbacks</h1>
        <p className="mt-3 text-lg leading-snug text-muted-foreground sm:text-xl">{intro}</p>
      </div>
      {items.length === 0 ? (
        <EmptyNote className="surface py-10 text-base">Nothing to call today.</EmptyNote>
      ) : (
        items.map((item) => <CallbackCard key={item.cust + item.date} item={item} storeId={view.store_id} />)
      )}
      <p className="text-[0.95rem] text-muted-foreground">
        Numbers open in the store's CRM. Store Coach keeps only masked IDs, and the CRM is not connected here, so nothing is dialled
        or sent from this page.
      </p>
    </div>
  );
}

function CallbacksPage() {
  const query = useCoachView();
  return <SalespersonGate query={query}>{(v) => <Callbacks view={v} />}</SalespersonGate>;
}
