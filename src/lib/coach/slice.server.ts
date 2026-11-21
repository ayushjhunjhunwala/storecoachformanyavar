// Builds the ONLY data a signed-in person may see for a replay date.
// The browser never filters for security: it renders what this returns.
import type {
  CallbackView,
  DataFlag,
  FollowupView,
  Issue,
  ManagerView,
  MarketIssue,
  MyView,
  RoleModel,
  StoreBundle,
  TeamRow,
  UpcomingDay,
  ViewProfile,
  WeekSent,
  CoachView,
  AreaManager,
} from "./types";
import {
  type CoachIndex,
  digestDateFor,
  digestDates,
  followupKey,
  historyUpTo,
  storeLeadFor,
  teamDayFor,
} from "./logic";

export class ScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScopeError";
  }
}

const CALLBACK_TOP = 8;

function spName(index: CoachIndex, id: string): string {
  return index.spById.get(id)?.name ?? id;
}

function buildStoreBundle(index: CoachIndex, storeId: string, date: string): StoreBundle {
  const meta = index.storeById.get(storeId);
  if (!meta) throw new ScopeError(`Unknown store ${storeId}`);
  const day = index.dayByDate.get(date);
  const teamDay = teamDayFor(index, date);
  const team: TeamRow[] = Object.entries(teamDay?.sp ?? {})
    .filter(([, s]) => s.store_id === storeId)
    .map(([id, s]) => ({
      ...s,
      salesperson_id: id,
      join_date: index.spById.get(id)?.join_date ?? null,
    }))
    .sort((a, b) => b.bills28 - a.bills28 || a.name.localeCompare(b.name));
  const cb = index.meta.callbacks[storeId];
  const items: CallbackView[] = (cb?.items ?? []).slice(0, CALLBACK_TOP).map((item) => ({
    ...item,
    owner_name: item.owner ? spName(index, item.owner) : null,
  }));
  return {
    meta,
    kpi: day?.stores[storeId] ?? null,
    team,
    cards: (day?.cards ?? []).filter((c) => c.store_id === storeId),
    mentors: (day?.mentors ?? [])
      .filter((m) => m.store_id === storeId)
      .map((m) => ({ ...m, mentee_name: spName(index, m.mentee), mentor_name: spName(index, m.mentor) })),
    callbacks: { total: cb?.total ?? 0, items },
    flags: (day?.flags ?? []).filter((f) => f.store_id === storeId),
    lead_name: storeLeadFor(index, storeId)?.name ?? null,
  };
}

function followupsFor(index: CoachIndex, storeIds: Set<string>, date: string): FollowupView[] {
  return index.meta.followups
    .filter((f) => storeIds.has(f.issue.store_id) && f.first_sent <= date)
    .map((f) => {
      const history = historyUpTo(f, date);
      return {
        key: f.key,
        store_id: f.issue.store_id,
        area_manager_id: f.issue.area_manager_id,
        title: f.issue.title,
        lever: f.issue.lever,
        sends: f.sends.filter((s) => s <= date),
        first_sent: f.first_sent,
        latest: history[history.length - 1] ?? null,
        history,
      };
    });
}

function weeksFor(index: CoachIndex, amIds: Set<string>, date: string): WeekSent[] {
  return digestDates(index.dates)
    .filter((d) => d <= date)
    .map((d) => {
      const by_am: WeekSent["by_am"] = {};
      for (const id of amIds) by_am[id] = { count: 0, rupees: 0 };
      for (const issue of index.dayByDate.get(d)?.issues ?? []) {
        const slot = by_am[issue.area_manager_id];
        if (!slot) continue;
        slot.count += 1;
        slot.rupees += issue.rupees;
      }
      return { date: d, by_am };
    });
}

function upcomingFor(index: CoachIndex, states: Set<string>, date: string): Record<string, UpcomingDay[]> {
  const out: Record<string, UpcomingDay[]> = {};
  for (const state of states) {
    out[state] = (index.meta.upcoming[state] ?? []).filter((u) => u.date > date);
  }
  return out;
}

