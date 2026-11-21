import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send } from "lucide-react";
import { practiceTurn } from "@/lib/coach/practice.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, PageHeader } from "@/components/coach/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/me_/practice")({
  head: () => ({
    meta: [
      { title: "Sales practice · Store Coach by Manyavar" },
      { name: "description", content: "Practise suggesting add-ons with an AI customer and get quick feedback." },
      { property: "og:title", content: "Sales practice · Store Coach by Manyavar" },
      { property: "og:description", content: "Role-play real customer moments and get a coach's score." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Practice,
});

const SCEN = [
  { id: "wedding", label: "Groom buying a sherwani", open: "Hi, I need a sherwani for my wedding next month." },
  { id: "kurta", label: "Kurta set for a sangeet", open: "I need a kurta set for a sangeet this weekend, quickly please." },
  { id: "family", label: "Father and son, Diwali", open: "We're looking at Diwali kurtas, but the shop next door has 30% off." },
] as const;
type Msg = { role: "user" | "assistant"; content: string };

function Practice() {
  const turn = useServerFn(practiceTurn);
  const [scenario, setScenario] = useState<(typeof SCEN)[number]["id"]>("wedding");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const opener = SCEN.find((s) => s.id === scenario)!.open;

  async function send() {
    if (!text.trim()) return;
    const next: Msg[] = [...msgs, { role: "user", content: text.trim() }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      const r = await turn({ data: { scenario, messages: [{ role: "user", content: "(customer walks in)" }, { role: "assistant", content: opener }, ...next] } });
      setMsgs([...next, { role: "assistant", content: r.text }]);
    } finally { setBusy(false); }
  }
  async function finish() {
    setBusy(true);
    try {
      const r = await turn({ data: { scenario, finish: true, messages: [{ role: "user", content: "(customer walks in)" }, { role: "assistant", content: opener }, ...msgs, { role: "user", content: "(end of practice — please give feedback)" }] } });
      setFeedback(r.text);
    } finally { setBusy(false); }
  }
  function reset(id: typeof scenario) { setScenario(id); setMsgs([]); setFeedback(null); }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader kicker="Practice" title="Sales practice" sub="Talk to an AI customer. Try asking about the occasion and suggesting a matching add-on." />
      <div className="flex flex-wrap gap-2">
        {SCEN.map((s) => (
          <Button key={s.id} size="sm" variant={s.id === scenario ? "default" : "secondary"} onClick={() => reset(s.id)}>{s.label}</Button>
        ))}
      </div>
      <Card title="Customer">
        <ul className="flex flex-col gap-3">
          {[{ role: "assistant" as const, content: opener }, ...msgs].map((m, i) => (
            <li key={i} className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-[0.98rem]", m.role === "assistant" ? "bg-secondary text-foreground" : "self-end bg-primary text-primary-foreground")}>{m.content}</li>
          ))}
          {busy && <li className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Thinking…</li>}
        </ul>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="What do you say?" className="h-11 rounded-full" aria-label="Your reply" />
          <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send"><Send /></Button>
        </form>
        <div className="mt-3 flex justify-end">
          <Button variant="secondary" size="sm" disabled={busy || msgs.length < 2} onClick={() => void finish()}>Finish and get feedback</Button>
        </div>
      </Card>
      {feedback && <Card title="Coach feedback"><p className="whitespace-pre-line text-[1.02rem] leading-relaxed">{feedback}</p></Card>}
    </div>
  );
}
