'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import { DataState } from '@/components/ui/DataState';
import { createSingleFlightRunner } from '@/lib/singleFlight';
import { getFirstIssueMessage, validateModerationReason } from '@/lib/validation';
import { logAdminAuditEvent } from '@/lib/auditLog';
import { getDriverPerformanceStats, type DriverPerformanceStats } from '@/lib/analytics/driverPerformance';
import { getDriverQosFlags, type DriverQosFlag } from '@/lib/analytics/driverQosFlags';

type DriverDocumentType = 'driver_license' | 'vehicle_registration' | 'insurance';

interface DriverDocumentRecord {
  id: string;
  driver_id: string;
  document_type: DriverDocumentType;
  file_url: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked';
  rejection_reason: string | null;
  reviewed_at: string | null;
  is_current: boolean;
}

interface DriverProfile {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_plate: string;
  driver_license_url: string | null;
  id_card_url: string | null;
  approval_status: string;
  rejection_reason?: string | null;
  created_at: string;
  profiles: {
    phone: string | null;
    full_name?: string | null;
  };
}

const STATUS_FILTERS = ['pending', 'approved', 'rejected', 'all'] as const;

const statusBadgeClass = (status: string) => {
  if (status === 'approved') return 'badge-approved';
  if (status === 'rejected') return 'badge-rejected';
  if (status === 'pending') return 'badge-pending';
  return 'badge-active';
};

type DriverCardView = {
  id: string;
  name: string;
  phone: string;
  badgeClass: string;
  approvalStatus: string;
  vehicleLine: string;
  vehicleType: string;
  appliedAtText: string;
  performance: DriverPerformanceStats | null;
  approvedDocCount: number;
  requiredDocCount: number;
  openQosFlags: DriverQosFlag[];
  source: DriverProfile;
};

type DriverListCardProps = {
  row: DriverCardView;
  onSelect: (driver: DriverProfile) => void;
};

const DriverListCard = memo(function DriverListCard({ row, onSelect }: DriverListCardProps) {
  const perf = row.performance;
  return (
    <button onClick={() => onSelect(row.source)} style={styles.driverCardButton}>
      <div className="card" style={styles.driverCard}>
        <div style={styles.driverTopRow}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.driverName}>{row.name}</div>
            <div style={styles.driverMeta}>Phone: {row.phone}</div>
          </div>
          <span className={`badge ${row.badgeClass}`}>{row.approvalStatus}</span>
        </div>

        <div style={styles.vehicleLine}>{row.vehicleLine}</div>
        <div style={styles.driverMeta}>Type: {row.vehicleType}</div>
        <div style={styles.performanceStrip}>
          <span>{perf ? `${perf.totalRidesCompleted} completed` : '0 completed'}</span>
          <span>{perf ? `${perf.cancellationRate.toFixed(1)}% cancels` : '0.0% cancels'}</span>
          <span>{perf ? `${perf.averageRating.toFixed(2)} rating` : '0.00 rating'}</span>
          <span>{perf ? `${Math.round(perf.totalEarnings).toLocaleString()} XOF` : '0 XOF'}</span>
          <span>Docs {row.approvedDocCount}/{row.requiredDocCount} approved</span>
          {row.openQosFlags.length > 0 ? (
            <span style={styles.flagPill}>QoS flags: {row.openQosFlags.length}</span>
          ) : null}
        </div>
        <div style={styles.driverFooter}>Applied {row.appliedAtText}</div>
      </div>
    </button>
  );
});

const REQUIRED_DRIVER_DOC_TYPES: DriverDocumentType[] = ['driver_license', 'vehicle_registration', 'insurance'];

const DRIVER_DOC_LABEL: Record<DriverDocumentType, string> = {
  driver_license: 'Permis de conduire',
  vehicle_registration: 'Carte grise',
  insurance: 'Assurance',
};

