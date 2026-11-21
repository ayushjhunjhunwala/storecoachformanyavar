// Action workflow rules for weekly issues. Pure, shared by the server (which enforces
// them) and the UI (which only offers allowed buttons). Execution status (done) is kept
// separate from outcome status (improved / no change), which comes from follow-ups.

export const ACTION_STATES = ["open", "assigned", "acknowledged", "in_progress", "blocked", "done", "reviewed", "dismissed"] as const;
export type ActionState = (typeof ACTION_STATES)[number];

export const ACTION_EVENTS = ["assign", "acknowledge", "begin", "block", "unblock", "done", "review", "dismiss", "reopen"] as const;
export type ActionEvent = (typeof ACTION_EVENTS)[number];

export type ActorRole = "hq" | "zonal" | "am" | "store_lead" | "salesperson";

export const BLOCK_REASONS = [
  "Stock not available",
  "Person away or not on the floor",
  "Need a manager decision",
  "Customer details missing",
  "Other",
] as const;

export const DISMISS_REASONS = [
  "Already handled",
  "Data looks wrong",
  "Market or calendar effect",
  "Not actionable this week",
  "Other",
] as const;

export const STATE_LABEL: Record<ActionState, string> = {
  open: "Not assigned",
  assigned: "Assigned",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  reviewed: "Reviewed",
  dismissed: "Dismissed",
};

export const EVENT_LABEL: Record<ActionEvent, string> = {
  assign: "Assign",
  acknowledge: "Acknowledge",
  begin: "Start",
  block: "Blocked",
  unblock: "Unblock",
  done: "Mark done",
  review: "Mark reviewed",
  dismiss: "Dismiss",
  reopen: "Reopen",
};

/** Past-tense wording for the history list. */
export const EVENT_PAST: Record<ActionEvent, string> = {
  assign: "assigned",
  acknowledge: "acknowledged",
  begin: "started",
  block: "marked blocked",
  unblock: "unblocked",
  done: "marked done",
  review: "reviewed",
  dismiss: "dismissed",
  reopen: "reopened",
};

const ACTIVE: ActionState[] = ["assigned", "acknowledged", "in_progress"];

export interface ActionSnapshot {
  state: ActionState;
  assigneeUserId: string | null;
}

export interface ActorContext {
  role: ActorRole;
  userId: string;
}

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

export function isManagerRole(role: ActorRole): boolean {
  return role === "hq" || role === "zonal" || role === "am";
}

interface Rule {
  from: ActionState[];
  to: (s: ActionSnapshot) => ActionState;
  who: "manager" | "assignee" | "assignee_or_manager";
  needsReason?: readonly string[];
  needsAssignee?: boolean;
}

const RULES: Record<ActionEvent, Rule> = {
  assign: { from: ["open", ...ACTIVE, "blocked"], to: () => "assigned", who: "manager", needsAssignee: true },
  acknowledge: { from: ["assigned"], to: () => "acknowledged", who: "assignee" },
  begin: { from: ["assigned", "acknowledged"], to: () => "in_progress", who: "assignee" },
  block: { from: ACTIVE, to: () => "blocked", who: "assignee", needsReason: BLOCK_REASONS },
  unblock: { from: ["blocked"], to: () => "in_progress", who: "assignee_or_manager" },
  done: { from: ["open", ...ACTIVE, "blocked"], to: () => "done", who: "assignee_or_manager" },
  review: { from: ["done"], to: () => "reviewed", who: "manager" },
  dismiss: { from: ["open", ...ACTIVE, "blocked"], to: () => "dismissed", who: "manager", needsReason: DISMISS_REASONS },
  reopen: { from: ["done", "reviewed", "dismissed"], to: (s) => (s.assigneeUserId ? "assigned" : "open"), who: "manager" },
};

function allowedActor(rule: Rule, snap: ActionSnapshot, actor: ActorContext): boolean {
  const manager = isManagerRole(actor.role);
  const assignee = snap.assigneeUserId !== null && snap.assigneeUserId === actor.userId;
  if (rule.who === "manager") return manager;
  if (rule.who === "assignee") return assignee;
  return manager || assignee;
}

/** Events this person may take from the current state (for showing buttons). */
export function allowedEvents(snap: ActionSnapshot, actor: ActorContext): ActionEvent[] {
  if (actor.role === "salesperson") return [];
  return ACTION_EVENTS.filter((e) => {
    const rule = RULES[e];
    if (!rule.from.includes(snap.state)) return false;
    // "Done" straight from open is only for a manager doing it themselves.
    if (e === "done" && snap.state === "open" && !isManagerRole(actor.role)) return false;
    return allowedActor(rule, snap, actor);
  });
}

export interface TransitionInput {
  event: ActionEvent;
  reason?: string | null;
  note?: string | null;
  hasAssignee?: boolean;
}

/** Validates a change and returns the new state; throws WorkflowError with a readable message. */
export function nextState(snap: ActionSnapshot, actor: ActorContext, input: TransitionInput): ActionState {
  const rule = RULES[input.event];
  if (!rule) throw new WorkflowError("Unknown action");
  if (actor.role === "salesperson") throw new WorkflowError("Salespeople can't change manager actions");
  if (!allowedEvents(snap, actor).includes(input.event)) {
    if (!rule.from.includes(snap.state)) {
      throw new WorkflowError(`Can't ${EVENT_LABEL[input.event].toLowerCase()} an action that is ${STATE_LABEL[snap.state].toLowerCase()}`);
    }
    throw new WorkflowError(
      rule.who === "manager" ? "Only a manager can do that" : "Only the person this action is assigned to can do that",
    );
  }
  if (rule.needsReason) {
    const reason = input.reason?.trim() ?? "";
    if (!rule.needsReason.includes(reason)) throw new WorkflowError("Choose a reason");
    if (reason === "Other" && !(input.note ?? "").trim()) throw new WorkflowError("Add a short note for “Other”");
  }
  if (rule.needsAssignee && !input.hasAssignee) throw new WorkflowError("Choose who should do this");
  return rule.to(snap);
}

/** Who hears about a change: the assignee for manager moves, the managers for assignee moves. */
export function notifyTargets(event: ActionEvent): "assignee" | "managers" | "none" {
  switch (event) {
    case "assign":
    case "reopen":
    case "review":
    case "dismiss":
      return "assignee";
    case "acknowledge":
    case "block":
    case "done":
      return "managers";
    default:
      return "none";
  }
}

/** Board grouping: what needs attention first. */
export function boardColumn(state: ActionState): "todo" | "active" | "blocked" | "closed" {
  if (state === "open") return "todo";
  if (state === "blocked") return "blocked";
  if (state === "done" || state === "reviewed" || state === "dismissed") return "closed";
  return "active";
}

/** CSV-safe cell: quotes, doubles quotes, and neutralises spreadsheet formulas. */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
