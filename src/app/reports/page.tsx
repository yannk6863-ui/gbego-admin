'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import { logAdminAuditEvent } from '@/lib/auditLog';

interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  ride_id: string | null;
  reason: string;
  description: string;
  status: string;
  created_at: string;
  reporter: { phone: string };
  reported_user: { phone: string };
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<string>('pending');
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionNote, setActionNote] = useState('');

  useEffect(() => {
    loadReports();
  }, [filter]);

  const loadReports = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('reports')
        .select(`
          *,
          reporter:profiles!reports_reporter_id_fkey(phone),
          reported_user:profiles!reports_reported_user_id_fkey(phone)
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setReports(data || []);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (reportId: string, action: 'dismissed' | 'action_taken') => {
    if (!actionNote.trim()) {
      alert('Please provide a note for this action');
      return;
    }

    setActionLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const adminId = authData.user?.id ?? selectedReport?.reporter_id ?? selectedReport?.reported_user_id;

      const { error } = await supabase
        .from('reports')
        .update({
          status: 'resolved',
          resolution: action,
          admin_notes: actionNote,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) throw error;

      await logAdminAuditEvent({
        actorId: adminId ?? 'unknown',
        action: 'report.resolved',
        rideId: selectedReport?.ride_id ?? null,
        metadata: {
          reporter_id: selectedReport?.reporter_id ?? null,
          reported_user_id: selectedReport?.reported_user_id ?? null,
          report_id: reportId,
          resolution: action,
          notes: actionNote,
          resolved_by: 'admin',
        },
      });

      if (action === 'action_taken' && selectedReport) {
        await supabase
          .from('profiles')
          .update({ is_suspended: true })
          .eq('id', selectedReport.reported_user_id);

        await logAdminAuditEvent({
          actorId: adminId ?? 'unknown',
          action: 'report.action_taken',
          rideId: selectedReport.ride_id,
          metadata: {
            user_id: selectedReport.reported_user_id,
            reason: 'report_action',
            report_id: reportId,
            suspended_by: 'admin',
            action_taken: 'user_suspended',
          },
        });
      }

      setSelectedReport(null);
      setActionNote('');
      loadReports();
    } catch (error) {
      console.error('Error resolving report:', error);
      alert('Failed to resolve report');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'badge-pending',
      under_review: 'badge-active',
      resolved: 'badge-approved',
    };
    return statusMap[status] || 'badge-pending';
  };

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">Reports Management</h1>
      </div>

      <div className="card">
        <div className="filters">
          <button
            className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('pending')}
          >
            Pending
          </button>
          <button
            className={`btn ${filter === 'under_review' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('under_review')}
          >
            Under Review
          </button>
          <button
            className={`btn ${filter === 'resolved' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('resolved')}
          >
            Resolved
          </button>
          <button
            className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            No reports found
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Reporter</th>
                <th>Reported User</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{report.reporter?.phone || 'N/A'}</td>
                  <td>{report.reported_user?.phone || 'N/A'}</td>
                  <td>
                    <span className="badge badge-pending">{report.reason}</span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadge(report.status)}`}>
                      {report.status}
                    </span>
                  </td>
                  <td>{new Date(report.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 12, padding: '6px 12px' }}
                      onClick={() => setSelectedReport(report)}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedReport && (
        <div className="modal-overlay" onClick={() => setSelectedReport(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Report Details</h3>
              <button className="modal-close" onClick={() => setSelectedReport(null)}>
                ×
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={styles.detailRow}>
                <strong>Reporter:</strong> {selectedReport.reporter?.phone || 'N/A'}
              </div>
              <div style={styles.detailRow}>
                <strong>Reported User:</strong> {selectedReport.reported_user?.phone || 'N/A'}
              </div>
              <div style={styles.detailRow}>
                <strong>Reason:</strong>{' '}
                <span className="badge badge-pending">{selectedReport.reason}</span>
              </div>
              <div style={styles.detailRow}>
                <strong>Status:</strong>{' '}
                <span className={`badge ${getStatusBadge(selectedReport.status)}`}>
                  {selectedReport.status}
                </span>
              </div>
              <div style={styles.detailRow}>
                <strong>Ride ID:</strong> {selectedReport.ride_id || 'N/A'}
              </div>
              <div style={styles.detailRow}>
                <strong>Created:</strong> {new Date(selectedReport.created_at).toLocaleString()}
              </div>
            </div>

            <div style={styles.descriptionSection}>
              <strong>Description:</strong>
              <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{selectedReport.description}</div>
            </div>

            {selectedReport.status !== 'resolved' && (
              <>
                <div className="form-group" style={{ marginTop: 20 }}>
                  <label className="form-label">Action Notes (Required)</label>
                  <textarea
                    className="form-textarea"
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="Explain the action taken or reason for dismissal..."
                    disabled={actionLoading}
                  />
                </div>

                <div className="modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleResolve(selectedReport.id, 'dismissed')}
                    disabled={actionLoading || !actionNote.trim()}
                  >
                    {actionLoading ? 'Processing...' : 'Dismiss Report'}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleResolve(selectedReport.id, 'action_taken')}
                    disabled={actionLoading || !actionNote.trim()}
                  >
                    {actionLoading ? 'Processing...' : 'Suspend User'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  detailRow: {
    padding: '8px 0',
    borderBottom: '1px solid #eee',
  },
  descriptionSection: {
    padding: 16,
    background: '#f9f9f9',
    borderRadius: 6,
  },
};
