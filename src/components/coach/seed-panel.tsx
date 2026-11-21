import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { seedUsers, type SeedResult } from "@/lib/coach/coach.functions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "./primitives";

interface Totals {
  total: number;
  done: number;
  created: number;
  repaired: number;
  existing: number;
  failed: SeedResult["failed"];
}

export function SeedPanel() {
  const seed = useServerFn(seedUsers);
  const [running, setRunning] = useState(false);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    const acc: Totals = { total: 0, done: 0, created: 0, repaired: 0, existing: 0, failed: [] };
    setTotals(acc);
    try {
      let offset: number | null = 0;
      while (offset !== null) {
        const r: SeedResult = await seed({ data: { offset } });
        acc.total = r.total;
        acc.done = Math.min(r.total, r.offset + r.processed);
        acc.created += r.created;
        acc.repaired += r.repaired;
        acc.existing += r.existing;
        acc.failed = [...acc.failed, ...r.failed];
        setTotals({ ...acc });
        offset = r.next_offset;
      }
      toast.success("Demo accounts checked", {
        description: `${acc.created} created, ${acc.repaired} repaired, ${acc.existing} already valid${acc.failed.length ? `, ${acc.failed.length} failed` : ""}.`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Seeding stopped.";
      setError(message);
      toast.error("Seeding stopped", { description: message });
    } finally {
      setRunning(false);
    }
  }

  const pct = totals && totals.total ? Math.round((totals.done / totals.total) * 100) : 0;

  return (
    <Card
      title="Demo accounts"
      aside={
        <Button onClick={run} disabled={running}>
          {running ? <Loader2 className="animate-spin" /> : <UserPlus />}
          {running ? "Checking…" : "Check and repair accounts"}
        </Button>
      }
      subtitle="Creates or repairs every login from the data: 3 zonal heads, 6 area managers, 20 store leads and every salesperson with a card on 31 Oct. Password Demo@2026. Existing passwords are never changed; safe to run again."
    >
      {totals ? (
        <div className="flex flex-col gap-2 text-sm">
          <Progress value={pct} className="h-2 bg-secondary" />
          <p className="tabular text-muted-foreground">
            {totals.done} of {totals.total || "…"} accounts checked · <b className="text-foreground">{totals.created}</b> created ·{" "}
            <b className="text-foreground">{totals.repaired}</b> repaired · {totals.existing} already valid
            {totals.failed.length > 0 && <span className="text-bad"> · {totals.failed.length} failed</span>}
          </p>
          {totals.failed.length > 0 && (
            <ul className="text-xs text-bad">
              {totals.failed.slice(0, 5).map((f) => (
                <li key={f.email}>
                  {f.email}: {f.error}
                </li>
              ))}
            </ul>
          )}
          {error && <p className="text-xs text-bad">{error}</p>}
        </div>
      ) : (
        <p className="text-[0.95rem] text-muted-foreground">Accounts that are already complete are left exactly as they are.</p>
      )}
    </Card>
  );
}
