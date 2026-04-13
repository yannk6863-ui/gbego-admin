import { supabase } from '@/lib/supabase';

export type DriverQosFlag = {
  id: string;
  driverId: string;
  severity: 'warning' | 'restriction';
  reasonCode: string;
  status: 'open' | 'reviewed' | 'dismissed';
  metricSnapshot: {
    average_rating?: number;
    rating_count?: number;
    completed_rides?: number;
    evaluated_at?: string;
    [key: string]: unknown;
  };
  note: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapFlagRow(row: any): DriverQosFlag {
  const severity = String(row?.severity ?? 'warning');
  const status = String(row?.status ?? 'open');

  return {
    id: String(row?.id),
    driverId: String(row?.driver_id),
    severity: severity === 'restriction' ? 'restriction' : 'warning',
    reasonCode: String(row?.reason_code ?? 'unknown_reason'),
    status: status === 'reviewed' || status === 'dismissed' ? status : 'open',
    metricSnapshot:
      row?.metric_snapshot_json && typeof row.metric_snapshot_json === 'object'
        ? row.metric_snapshot_json
        : {},
    note: row?.note ? String(row.note) : null,
    reviewedBy: row?.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row?.reviewed_at ? String(row.reviewed_at) : null,
    createdAt: String(row?.created_at ?? new Date().toISOString()),
    updatedAt: String(row?.updated_at ?? new Date().toISOString()),
  };
}

export async function getDriverQosFlags(driverIds: string[]): Promise<Map<string, DriverQosFlag[]>> {
  const map = new Map<string, DriverQosFlag[]>();

  const uniqueIds = Array.from(new Set(driverIds.filter(Boolean)));
  if (!uniqueIds.length) return map;

  const { data, error } = await supabase.rpc('get_admin_driver_qos_flags', {
    p_driver_ids: uniqueIds,
    p_only_open: true,
  });

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    const parsed = mapFlagRow(row);
    const current = map.get(parsed.driverId) || [];
    current.push(parsed);
    map.set(parsed.driverId, current);
  }

  return map;
}