function docStatusBadgeClass(status: DriverDocumentRecord['status']) {
  if (status === 'approved') return 'badge-approved';
  if (status === 'pending') return 'badge-pending';
  if (status === 'rejected' || status === 'revoked' || status === 'expired') return 'badge-rejected';
  return 'badge-active';
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [filter, setFilter] = useState<string>('pending');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [performanceByDriver, setPerformanceByDriver] = useState<Map<string, DriverPerformanceStats>>(new Map());
  const [documentsByDriver, setDocumentsByDriver] = useState<Map<string, DriverDocumentRecord[]>>(new Map());
  const [qosFlagsByDriver, setQosFlagsByDriver] = useState<Map<string, DriverQosFlag[]>>(new Map());
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const singleFlight = useMemo(() => createSingleFlightRunner(), []);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let queryBuilder = supabase
        .from('driver_profiles')
        .select('id,user_id,vehicle_type,vehicle_make,vehicle_model,vehicle_year,vehicle_plate,driver_license_url,id_card_url,approval_status,rejection_reason,created_at,profiles(phone,full_name)')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        queryBuilder = queryBuilder.eq('approval_status', filter);
      }

      const { data, error: queryError } = await queryBuilder;
      if (queryError) throw queryError;
      const rows = (data || []) as DriverProfile[];
      setDrivers(rows);

      const driverIds = rows.map((row) => row.user_id);

      if (driverIds.length > 0) {
        const { data: documents, error: documentError } = await supabase
          .from('driver_documents')
          .select('id,driver_id,document_type,file_url,status,rejection_reason,reviewed_at,is_current')
          .in('driver_id', driverIds)
          .eq('is_current', true);

        if (documentError) throw documentError;

        const docsMap = new Map<string, DriverDocumentRecord[]>();
        for (const rawDoc of (documents || []) as DriverDocumentRecord[]) {
          const current = docsMap.get(rawDoc.driver_id) || [];
          current.push(rawDoc);
          docsMap.set(rawDoc.driver_id, current);
        }
        setDocumentsByDriver(docsMap);
      } else {
        setDocumentsByDriver(new Map());
      }

      const [perfResult, qosResult] = await Promise.allSettled([
        getDriverPerformanceStats(driverIds),
        getDriverQosFlags(driverIds),
      ]);
      if (perfResult.status === 'fulfilled') setPerformanceByDriver(perfResult.value);
      else console.warn('Driver performance stats unavailable:', perfResult.reason);
      if (qosResult.status === 'fulfilled') setQosFlagsByDriver(qosResult.value);
      else console.warn('Driver QoS flags unavailable:', qosResult.reason);
    } catch (err) {
      console.error('Error loading drivers:', err);
      setError('Unable to load driver records.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadDrivers();
  }, [loadDrivers]);

  const requestApprove = async (driverId: string) => {
    const proceed = window.confirm('Approve this driver? This action marks them operational.');
    if (!proceed) return;
    await handleApprove(driverId);
  };

  const requestReject = async (driverId: string) => {
    const issues = validateModerationReason(rejectReason);
    if (issues.length > 0) {
      alert(getFirstIssueMessage(issues));
      return;
    }
    const proceed = window.confirm('Reject this driver application? This will store the rejection reason.');
    if (!proceed) return;
    await handleReject(driverId);
  };

  const handleApprove = async (driverId: string) => {
    const actionKey = `approve:${driverId}`;
    if (singleFlight.isRunning(actionKey)) return;

    await singleFlight.run(actionKey, async () => {
      setActionLoading(true);
      setActionLoadingKey(actionKey);
      try {
        const driver = drivers.find((d) => d.id === driverId);
        const { data: authData } = await supabase.auth.getUser();
        const adminId = authData.user?.id ?? driver?.user_id ?? 'admin-unknown';

        const { error: updateError } = await supabase
          .from('driver_profiles')
          .update({
            approval_status: 'approved',
            approved_at: new Date().toISOString(),
          })
          .eq('id', driverId);

        if (updateError) throw updateError;

        await logAdminAuditEvent({
          actorId: adminId,
          action: 'driver.approved',
          metadata: {
            driver_id: driverId,
            approved_by: 'admin',
            previous_status: driver?.approval_status ?? null,
            next_status: 'approved',
          },
        });

        setSelectedDriver(null);
        await loadDrivers();
      } catch (err) {
        console.error('Error approving driver:', err);
        alert('Failed to approve driver.');
      } finally {
        setActionLoading(false);
        setActionLoadingKey(null);
      }
    });
  };

  const handleReject = async (driverId: string) => {
    const actionKey = `reject:${driverId}`;
    if (singleFlight.isRunning(actionKey)) return;

    await singleFlight.run(actionKey, async () => {
      setActionLoading(true);
      setActionLoadingKey(actionKey);
      try {
        const issues = validateModerationReason(rejectReason);
        if (issues.length > 0) {
          alert(getFirstIssueMessage(issues));
          return;
        }

        const driver = drivers.find((d) => d.id === driverId);
        const { data: authData } = await supabase.auth.getUser();
        const adminId = authData.user?.id ?? driver?.user_id ?? 'admin-unknown';
        const reason = rejectReason.trim();

        const { error: updateError } = await supabase
          .from('driver_profiles')
          .update({
            approval_status: 'rejected',
            rejection_reason: reason,
          })
          .eq('id', driverId);

        if (updateError) throw updateError;

        await logAdminAuditEvent({
          actorId: adminId,
          action: 'driver.rejected',
          metadata: {
            driver_id: driverId,
            reason,
            rejected_by: 'admin',
            previous_status: driver?.approval_status ?? null,
            next_status: 'rejected',
          },
        });

        setSelectedDriver(null);
        setRejectReason('');
        await loadDrivers();
      } catch (err) {
        console.error('Error rejecting driver:', err);
        alert('Failed to reject driver.');
      } finally {
        setActionLoading(false);
        setActionLoadingKey(null);
      }
    });
  };

  const filteredDrivers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return drivers;

    return drivers.filter((driver) => {
      const fullName = (driver.profiles?.full_name ?? '').toLowerCase();
      const phone = (driver.profiles?.phone ?? '').toLowerCase();
      const vehicle = `${driver.vehicle_make} ${driver.vehicle_model} ${driver.vehicle_plate}`.toLowerCase();
      return fullName.includes(normalized) || phone.includes(normalized) || vehicle.includes(normalized);
    });
  }, [drivers, query]);

  const stats = useMemo(() => {
    return drivers.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.approval_status === 'pending') acc.pending += 1;
        if (item.approval_status === 'approved') acc.approved += 1;
        if (item.approval_status === 'rejected') acc.rejected += 1;
        if ((qosFlagsByDriver.get(item.user_id) || []).length > 0) acc.flagged += 1;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, rejected: 0, flagged: 0 }
    );
  }, [drivers, qosFlagsByDriver]);

  const filteredDriverRows = useMemo<DriverCardView[]>(
    () =>
      filteredDrivers.map((driver) => ({
        id: driver.id,
        name: driver.profiles?.full_name || 'Unnamed driver',
        phone: driver.profiles?.phone || 'N/A',
        badgeClass: statusBadgeClass(driver.approval_status),
        approvalStatus: driver.approval_status,
        vehicleLine: `${driver.vehicle_make} ${driver.vehicle_model} · ${driver.vehicle_year} · ${driver.vehicle_plate}`,
        vehicleType: driver.vehicle_type || 'N/A',
        appliedAtText: new Date(driver.created_at).toLocaleString(),
        performance: performanceByDriver.get(driver.user_id) ?? null,
        approvedDocCount: (documentsByDriver.get(driver.user_id) || []).filter((doc) => doc.status === 'approved').length,
        requiredDocCount: REQUIRED_DRIVER_DOC_TYPES.length,
        openQosFlags: qosFlagsByDriver.get(driver.user_id) || [],
        source: driver,
      })),
    [filteredDrivers, performanceByDriver, documentsByDriver, qosFlagsByDriver]
  );

  const selectedPerformance = selectedDriver ? performanceByDriver.get(selectedDriver.user_id) ?? null : null;
  const selectedDocuments = selectedDriver ? documentsByDriver.get(selectedDriver.user_id) || [] : [];
  const selectedQosFlags = selectedDriver ? qosFlagsByDriver.get(selectedDriver.user_id) || [] : [];

  const activityBadgeClass =
    selectedPerformance?.activityStatus === 'active'
      ? 'badge-approved'
      : selectedPerformance?.activityStatus === 'stale'
      ? 'badge-pending'
      : 'badge-rejected';

  const updateDocumentStatus = async (
    driver: DriverProfile,
    doc: DriverDocumentRecord,
    nextStatus: 'approved' | 'rejected'
  ) => {
    const actionKey = `doc:${doc.id}:${nextStatus}`;
    if (singleFlight.isRunning(actionKey)) return;

    await singleFlight.run(actionKey, async () => {
      setActionLoading(true);
      setActionLoadingKey(actionKey);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const adminId = authData.user?.id ?? 'admin-unknown';

        let rejectionReason: string | null = null;
        if (nextStatus === 'rejected') {
          const promptValue = window.prompt('Provide rejection reason for this document', doc.rejection_reason ?? '');
          if (!promptValue || !promptValue.trim()) {
            return;
          }
          rejectionReason = promptValue.trim();
        }

        const { error: updateError } = await supabase
          .from('driver_documents')
          .update({
            status: nextStatus,
            rejection_reason: rejectionReason,
            reviewed_by: adminId,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', doc.id);

        if (updateError) throw updateError;

        await logAdminAuditEvent({
          actorId: adminId,
          action: `driver.${nextStatus}`,
          metadata: {
            driver_id: driver.user_id,
            driver_document_id: doc.id,
            document_type: doc.document_type,
            previous_status: doc.status,
            next_status: nextStatus,
            rejection_reason: rejectionReason,
          },
        });

        await loadDrivers();
      } catch (err) {
        console.error('Error reviewing driver document:', err);
        alert('Failed to update document status.');
      } finally {
        setActionLoading(false);
        setActionLoadingKey(null);
      }
    });
  };

  const handleSelectDriver = useCallback((driver: DriverProfile) => {
    setSelectedDriver(driver);
  }, []);

  const reviewQosFlag = async (
    driver: DriverProfile,
    flag: DriverQosFlag,
    nextStatus: 'reviewed' | 'dismissed'
  ) => {
    const actionKey = `qos:${flag.id}:${nextStatus}`;
    if (singleFlight.isRunning(actionKey)) return;

    await singleFlight.run(actionKey, async () => {
      setActionLoading(true);
      setActionLoadingKey(actionKey);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const adminId = authData.user?.id ?? 'admin-unknown';
        const note = window.prompt(
          nextStatus === 'dismissed'
            ? 'Optional dismissal note for this QoS flag'
            : 'Optional review note for this QoS flag',
          flag.note ?? ''
        );

        const { error: updateError } = await supabase
          .from('driver_quality_flags')
          .update({
            status: nextStatus,
            note: note?.trim() || null,
            reviewed_by: adminId,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', flag.id)
          .eq('status', 'open');

        if (updateError) throw updateError;

        await logAdminAuditEvent({
          actorId: adminId,
          action: nextStatus === 'reviewed' ? 'driver.flag_reviewed' : 'driver.flag_dismissed',
          metadata: {
            driver_id: driver.user_id,
            driver_quality_flag_id: flag.id,
            severity: flag.severity,
            reason_code: flag.reasonCode,
            next_status: nextStatus,
            note: note?.trim() || null,
          },
        });

        await loadDrivers();
      } catch (err) {
        console.error('Error reviewing QoS flag:', err);
        alert('Failed to update QoS flag status.');
      } finally {
        setActionLoading(false);
        setActionLoadingKey(null);
      }
    });
  };

  return (
    <AdminLayout>
      <div style={styles.headerWrap}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 6 }}>Driver Operations</h1>
          <p style={styles.subtitle}>Review onboarding records, verify vehicle documents, and safely approve driver access.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => void loadDrivers()}>
          Refresh
        </button>
      </div>

      <div style={styles.summaryGrid}>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryValue}>{stats.total}</div><div style={styles.summaryLabel}>Visible Drivers</div></div>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryValue}>{stats.pending}</div><div style={styles.summaryLabel}>Pending</div></div>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryValue}>{stats.approved}</div><div style={styles.summaryLabel}>Approved</div></div>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryValue}>{stats.rejected}</div><div style={styles.summaryLabel}>Rejected</div></div>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryValue}>{stats.flagged}</div><div style={styles.summaryLabel}>QoS Flagged</div></div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="filters" style={{ marginBottom: 12 }}>
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              className={`btn ${filter === status ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(status)}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <input
          className="form-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, vehicle or plate"
          style={{ maxWidth: 460 }}
        />
      </div>

      {loading ? (
        <DataState kind="loading" title="Loading drivers" message="Fetching latest onboarding and approval records." />
      ) : error ? (
        <DataState kind="error" title="Driver records unavailable" message={error} actionLabel="Retry" onAction={() => void loadDrivers()} />
      ) : filteredDriverRows.length === 0 ? (
        <DataState
          kind="empty"
          title="No drivers match this view"
          message="Try changing status filters or search terms to find the right driver record."
          actionLabel="Reset"
          onAction={() => {
            setFilter('all');
            setQuery('');
          }}
        />
      ) : (
        <div style={styles.driverList}>
          {filteredDriverRows.map((row) => (
            <DriverListCard key={row.id} row={row} onSelect={handleSelectDriver} />
          ))}
        </div>
      )}

      {selectedDriver ? (
        <div className="modal-overlay" onClick={() => setSelectedDriver(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={styles.modalLarge}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 20 }}>Driver Review</h3>
              <button className="btn btn-secondary" onClick={() => setSelectedDriver(null)}>
                Close
              </button>
            </div>

            <div style={styles.infoGrid}>
              <div style={styles.infoItem}><strong>Name</strong><span>{selectedDriver.profiles?.full_name || 'N/A'}</span></div>
              <div style={styles.infoItem}><strong>Phone</strong><span>{selectedDriver.profiles?.phone || 'N/A'}</span></div>
              <div style={styles.infoItem}><strong>Vehicle</strong><span>{selectedDriver.vehicle_make} {selectedDriver.vehicle_model}</span></div>
              <div style={styles.infoItem}><strong>Plate</strong><span>{selectedDriver.vehicle_plate}</span></div>
              <div style={styles.infoItem}><strong>Vehicle Type</strong><span>{selectedDriver.vehicle_type || 'N/A'}</span></div>
              <div style={styles.infoItem}><strong>Approval State</strong><span className={`badge ${statusBadgeClass(selectedDriver.approval_status)}`}>{selectedDriver.approval_status}</span></div>
            </div>

            <div style={styles.performanceGrid}>
              <div style={styles.performanceCard}>
                <span style={styles.performanceLabel}>Completed rides</span>
                <strong style={styles.performanceValue}>{selectedPerformance?.totalRidesCompleted ?? 0}</strong>
              </div>
              <div style={styles.performanceCard}>
                <span style={styles.performanceLabel}>Cancellation rate</span>
                <strong style={styles.performanceValue}>{(selectedPerformance?.cancellationRate ?? 0).toFixed(1)}%</strong>
              </div>
              <div style={styles.performanceCard}>
                <span style={styles.performanceLabel}>Average rating</span>
                <strong style={styles.performanceValue}>
                  {(selectedPerformance?.averageRating ?? 0).toFixed(2)} ({selectedPerformance?.ratingCount ?? 0})
                </strong>
              </div>
              <div style={styles.performanceCard}>
                <span style={styles.performanceLabel}>Total earnings</span>
                <strong style={styles.performanceValue}>{Math.round(selectedPerformance?.totalEarnings ?? 0).toLocaleString()} XOF</strong>
              </div>
              <div style={styles.performanceCard}>
                <span style={styles.performanceLabel}>Activity status</span>
                <strong style={styles.performanceValue}>
                  <span className={`badge ${activityBadgeClass}`}>{selectedPerformance?.activityStatus ?? 'offline'}</span>
                </strong>
              </div>
            </div>

            <div style={styles.docRow}>
              {selectedDriver.driver_license_url ? (
                <a href={selectedDriver.driver_license_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                  View Driver License
                </a>
              ) : (
                <span style={styles.docHint}>Driver license not uploaded.</span>
              )}
              {selectedDriver.id_card_url ? (
                <a href={selectedDriver.id_card_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                  View ID Card
                </a>
              ) : (
                <span style={styles.docHint}>ID card not uploaded.</span>
              )}
            </div>

            <div style={styles.documentReviewBlock}>
              <h4 style={styles.documentReviewTitle}>Document verification</h4>
              {REQUIRED_DRIVER_DOC_TYPES.map((docType) => {
                const doc = selectedDocuments.find((d) => d.document_type === docType);

                return (
                  <div key={docType} style={styles.documentReviewRow}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={styles.documentReviewLabel}>{DRIVER_DOC_LABEL[docType]}</strong>
                      <div style={styles.driverMeta}>
                        {doc?.file_url ? (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            Open document
                          </a>
                        ) : (
                          'Not uploaded'
                        )}
                      </div>
                      {doc?.rejection_reason ? (
                        <div style={styles.documentRejectReason}>Reason: {doc.rejection_reason}</div>
                      ) : null}
                    </div>

                    <div style={styles.documentReviewActions}>
                      <span className={`badge ${doc ? docStatusBadgeClass(doc.status) : 'badge-rejected'}`}>
                        {doc?.status ?? 'missing'}
                      </span>
                      <button
                        className="btn btn-success"
                        disabled={!doc || actionLoading}
                        onClick={() => doc && void updateDocumentStatus(selectedDriver, doc, 'approved')}
                      >
                        {actionLoadingKey === `doc:${doc?.id}:approved` ? '...' : 'Approve'}
                      </button>
                      <button
                        className="btn btn-danger"
                        disabled={!doc || actionLoading}
                        onClick={() => doc && void updateDocumentStatus(selectedDriver, doc, 'rejected')}
                      >
                        {actionLoadingKey === `doc:${doc?.id}:rejected` ? '...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={styles.documentReviewBlock}>
              <h4 style={styles.documentReviewTitle}>QoS safeguards (manual review)</h4>
              {selectedQosFlags.length === 0 ? (
                <div style={styles.driverMeta}>No open QoS flags for this driver.</div>
              ) : (
                selectedQosFlags.map((flag) => {
                  const avgRating = Number(flag.metricSnapshot.average_rating ?? 0);
                  const ratingCount = Number(flag.metricSnapshot.rating_count ?? 0);
                  const completedRides = Number(flag.metricSnapshot.completed_rides ?? 0);

                  return (
                    <div key={flag.id} style={styles.documentReviewRow}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={styles.documentReviewLabel}>
                          {flag.severity === 'restriction' ? 'Restriction signal' : 'Warning signal'}
                        </strong>
                        <div style={styles.driverMeta}>Reason: {flag.reasonCode}</div>
                        <div style={styles.driverMeta}>
                          Snapshot: {avgRating.toFixed(2)} rating, {ratingCount} ratings, {completedRides} completed rides
                        </div>
                      </div>

                      <div style={styles.documentReviewActions}>
                        <span className={`badge ${flag.severity === 'restriction' ? 'badge-rejected' : 'badge-pending'}`}>
                          {flag.severity}
                        </span>
                        <button
                          className="btn btn-success"
                          disabled={actionLoading}
                          onClick={() => void reviewQosFlag(selectedDriver, flag, 'reviewed')}
                        >
                          {actionLoadingKey === `qos:${flag.id}:reviewed` ? '...' : 'Mark Reviewed'}
                        </button>
                        <button
                          className="btn btn-secondary"
                          disabled={actionLoading}
                          onClick={() => void reviewQosFlag(selectedDriver, flag, 'dismissed')}
                        >
                          {actionLoadingKey === `qos:${flag.id}:dismissed` ? '...' : 'Dismiss'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {selectedDriver.approval_status === 'pending' ? (
              <>
                <div style={styles.safetyNote}>
                  Confirm documents and profile details before approval. Rejection reason is required for audit traceability.
                </div>

                <div className="form-group" style={{ marginTop: 14 }}>
                  <label className="form-label">Rejection Reason</label>
                  <textarea
                    className="form-textarea"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Explain why this application is rejected..."
                    disabled={actionLoading}
                  />
                </div>

                <div style={styles.actionRow}>
                  <button className="btn btn-success" onClick={() => void requestApprove(selectedDriver.id)} disabled={actionLoading}>
                    {actionLoading && actionLoadingKey?.startsWith('approve:') ? 'Processing...' : 'Approve Driver'}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => void requestReject(selectedDriver.id)}
                    disabled={actionLoading || !rejectReason.trim()}
                  >
                    {actionLoading && actionLoadingKey?.startsWith('reject:') ? 'Processing...' : 'Reject Driver'}
                  </button>
                </div>
              </>
            ) : selectedDriver.approval_status === 'rejected' && selectedDriver.rejection_reason ? (
              <div style={styles.safetyNote}>Rejection reason: {selectedDriver.rejection_reason}</div>
            ) : null}
          </div>
        </div>
      ) : null}
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
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 14,
    maxWidth: 740,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
    marginBottom: 14,
  },
  summaryCard: {
    marginBottom: 0,
    padding: 16,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 800,
    color: '#111827',
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  driverList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  driverCardButton: {
    border: 'none',
    padding: 0,
    margin: 0,
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
  },
  driverCard: {
    marginBottom: 0,
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 14,
  },
  driverTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  driverName: {
    fontSize: 15,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 3,
  },
  driverMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  vehicleLine: {
    marginTop: 10,
    fontSize: 13,
    color: '#374151',
  },
  performanceStrip: {
    marginTop: 10,
    fontSize: 12,
    color: '#4b5563',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  driverFooter: {
    marginTop: 9,
    fontSize: 12,
    color: '#9ca3af',
  },
  flagPill: {
    border: '1px solid #fca5a5',
    background: '#fff1f2',
    color: '#b91c1c',
    borderRadius: 999,
    padding: '2px 8px',
    fontWeight: 700,
  },
  modalLarge: {
    width: 'min(760px, 94vw)',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
  },
  docRow: {
    marginTop: 14,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  docHint: {
    fontSize: 12,
    color: '#6b7280',
  },
  documentReviewBlock: {
    marginTop: 14,
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 10,
  },
  documentReviewTitle: {
    margin: 0,
    marginBottom: 10,
    fontSize: 14,
    color: '#111827',
  },
  documentReviewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    borderTop: '1px dashed #e5e7eb',
    paddingTop: 10,
    marginTop: 10,
  },
  documentReviewLabel: {
    fontSize: 13,
    color: '#111827',
  },
  documentReviewActions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  documentRejectReason: {
    marginTop: 4,
    color: '#991b1b',
    fontSize: 12,
  },
  performanceGrid: {
    marginTop: 14,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 10,
  },
  performanceCard: {
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 10,
    background: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  performanceLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: 600,
  },
  performanceValue: {
    color: '#111827',
    fontSize: 16,
    fontWeight: 700,
  },
  safetyNote: {
    marginTop: 14,
    border: '1px solid #f3d2cf',
    background: '#fff5f4',
    color: '#7c2d12',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
  },
  actionRow: {
    marginTop: 14,
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
};
