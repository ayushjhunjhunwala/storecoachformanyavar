// Reads the signed-in person's Store Coach identity. The role and scope come from
// user_roles (own row only, never writable from the app); the name from profiles.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ViewProfile } from "./types";
import { isCoachRole } from "./logic";

export async function fetchViewProfile(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<ViewProfile | null> {
  const [profileRes, roleRes] = await Promise.all([
    client.from("profiles").select("email, display_name").eq("id", userId).maybeSingle(),
    client.from("user_roles").select("role, scope_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (roleRes.error) throw roleRes.error;
  const profile = profileRes.data;
  const role = roleRes.data;
  if (!profile || !role || !isCoachRole(role.role)) return null;
  return { email: profile.email, display_name: profile.display_name, role: role.role, scope_id: role.scope_id };
}
