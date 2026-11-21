import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, Loader2, MessageCircleQuestion } from "lucide-react";
import { askCoach } from "@/lib/coach/coach.functions";
import { chatHistoryQueryOptions } from "@/lib/coach/queries";
import { formatLongDate } from "@/lib/coach/format";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { BrandMark } from "./app-shell";
import { useReplay } from "./replay-context";

export const SUGGESTED_QUESTIONS = [
  "Which store needs me most this week, and why?",
  "Did last week's actions work?",
  "Who discounts the most in my stores?",
  "Is Kanpur's drop a store problem?",
  "Is hafte ka summary Hindi mein do",
];

interface Exchange {
  id: string;
  question: string;
  answer: string | null;
  replay_date: string | null;
  provider: string | null;
  error?: string;
}

/** Light formatting for answers: paragraphs, "-"/"*" bullets and **bold**. */
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

function AnswerText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="ml-4 list-disc space-y-1">
          {list.map((l, i) => (
            <li key={i}>{renderInline(l)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet?.[1]) {
      list.push(bullet[1]);
      continue;
    }
    flush();
    if (line) blocks.push(<p key={`p${blocks.length}`}>{renderInline(line.replace(/^#+\s*/, ""))}</p>);
  }
  flush();
  return <div className="space-y-2 text-[0.95rem] leading-relaxed text-foreground">{blocks}</div>;
}

export function ChatDrawer({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const { date } = useReplay();
  const ask = useServerFn(askCoach);
  const queryClient = useQueryClient();
  const history = useQuery({ ...chatHistoryQueryOptions(userId), enabled: open });
  const [pending, setPending] = useState<Exchange[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const saved: Exchange[] = (history.data ?? []).map((m) => ({
    id: m.id,
    question: m.question,
    answer: m.answer,
    replay_date: m.replay_date,
    provider: m.provider,
  }));
  const savedIds = new Set(saved.map((s) => s.id));
  const exchanges = [...saved, ...pending.filter((p) => !savedIds.has(p.id))];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [exchanges.length, busy, open]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const tempId = `pending-${Date.now()}`;
    setNotice(null);
    setInput("");
    setBusy(true);
    setPending((p) => [...p, { id: tempId, question: q, answer: null, replay_date: date, provider: null }]);
    try {
      const res = await ask({ data: { date, question: q } });
      setRemaining(res.remaining);
      if (res.ok) {
        setPending((p) =>
          p.map((x) =>
            x.id === tempId
              ? { id: res.id, question: q, answer: res.answer, replay_date: res.date, provider: res.provider }
              : x,
          ),
        );
        await queryClient.invalidateQueries({ queryKey: chatHistoryQueryOptions(userId).queryKey });
      } else {
        setPending((p) => p.filter((x) => x.id !== tempId));
        setInput(q);
        setNotice(res.message);
      }
    } catch (e) {
      setPending((p) => p.filter((x) => x.id !== tempId));
      setInput(q);
      setNotice(e instanceof Error ? e.message : "The assistant could not answer right now.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shadow-fab fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-maroon py-3 pl-3 pr-5 font-bold text-on-maroon transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-marigold/50"
        aria-label="Ask Store Coach"
      >
        <span className="grid size-8 place-items-center rounded-full bg-marigold text-accent-foreground">
          <MessageCircleQuestion className="size-4" />
        </span>
        Ask Store Coach
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md" closeClassName="text-on-maroon data-[state=open]:bg-transparent">
          <SheetHeader className="header-band space-y-0 px-5 py-4 text-left">
            <div className="flex items-center gap-3">
              <BrandMark className="size-9" />
              <div>
                <SheetTitle className="text-lg font-extrabold text-on-maroon">Ask Store Coach</SheetTitle>
                <SheetDescription className="text-xs text-on-maroon-muted">
                  Answers only from your data for {formatLongDate(date)}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto bg-ivory px-4 py-4">
            {history.isLoading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading your earlier questions…
              </p>
            )}
            {!history.isLoading && exchanges.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
                Ask in English, Hindi, Kannada or any language. Store Coach answers only from the numbers you can see on
                your dashboard, and never invents new ones.
              </div>
            )}
            <ul className="flex flex-col gap-5">
              {exchanges.map((x) => (
                <li key={x.id} className="flex flex-col gap-2">
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-maroon px-3.5 py-2 text-[0.95rem] text-on-maroon">
                    {x.question}
                  </div>
                  {x.answer ? (
                    <div className="max-w-[95%]">
                      <AnswerText text={x.answer} />
                      <p className="mt-2 border-t border-border pt-1.5 text-xs text-muted-foreground">
                        Based on Store Coach data for {x.replay_date ? formatLongDate(x.replay_date) : "this date"}. Numbers
                        come from the engine, not the AI.
                        {x.provider && (
                          <span className="ml-1 opacity-70">· {x.provider === "sarvam" ? "Sarvam" : "Lovable AI backup"}</span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-1 py-2" aria-label="Store Coach is thinking">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="typing-dot size-2 rounded-full bg-maroon"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-border bg-card px-4 pb-4 pt-3">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void send(q)}
                  disabled={busy}
                  className="rounded-full border border-marigold/50 bg-marigold-soft px-3 py-1.5 text-xs font-semibold text-marigold-ink transition-colors hover:bg-marigold hover:text-accent-foreground disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
            {notice && <p className="mb-2 rounded-lg bg-worse-soft px-3 py-2 text-xs font-medium text-worse">{notice}</p>}
            <form onSubmit={onSubmit} className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder="Ask about your stores…"
                rows={2}
                maxLength={600}
                className="min-h-[2.75rem] resize-none rounded-xl bg-ivory"
                aria-label="Your question"
              />
              <Button type="submit" size="icon" className={cn("size-11 shrink-0 rounded-xl")} disabled={busy || input.trim().length < 2} aria-label="Send">
                {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
              </Button>
            </form>
            <p className="mt-2 text-[0.7rem] text-muted-foreground">
              Up to 10 questions an hour{remaining != null ? ` · ${remaining} left` : ""}. Answers stay under 150 words.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
