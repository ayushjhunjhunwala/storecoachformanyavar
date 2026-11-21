import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, Loader2, MessageCircle } from "lucide-react";
import { askCoach } from "@/lib/coach/coach.functions";
import { chatHistoryQueryOptions } from "@/lib/coach/queries";
import { formatDayMonth } from "@/lib/coach/format";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
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
}

/** Light formatting for answers: paragraphs, "-"/"*" bullets and **bold**. */
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
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
  return <div className="space-y-3 text-[1rem] leading-relaxed text-foreground">{blocks}</div>;
}

/** Conversation state shared by the inline card and the drawer. */
function useCoachChat(userId: string, enabled: boolean) {
  const { date } = useReplay();
  const ask = useServerFn(askCoach);
  const queryClient = useQueryClient();
  const history = useQuery({ ...chatHistoryQueryOptions(userId), enabled });
  const [pending, setPending] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const saved: Exchange[] = (history.data ?? []).map((m) => ({
    id: m.id,
    question: m.question,
    answer: m.answer,
    replay_date: m.replay_date,
    provider: m.provider,
  }));
  const savedIds = new Set(saved.map((s) => s.id));
  const exchanges = [...saved, ...pending.filter((p) => !savedIds.has(p.id))];

  async function send(question: string): Promise<boolean> {
    const q = question.trim();
    if (q.length < 2 || busy) return false;
    const tempId = `pending-${Date.now()}`;
    setNotice(null);
    setBusy(true);
    setPending((p) => [...p, { id: tempId, question: q, answer: null, replay_date: date, provider: null }]);
    try {
      const res = await ask({ data: { date, question: q } });
      setRemaining(res.remaining);
      if (res.ok) {
        setPending((p) =>
          p.map((x) => (x.id === tempId ? { id: res.id, question: q, answer: res.answer, replay_date: res.date, provider: res.provider } : x)),
        );
        await queryClient.invalidateQueries({ queryKey: chatHistoryQueryOptions(userId).queryKey });
        return true;
      }
      setPending((p) => p.filter((x) => x.id !== tempId));
      setNotice(res.message);
      return false;
    } catch (e) {
      setPending((p) => p.filter((x) => x.id !== tempId));
      setNotice(e instanceof Error ? e.message : "The assistant could not answer right now.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { date, history, exchanges, busy, remaining, notice, send };
}

function ChatBody({ userId, active, compact }: { userId: string; active: boolean; compact?: boolean }) {
  const chat = useCoachChat(userId, active);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.exchanges.length, chat.busy]);

  async function submit(question: string) {
    const q = question.trim();
    if (!q) return;
    setInput("");
    const ok = await chat.send(q);
    if (!ok) setInput(q);
    inputRef.current?.focus();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit(input);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className={cn("min-h-0 flex-1 overflow-y-auto", compact ? "max-h-[30rem]" : "")}>
        {chat.history.isLoading && (
          <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading your earlier questions…
          </p>
        )}
        {!chat.history.isLoading && chat.exchanges.length === 0 && (
          <p className="rounded-2xl bg-secondary px-4 py-3 text-[0.95rem] leading-relaxed text-muted-foreground">
            Ask in English, Hindi or any language. Answers come only from the numbers you can see here.
          </p>
        )}
        <ul className="flex flex-col gap-5">
          {chat.exchanges.map((x) => (
            <li key={x.id} className="flex flex-col gap-3">
              <div className="ml-auto max-w-[88%] rounded-[1.25rem] bg-primary px-4 py-2.5 text-[1rem] font-medium text-primary-foreground">
                {x.question}
              </div>
              {x.answer ? (
                <div>
                  <div className="rounded-[1.25rem] bg-secondary px-4 py-3.5">
                    <AnswerText text={x.answer} />
                  </div>
                  <p className="mt-2 text-xs leading-snug text-muted-foreground">
                    Based on Store Coach data for {x.replay_date ? formatDayMonth(x.replay_date) : "this date"}. Numbers come from the
                    engine, not the AI.
                    {x.provider && x.provider !== "sarvam" && <span> · Lovable AI backup</span>}
                  </p>
                </div>
              ) : (
                <div className="flex w-fit items-center gap-1.5 rounded-[1.25rem] bg-secondary px-4 py-3" aria-label="Store Coach is thinking">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="typing-dot size-2 rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void submit(q)}
              disabled={chat.busy}
              className="rounded-full border border-border bg-card px-4 py-2 text-left text-[0.92rem] text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        {chat.notice && (
          <p role="alert" className="rounded-2xl bg-bad-soft px-4 py-2.5 text-sm text-bad">
            {chat.notice}
          </p>
        )}
        <form onSubmit={onSubmit} className="mt-1 flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your stores..."
            maxLength={600}
            aria-label="Your question"
            className="h-12 min-w-0 flex-1 rounded-full border border-border bg-card px-5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
          />
          <Button type="submit" size="icon" className="size-12 shrink-0" disabled={chat.busy || input.trim().length < 2} aria-label="Send">
            {chat.busy ? <Loader2 className="animate-spin" /> : <ArrowUp className="size-5" />}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Up to 10 questions an hour{chat.remaining != null ? ` · ${chat.remaining} left` : ""}. Answers stay under 150 words.
        </p>
      </div>
    </div>
  );
}

function ChatTitle() {
  return (
    <div className="flex items-start justify-between gap-4">
      <h2 className="text-2xl font-semibold leading-tight text-foreground">Ask Store Coach</h2>
      <span className="pt-1 text-right text-sm leading-snug text-muted-foreground">Sarvam · your stores only</span>
    </div>
  );
}

/** Inline card used in the right column of the area manager digest. */
export function ChatCard({ userId, className }: { userId: string; className?: string }) {
  return (
    <section className={cn("surface p-6 sm:p-7", className)} aria-label="Ask Store Coach">
      <ChatTitle />
      <div className="mt-4 flex flex-col">
        <ChatBody userId={userId} active compact />
      </div>
    </section>
  );
}

/** Floating button and right-hand drawer for every other manager page. */
export function ChatDrawer({ userId, fabClassName }: { userId: string; fabClassName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "shadow-fab fixed bottom-20 right-4 z-40 md:bottom-5 md:right-5 print:hidden flex items-center gap-2 rounded-full bg-primary py-3.5 pl-4 pr-5 font-semibold text-primary-foreground transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
          fabClassName,
        )}
        aria-label="Ask Store Coach"
      >
        <MessageCircle className="size-5" />
        Ask Store Coach
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 border-l-0 bg-card p-6 sm:max-w-md sm:p-7">
          <SheetHeader className="space-y-0 pr-8 text-left">
            <SheetTitle className="text-2xl font-semibold text-foreground">Ask Store Coach</SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">Sarvam · your stores only</SheetDescription>
          </SheetHeader>
          <div className="mt-5 flex min-h-0 flex-1 flex-col">{open && <ChatBody userId={userId} active={open} />}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
