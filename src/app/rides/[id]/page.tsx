'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import RideStatusBadge from '@/components/RideStatusBadge';
import RideProgressTimeline from '@/components/RideProgressTimeline';
import { extractAdminErrorCode, getAdminErrorMessage } from '@/lib/domainErrors';

interface Profile {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  role?: string | null;
  language?: string | null;
  is_suspended?: boolean | null;
  created_at?: string | null;
}

interface RideEvent {
  id: string;
  event_type: string;
  metadata_json: any;
  created_at: string;
  actor_id?: string | null;
  actor_role?: string | null;
}

interface Ride {
  id: string;
  rider_id: string;
  driver_id: string | null;
  status: string;
  pickup_address?: string | null;
  dest_address?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
  fare_estimated: number;
  fare_final: number | null;
  created_at?: string | null;
  ride_type?: string | null;
  duration_min?: number | null;
  distance_km?: number | null;
  cancelled_by?: string | null;
  cancelled_reason?: string | null;
  cancellation_reason?: string | null;
  rider: Profile | null;
  driver: Profile | null;
}

interface RideOtp {
  id: string;
  ride_id: string;
  otp_code?: string;
  code?: string;
  created_at?: string;
  expires_at?: string;
  verified_at?: string | null;
}

interface Payment {
  id: string;
  ride_id: string;
  amount: number;
  total_fare: number;
  commission_rate: number;
  platform_commission: number;
  driver_earnings: number;
  method: 'cash' | 'mobile_money';
  status: 'pending' | 'paid' | 'failed';
  provider_reference?: string | null;
  created_at: string;
}

const formatMoney = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return 'N/A';
  return `${Number(amount).toLocaleString()} XOF`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
};

const formatCoord = (value?: number | null) => (typeof value === 'number' ? value : 'N/A');

const LIFECYCLE_EVENT_LABELS: Record<string, string> = {
  ride_created: 'Ride Created',
  driver_search_started: 'Driver Search Started',
  driver_offered: 'Driver Offered',
  driver_declined: 'Driver Declined',
  driver_timeout: 'Driver Timeout',
  driver_assigned: 'Driver Assigned',
  driver_arrived: 'Driver Arrived',
  otp_verification_started: 'OTP Verification Started',
  otp_verified: 'OTP Verified',
  trip_started: 'Trip Started',
  trip_completed: 'Trip Completed',
  ride_cancelled: 'Ride Cancelled',
};

const LIFECYCLE_EVENT_TYPES = new Set(Object.keys(LIFECYCLE_EVENT_LABELS));

