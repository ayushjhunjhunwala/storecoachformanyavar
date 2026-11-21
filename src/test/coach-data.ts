// Loads the engine's data.json for tests without keeping a copy in the repo:
// a local cache, the uploaded file, or the private bucket via the service key.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { CoachRecord } from "@/lib/coach/types";

const CACHE = "/tmp/coach-data.json";
const UPLOAD = "/mnt/user-uploads/data.json";

export async function loadTestCoachData(): Promise<CoachRecord[] | null> {
  for (const path of [process.env["COACH_DATA_PATH"], CACHE, UPLOAD]) {
    if (path && existsSync(path)) return JSON.parse(readFileSync(path, "utf8")) as CoachRecord[];
  }
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return null;
  const headers: Record<string, string> = { apikey: key };
  if (!key.startsWith("sb_")) headers["Authorization"] = `Bearer ${key}`;
  const res = await fetch(`${url}/storage/v1/object/coach-data/data.json`, { headers });
  if (!res.ok) return null;
  const text = await res.text();
  writeFileSync(CACHE, text);
  return JSON.parse(text) as CoachRecord[];
}
