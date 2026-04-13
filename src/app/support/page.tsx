'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import { DataState } from '@/components/ui/DataState';
import { logAdminAuditEvent } from '@/lib/auditLog';

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  message?: string | null;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  profiles: { phone: string };
}

interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: 'user' | 'admin' | 'system';
  message: string;
  created_at: string;
}

const STATUS_FILTERS = ['open', 'in_progress', 'resolved', 'all'] as const;
const PRIORITY_FILTERS = ['all', 'high', 'medium', 'low'] as const;

const getPriorityBadge = (priority: string) => {
  const priorityMap: Record<string, string> = {
    low: 'badge-approved',
    medium: 'badge-pending',
    high: 'badge-rejected',
  };
  return priorityMap[priority] || 'badge-pending';
};

const getStatusBadge = (status: string) => {
  const statusMap: Record<string, string> = {
    open: 'badge-pending',
    in_progress: 'badge-active',
    resolved: 'badge-approved',
    closed: 'badge-approved',
  };
  return statusMap[status] || 'badge-pending';
};

type TicketCardView = {
  id: string;
  subject: string;
  userPhone: string;
  createdAtText: string;
  updatedAtText: string;
  priority: string;
  status: string;
  priorityBadgeClass: string;
  statusBadgeClass: string;
  description: string;
  source: SupportTicket;
};

type TicketCardProps = {
  row: TicketCardView;
  onSelect: (ticket: SupportTicket) => void | Promise<void>;
};

