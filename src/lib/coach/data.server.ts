// Loads data.json from the PRIVATE "coach-data" bucket with the service role.
// Only call after the caller has been authenticated and authorised.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { CoachRecord } from "./types";
import { type CoachIndex, indexCoachData } from "./logic";

export const COACH_BUCKET = "coach-data";
export const COACH_OBJECT = "data.json";
const CACHE_MS = 10 * 60 * 1000;

// Parsed result cache per worker instance. Only plain data is cached (never a
// pending request), so nothing tied to another request's I/O is reused.
let cached: { at: number; index: CoachIndex } | null = null;

export async function loadCoachIndex(): Promise<CoachIndex> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.index;
  const { data, error } = await supabaseAdmin.storage.from(COACH_BUCKET).download(COACH_OBJECT);
  if (error || !data) {
    console.error("[coach] could not download data.json", error);
    throw new Error("Store Coach data is not available right now.");
  }
  const records = JSON.parse(await data.text()) as CoachRecord[];
  const index = indexCoachData(records);
  cached = { at: Date.now(), index };
  return index;
}
