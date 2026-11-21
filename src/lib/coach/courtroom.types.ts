import type { Check, Fact, Verdict } from "./evidence";

export interface DetectiveOutput {
  diagnosis: string;
  hypothesis: string;
  cited_fact_ids: string[];
  confidence: "low" | "medium" | "high";
  would_change_my_mind: string;
}

export interface SkepticOutput {
  challenges: { check_id: string; comment: string; cited_fact_ids: string[] }[];
  strongest_alternative: string;
  missing_evidence: string[];
}

export interface InvestigationRecord {
  id: string;
  issue_id: string;
  as_of: string;
  data_version: string;
  evidence_hash: string;
  created_by_name: string;
  created_at: string;
  status: "detective" | "complete";
  facts: Fact[];
  checks: Check[];
  detective: (DetectiveOutput & { fallback: boolean }) | null;
  skeptic: (SkepticOutput & { fallback: boolean }) | null;
  verdict: Verdict | null;
  verdict_reason: string | null;
  missing: string[];
  model: string | null;
  provider: string | null;
  prompt_version: string;
  validations: string[];
  fallback: boolean;
  latency_ms: number | null;
}

export interface ChallengeRecord {
  id: string;
  question: string;
  preset: string | null;
  answer: string;
  can_answer: boolean;
  fact_ids: string[];
  user_name: string;
  provider: string | null;
  fallback: boolean;
  created_at: string;
}

export interface CourtroomState {
  investigation: InvestigationRecord | null;
  challenges: ChallengeRecord[];
}