const TicketCard = memo(function TicketCard({ row, onSelect }: TicketCardProps) {
  return (
    <button onClick={() => void onSelect(row.source)} style={styles.ticketCardButton}>
      <div className="card" style={styles.ticketCard}>
        <div style={styles.ticketTopRow}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.ticketSubject}>{row.subject}</div>
            <div style={styles.ticketMeta}>User: {row.userPhone} · {row.createdAtText}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <span className={`badge ${row.priorityBadgeClass}`}>{row.priority}</span>
            <span className={`badge ${row.statusBadgeClass}`}>{row.status}</span>
          </div>
        </div>
        <div style={styles.ticketPreview}>{row.description}</div>
        <div style={styles.ticketFooter}>Updated {row.updatedAtText}</div>
      </div>
    </button>
  );
});

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filter, setFilter] = useState<string>('open');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [threadMessages, setThreadMessages] = useState<SupportTicketMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [responseText, setResponseText] = useState('');

  const closeDetail = useCallback(() => {
    setSelectedTicket(null);
    setThreadMessages([]);
    setThreadError(null);
    setResponseText('');
  }, []);

  const loadThreadMessages = useCallback(async (ticketId: string) => {
    setThreadLoading(true);
    setThreadError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (queryError) throw queryError;
      setThreadMessages((data || []) as SupportTicketMessage[]);
    } catch (err) {
      console.error('Error loading support thread:', err);
      setThreadError('Unable to load ticket messages.');
      setThreadMessages([]);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('support_tickets')
        .select('*, profiles(phone)')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;

      setTickets(data || []);
    } catch (err) {
      console.error('Error loading tickets:', err);
      setError('Unable to load support tickets.');
    } finally {
      setLoading(false);
    }
  }, [filter, priorityFilter]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const handleUpdateStatus = async (ticketId: string, status: string) => {
    setActionLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const adminId = authData.user?.id ?? selectedTicket?.user_id ?? ticketId ?? 'admin-unknown';
      const previousStatus = selectedTicket?.status ?? null;

      const nextStatus = status === 'closed' ? 'resolved' : status;

      const { error: updateError } = await supabase
        .from('support_tickets')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      await logAdminAuditEvent({
        actorId: adminId,
        action: 'support.status_updated',
        metadata: {
          ticket_id: ticketId,
          user_id: selectedTicket?.user_id ?? null,
          previous_status: previousStatus,
          next_status: nextStatus,
        },
      });

      setSelectedTicket((current) => {
        if (!current || current.id !== ticketId) {
          return current;
        }
        return {
          ...current,
          status: nextStatus,
          updated_at: new Date().toISOString(),
        };
      });
      await loadTickets();
    } catch (err) {
      console.error('Error updating ticket:', err);
      alert('Failed to update ticket status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddResponse = async (ticketId: string) => {
    if (!responseText.trim()) {
      alert('Please enter a response');
      return;
    }

    setActionLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const adminId = authData.user?.id ?? selectedTicket?.user_id ?? 'admin-unknown';

      const trimmedResponse = responseText.trim();

      const { error: insertError } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: adminId,
          sender_role: 'admin',
          message: trimmedResponse,
        });

      if (insertError) throw insertError;

      await logAdminAuditEvent({
        actorId: adminId,
        action: 'support.response_added',
        metadata: {
          user_id: selectedTicket?.user_id ?? null,
          ticket_id: ticketId,
          response_length: trimmedResponse.length,
          responded_by: 'admin',
          ticket_status: selectedTicket?.status ?? null,
        },
      });

      setResponseText('');
      if (selectedTicket?.status === 'open') {
        setSelectedTicket((current) => (current ? { ...current, status: 'in_progress' } : current));
      }
      await loadThreadMessages(ticketId);
      await loadTickets();
    } catch (err) {
      console.error('Error adding response:', err);
      alert('Failed to add response');
    } finally {
      setActionLoading(false);
    }
  };

  const summary = useMemo(() => {
    return tickets.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.status === 'open') acc.open += 1;
        if (item.status === 'in_progress') acc.inProgress += 1;
        if (item.priority === 'high') acc.high += 1;
        return acc;
      },
      { total: 0, open: 0, inProgress: 0, high: 0 }
    );
  }, [tickets]);

  const ticketRows = useMemo<TicketCardView[]>(
    () =>
      tickets.map((ticket) => ({
        id: ticket.id,
        subject: ticket.subject,
        userPhone: ticket.profiles?.phone || 'N/A',
        createdAtText: new Date(ticket.created_at).toLocaleString(),
        updatedAtText: new Date(ticket.updated_at).toLocaleString(),
        priority: ticket.priority,
        status: ticket.status,
        priorityBadgeClass: getPriorityBadge(ticket.priority),
        statusBadgeClass: getStatusBadge(ticket.status),
        description: ticket.description || ticket.message || 'No description provided.',
        source: ticket,
      })),
    [tickets]
  );

  const handleSelectTicket = useCallback(async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setResponseText('');
    await loadThreadMessages(ticket.id);
  }, [loadThreadMessages]);

  return (
    <AdminLayout>
      <div style={styles.headerWrap}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 6 }}>Support Operations</h1>
          <p style={styles.subtitle}>Track, prioritize and resolve customer issues with a clear support workflow.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => void loadTickets()}>
          Refresh
        </button>
      </div>

      <div style={styles.summaryGrid}>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryValue}>{summary.total}</div><div style={styles.summaryLabel}>Visible Tickets</div></div>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryValue}>{summary.open}</div><div style={styles.summaryLabel}>Open</div></div>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryValue}>{summary.inProgress}</div><div style={styles.summaryLabel}>In Progress</div></div>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryValue}>{summary.high}</div><div style={styles.summaryLabel}>High Priority</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={styles.filterGroup}>
          <div style={styles.filterLabel}>Status</div>
          <div className="filters" style={{ marginBottom: 10 }}>
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                className={`btn ${filter === status ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(status)}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div style={styles.filterLabel}>Category</div>
          <div className="filters" style={{ marginBottom: 0 }}>
            {PRIORITY_FILTERS.map((priority) => (
              <button
                key={priority}
                className={`btn ${priorityFilter === priority ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPriorityFilter(priority)}
              >
                {priority}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <DataState kind="loading" title="Loading support queue" message="Please wait while tickets are being fetched." />
      ) : error ? (
        <DataState kind="error" title="Support queue unavailable" message={error} actionLabel="Retry" onAction={() => void loadTickets()} />
      ) : tickets.length === 0 ? (
        <DataState
          kind="empty"
          title="No tickets for this filter"
          message="Try another status or priority filter to view more support conversations."
          actionLabel="Reset Filters"
          onAction={() => {
            setFilter('all');
            setPriorityFilter('all');
          }}
        />
      ) : (
        <div style={styles.ticketList}>
          {ticketRows.map((row) => (
            <TicketCard key={row.id} row={row} onSelect={handleSelectTicket} />
          ))}
        </div>
      )}

      {selectedTicket ? (
        <div className="modal-overlay" onClick={closeDetail}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={styles.modalLarge}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 20 }}>Ticket Detail</h3>
              <button className="btn btn-secondary" onClick={closeDetail}>Close</button>
            </div>

            <div style={styles.detailGrid}>
              <div style={styles.detailItem}><strong>User</strong><span>{selectedTicket.profiles?.phone || 'N/A'}</span></div>
              <div style={styles.detailItem}><strong>Created</strong><span>{new Date(selectedTicket.created_at).toLocaleString()}</span></div>
              <div style={styles.detailItem}><strong>Updated</strong><span>{new Date(selectedTicket.updated_at).toLocaleString()}</span></div>
              <div style={styles.detailItem}><strong>Priority</strong><span className={`badge ${getPriorityBadge(selectedTicket.priority)}`}>{selectedTicket.priority}</span></div>
              <div style={styles.detailItem}><strong>Status</strong><span className={`badge ${getStatusBadge(selectedTicket.status)}`}>{selectedTicket.status}</span></div>
            </div>

            <div style={styles.detailBlock}>
              <div style={styles.detailTitle}>Subject</div>
              <div>{selectedTicket.subject}</div>
            </div>

            <div style={styles.detailBlock}>
              <div style={styles.detailTitle}>Issue Description</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{selectedTicket.description || selectedTicket.message || 'No description provided.'}</div>
            </div>

            <div style={styles.detailBlock}>
              <div style={styles.detailTitle}>Conversation Thread</div>
              {threadLoading ? (
                <div style={styles.threadHint}>Loading messages...</div>
              ) : threadError ? (
                <div style={styles.threadHint}>{threadError}</div>
              ) : threadMessages.length === 0 ? (
                <div style={styles.threadHint}>No messages yet for this ticket.</div>
              ) : (
                <div style={styles.threadList}>
                  {threadMessages.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        ...styles.messageRow,
                        alignSelf: item.sender_role === 'admin' ? 'flex-end' : 'flex-start',
                        background: item.sender_role === 'admin' ? '#eff6ff' : '#ffffff',
                        borderColor: item.sender_role === 'admin' ? '#bfdbfe' : '#e5e7eb',
                      }}
                    >
                      <div style={styles.messageMeta}>
                        <strong>{item.sender_role === 'admin' ? 'Support Agent' : item.sender_role === 'system' ? 'System' : 'User'}</strong>
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                      <div style={styles.messageText}>{item.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Reply To User</label>
              <textarea
                className="form-textarea"
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Write a clear response for the customer..."
                disabled={actionLoading}
              />
              <button
                className="btn btn-primary"
                style={{ marginTop: 8 }}
                onClick={() => void handleAddResponse(selectedTicket.id)}
                disabled={actionLoading || !responseText.trim()}
              >
                {actionLoading ? 'Sending...' : 'Send Response'}
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={styles.detailTitle}>Status Actions</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => void handleUpdateStatus(selectedTicket.id, 'in_progress')} disabled={actionLoading}>
                  Mark In Progress
                </button>
                <button className="btn btn-success" onClick={() => void handleUpdateStatus(selectedTicket.id, 'resolved')} disabled={actionLoading}>
                  Mark Resolved
                </button>
                <button className="btn btn-secondary" onClick={() => void handleUpdateStatus(selectedTicket.id, 'open')} disabled={actionLoading}>
                  Reopen
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 14,
    maxWidth: 700,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
    marginBottom: 16,
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
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#4b5563',
  },
  ticketList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  ticketCardButton: {
    border: 'none',
    padding: 0,
    margin: 0,
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
  },
  ticketCard: {
    marginBottom: 0,
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 14,
  },
  ticketTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  ticketSubject: {
    fontSize: 15,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 4,
  },
  ticketMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  ticketPreview: {
    marginTop: 10,
    fontSize: 13,
    color: '#374151',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  ticketFooter: {
    marginTop: 10,
    fontSize: 12,
    color: '#9ca3af',
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
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
    marginBottom: 12,
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 10,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 13,
  },
  detailBlock: {
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    background: '#f9fafb',
  },
  detailTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: 700,
    color: '#6b7280',
    marginBottom: 6,
  },
  threadList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 280,
    overflowY: 'auto',
    paddingRight: 2,
  },
  threadHint: {
    fontSize: 13,
    color: '#6b7280',
  },
  messageRow: {
    width: 'min(100%, 560px)',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 10,
  },
  messageMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 6,
  },
  messageText: {
    whiteSpace: 'pre-wrap',
    fontSize: 13,
    color: '#1f2937',
  },
};
