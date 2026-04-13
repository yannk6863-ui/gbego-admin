'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import RideStatusBadge from '@/components/RideStatusBadge';
import { DataState } from '@/components/ui/DataState';

interface Ride {
  id: string;
  rider_id: string;
  driver_id: string | null;
  status: string;
  pickup_address?: string | null;
  dest_address?: string | null;
  fare_estimated?: number | null;
  created_at?: string | null;
  rider_profile?: { phone?: string | null } | null;
  driver_profile?: { phone?: string | null } | null;
}

type RideRowView = {
  id: string;
  status: string;
  riderPhone: string;
  driverPhone: string;
  pickupAddress: string;
  destinationAddress: string;
  fareText: string;
  createdText: string;
};

type RideRowCardProps = {
  row: RideRowView;
  onCopyRideId: (rideId: string) => void;
};

const RideRowCard = memo(function RideRowCard({ row, onCopyRideId }: RideRowCardProps) {
  return (
    <div style={styles.rideRowCard}>
      <div style={styles.rideTopRow}>
        <div style={styles.rideIdWrap}>
          <span style={styles.rideIdLabel}>Ride ID</span>
          <span style={styles.rideIdValue}>{row.id}</span>
        </div>
        <RideStatusBadge status={row.status} />
      </div>

      <div style={styles.rideGrid}>
        <div>
          <div style={styles.fieldLabel}>Rider</div>
          <div style={styles.fieldValue}>{row.riderPhone}</div>
        </div>
        <div>
          <div style={styles.fieldLabel}>Driver</div>
          <div style={styles.fieldValue}>{row.driverPhone}</div>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <div style={styles.fieldLabel}>Origin</div>
          <div style={styles.fieldValueEllipsis}>{row.pickupAddress}</div>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <div style={styles.fieldLabel}>Destination</div>
          <div style={styles.fieldValueEllipsis}>{row.destinationAddress}</div>
        </div>
        <div>
          <div style={styles.fieldLabel}>Fare</div>
          <div style={styles.fareValue}>{row.fareText}</div>
        </div>
        <div>
          <div style={styles.fieldLabel}>Created</div>
          <div style={styles.fieldValue}>{row.createdText}</div>
        </div>
      </div>

      <div style={styles.actionsRow}>
        <Link href={`/rides/${row.id}`} className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }}>
          View Details
        </Link>
        <button
          className="btn btn-secondary"
          style={{ fontSize: 12, padding: '6px 12px' }}
          onClick={() => onCopyRideId(row.id)}
        >
          Copy Ride ID
        </button>
      </div>
    </div>
  );
});

const toSearchable = (value: unknown) => (typeof value === 'string' ? value.toLowerCase() : '');

const formatDateTime = (value?: string | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
};