function formatEventLabel(eventType: string) {
  if (LIFECYCLE_EVENT_LABELS[eventType]) return LIFECYCLE_EVENT_LABELS[eventType];
  return eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function summarizeEvent(event: RideEvent): string | null {
  const meta = (event.metadata_json || {}) as Record<string, any>;
  if (event.event_type === 'driver_offered') {
    const distance = Number(meta.distance_km);
    return Number.isFinite(distance) ? `Candidate distance: ${distance.toFixed(2)} km` : null;
  }
  if (event.event_type === 'driver_declined') {
    return meta.reason ? `Reason: ${String(meta.reason)}` : null;
  }
  if (event.event_type === 'driver_timeout') {
    return meta.timeout_seconds ? `Offer expired after ${meta.timeout_seconds}s` : null;
  }
  if (event.event_type === 'driver_assigned') {
    return meta.rider_id ? `Rider notified: ${String(meta.rider_id)}` : null;
  }
  if (event.event_type === 'trip_completed') {
    return meta.fare_final ? `Final fare: ${formatMoney(Number(meta.fare_final))}` : null;
  }
  if (event.event_type === 'ride_cancelled') {
    const reasonText = meta?.reason?.text || meta?.reason?.code;
    return reasonText ? `Reason: ${String(reasonText)}` : null;
  }
  return null;
}

export default function RideDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rideId = params.id as string;
  const [ride, setRide] = useState<Ride | null>(null);
  const [rideOtp, setRideOtp] = useState<RideOtp | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [events, setEvents] = useState<RideEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadRideData();
  }, [rideId]);

  const loadRideData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        { data: rideData, error: rideError },
        { data: otpData, error: otpError },
        { data: eventData, error: eventError },
        { data: paymentData, error: paymentError },
      ] = await Promise.all([
        supabase
          .from('rides')
          .select(`
            *,
            rider:profiles!rides_rider_id_fkey(*),
            driver:profiles!rides_driver_id_fkey(*)
          `)
          .eq('id', rideId)
          .single(),
        supabase
          .from('ride_otp')
          .select('*')
          .eq('ride_id', rideId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('ride_events')
          .select('*')
          .eq('ride_id', rideId)
          .order('created_at', { ascending: true }),
        supabase
          .from('payments')
          .select('*')
          .eq('ride_id', rideId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (rideError) throw rideError;
      if (otpError) throw otpError;
      if (eventError) throw eventError;
      if (paymentError) {
        console.warn('Payment lookup failed for ride detail:', paymentError);
      }

      setRide(rideData);
      setRideOtp(otpData || null);
      setEvents(eventData || []);
      setPayment((paymentData as Payment | null) || null);
    } catch (error) {
      console.error('Error loading ride:', error);
      const code = extractAdminErrorCode(error);
      setError(getAdminErrorMessage(code, 'Unable to load ride investigation details.'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="loading">Loading ride details...</div>
      </AdminLayout>
    );
  }

  if (!ride) {
    return (
      <AdminLayout>
        <div className="card">
          <p>{error || 'Ride not found'}</p>
          <button onClick={() => router.back()} className="btn btn-secondary" style={{ marginTop: 16 }}>
            Go Back
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div style={styles.headerWrap}>
        <div>
          <h1 className="page-title" style={styles.pageTitle}>Ride Investigation</h1>
          <p style={styles.subtitle}>Operations, support, and debugging cockpit for this ride.</p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={() => void loadRideData()} className="btn btn-secondary">Refresh</button>
          <button onClick={() => router.back()} className="btn btn-secondary">Back to Rides</button>
        </div>
      </div>

      {error ? <div style={styles.errorBanner}>{error}</div> : null}

      <div className="card" style={styles.summaryCard}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Ride Summary</h3>
          <RideStatusBadge status={ride.status} showHelper />
        </div>

        <div style={{ marginBottom: 14 }}>
          <RideProgressTimeline status={ride.status} />
        </div>

        <div style={styles.infoGrid}>
          <div style={styles.infoItem}>
            <div style={styles.infoLabel}>Ride ID</div>
            <div style={styles.infoValue}>{ride.id}</div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoLabel}>Type</div>
            <div style={styles.infoValue}>{ride.ride_type ? String(ride.ride_type).toUpperCase() : 'N/A'}</div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoLabel}>Created</div>
            <div style={styles.infoValue}>{formatDateTime(ride.created_at)}</div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoLabel}>Distance / Duration</div>
            <div style={styles.infoValue}>
              {ride.distance_km ? `${ride.distance_km.toFixed(1)} km` : 'N/A'} · {ride.duration_min ? `${ride.duration_min} min` : 'N/A'}
            </div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoLabel}>Estimated Fare</div>
            <div style={styles.infoValue}>{formatMoney(ride.fare_estimated)}</div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoLabel}>Final Fare</div>
            <div style={styles.infoValue}>{formatMoney(ride.fare_final)}</div>
          </div>
        </div>

        <div style={styles.routeGrid}>
          <div style={styles.routeItem}>
            <div style={styles.infoLabel}>Pickup Address</div>
            <div style={styles.infoValue}>{ride.pickup_address || 'N/A'}</div>
            <div style={styles.metaTiny}>Lat/Lng: {formatCoord(ride.pickup_lat)}, {formatCoord(ride.pickup_lng)}</div>
          </div>
          <div style={styles.routeItem}>
            <div style={styles.infoLabel}>Destination Address</div>
            <div style={styles.infoValue}>{ride.dest_address || 'N/A'}</div>
            <div style={styles.metaTiny}>Lat/Lng: {formatCoord(ride.dest_lat)}, {formatCoord(ride.dest_lng)}</div>
          </div>
        </div>

        {(ride.cancelled_by || ride.cancelled_reason) ? (
          <div style={styles.cancelBlock}>
            <strong style={{ color: '#991b1b' }}>Cancellation Context</strong>
            <div style={styles.metaTiny}>Cancelled by: {ride.cancelled_by || 'N/A'}</div>
            <div style={styles.metaTiny}>Reason: {ride.cancellation_reason || ride.cancelled_reason || 'N/A'}</div>
          </div>
        ) : null}
      </div>

      <div style={styles.gridTwoCols}>
        <div className="card" style={styles.detailCard}>
          <h3 style={styles.sectionTitle}>Rider Details</h3>
          <div style={styles.profileRows}>
            <div style={styles.profileRow}><span>Name</span><strong>{ride.rider?.full_name || 'N/A'}</strong></div>
            <div style={styles.profileRow}><span>Phone</span><strong>{ride.rider?.phone || 'N/A'}</strong></div>
            <div style={styles.profileRow}><span>Role</span><strong>{ride.rider?.role || 'N/A'}</strong></div>
            <div style={styles.profileRow}><span>Language</span><strong>{ride.rider?.language || 'N/A'}</strong></div>
            <div style={styles.profileRow}><span>Suspended</span><strong>{ride.rider?.is_suspended ? 'Yes' : 'No'}</strong></div>
          </div>
        </div>

        <div className="card" style={styles.detailCard}>
          <h3 style={styles.sectionTitle}>Driver Details</h3>
          <div style={styles.profileRows}>
            <div style={styles.profileRow}><span>Name</span><strong>{ride.driver?.full_name || 'Unassigned'}</strong></div>
            <div style={styles.profileRow}><span>Phone</span><strong>{ride.driver?.phone || 'Unassigned'}</strong></div>
            <div style={styles.profileRow}><span>Role</span><strong>{ride.driver?.role || 'N/A'}</strong></div>
            <div style={styles.profileRow}><span>Language</span><strong>{ride.driver?.language || 'N/A'}</strong></div>
            <div style={styles.profileRow}><span>Suspended</span><strong>{ride.driver?.is_suspended ? 'Yes' : 'No'}</strong></div>
          </div>
        </div>
      </div>

      <div style={styles.gridTwoCols}>
        <div className="card" style={styles.detailCard}>
          <h3 style={styles.sectionTitle}>OTP Details</h3>
          {!rideOtp ? (
            <div style={styles.mutedText}>No OTP record available for this ride.</div>
          ) : (
            <div style={styles.profileRows}>
              <div style={styles.profileRow}><span>OTP Code</span><strong>{rideOtp.otp_code || rideOtp.code || 'N/A'}</strong></div>
              <div style={styles.profileRow}><span>Created</span><strong>{formatDateTime(rideOtp.created_at)}</strong></div>
              <div style={styles.profileRow}><span>Expires</span><strong>{formatDateTime(rideOtp.expires_at)}</strong></div>
              <div style={styles.profileRow}><span>Verified</span><strong>{rideOtp.verified_at ? formatDateTime(rideOtp.verified_at) : 'Not verified'}</strong></div>
            </div>
          )}
        </div>

        <div className="card" style={styles.detailCard}>
          <h3 style={styles.sectionTitle}>Payment Summary</h3>
          {!payment ? (
            <div style={styles.mutedText}>No payment record available yet.</div>
          ) : (
            <div style={styles.profileRows}>
              <div style={styles.profileRow}><span>Payment ID</span><strong>{payment.id}</strong></div>
              <div style={styles.profileRow}><span>Amount</span><strong>{formatMoney(payment.amount)}</strong></div>
              <div style={styles.profileRow}><span>Total Fare</span><strong>{formatMoney(payment.total_fare)}</strong></div>
              <div style={styles.profileRow}><span>Commission Rate</span><strong>{(Number(payment.commission_rate || 0) * 100).toFixed(2)}%</strong></div>
              <div style={styles.profileRow}><span>Platform Commission</span><strong>{formatMoney(payment.platform_commission)}</strong></div>
              <div style={styles.profileRow}><span>Driver Earnings</span><strong>{formatMoney(payment.driver_earnings)}</strong></div>
              <div style={styles.profileRow}><span>Method</span><strong>{payment.method}</strong></div>
              <div style={styles.profileRow}><span>Status</span><strong>{payment.status}</strong></div>
              <div style={styles.profileRow}><span>Provider Ref</span><strong>{payment.provider_reference || 'N/A'}</strong></div>
              <div style={styles.profileRow}><span>Created</span><strong>{formatDateTime(payment.created_at)}</strong></div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={styles.timelineCard}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Chronological Event Timeline</h3>
          <span style={styles.eventCount}>{events.length} events</span>
        </div>

        {events.length === 0 ? (
          <div style={styles.emptyState}>No events recorded</div>
        ) : (
          <div style={styles.timeline}>
            {events.map((event, index) => (
              <div key={event.id} style={styles.timelineItem}>
                <div style={styles.timelineDot} />
                {index < events.length - 1 && <div style={styles.timelineLine} />}
                <div style={styles.timelineContent}>
                  <div style={styles.eventHeader}>
                    <div style={styles.eventType}>
                      {formatEventLabel(event.event_type)}
                      {LIFECYCLE_EVENT_TYPES.has(event.event_type) ? <span style={styles.lifecycleTag}>Lifecycle</span> : null}
                    </div>
                    <div style={styles.eventTime}>{formatDateTime(event.created_at)}</div>
                  </div>
                  <div style={styles.eventActor}>
                    Actor: {event.actor_role || 'system'} {event.actor_id ? `· ${event.actor_id}` : ''}
                  </div>
                  {summarizeEvent(event) ? <div style={styles.eventSummary}>{summarizeEvent(event)}</div> : null}
                  {event.metadata_json && Object.keys(event.metadata_json).length > 0 && (
                    <div style={styles.eventData}>
                      <pre>{JSON.stringify(event.metadata_json, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
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
  headerActions: {
    display: 'flex',
    gap: 8,
  },
  errorBanner: {
    marginBottom: 16,
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#991b1b',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    fontWeight: 600,
  },
  summaryCard: {
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.06)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
  },
  infoItem: {
    padding: 14,
    background: '#f8fafc',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: 600,
  },
  metaTiny: {
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',
  },
  routeGrid: {
    marginTop: 14,
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
  },
  routeItem: {
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    background: '#ffffff',
    padding: 14,
  },
  cancelBlock: {
    marginTop: 14,
    border: '1px solid #fecaca',
    background: '#fef2f2',
    borderRadius: 10,
    padding: 12,
  },
  gridTwoCols: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 16,
    marginTop: 16,
  },
  detailCard: {
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.06)',
  },
  profileRows: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  profileRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    borderBottom: '1px dashed #e5e7eb',
    paddingBottom: 8,
    fontSize: 13,
    color: '#374151',
  },
  mutedText: {
    color: '#6b7280',
    fontSize: 13,
  },
  timelineCard: {
    marginTop: 16,
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.06)',
  },
  eventCount: {
    fontSize: 12,
    fontWeight: 700,
    color: '#6b7280',
  },
  emptyState: {
    color: '#9ca3af',
    textAlign: 'center',
    padding: 20,
    border: '1px dashed #d1d5db',
    borderRadius: 10,
  },
  timeline: {
    position: 'relative',
    paddingLeft: 40,
  },
  timelineItem: {
    position: 'relative',
    marginBottom: 24,
  },
  timelineDot: {
    position: 'absolute',
    left: -40,
    top: 4,
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: '#2563eb',
    border: '3px solid white',
    boxShadow: '0 0 0 2px #2563eb',
  },
  timelineLine: {
    position: 'absolute',
    left: -34,
    top: 16,
    bottom: -24,
    width: 2,
    background: '#ddd',
  },
  timelineContent: {
    background: '#f8fafc',
    padding: 16,
    borderRadius: 10,
    border: '1px solid #e5e7eb',
  },
  eventHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  eventType: {
    fontSize: 14,
    fontWeight: 600,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  lifecycleTag: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontWeight: 700,
    color: '#075985',
    background: '#e0f2fe',
    border: '1px solid #bae6fd',
    borderRadius: 999,
    padding: '2px 6px',
  },
  eventTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  eventActor: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  eventSummary: {
    marginBottom: 8,
    padding: '8px 10px',
    background: '#ecfeff',
    border: '1px solid #a5f3fc',
    color: '#155e75',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
  },
  eventData: {
    marginTop: 12,
    padding: 12,
    background: '#ffffff',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    fontSize: 12,
    fontFamily: 'monospace',
    overflowX: 'auto',
  },
};
