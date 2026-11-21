// The demo account list, derived from data.json exactly as the PRD specifies.
import type { CoachRole } from "./types";
import { type CoachIndex, storeLeadFor } from "./logic";

export const DEMO_PASSWORD = "Demo@2026";
export const DEMO_DOMAIN = "storecoach.demo";

export interface DemoAccount {
  email: string;
  display_name: string;
  role: CoachRole;
  scope_id: string;
}

const ZONES = ["North", "East", "South"] as const;

export function buildDemoAccounts(index: CoachIndex): DemoAccount[] {
  const accounts: DemoAccount[] = [
    { email: `hq@${DEMO_DOMAIN}`, display_name: "HQ Admin", role: "hq", scope_id: "ALL" },
  ];
  for (const zone of ZONES) {
    accounts.push({
      email: `zonal.${zone.toLowerCase()}@${DEMO_DOMAIN}`,
      display_name: `${zone} zonal head`,
      role: "zonal",
      scope_id: zone,
    });
  }
  const ams = [...index.meta.meta.area_managers].sort((a, b) =>
    a.area_manager_id.localeCompare(b.area_manager_id),
  );
  for (const am of ams) {
    const num = am.area_manager_id.replace(/^AM-/, "");
    accounts.push({
      email: `am${num}@${DEMO_DOMAIN}`,
      display_name: am.name,
      role: "am",
      scope_id: am.area_manager_id,
    });
  }
  for (const store of index.meta.meta.stores) {
    const lead = storeLeadFor(index, store.store_id);
    accounts.push({
      email: `lead.${store.store_id.toLowerCase().replace(/-/g, "")}@${DEMO_DOMAIN}`,
      display_name: lead?.name ?? `${store.store_id} store lead`,
      role: "store_lead",
      scope_id: store.store_id,
    });
  }
  const refDay = index.dayByDate.get(index.meta.generated) ?? index.days[index.days.length - 1];
  const seen = new Set<string>();
  for (const card of refDay?.cards ?? []) {
    if (seen.has(card.sp)) continue;
    seen.add(card.sp);
    accounts.push({
      email: `${card.sp.toLowerCase()}@${DEMO_DOMAIN}`,
      display_name: index.spById.get(card.sp)?.name ?? card.name,
      role: "salesperson",
      scope_id: card.sp,
    });
  }
  return accounts;
}