export default function RidesPage() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRides = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('rides')
        .select(`
          *,
          rider_profile:profiles!rides_rider_id_fkey(phone),
          driver_profile:profiles!rides_driver_id_fkey(phone)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setRides(data || []);
    } catch (error) {
      console.error('Error loading rides:', error);
      setError('Unable to load rides right now. Please retry.');
      setRides([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadRides();
  }, [loadRides]);

  const needle = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);
  const filteredRides = useMemo(
    () =>
      rides.filter((ride) => {
        if (!needle) return true;
        return (
          toSearchable(ride.pickup_address).includes(needle) ||
          toSearchable(ride.dest_address).includes(needle) ||
          toSearchable(ride.rider_profile?.phone).includes(needle) ||
          toSearchable(ride.driver_profile?.phone).includes(needle) ||
          toSearchable(ride.id).includes(needle)
        );
      }),
    [rides, needle]
  );

  const statusOrder = ['all', 'requested', 'accepted', 'arrived', 'started', 'completed', 'cancelled'];
  const statusCounts = useMemo(
    () =>
      rides.reduce<Record<string, number>>((acc, ride) => {
        const key = ride.status || 'requested';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    [rides]
  );

  const filteredRideRows = useMemo<RideRowView[]>(
    () =>
      filteredRides.map((ride) => ({
        id: ride.id,
        status: ride.status,
        riderPhone: ride.rider_profile?.phone || 'N/A',
        driverPhone: ride.driver_profile?.phone || 'Unassigned',
        pickupAddress: ride.pickup_address || 'N/A',
        destinationAddress: ride.dest_address || 'N/A',
        fareText: `${Number(ride.fare_estimated || 0).toLocaleString()} XOF`,
        createdText: formatDateTime(ride.created_at),
      })),
    [filteredRides]
  );

  const statusChipModels = useMemo(
    () =>
      statusOrder.map((status) => ({
        status,
        count: status === 'all' ? rides.length : (statusCounts[status] || 0),
        active: filter === status,
      })),
    [statusCounts, rides.length, filter]
  );

  const handleCopyRideId = useCallback((rideId: string) => {
    void navigator.clipboard?.writeText(rideId);
  }, []);
  return (
    <AdminLayout>
      <div style={styles.headerWrap}>
        <div>
          <h1 className="page-title" style={styles.pageTitle}>Ride Operations</h1>
          <p style={styles.subtitle}>Operational queue for dispatch, trip health, and interventions.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => void loadRides()}>
          Refresh
        </button>
      </div>

      <div className="card" style={styles.filterCard}>
        <div style={styles.filterHeader}>
          <strong style={styles.filterTitle}>Status filters</strong>
          <span style={styles.filterHint}>Total loaded rides: {rides.length}</span>
        </div>

        <div style={styles.statusChipsWrap}>
          {statusChipModels.map(({ status, count, active }) => {

            return (
              <button
                key={status}
                onClick={() => setFilter(status)}
                style={{
                  ...styles.statusChip,
                  ...(active ? styles.statusChipActive : null),
                }}
              >
                <span style={styles.statusChipLabel}>{status === 'all' ? 'All' : status}</span>
                <span style={{ ...styles.statusChipCount, ...(active ? styles.statusChipCountActive : null) }}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by ride ID, phone, origin, or destination..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={styles.listCard}>
        <div style={styles.listHeader}>
          <h3 style={styles.listTitle}>Ride queue</h3>
          <span style={styles.listMeta}>{filteredRideRows.length} matching rides</span>
        </div>

        {loading ? (
          <DataState kind="loading" title="Chargement des courses" message="Mise à jour de la file opérationnelle." />
        ) : error ? (
          <DataState kind="error" title="Chargement impossible" message={error} actionLabel="Réessayer" onAction={() => void loadRides()} />
        ) : filteredRideRows.length === 0 ? (
          <DataState
            kind="empty"
            title="Aucune course trouvée"
            message="Ajustez la recherche ou le filtre de statut."
            actionLabel="Réinitialiser"
            onAction={() => {
              setFilter('all');
              setSearchTerm('');
            }}
          />
        ) : (
          <div style={styles.rowsWrap}>
            {filteredRideRows.map((row) => (
              <RideRowCard key={row.id} row={row} onCopyRideId={handleCopyRideId} />
            ))}
          </div>
        )}

        <div style={{ marginTop: 20, color: '#666', fontSize: 14, fontWeight: 600 }}>
          Showing {filteredRideRows.length} of {rides.length} rides
        </div>
      </div>
    </AdminLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerWrap: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  pageTitle: {
    marginBottom: 6,
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 14,
  },
  filterCard: {
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    boxShadow: '0 6px 16px rgba(15,23,42,0.06)',
  },
  filterHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
    flexWrap: 'wrap',
  },
  filterTitle: {
    fontSize: 14,
  },
  filterHint: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: 600,
  },
  statusChipsWrap: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusChip: {
    border: '1px solid #d1d5db',
    background: '#ffffff',
    borderRadius: 999,
    padding: '6px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    fontWeight: 700,
  },
  statusChipActive: {
    borderColor: '#1d4ed8',
    background: '#e0ecff',
  },
  statusChipLabel: {
    textTransform: 'capitalize',
  },
  statusChipCount: {
    background: '#f3f4f6',
    color: '#374151',
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 6px',
    fontSize: 11,
  },
  statusChipCountActive: {
    background: '#1d4ed8',
    color: '#fff',
  },
  listCard: {
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    boxShadow: '0 6px 16px rgba(15,23,42,0.06)',
  },
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
    flexWrap: 'wrap',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  listMeta: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: 600,
  },
  rowsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  rideRowCard: {
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 14,
    background: '#fff',
  },
  rideTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  rideIdWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  rideIdLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    fontWeight: 700,
    letterSpacing: 0.4,
  },
  rideIdValue: {
    fontSize: 12,
    color: '#111827',
    fontWeight: 700,
  },
  rideGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontWeight: 700,
  },
  fieldValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: 600,
  },
  fieldValueEllipsis: {
    fontSize: 13,
    color: '#111827',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 520,
  },
  fareValue: {
    fontSize: 14,
    color: '#1d4ed8',
    fontWeight: 700,
  },
  actionsRow: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  loadingStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  loadingRow: {
    height: 88,
    borderRadius: 12,
    background: '#f3f4f6',
  },
  emptyState: {
    padding: 28,
    textAlign: 'center',
    color: '#6b7280',
    border: '1px dashed #d1d5db',
    borderRadius: 10,
  },
  errorState: {
    padding: 24,
    textAlign: 'center',
    color: '#991b1b',
    border: '1px solid #fecaca',
    borderRadius: 10,
    background: '#fef2f2',
  },
};
