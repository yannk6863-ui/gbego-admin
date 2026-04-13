import { supabase } from '@/lib/supabase';

export type UserBehaviorSummary = {
  windowDays: number;
  activeUsers: number;
  totalRides: number;
  ridesPerUser: number;
  cancellationRate: number;
  averageFare: number;
  repeatUserRate: number;
  totalRiders: number;
  sampled: boolean;
  sampleSize: number;
  computedAt: string;
};

type CacheEnvelope = {
  fetchedAt: number;
  payload: UserBehaviorSummary;
};

const CACHE_KEY = 'admin_user_behavior_summary_v1';
const CACHE_TTL_MS = 60_000;
const CACHE_STALE_FALLBACK_MS = 10 * 60_000;
const PAGE_SIZE = 1000;
const MAX_SCANNED_ROWS = 5000;

const EMPTY_SUMMARY: UserBehaviorSummary = {
  windowDays: 30,
  activeUsers: 0,
  totalRides: 0,
  ridesPerUser: 0,
  cancellationRate: 0,
  averageFare: 0,
  repeatUserRate: 0,
  totalRiders: 0,
  sampled: false,
  sampleSize: 0,
  computedAt: new Date(0).toISOString(),
};

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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

function setCached(payload: UserBehaviorSummary): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        fetchedAt: Date.now(),
        payload,
      } as CacheEnvelope)
    );
  } catch {
    // Ignore localStorage write failures.
  }
}

type RideAggregateRow = {
  rider_id: string | null;
  status: string | null;
  fare_final: number | null;
  fare_estimated: number | null;
};

async function loadRidesWindow(sinceIso: string): Promise<{ rows: RideAggregateRow[]; sampled: boolean }> {
  const rows: RideAggregateRow[] = [];
  let sampled = false;

  for (let offset = 0; offset < MAX_SCANNED_ROWS; offset += PAGE_SIZE) {
    const upper = offset + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('rides')
      .select('rider_id,status,fare_final,fare_estimated')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .range(offset, upper);

    if (error) throw error;

    const page = (data || []) as RideAggregateRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      return { rows, sampled };
    }

    if (rows.length >= MAX_SCANNED_ROWS) {
      sampled = true;
      break;
    }
  }

  return { rows, sampled };
}

export async function getUserBehaviorSummary(options?: { windowDays?: number }): Promise<UserBehaviorSummary> {
  const windowDays = Math.max(7, Math.min(180, Number(options?.windowDays ?? 30)));
  const cached = getCached();

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.payload;
  }

  const sinceIso = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [{ rows, sampled }, riderCountRes] = await Promise.all([
      loadRidesWindow(sinceIso),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'rider'),
    ]);

    if (riderCountRes.error) throw riderCountRes.error;

    const perUserCount = new Map<string, number>();
    let cancelled = 0;
    let fareSum = 0;
    let fareCount = 0;

    for (const row of rows) {
      if (!row.rider_id) continue;

      perUserCount.set(row.rider_id, (perUserCount.get(row.rider_id) || 0) + 1);

      if (row.status === 'cancelled') cancelled += 1;

      if (row.status === 'completed') {
        const fare = toNumber(row.fare_final ?? row.fare_estimated ?? 0);
        if (fare > 0) {
          fareSum += fare;
          fareCount += 1;
        }
      }
    }

    const activeUsers = perUserCount.size;
    const totalRides = rows.length;
    const repeatUsers = Array.from(perUserCount.values()).filter((count) => count > 1).length;

    const summary: UserBehaviorSummary = {
      windowDays,
      activeUsers,
      totalRides,
      ridesPerUser: activeUsers > 0 ? round(totalRides / activeUsers, 2) : 0,
      cancellationRate: totalRides > 0 ? round((cancelled / totalRides) * 100, 2) : 0,
      averageFare: fareCount > 0 ? round(fareSum / fareCount, 2) : 0,
      repeatUserRate: activeUsers > 0 ? round((repeatUsers / activeUsers) * 100, 2) : 0,
      totalRiders: Math.max(0, Number(riderCountRes.count || 0)),
      sampled,
      sampleSize: totalRides,
      computedAt: new Date().toISOString(),
    };

    setCached(summary);
    return summary;
  } catch (error) {
    if (cached && Date.now() - cached.fetchedAt < CACHE_STALE_FALLBACK_MS) {
      return cached.payload;
    }
    throw error;
  }
}
