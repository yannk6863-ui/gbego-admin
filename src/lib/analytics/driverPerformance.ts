import { supabase } from '@/lib/supabase';

export type DriverPerformanceStats = {
  driverId: string;
  totalRidesCompleted: number;
  cancellationRate: number;
  averageRating: number;
  ratingCount: number;
  totalEarnings: number;
  activityStatus: 'active' | 'stale' | 'offline';
  lastSeenAt: string | null;
  computedAt: string;
};

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toInt(value: unknown): number {
  return Math.max(0, Math.trunc(toNumber(value)));
}

function mapRow(row: any): DriverPerformanceStats {
  const rawStatus = String(row?.activity_status ?? 'offline');
  const activityStatus: DriverPerformanceStats['activityStatus'] =
    rawStatus === 'active' || rawStatus === 'stale' ? rawStatus : 'offline';

  return {
    driverId: String(row?.driver_id),
    totalRidesCompleted: toInt(row?.total_rides_completed),
    cancellationRate: toNumber(row?.cancellation_rate),
    averageRating: toNumber(row?.average_rating),
    ratingCount: toInt(row?.rating_count),
    totalEarnings: toNumber(row?.total_earnings),
    activityStatus,
    lastSeenAt: row?.last_seen_at ? String(row.last_seen_at) : null,
    computedAt: String(row?.computed_at ?? new Date().toISOString()),
  };
}

export async function getDriverPerformanceStats(driverIds: string[]): Promise<Map<string, DriverPerformanceStats>> {
  const map = new Map<string, DriverPerformanceStats>();

  if (!driverIds.length) return map;

  const uniqueIds = Array.from(new Set(driverIds.filter(Boolean)));

  const { data, error } = await supabase.rpc('get_admin_driver_performance_stats', {
    p_driver_ids: uniqueIds,
  });

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    const parsed = mapRow(row);
    map.set(parsed.driverId, parsed);
  }

  return map;
}
