import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import type { MentorView, TeamRow } from "@/lib/coach/types";
import { FOCUS_LABEL, formatPct } from "@/lib/coach/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "./primitives";
import { statusKey, useActionStatus, useActionStatusGroup } from "./use-action-status";

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "Ajay S. coaches Faizan M. on items per bill · 79% shared shifts", with Accept all / Swap a mentor. */
export function MentorPairs({
  storeId,
  date,
  mentors,
  team,
  interactive,
}: {
  storeId: string;
  date: string;
  mentors: MentorView[];
  team: TeamRow[];
  interactive: boolean;
}) {
  const [accepted, setAccepted] = useActionStatus<"accepted">(statusKey.mentors(storeId, date));
  const [swaps, setSwap] = useActionStatusGroup(statusKey.mentorSwaps(storeId, date));
  const nameOf = (id: string) => team.find((t) => t.salesperson_id === id)?.name ?? id;

  const pairs = mentors.map((m) => {
    const swapped = swaps[m.mentee];
    return swapped ? { ...m, mentor: swapped, mentor_name: nameOf(swapped), swapped: true } : { ...m, swapped: false };
  });
  const groups = new Map<string, typeof pairs>();
  for (const p of pairs) {
    const key = `${p.mentor}|${p.focus}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  const [open, setOpen] = useState(false);
  const [mentee, setMentee] = useState("");
  const [newMentor, setNewMentor] = useState("");
  const menteeRow = mentors.find((m) => m.mentee === mentee);
  const choices = team.filter((t) => t.salesperson_id !== mentee);

  function saveSwap() {
    if (!mentee || !newMentor) return;
    setSwap(mentee, menteeRow && newMentor === menteeRow.mentor ? null : newMentor);
    setOpen(false);
  }

  return (
    <Card title="Mentor pairs">
      {pairs.length === 0 ? (
        <p className="text-[1.05rem] text-muted-foreground">No mentor pairs today.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {[...groups.values()].map((group) => {
            const first = group[0]!;
            const focus = (FOCUS_LABEL[first.focus] ?? first.focus).toLowerCase();
            return (
              <li key={`${first.mentor}-${first.focus}`} className="text-[1.05rem] leading-relaxed text-foreground">
                <b className="font-semibold">{first.mentor_name}</b> coaches{" "}
                {group.map((g, i) => (
                  <span key={g.mentee}>
                    {i > 0 && (i === group.length - 1 ? " and " : ", ")}
                    <b className="font-semibold">{g.mentee_name}</b>
                  </span>
                ))}{" "}
                on {focus}
                {group.length === 1 && !first.swapped ? ` · ${formatPct(first.overlap, 0)} shared shifts` : ""}
                {group.some((g) => g.swapped) && <span className="text-muted-foreground"> · swapped today</span>}
              </li>
            );
          })}
        </ul>
      )}
      {interactive && pairs.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {accepted ? (
            <>
              <span className="inline-flex h-11 items-center gap-2 rounded-full bg-good-soft px-5 font-semibold text-good" role="status">
                <Check className="size-4" /> Accepted
              </span>
              <Button variant="quiet" onClick={() => setAccepted(null)}>
                <RotateCcw /> Undo
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setAccepted("accepted")}>
              Accept all
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setMentee(mentors[0]?.mentee ?? "");
              setNewMentor("");
              setOpen(true);
            }}
          >
            Swap a mentor
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Swap a mentor</DialogTitle>
            <DialogDescription>
              Pick who needs a different mentor today. The pairing is saved for {storeId} on this date.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              Learner
              <Select value={mentee} onValueChange={(v) => { setMentee(v); setNewMentor(""); }}>
                <SelectTrigger className="h-11 rounded-2xl text-base text-foreground">
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  {mentors.map((m) => (
                    <SelectItem key={m.mentee} value={m.mentee}>
                      {m.mentee_name} · {FOCUS_LABEL[m.focus] ?? m.focus}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              New mentor
              <Select value={newMentor} onValueChange={setNewMentor} disabled={!mentee}>
                <SelectTrigger className="h-11 rounded-2xl text-base text-foreground">
                  <SelectValue placeholder="Choose a colleague" />
                </SelectTrigger>
                <SelectContent>
                  {choices.map((t) => (
                    <SelectItem key={t.salesperson_id} value={t.salesperson_id}>
                      {t.name}
                      {menteeRow?.mentor === t.salesperson_id ? " (engine's pick)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            {menteeRow && swaps[menteeRow.mentee] && (
              <p className="text-sm text-muted-foreground">
                Currently swapped to {nameOf(swaps[menteeRow.mentee]!)}. Choose {menteeRow.mentor_name} to go back to the engine's pick.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSwap} disabled={!mentee || !newMentor}>
              Save pairing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export { joinNames };
