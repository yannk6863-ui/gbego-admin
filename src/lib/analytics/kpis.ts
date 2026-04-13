import { supabase } from '@/lib/supabase';

export type DashboardKpiSnapshot = {
  totalRides: number;
  completedRides: number;
  cancelledRides: number;
  activeDrivers: number;
  totalRevenue: number;
  platformCommission: number;
  averageFare: number;
  newUsers: number;
  computedAt: string;
};

type CacheEnvelope = {
  fetchedAt: number;
  payload: DashboardKpiSnapshot;
};

const CACHE_KEY = 'admin_dashboard_kpis_v1';
const CACHE_TTL_MS = 60_000;
const CACHE_STALE_FALLBACK_MS = 10 * 60_000;

const EMPTY_KPIS: DashboardKpiSnapshot = {
  totalRides: 0,
  completedRides: 0,
  cancelledRides: 0,
  activeDrivers: 0,
  totalRevenue: 0,
  platformCommission: 0,
  averageFare: 0,
  newUsers: 0,
  computedAt: new Date(0).toISOString(),
};

function parseNumeric(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function parseCount(value: unknown): number {
  return Math.max(0, Math.trunc(parseNumeric(value)));
}

function getCached(): CacheEnvelope | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope;

    if (!parsed?.payload || typeof parsed?.fetchedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCached(payload: DashboardKpiSnapshot): void {
  if (typeof window === 'undefined') return;

  try {
    const envelope: CacheEnvelope = {
      fetchedAt: Date.now(),
      payload,
    };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
  } catch {
    // Ignore localStorage errors.
  }
}

function fromRpcRow(row: any): DashboardKpiSnapshot {
  return {
    totalRides: parseCount(row?.total_rides),
    completedRides: parseCount(row?.completed_rides),
    cancelledRides: parseCount(row?.cancelled_rides),
    activeDrivers: parseCount(row?.active_drivers),
    totalRevenue: parseNumeric(row?.total_revenue),
    platformCommission: parseNumeric(row?.platform_commission),
    averageFare: parseNumeric(row?.average_fare),
    newUsers: parseCount(row?.new_users),
    computedAt: String(row?.computed_at ?? new Date().toISOString()),
  };
}

export async function getDashboardKpis(options?: { newUsersWindowDays?: number }): Promise<DashboardKpiSnapshot> {
  const windowDays = Math.max(1, Math.min(365, Number(options?.newUsersWindowDays ?? 30)));
  const cached = getCached();

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.payload;
  }

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase.rpc('get_admin_dashboard_kpis', {
    p_new_user_since: since,
  });

  if (error) {
    if (cached && Date.now() - cached.fetchedAt < CACHE_STALE_FALLBACK_MS) {
      return cached.payload;
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  const snapshot = row ? fromRpcRow(row) : { ...EMPTY_KPIS, computedAt: new Date().toISOString() };

  setCached(snapshot);
  return snapshot;
}
