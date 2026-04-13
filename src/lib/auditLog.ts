import { supabase } from './supabase';

export type AdminAuditAction =
  | 'driver.approved'
  | 'driver.rejected'
  | 'driver.flag_reviewed'
  | 'driver.flag_dismissed'
  | 'user.suspended'
  | 'user.unsuspended'
  | 'support.response_added'
  | 'support.status_updated'
  | 'report.resolved'
  | 'report.action_taken';

type JsonRecord = Record<string, unknown>;

type AdminAuditEventInput = {
  actorId: string;
  action: AdminAuditAction;
  rideId?: string | null;
  metadata?: JsonRecord;
};

const ACTION_EVENT_TYPE: Record<AdminAuditAction, string> = {
  'driver.approved': 'driver_approved',
  'driver.rejected': 'driver_rejected',
  'driver.flag_reviewed': 'driver_flag_reviewed',
  'driver.flag_dismissed': 'driver_flag_dismissed',
  'user.suspended': 'user_suspended',
  'user.unsuspended': 'user_unsuspended',
  'support.response_added': 'support_response',
  'support.status_updated': 'support_status_updated',
  'report.resolved': 'report_resolved',
  'report.action_taken': 'report_action_taken',
};

export async function logAdminAuditEvent({ actorId, action, rideId = null, metadata = {} }: AdminAuditEventInput): Promise<void> {
  const occurredAt = new Date().toISOString();

  const payload: JsonRecord = {
    ...metadata,
    audit: {
      version: 1,
      action_type: action,
      actor_id: actorId,
      actor_role: 'admin',
      occurred_at: occurredAt,
      source: 'admin_dashboard',
    },
  };

  const { error } = await supabase.from('ride_events').insert({
    event_type: ACTION_EVENT_TYPE[action],
    actor_id: actorId,
    actor_role: 'admin',
    ride_id: rideId,
    metadata_json: payload,
  });

  if (error) {
    throw error;
  }
}
