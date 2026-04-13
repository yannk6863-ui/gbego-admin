'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import { DataState } from '@/components/ui/DataState';

type PaymentStatus = 'pending' | 'paid' | 'failed' | 'all';
type PaymentMethod = 'cash' | 'mobile_money' | 'all';
type SortField = 'created_at' | 'total_fare' | 'driver_earnings' | 'platform_commission';
type SortDirection = 'asc' | 'desc';

interface FinancialRecord {
  id: string;
  ride_id: string;
  total_fare: number;
  driver_earnings: number;
  platform_commission: number;
  status: 'pending' | 'paid' | 'failed';
  method: 'cash' | 'mobile_money';
  created_at: string;
  ride: {
    rider_profile: { full_name: string | null; phone: string | null } | null;
    driver_profile: { full_name: string | null; phone: string | null } | null;
  } | null;
}

type RawFinancialRecord = {
  id: string;
  ride_id: string;
  total_fare: number | null;
  driver_earnings: number | null;
  platform_commission: number | null;
  status: 'pending' | 'paid' | 'failed';
  method: 'cash' | 'mobile_money';
  created_at: string;
  ride:
    | Array<{
        rider_profile?: Array<{ full_name: string | null; phone: string | null }>;
        driver_profile?: Array<{ full_name: string | null; phone: string | null }>;
      }>
    | null;
};

const STATUS_OPTIONS: PaymentStatus[] = ['all', 'paid', 'pending', 'failed'];
const METHOD_OPTIONS: PaymentMethod[] = ['all', 'cash', 'mobile_money'];

function formatXof(value: number) {
  return `${Math.round(Number(value || 0)).toLocaleString()} XOF`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
}

function getCounterpartyLabel(entity?: { full_name: string | null; phone: string | null } | null) {
  if (!entity) return 'N/A';
  if (entity.full_name && entity.phone) return `${entity.full_name} (${entity.phone})`;
  return entity.full_name || entity.phone || 'N/A';
}