export function buildView(index: CoachIndex, profile: ViewProfile, date: string): CoachView {
  const day = index.dayByDate.get(date);
  if (!day) throw new ScopeError(`No replay run for ${date}`);
  if (profile.role === "salesperson") return buildMyView(index, profile, date);

  const allStores = index.meta.meta.stores;
  let stores: typeof allStores;
  let ams: AreaManager[];
  switch (profile.role) {
    case "hq":
      stores = allStores;
      ams = index.meta.meta.area_managers;
      break;
    case "zonal": {
      stores = allStores.filter((s) => s.zone === profile.scope_id);
      const amSet = new Set(stores.map((s) => s.area_manager_id));
      ams = index.meta.meta.area_managers.filter((a) => amSet.has(a.area_manager_id));
      break;
    }
    case "am":
      stores = allStores.filter((s) => s.area_manager_id === profile.scope_id);
      ams = index.meta.meta.area_managers.filter((a) => a.area_manager_id === profile.scope_id);
      break;
    case "store_lead":
      stores = allStores.filter((s) => s.store_id === profile.scope_id);
      ams = index.meta.meta.area_managers.filter((a) =>
        stores.some((s) => s.area_manager_id === a.area_manager_id),
      );
      break;
    default:
      throw new ScopeError("Unknown role");
  }
  if (stores.length === 0) throw new ScopeError("This account has no stores in scope");

  const storeIds = new Set(stores.map((s) => s.store_id));
  const amIds = new Set(ams.map((a) => a.area_manager_id));
  const cities = new Set(stores.map((s) => s.city));
  const zones = new Set(stores.map((s) => s.zone));
  const states = new Set(stores.map((s) => s.state));

  const digestDate = digestDateFor(index.dates, date);
  const digestDay = index.dayByDate.get(digestDate);
  const digest: Issue[] = (digestDay?.issues ?? []).filter((i) => storeIds.has(i.store_id));

  let market: MarketIssue[] = [];
  if (profile.role === "hq") market = day.market;
  else if (profile.role === "zonal") market = day.market.filter((m) => zones.has(m.zone));
  else if (profile.role === "am") market = day.market.filter((m) => cities.has(m.city));

  const flags: DataFlag[] = day.flags.filter((f) => storeIds.has(f.store_id));

  let roles: RoleModel[];
  if (profile.role === "store_lead") roles = day.roles.filter((r) => storeIds.has(r.store_id));
  else roles = day.roles.filter((r) => cities.has(r.city));

  const managerLevel = profile.role === "hq" || profile.role === "zonal";
  const bundles: Record<string, StoreBundle> = {};
  for (const s of stores) bundles[s.store_id] = buildStoreBundle(index, s.store_id, date);

  let network: ManagerView["network"] = null;
  if (profile.role === "hq") {
    let bills = 0;
    let ly = 0;
    for (const k of Object.values(day.stores)) {
      bills += k.bills;
      ly += k.ly_bills;
    }
    network = { bills, ly_bills: ly };
  }

  return {
    kind: "manager",
    role: profile.role,
    profile,
    date,
    digest_date: digestDate,
    team_as_of: teamDayFor(index, date)?.date ?? null,
    dates: index.dates,
    area_managers: ams,
    stores: bundles,
    store_order: stores.map((s) => s.store_id),
    digest,
    followups: followupsFor(index, storeIds, date),
    market,
    flags,
    roles,
    upcoming: upcomingFor(index, states, date),
    runs: managerLevel ? index.meta.runs.filter((r) => r.replay_date <= date) : [],
    weeks: profile.role === "store_lead" ? [] : weeksFor(index, amIds, date),
    network,
    all_issue_count: profile.role === "hq" ? day.all_issue_count : null,
  };
}

function kpiKeyForCard(kind: string | undefined): MyView["kpi_key"] {
  if (kind === "kur") return "kur";
  if (kind === "disc") return "disc";
  return "ipb";
}

function buildMyView(index: CoachIndex, profile: ViewProfile, date: string): MyView {
  const id = profile.scope_id ?? "";
  const person = index.spById.get(id);
  if (!person) throw new ScopeError("This salesperson is not in the data");
  const day = index.dayByDate.get(date);
  const store = index.storeById.get(person.store_id);
  const teamDay = teamDayFor(index, date);
  const rawCard = day?.cards.find((c) => c.sp === id) ?? null;
  // The card text names its peer already; drop the peer's id so no colleague identifier is sent.
  const card = rawCard ? { ...rawCard, peer: null } : null;
  const mentorPair = day?.mentors.find((m) => m.mentee === id) ?? null;
  const cb = index.meta.callbacks[person.store_id];
  const own = (cb?.items ?? []).filter((item) => item.owner === id);
  return {
    kind: "salesperson",
    role: "salesperson",
    profile,
    date,
    dates: index.dates,
    salesperson_id: id,
    name: person.name,
    store_id: person.store_id,
    store_city: store?.city ?? "",
    card,
    kpi_key: kpiKeyForCard(card?.kind),
    trend: (index.trend[id] ?? []).filter((p) => p.w <= date),
    store_trend: (index.trend[`_store_${person.store_id}`] ?? []).filter((p) => p.w <= date),
    mentor: mentorPair ? { name: spName(index, mentorPair.mentor), focus: mentorPair.focus } : null,
    mentees: (day?.mentors ?? [])
      .filter((m) => m.mentor === id)
      .map((m) => ({ name: spName(index, m.mentee), focus: m.focus })),
    callbacks: { total: own.length, items: own },
    stats: teamDay?.sp?.[id] ?? null,
    stats_as_of: teamDay?.date ?? null,
    // The public festival / wedding calendar for the person's state (no colleague data).
    upcoming: store ? (index.meta.upcoming[store.state] ?? []) : [],
  };
}

export { followupKey };
