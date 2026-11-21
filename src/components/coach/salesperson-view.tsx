import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, RotateCcw } from "lucide-react";
import type { MyView } from "@/lib/coach/types";
import {
  FOCUS_LABEL,
  cardBody,
  firstName,
  formatPct,
  formatShortDate,
  formatWeekdayDayMonth,
  initials,
} from "@/lib/coach/format";
import { Button } from "@/components/ui/button";
import { CoachChart, KPI_LABEL, trendCaption } from "./coach-chart";
import { Card, KeyValue } from "./primitives";
import { statusKey, useActionStatus } from "./use-action-status";

type CardStatus = "done" | "not_today";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function TodayCard({ view }: { view: MyView }) {
  const [status, setStatus] = useActionStatus<CardStatus>(statusKey.card(view.date, view.salesperson_id));
  if (!view.card) {
    return (
      <Card>
        <p className="font-semibold text-primary">Today's one thing</p>
        <p className="mt-3 text-xl leading-snug text-muted-foreground">No card for you today. Keep doing what works.</p>
      </Card>
    );
  }
  return (
    <section className="surface p-6 sm:p-8" aria-label="Today's one thing">
      <p className="font-semibold text-primary">Today's one thing</p>
      <p className="mt-4 text-2xl font-semibold leading-snug text-foreground sm:text-[1.75rem]">{cardBody(view.card.text, view.name)}</p>
      <div className="mt-7">
        {status ? (
          <div className="flex items-center gap-3">
            <span
              role="status"
              className={
                status === "done"
                  ? "inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-good-soft text-lg font-semibold text-good"
                  : "inline-flex h-14 flex-1 items-center justify-center rounded-2xl bg-secondary text-lg font-semibold text-muted-foreground"
              }
            >
              {status === "done" ? (
                <>
                  <Check className="size-5" /> Done
                </>
              ) : (
                "Not today"
              )}
            </span>
            <Button variant="quiet" size="lg" onClick={() => setStatus(null)}>
              <RotateCcw /> Undo
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button size="xl" className="h-14 rounded-2xl" onClick={() => setStatus("done")}>
              Done
            </Button>
            <Button size="xl" variant="secondary" className="h-14 rounded-2xl" onClick={() => setStatus("not_today")}>
              Not today
            </Button>
          </div>
        )}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        {view.card.words} words · your store lead sees whether you tapped Done
      </p>
    </section>
  );
}

export function SalespersonView({ view }: { view: MyView }) {
  const s = view.stats;
  const caption = trendCaption(view.trend, view.kpi_key);
  const firstCallback = view.callbacks.items[0];
  const callbackHint = view.callbacks.total
    ? `${view.callbacks.total} to call`
    : "None handed to you yet";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="mb-2">
        <p className="text-lg text-muted-foreground">
          {formatWeekdayDayMonth(view.date)} · {view.store_id}
        </p>
        <h1 className="headline mt-1 text-5xl text-foreground sm:text-6xl">Hi, {firstName(view.name)}</h1>
      </div>

      <TodayCard view={view} />

      <Card title="My coach" aside={KPI_LABEL[view.kpi_key]}>
        <CoachChart mine={view.trend} store={view.store_trend} kpi={view.kpi_key} />
        <p className="mt-4 text-[1.05rem] leading-relaxed text-foreground/80">
          {caption ? `${caption} ` : ""}Only you see your own numbers.
        </p>
      </Card>

      {view.mentor ? (
        <section className="surface flex items-center gap-5 p-6 sm:p-7" aria-label="Your mentor">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-info-soft text-xl font-semibold text-info">
            {initials(view.mentor.name)}
          </span>
          <div>
            <p className="text-xl font-semibold text-foreground">Your mentor: {view.mentor.name}</p>
            <p className="text-[1.05rem] text-muted-foreground">
              Best at {(FOCUS_LABEL[view.mentor.focus] ?? view.mentor.focus).toLowerCase()} · watch one customer with them today
            </p>
          </div>
        </section>
      ) : null}
      {view.mentees.length > 0 && (
        <Card>
          <p className="text-xl font-semibold text-foreground">You're a mentor today</p>
          <p className="mt-1 text-[1.05rem] text-muted-foreground">
            {view.mentees.map((m) => `${m.name} learns ${(FOCUS_LABEL[m.focus] ?? m.focus).toLowerCase()} from you`).join(" · ")}
          </p>
        </Card>
      )}

      <Link
        to="/me/callbacks"
        className="surface flex items-center justify-between gap-4 p-6 transition-shadow hover:shadow-float focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring sm:p-7"
      >
        <span className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-xl font-semibold text-foreground">My callbacks</span>
          <span className="text-[1.05rem] text-muted-foreground">
            {callbackHint}
            {firstCallback ? ` · from ${MONTH_SHORT[Number(firstCallback.date.slice(5, 7)) - 1]} ${firstCallback.date.slice(0, 4)}` : ""}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </Link>

      <Card title="My last 90 days" aside={s ? `As of ${formatShortDate(view.stats_as_of)}` : undefined}>
        {s ? (
          <div>
            <KeyValue label="Bills, 90 days" value={s.bills90} />
            <KeyValue label="Bills, 28 days" value={s.bills28} />
            <KeyValue label="Items per bill" value={s.ipb == null ? "—" : s.ipb.toFixed(2)} />
            <KeyValue label="Kurta sets with a jacket" value={`${formatPct(s.kur_rate)} of ${s.kur}`} />
            <KeyValue label="Discount" value={formatPct(s.disc)} />
            <KeyValue label="Weekend days off" value={formatPct(s.wkend_off, 0)} />
            <KeyValue label="Repeat customers" value={formatPct(s.repeat)} />
            <KeyValue label="Last bill" value={formatShortDate(s.last_bill)} />
          </div>
        ) : (
          <p className="text-[1.05rem] text-muted-foreground">Your 90-day numbers appear after the first Saturday run.</p>
        )}
      </Card>
    </div>
  );
}
