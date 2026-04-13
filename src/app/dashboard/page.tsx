'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import RideStatusBadge from '@/components/RideStatusBadge';
import { DataState } from '@/components/ui/DataState';
import { getDashboardKpis, type DashboardKpiSnapshot } from '@/lib/analytics/kpis';
import { getOperationalAlerts, type OperationalAlert } from '@/lib/analytics/alerts';
import { getUserBehaviorSummary, type UserBehaviorSummary } from '@/lib/analytics/userBehavior';

interface DashboardRide {
  id: string;
  status: string;
  pickup_address: string;
  dest_address: string;
  fare_estimated: number;
  created_at: string;
}

interface DashboardTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
}

interface DashboardReport {
  id: string;
  reason: string;
  status: string;
  created_at: string;
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKpiSnapshot>({
    totalRides: 0,
    completedRides: 0,
    cancelledRides: 0,
    activeDrivers: 0,
    totalRevenue: 0,
    platformCommission: 0,
    averageFare: 0,
    newUsers: 0,
    computedAt: new Date(0).toISOString(),
  });
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDrivers: 0,
    pendingDrivers: 0,
    approvedDrivers: 0,
    rejectedDrivers: 0,
    activeRides: 0,
    openTickets: 0,
  });
  const [recentRides, setRecentRides] = useState<DashboardRide[]>([]);
  const [recentTickets, setRecentTickets] = useState<DashboardTicket[]>([]);
  const [recentReports, setRecentReports] = useState<DashboardReport[]>([]);
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [userBehavior, setUserBehavior] = useState<UserBehaviorSummary>({
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
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [
        users,
        drivers,
        pendingDrivers,
        approvedDrivers,
        rejectedDrivers,
        activeRides,
        openTickets,
        rides,
        tickets,
        reports,
        dashboardKpis,
        operationalAlerts,
        behaviorSummary,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('driver_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('driver_profiles').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending'),
        supabase.from('driver_profiles').select('id', { count: 'exact', head: true }).eq('approval_status', 'approved'),
        supabase.from('driver_profiles').select('id', { count: 'exact', head: true }).in('approval_status', ['rejected', 'suspended']),
        supabase.from('rides').select('id', { count: 'exact', head: true }).in('status', ['accepted', 'arrived', 'started']),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase
          .from('rides')
          .select('id,status,pickup_address,dest_address,fare_estimated,created_at')
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('support_tickets')
          .select('id,subject,status,priority,created_at')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('reports')
          .select('id,reason,status,created_at')
          .order('created_at', { ascending: false })
          .limit(6),
        getDashboardKpis({ newUsersWindowDays: 30 }),
        getOperationalAlerts(),
        getUserBehaviorSummary({ windowDays: 30 }),
      ]);

      setKpis(dashboardKpis);

      setStats({
        totalUsers: users.count || 0,
        totalDrivers: drivers.count || 0,
        pendingDrivers: pendingDrivers.count || 0,
        approvedDrivers: approvedDrivers.count || 0,
        rejectedDrivers: rejectedDrivers.count || 0,
        activeRides: activeRides.count || 0,
        openTickets: openTickets.count || 0,
      });

      setRecentRides((rides.data || []) as DashboardRide[]);
      setRecentTickets((tickets.data || []) as DashboardTicket[]);
      setRecentReports((reports.data || []) as DashboardReport[]);
      setAlerts(operationalAlerts);
      setUserBehavior(behaviorSummary);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeRideRate = kpis.totalRides > 0 ? Math.round((stats.activeRides / kpis.totalRides) * 100) : 0;
  const pendingDriverRate = stats.totalDrivers > 0 ? Math.round((stats.pendingDrivers / stats.totalDrivers) * 100) : 0;
  const ticketPressure = stats.totalUsers > 0 ? ((stats.openTickets / stats.totalUsers) * 100).toFixed(1) : '0.0';
  const completionRate = kpis.totalRides > 0 ? Math.round((kpis.completedRides / kpis.totalRides) * 100) : 0;
  const cancellationRate = kpis.totalRides > 0 ? Math.round((kpis.cancelledRides / kpis.totalRides) * 100) : 0;
  const commissionRate = kpis.totalRevenue > 0 ? Math.round((kpis.platformCommission / kpis.totalRevenue) * 100) : 0;

  const formatXof = (value: number) => `${Math.round(value || 0).toLocaleString()} XOF`;

  const userBehaviorCards = [
    {
      title: 'Active users (30d)',
      value: userBehavior.activeUsers.toLocaleString(),
      indicator: `${userBehavior.totalRiders.toLocaleString()} total riders in base`,
      tone: '#1D4ED8',
    },
    {
      title: 'Rides per active user',
      value: userBehavior.ridesPerUser.toFixed(2),
      indicator: `${userBehavior.totalRides.toLocaleString()} rides in window`,
      tone: '#0F766E',
    },
    {
      title: 'Cancellation rate',
      value: `${userBehavior.cancellationRate.toFixed(2)}%`,
      indicator: 'Cancelled rides among sampled trips',
      tone: '#B45309',
    },
    {
      title: 'Average fare',
      value: formatXof(userBehavior.averageFare),
      indicator: 'Completed rides only',
      tone: '#7C3AED',
    },
    {
      title: 'Repeat user rate',
      value: `${userBehavior.repeatUserRate.toFixed(2)}%`,
      indicator: 'Users with multiple rides in window',
      tone: '#B91C1C',
    },
  ];

  const severityClass = (severity: OperationalAlert['severity']) => {
    if (severity === 'critical') return 'badge-rejected';
    if (severity === 'warning') return 'badge-pending';
    return 'badge-active';
  };

  const businessKpiCards = [
    {
      title: 'Total rides',
      value: kpis.totalRides.toLocaleString(),
      indicator: `${completionRate}% completion rate`,
      tone: '#1D4ED8',
    },
    {
      title: 'Completed rides',
      value: kpis.completedRides.toLocaleString(),
      indicator: 'Successfully fulfilled trips',
      tone: '#0F766E',
    },
    {
      title: 'Cancelled rides',
      value: kpis.cancelledRides.toLocaleString(),
      indicator: `${cancellationRate}% cancellation rate`,
      tone: '#B45309',
    },
    {
      title: 'Active drivers',
      value: kpis.activeDrivers.toLocaleString(),
      indicator: 'Online in last 90 seconds',
      tone: '#2563EB',
    },
    {
      title: 'Total revenue',
      value: formatXof(kpis.totalRevenue),
      indicator: 'Paid trip volume',
      tone: '#7C3AED',
    },
    {
      title: 'Platform commission',
      value: formatXof(kpis.platformCommission),
      indicator: `${commissionRate}% blended take rate`,
      tone: '#0F766E',
    },
    {
      title: 'Average fare',
      value: formatXof(kpis.averageFare),
      indicator: 'Average paid trip ticket',
      tone: '#B91C1C',
    },
    {
      title: 'New users (30d)',
      value: kpis.newUsers.toLocaleString(),
      indicator: 'Recent acquisition momentum',
      tone: '#9333EA',
    },
  ];

  const operationalCards = [
    {
      title: 'Total users',
      value: stats.totalUsers.toLocaleString(),
      indicator: `${stats.totalDrivers.toLocaleString()} drivers onboarded`,
      tone: '#1D4ED8',
    },
    {
      title: 'Total drivers',
      value: stats.totalDrivers.toLocaleString(),
      indicator: `${stats.approvedDrivers.toLocaleString()} approved`,
      tone: '#0F766E',
    },
    {
      title: 'Pending drivers',
      value: stats.pendingDrivers.toLocaleString(),
      indicator: `${pendingDriverRate}% of driver pool`,
      tone: '#B45309',
    },
    {
      title: 'Active rides',
      value: stats.activeRides.toLocaleString(),
      indicator: `${activeRideRate}% of all rides`,
      tone: '#0F766E',
    },
    {
      title: 'Total rides',
      value: kpis.totalRides.toLocaleString(),
      indicator: 'Platform lifetime volume',
      tone: '#7C3AED',
    },
    {
      title: 'Open tickets',
      value: stats.openTickets.toLocaleString(),
      indicator: `${ticketPressure}% user pressure`,
      tone: '#B91C1C',
    },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <DataState kind="loading" title="Chargement du dashboard" message="Récupération des indicateurs opérationnels." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div style={styles.headerWrap}>
        <div>
          <h1 className="page-title" style={styles.pageTitle}>Operations Dashboard</h1>
          <p style={styles.pageSubtitle}>Live command center for mobility operations, supply, and safety.</p>
        </div>
        <div style={styles.refreshPill}>KPI snapshot: {new Date(kpis.computedAt).toLocaleTimeString()}</div>
      </div>

      <div className="card" style={styles.kpiPanelCard}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Operational Alerts</h3>
          <span style={styles.sectionHint}>Simple threshold signals from live platform data</span>
        </div>
        <div style={styles.alertStack}>
          {alerts.map((alert) => (
            <div key={alert.id} style={styles.alertItem}>
              <div style={styles.alertTopRow}>
                <strong style={styles.alertTitle}>{alert.title}</strong>
                <span className={`badge ${severityClass(alert.severity)}`}>{alert.severity}</span>
              </div>
              <div style={styles.alertMessage}>{alert.message}</div>
              <div style={styles.alertMeta}>Threshold: {alert.threshold}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={styles.kpiPanelCard}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Business KPI Snapshot</h3>
          <span style={styles.sectionHint}>Single-query analytics with short-lived local cache</span>
        </div>
        <div style={styles.statsGrid}>
          {businessKpiCards.map((card) => (
            <div key={card.title} className="card" style={styles.kpiCard}>
              <div style={styles.kpiHeaderRow}>
                <span style={styles.kpiLabel}>{card.title}</span>
                <span style={{ ...styles.kpiDot, background: card.tone }} />
              </div>
              <div style={{ ...styles.kpiValue, color: card.tone, fontSize: 28 }}>{card.value}</div>
              <div style={styles.kpiIndicator}>{card.indicator}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={styles.kpiPanelCard}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>User Behavior Summary</h3>
          <span style={styles.sectionHint}>Rider behavior over the last {userBehavior.windowDays} days</span>
        </div>
        <div style={styles.statsGrid}>
          {userBehaviorCards.map((card) => (
            <div key={card.title} className="card" style={styles.kpiCard}>
              <div style={styles.kpiHeaderRow}>
                <span style={styles.kpiLabel}>{card.title}</span>
                <span style={{ ...styles.kpiDot, background: card.tone }} />
              </div>
              <div style={{ ...styles.kpiValue, color: card.tone, fontSize: 28 }}>{card.value}</div>
              <div style={styles.kpiIndicator}>{card.indicator}</div>
            </div>
          ))}
        </div>
        <div style={styles.userBehaviorMeta}>
          <span>Snapshot time: {new Date(userBehavior.computedAt).toLocaleTimeString()}</span>
          <span>
            Data scope: {userBehavior.sampled ? `sampled (${userBehavior.sampleSize.toLocaleString()} rides scanned)` : 'full window scan'}
          </span>
        </div>
      </div>

      <div style={styles.statsGrid}>
        {operationalCards.map((card) => (
          <div key={card.title} className="card" style={styles.kpiCard}>
            <div style={styles.kpiHeaderRow}>
              <span style={styles.kpiLabel}>{card.title}</span>
              <span style={{ ...styles.kpiDot, background: card.tone }} />
            </div>
            <div style={{ ...styles.kpiValue, color: card.tone }}>{card.value}</div>
            <div style={styles.kpiIndicator}>{card.indicator}</div>
          </div>
        ))}
      </div>

      <div style={styles.mainGrid}>
        <div className="card" style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Recent Ride Activity</h3>
            <span style={styles.sectionHint}>Last {recentRides.length} rides</span>
          </div>

          {recentRides.length === 0 ? (
            <DataState kind="empty" title="Aucune course récente" message="Les nouvelles activités apparaîtront ici." compact />
          ) : (
            <table className="table" style={styles.tablePremium}>
              <thead>
                <tr>
                  <th>Ride</th>
                  <th>Route</th>
                  <th>Fare</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recentRides.map((ride) => (
                  <tr key={ride.id}>
                    <td style={styles.idCell}>{ride.id.substring(0, 8)}...</td>
                    <td>
                      <div style={styles.routeCellTop}>{ride.pickup_address}</div>
                      <div style={styles.routeCellBottom}>→ {ride.dest_address}</div>
                    </td>
                    <td>{Number(ride.fare_estimated || 0).toLocaleString()} XOF</td>
                    <td><RideStatusBadge status={ride.status} /></td>
                    <td>{new Date(ride.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={styles.sideStack}>
          <div className="card" style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Driver Approval Summary</h3>
              <span style={styles.sectionHint}>Supply quality funnel</span>
            </div>
            <div style={styles.approvalGrid}>
              <div style={styles.approvalItem}>
                <span style={styles.approvalLabel}>Approved</span>
                <strong style={styles.approvalValue}>{stats.approvedDrivers.toLocaleString()}</strong>
              </div>
              <div style={styles.approvalItem}>
                <span style={styles.approvalLabel}>Pending</span>
                <strong style={styles.approvalValue}>{stats.pendingDrivers.toLocaleString()}</strong>
              </div>
              <div style={styles.approvalItem}>
                <span style={styles.approvalLabel}>Rejected / Suspended</span>
                <strong style={styles.approvalValue}>{stats.rejectedDrivers.toLocaleString()}</strong>
              </div>
            </div>
            <div style={styles.placeholderTrend}>Trend placeholder: approval SLA improving week over week.</div>
          </div>

          <div className="card" style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Support & Reports Overview</h3>
              <span style={styles.sectionHint}>Live trust & safety feed</span>
            </div>

            <div style={styles.feedBlock}>
              <h4 style={styles.feedTitle}>Recent Support Tickets</h4>
              {recentTickets.length === 0 ? (
                <DataState kind="empty" title="Aucun ticket" message="Aucun ticket récent." compact />
              ) : (
                recentTickets.map((ticket) => (
                  <div key={ticket.id} style={styles.feedItem}>
                    <div style={styles.feedItemTop}>
                      <strong style={styles.feedPrimary}>{ticket.subject}</strong>
                      <span className="badge badge-pending" style={styles.priorityBadge}>{ticket.priority}</span>
                    </div>
                    <div style={styles.feedItemMeta}>
                      <span>{new Date(ticket.created_at).toLocaleString()}</span>
                      <span style={styles.feedStatus}>Status: {ticket.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={styles.feedBlock}>
              <h4 style={styles.feedTitle}>Recent Reports</h4>
              {recentReports.length === 0 ? (
                <DataState kind="empty" title="Aucun signalement" message="Aucun report récent." compact />
              ) : (
                recentReports.map((report) => (
                  <div key={report.id} style={styles.feedItem}>
                    <div style={styles.feedItemTop}>
                      <strong style={styles.feedPrimary}>{report.reason}</strong>
                      <span className="badge badge-active">{report.status}</span>
                    </div>
                    <div style={styles.feedItemMeta}>
                      <span>{new Date(report.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={styles.placeholderTrend}>Trend placeholder: support backlog and incident resolution trend.</div>
          </div>
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
    marginBottom: 20,
    gap: 16,
    flexWrap: 'wrap',
  },
  pageTitle: {
    marginBottom: 6,
  },
  pageSubtitle: {
    color: '#6b7280',
    fontSize: 14,
  },
  refreshPill: {
    padding: '6px 12px',
    borderRadius: 999,
    background: '#e0ecff',
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: 700,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
    marginBottom: 20,
  },
  kpiPanelCard: {
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.06)',
  },
  alertStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  alertItem: {
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 10,
    background: '#f8fafc',
  },
  alertTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  alertTitle: {
    fontSize: 14,
    color: '#111827',
  },
  alertMessage: {
    marginTop: 6,
    color: '#374151',
    fontSize: 13,
  },
  alertMeta: {
    marginTop: 6,
    color: '#6b7280',
    fontSize: 12,
  },
  kpiCard: {
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.06)',
  },
  kpiHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  kpiDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
  },
  kpiValue: {
    fontSize: 34,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  kpiIndicator: {
    marginTop: 10,
    fontSize: 12,
    color: '#666',
    fontWeight: 600,
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: 20,
  },
  sectionCard: {
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.06)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  sectionHint: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: 600,
  },
  tablePremium: {
    border: '1px solid #eef2f7',
    borderRadius: 10,
    overflow: 'hidden',
  },
  idCell: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: 600,
  },
  routeCellTop: {
    fontSize: 13,
    fontWeight: 600,
    maxWidth: 360,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  routeCellBottom: {
    fontSize: 12,
    color: '#6b7280',
    maxWidth: 360,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sideStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  approvalGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 10,
  },
  approvalItem: {
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 12,
    background: '#f8fafc',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  approvalLabel: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: 600,
  },
  approvalValue: {
    fontSize: 18,
    color: '#111827',
  },
  feedBlock: {
    marginBottom: 14,
  },
  feedTitle: {
    fontSize: 14,
    marginBottom: 8,
    color: '#374151',
  },
  feedItem: {
    padding: 10,
    border: '1px solid #eef2f7',
    borderRadius: 10,
    marginBottom: 8,
    background: '#fdfefe',
  },
  feedItemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  feedPrimary: {
    fontSize: 13,
    color: '#111827',
    maxWidth: 210,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  feedItemMeta: {
    marginTop: 6,
    display: 'flex',
    justifyContent: 'space-between',
    color: '#6b7280',
    fontSize: 12,
    gap: 8,
  },
  feedStatus: {
    fontWeight: 700,
  },
  priorityBadge: {
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: 0.3,
  },
  placeholderTrend: {
    marginTop: 6,
    color: '#6b7280',
    fontSize: 12,
    borderTop: '1px dashed #d1d5db',
    paddingTop: 8,
  },
  userBehaviorMeta: {
    marginTop: 6,
    color: '#6b7280',
    fontSize: 12,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    borderTop: '1px dashed #d1d5db',
    paddingTop: 8,
  },
  emptyState: {
    padding: 28,
    textAlign: 'center',
    color: '#6b7280',
    border: '1px dashed #d1d5db',
    borderRadius: 10,
  },
  emptyStateCompact: {
    color: '#9ca3af',
    fontSize: 12,
    padding: '8px 0',
  },
};
