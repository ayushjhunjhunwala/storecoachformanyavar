// Server-only helpers shared by the server-function modules: caller profile, 403s and store scope.
import { setResponseStatus } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CoachIndex } from "./logic";
import { digestDates } from "./logic";
import type { Issue, StoreMeta, ViewProfile } from "./types";
import { fetchViewProfile } from "./profile";

export function forbid(message = "Forbidden"): never {
  setResponseStatus(403);
  throw new Error(message);
}

export async function readProfile(supabase: SupabaseClient<Database>, userId: string): Promise<ViewProfile> {
  let profile: ViewProfile | null;
  try {
    profile = await fetchViewProfile(supabase, userId);
  } catch (error) {
    console.error("[coach] profile read failed", error instanceof Error ? error.message : error);
    forbid("Could not read your Store Coach profile");
  }
  if (!profile) forbid("This account has no Store Coach role");
  return profile;
}

/** Stores a manager-level profile may see. Salespeople get none here. */
export function storesInScope(index: CoachIndex, profile: ViewProfile): StoreMeta[] {
  const all = index.meta.meta.stores;
  switch (profile.role) {
    case "hq":
      return all;
    case "zonal":
      return all.filter((s) => s.zone === profile.scope_id);
    case "am":
      return all.filter((s) => s.area_manager_id === profile.scope_id);
    case "store_lead":
      return all.filter((s) => s.store_id === profile.scope_id);
    default:
      return [];
  }
}

const issueCache = new WeakMap<CoachIndex, Map<string, { issue: Issue; week_date: string }>>();

/** Every weekly-digest issue by id, with the Monday it was sent. */
export function digestIssues(index: CoachIndex): Map<string, { issue: Issue; week_date: string }> {
  let map = issueCache.get(index);
  if (!map) {
    map = new Map();
    for (const d of digestDates(index.dates)) {
      for (const issue of index.dayByDate.get(d)?.issues ?? []) map.set(issue.id, { issue, week_date: d });
    }
    issueCache.set(index, map);
  }
  return map;
}
