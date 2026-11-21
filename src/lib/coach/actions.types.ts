import type { ActionEvent, ActionState } from "./workflow";
import type { FollowupHistory, Issue } from "./types";

export interface ActionRow {
  state: ActionState;
  assignee_user_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  block_reason: string | null;
  dismiss_reason: string | null;
  version: number;
  updated_at: string;
}

export interface ActionEventRow {
  id: number;
  actor_name: string;
  actor_role: string;
  event: ActionEvent;
  from_state: ActionState | null;
  to_state: ActionState;
  assignee_name: string | null;
  reason: string | null;
  note: string | null;
  created_at: string;
}

export interface BoardItem {
  issue: Issue;
  week_date: string;
  zone: string;
  action: ActionRow | null;
  /** Latest follow-up measurement on or before the chosen date, if any. */
  outcome: FollowupHistory | null;
  followup_due: string | null;
}

export interface ActionBoard {
  date: string;
  items: BoardItem[];
  stores: string[];
  levers: string[];
  weeks: string[];
}

export interface IssueActivity {
  issue: Issue;
  week_date: string;
  action: ActionRow | null;
  events: ActionEventRow[];
  /** Store lead login for this store, if one exists. */
  store_lead: { user_id: string; name: string } | null;
  me: { user_id: string; role: string };
}

export type TransitionResult =
  | { ok: true; state: ActionState; version: number }
  | { ok: false; code: "conflict" | "invalid"; message: string };