export default function FinancePage() {
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<PaymentStatus>('all');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const loadFinancialRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('payments')
        .select(`
          id,
          ride_id,
          total_fare,
          driver_earnings,
          platform_commission,
          status,
          method,
          created_at,
          ride:rides!payments_ride_id_fkey(
            rider_profile:profiles!rides_rider_id_fkey(full_name, phone),
            driver_profile:profiles!rides_driver_id_fkey(full_name, phone)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (queryError) throw queryError;
      const normalized = ((data || []) as RawFinancialRecord[]).map((row) => {
        const rideNode = row.ride?.[0] || null;
        const riderProfile = rideNode?.rider_profile?.[0] || null;
        const driverProfile = rideNode?.driver_profile?.[0] || null;

        return {
          id: row.id,
          ride_id: row.ride_id,
          total_fare: Number(row.total_fare || 0),
          driver_earnings: Number(row.driver_earnings || 0),
          platform_commission: Number(row.platform_commission || 0),
          status: row.status,
          method: row.method,
          created_at: row.created_at,
          ride: {
            rider_profile: riderProfile,
            driver_profile: driverProfile,
          },
        } as FinancialRecord;
      });

      setRecords(normalized);
    } catch (err) {
      console.error('Error loading financial records:', err);
      setError('Unable to load financial records right now.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFinancialRecords();
  }, [loadFinancialRecords]);

  const filteredRecords = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    const filtered = records.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (methodFilter !== 'all' && row.method !== methodFilter) return false;

      if (!needle) return true;

      const rider = getCounterpartyLabel(row.ride?.rider_profile).toLowerCase();
      const driver = getCounterpartyLabel(row.ride?.driver_profile).toLowerCase();

      return (
        row.ride_id.toLowerCase().includes(needle) ||
        rider.includes(needle) ||
        driver.includes(needle)
      );
    });

    return filtered.sort((a, b) => {
      const left = a[sortField];
      const right = b[sortField];

      if (sortField === 'created_at') {
        const leftTime = new Date(String(left)).getTime();
        const rightTime = new Date(String(right)).getTime();
        return sortDirection === 'asc' ? leftTime - rightTime : rightTime - leftTime;
      }

      const leftNum = Number(left || 0);
      const rightNum = Number(right || 0);
      return sortDirection === 'asc' ? leftNum - rightNum : rightNum - leftNum;
    });
  }, [records, statusFilter, methodFilter, searchTerm, sortField, sortDirection]);

  const summary = useMemo(() => {
    return filteredRecords.reduce(
      (acc, row) => {
        acc.count += 1;
        acc.totalFare += Number(row.total_fare || 0);
        acc.totalDriverEarnings += Number(row.driver_earnings || 0);
        acc.totalPlatformCommission += Number(row.platform_commission || 0);
        return acc;
      },
      {
        count: 0,
        totalFare: 0,
        totalDriverEarnings: 0,
        totalPlatformCommission: 0,
      }
    );
  }, [filteredRecords]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection('desc');
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  return (
    <AdminLayout>
      <div style={styles.headerWrap}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 6 }}>Financial History</h1>
          <p style={styles.subtitle}>Review ride payments and platform revenue distribution in one operational view.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => void loadFinancialRecords()}>
          Refresh
        </button>
      </div>

      <div style={styles.summaryGrid}>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryLabel}>Records</div><div style={styles.summaryValue}>{summary.count.toLocaleString()}</div></div>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryLabel}>Total Fare</div><div style={styles.summaryValue}>{formatXof(summary.totalFare)}</div></div>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryLabel}>Driver Earnings</div><div style={styles.summaryValue}>{formatXof(summary.totalDriverEarnings)}</div></div>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryLabel}>Platform Commission</div><div style={styles.summaryValue}>{formatXof(summary.totalPlatformCommission)}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={styles.filterGrid}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Status</label>
            <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PaymentStatus)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Method</label>
            <select className="form-select" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value as PaymentMethod)}>
              {METHOD_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
            <label className="form-label">Search</label>
            <input
              className="form-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ride ID, rider, or driver"
            />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <DataState kind="loading" title="Loading financial records" message="Please wait while payment data is fetched." />
        ) : error ? (
          <DataState kind="error" title="Financial records unavailable" message={error} actionLabel="Retry" onAction={() => void loadFinancialRecords()} />
        ) : filteredRecords.length === 0 ? (
          <DataState kind="empty" title="No records found" message="Adjust filters or search to view financial entries." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ride_id</th>
                  <th>rider</th>
                  <th>driver</th>
                  <th>
                    <button style={styles.sortButton} onClick={() => toggleSort('total_fare')}>
                      total_fare {sortIndicator('total_fare')}
                    </button>
                  </th>
                  <th>
                    <button style={styles.sortButton} onClick={() => toggleSort('driver_earnings')}>
                      driver_earnings {sortIndicator('driver_earnings')}
                    </button>
                  </th>
                  <th>
                    <button style={styles.sortButton} onClick={() => toggleSort('platform_commission')}>
                      platform_commission {sortIndicator('platform_commission')}
                    </button>
                  </th>
                  <th>status</th>
                  <th>method</th>
                  <th>
                    <button style={styles.sortButton} onClick={() => toggleSort('created_at')}>
                      created_at {sortIndicator('created_at')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((row) => (
                  <tr key={row.id}>
                    <td style={styles.codeCell}>{row.ride_id}</td>
                    <td>{getCounterpartyLabel(row.ride?.rider_profile)}</td>
                    <td>{getCounterpartyLabel(row.ride?.driver_profile)}</td>
                    <td>{formatXof(row.total_fare)}</td>
                    <td>{formatXof(row.driver_earnings)}</td>
                    <td>{formatXof(row.platform_commission)}</td>
                    <td>{row.status}</td>
                    <td>{row.method}</td>
                    <td>{formatDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 14,
    maxWidth: 760,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    marginBottom: 0,
    padding: 16,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: 700,
  },
  summaryValue: {
    fontSize: 20,
    color: '#111827',
    fontWeight: 800,
    marginTop: 6,
  },
  filterGrid: {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  },
  sortButton: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    margin: 0,
    fontWeight: 700,
    cursor: 'pointer',
    color: '#111827',
    textTransform: 'lowercase',
  },
  codeCell: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
  },
};
