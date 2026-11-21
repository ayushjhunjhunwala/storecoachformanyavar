import { CheckCheck, Clock, GraduationCap, PhoneCall } from "lucide-react";
import type { MyView } from "@/lib/coach/types";
import { FOCUS_LABEL, formatDateWithYear, formatPct, formatRupees, formatShortDate } from "@/lib/coach/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CoachChart, KPI_LABEL } from "./coach-chart";
import { EmptyNote, KeyValue, Panel } from "./primitives";
import { useLocalStatus } from "./use-local-status";

type CardStatus = "done" | "not_today";

export function SalespersonView({ view }: { view: MyView }) {
  const [status, setStatus] = useLocalStatus<CardStatus>(`card:${view.salesperson_id}:${view.date}`);
  const s = view.stats;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[360px]">
        <div className="overflow-hidden rounded-[2.2rem] border-[10px] border-foreground/90 bg-foreground/90 shadow-lift">
          <div className="flex items-center gap-3 bg-wa-header px-4 pb-3 pt-4 text-on-maroon">
            <span className="grid size-9 place-items-center rounded-full bg-marigold text-sm font-extrabold text-accent-foreground">
              SC
            </span>
            <div className="leading-tight">
              <p className="font-bold">Store Coach</p>
              <p className="text-xs opacity-80">{view.store_id} · daily card</p>
            </div>
          </div>
          <div className="wa-wall flex min-h-[14rem] sm:min-h-[22rem] flex-col gap-3 px-3 py-4">
            <span className="mx-auto rounded-md bg-card/90 px-2.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground shadow-sm">
              {formatShortDate(view.date)}
            </span>
            {view.card ? (
              <div className="relative max-w-[92%] rounded-xl rounded-tl-none bg-card px-3 py-2 text-[0.95rem] leading-relaxed text-wa-ink shadow-sm">
                {view.card.text}
                <span className="mt-1 flex items-center justify-end gap-1 text-[0.68rem] text-muted-foreground">
                  {view.card.words} words · 7:00 am <CheckCheck className="size-3.5 text-teal" />
                </span>
              </div>
            ) : (
              <div className="max-w-[92%] rounded-xl rounded-tl-none bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
                No card for you today. Keep doing what works.
              </div>
            )}
            {status && (
              <div className="ml-auto max-w-[80%] rounded-xl rounded-tr-none bg-wa-bubble px-3 py-2 text-sm text-wa-ink shadow-sm">
                {status === "done" ? "Done ✅" : "Not today"}
                <span className="mt-0.5 block text-right text-[0.68rem] text-muted-foreground">you</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 bg-wa-wall px-3 pb-4">
            <Button
              className="flex-1"
              variant={status === "done" ? "default" : "outline"}
              onClick={() => setStatus(status === "done" ? null : "done")}
              disabled={!view.card}
            >
              Done
            </Button>
            <Button
              className="flex-1"
              variant={status === "not_today" ? "default" : "outline"}
              onClick={() => setStatus(status === "not_today" ? null : "not_today")}
              disabled={!view.card}
            >
              Not today
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <Panel title="My coach" subtitle={`${KPI_LABEL[view.kpi_key]}: you vs the ${view.store_id} median`}>
          <CoachChart mine={view.trend} store={view.store_trend} kpi={view.kpi_key} />
        </Panel>

        <div className="grid items-start gap-5 md:grid-cols-2">
          <Panel
            title={
              <span className="flex items-center gap-2">
                <GraduationCap className="size-4 text-teal" /> My mentor
              </span>
            }
          >
            {view.mentor ? (
              <p className="text-sm leading-relaxed text-foreground">
                Learn from <b>{view.mentor.name}</b> on{" "}
                <span className="font-semibold text-maroon">{FOCUS_LABEL[view.mentor.focus] ?? view.mentor.focus}</span>.
                Watch one customer with them on the floor today.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No mentor pairing for you today.</p>
            )}
            {view.mentees.length > 0 && (
              <div className="mt-3 rounded-xl bg-teal-soft px-3 py-2 text-sm">
                <p className="font-semibold text-teal">You are mentoring</p>
                <ul className="mt-1 text-foreground">
                  {view.mentees.map((m) => (
                    <li key={m.name}>
                      {m.name} · {FOCUS_LABEL[m.focus] ?? m.focus}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <Panel title="My last 90 days" subtitle={s ? `As of ${formatShortDate(view.stats_as_of)}` : undefined}>
            {s ? (
              <div className="divide-y divide-border">
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
              <EmptyNote>Your stats appear after your first full week.</EmptyNote>
            )}
          </Panel>
        </div>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <PhoneCall className="size-4 text-maroon" /> My callbacks
            </span>
          }
          subtitle={`${view.callbacks.total} past customers handed to you`}
        >
          {view.callbacks.items.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {view.callbacks.items.map((c) => (
                <li key={c.cust + c.date} className="grid grid-cols-[1fr_auto] gap-x-3 py-2 text-sm">
                  <span className="font-semibold text-foreground">
                    {c.cust} <span className="font-normal text-muted-foreground">· {formatDateWithYear(c.date)}</span>
                  </span>
                  <span className="tabular font-bold text-maroon">{formatRupees(c.value)}</span>
                  <span className={cn("col-span-2 text-xs text-muted-foreground")}>
                    {c.bought} · first served by {c.served_by}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" /> No customers handed to you yet.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
