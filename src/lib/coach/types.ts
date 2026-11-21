// Shapes of the engine's data.json (k = "meta" | "trend" | "day") and of the
// role-scoped view the server returns. Client-safe: types only.

export type CoachRole = "hq" | "zonal" | "am" | "store_lead" | "salesperson";

export interface StoreMeta {
  store_id: string;
  city: string;
  state: string;
  zone: string;
  tier: string;
  size_sqft?: string;
  stock_capacity_units?: string;
  opened_on: string;
  area_manager_id: string;
}

export interface AreaManager {
  area_manager_id: string;
  name: string;
  city: string;
  stores: string;
  max_alerts_per_week: string;
}

export interface SalespersonMeta {
  salesperson_id: string;
  store_id: string;
  name: string;
  join_date: string;
}

export interface RunLog {
  replay_date: string;
  issues: number;
  candidates: number;
  cards: number;
  flags: number;
  market: number;
  max_card_words: number;
  secs: number;
}

export type FollowupResult = "improved" | "no_change" | "worse";

export interface FollowupHistory {
  on: string;
  sent_on: string;
  value: number;
  baseline: number;
  result: FollowupResult;
  text: string;
}

export interface Issue {
  id: string;
  rank: number;
  area_manager_id: string;
  store_id: string;
  city: string;
  detector: string;
  lever: string;
  title: string;
  cause: string;
  action: string;
  who: string;
  when: string;
  math: string;
  rupees: number;
  kpi: string;
  baseline: number;
  sp: string[];
}

export interface Followup {
  key: string;
  first_sent: string;
  history: FollowupHistory[];
  sends: string[];
  sent_on: string;
  status: string;
  issue: Issue;
  followup_on: string;
}

export interface CallbackItem {
  cust: string;
  date: string;
  value: number;
  bought: string;
  served_by: string;
  owner: string | null;
}

export interface CallbackList {
  total: number;
  items: CallbackItem[];
}

export interface UpcomingDay {
  date: string;
  festival: string | null;
  wedding: boolean;
}

export interface TrendPoint {
  w: string;
  ipb: number;
  disc: number;
  kur: number;
  bills?: number;
}

export interface MarketIssue {
  city: string;
  zone: string;
  value: number;
  others: number;
  share_down?: number;
  weeks?: number;
  weekly?: number[];
  text: string;
}

export interface DataFlag {
  type: string;
  store_id: string;
  detail: string;
  routed_to: string;
  days?: string[];
}

export type CardKind = "praise" | "ipb" | "kur" | "shw" | "disc";

export interface CoachCard {
  sp: string;
  name: string;
  store_id: string;
  kind: CardKind | string;
  peer: string | null;
  text: string;
  words: number;
}

export interface MentorPair {
  mentee: string;
  mentor: string;
  store_id: string;
  focus: string;
  overlap: number;
}

export interface RoleModel {
  sp: string;
  name: string;
  store_id: string;
  city: string;
  rate: number;
  city_med: number;
  n?: number;
}

export interface StoreKpi {
  store_id: string;
  city: string;
  tier: string;
  am: string;
  bills: number;
  footfall: number;
  revenue: number;
  conv: number | null;
  ipb: number;
  atv: number;
  disc: number;
  ly_bills: number;
  ly_footfall?: number;
  ly_conv: number | null;
  new_store: boolean;
  opened_on?: string;
  conv_tier: number | null;
  ipb_tier: number;
  atv_tier: number;
  disc_tier?: number;
}

export interface SpStats {
  name: string;
  store_id: string;
  bills90: number;
  bills28: number;
  rev28?: number;
  ipb: number | null;
  disc: number | null;
  kur_rate: number | null;
  kur: number;
  shw_rate?: number | null;
  shw?: number;
  wkend_off: number | null;
  last_bill: string | null;
  repeat: number | null;
}

export interface MetaRecord {
  k: "meta";
  generated: string;
  meta: {
    stores: StoreMeta[];
    area_managers: AreaManager[];
    salespeople: SalespersonMeta[];
  };
  runs: RunLog[];
  followups: Followup[];
  callbacks: Record<string, CallbackList>;
  upcoming: Record<string, UpcomingDay[]>;
}

export interface TrendRecord {
  k: "trend";
  trend: Record<string, TrendPoint[]>;
}

export interface DayRecord {
  k: "day";
  date: string;
  issues: Issue[];
  all_issue_count: number;
  market: MarketIssue[];
  flags: DataFlag[];
  cards: CoachCard[];
  mentors: MentorPair[];
  roles: RoleModel[];
  stores: Record<string, StoreKpi>;
  sp: Record<string, SpStats> | null;
}

export type CoachRecord = MetaRecord | TrendRecord | DayRecord;

// ---------- Scoped view returned by the server ----------

export interface ViewProfile {
  email: string;
  display_name: string;
  role: CoachRole;
  scope_id: string | null;
}

export interface FollowupView {
  key: string;
  store_id: string;
  area_manager_id: string;
  title: string;
  lever: string;
  sends: string[];
  first_sent: string;
  /** Latest history entry dated on or before the chosen date. */
  latest: FollowupHistory | null;
  /** History entries dated on or before the chosen date. */
  history: FollowupHistory[];
}

export interface MentorView extends MentorPair {
  mentee_name: string;
  mentor_name: string;
}

export interface TeamRow extends SpStats {
  salesperson_id: string;
  join_date: string | null;
}

export interface CallbackView extends CallbackItem {
  owner_name: string | null;
}

export interface StoreBundle {
  meta: StoreMeta;
  kpi: StoreKpi | null;
  team: TeamRow[];
  cards: CoachCard[];
  mentors: MentorView[];
  callbacks: { total: number; items: CallbackView[] };
  flags: DataFlag[];
  lead_name: string | null;
}

export interface WeekSent {
  date: string;
  by_am: Record<string, { count: number; rupees: number }>;
}

export interface ManagerView {
  kind: "manager";
  role: Exclude<CoachRole, "salesperson">;
  profile: ViewProfile;
  date: string;
  digest_date: string;
  team_as_of: string | null;
  dates: string[];
  area_managers: AreaManager[];
  stores: Record<string, StoreBundle>;
  store_order: string[];
  digest: Issue[];
  followups: FollowupView[];
  market: MarketIssue[];
  flags: DataFlag[];
  roles: RoleModel[];
  upcoming: Record<string, UpcomingDay[]>;
  runs: RunLog[];
  weeks: WeekSent[];
  network: { bills: number; ly_bills: number } | null;
  all_issue_count: number | null;
}

export interface MyView {
  kind: "salesperson";
  role: "salesperson";
  profile: ViewProfile;
  date: string;
  dates: string[];
  salesperson_id: string;
  name: string;
  store_id: string;
  store_city: string;
  card: CoachCard | null;
  kpi_key: "ipb" | "kur" | "disc";
  trend: TrendPoint[];
  store_trend: TrendPoint[];
  mentor: { name: string; focus: string } | null;
  mentees: { name: string; focus: string }[];
  callbacks: { total: number; items: CallbackItem[] };
  stats: SpStats | null;
  stats_as_of: string | null;
  upcoming: UpcomingDay[];
}

export type CoachView = ManagerView | MyView;
