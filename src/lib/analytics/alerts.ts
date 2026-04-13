import { supabase } from '@/lib/supabase';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type OperationalAlert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  metricValue: number;
  threshold: string;
  observedAt: string;
};

type AlertSignals = {
  cancelledRides24h: number;
  totalRides24h: number;
  staleOnlineDrivers: number;
  paymentFailures24h: number;
  supportTickets24h: number;
  supportTicketsPrev24h: number;
};

function toCount(value: number | null | undefined): number {
  return Math.max(0, Math.trunc(Number(value ?? 0) || 0));
}

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

function asIso(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString();
}

async function collectSignals(): Promise<AlertSignals> {
  const now = Date.now();
  const h24 = 24 * 60 * 60 * 1000;

  const since24h = asIso(h24);
  const since48h = asIso(2 * h24);
  const staleCutoff = asIso(5 * 60 * 1000);

  const [cancelled24h, total24h, staleOnline, paymentFailed24h, support24h, support48hTo24h] = await Promise.all([
    supabase
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'cancelled')
      .gte('created_at', since24h),
    supabase
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h),
    supabase
      .from('driver_status')
      .select('driver_id', { count: 'exact', head: true })
      .eq('is_online', true)
      .lt('last_seen_at', staleCutoff),
    supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', since24h),
    supabase
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h),
    supabase
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since48h)
      .lt('created_at', since24h),
  ]);

  return {
    cancelledRides24h: toCount(cancelled24h.count),
    totalRides24h: toCount(total24h.count),
    staleOnlineDrivers: toCount(staleOnline.count),
    paymentFailures24h: toCount(paymentFailed24h.count),
    supportTickets24h: toCount(support24h.count),
    supportTicketsPrev24h: toCount(support48hTo24h.count),
  };
}

// Rule catalog keeps alerts easy to extend with new operational signals.
function evaluateRules(signals: AlertSignals): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const observedAt = new Date().toISOString();

  const cancelRate = percentage(signals.cancelledRides24h, signals.totalRides24h);
  if (signals.cancelledRides24h >= 10 && cancelRate >= 25) {
    alerts.push({
      id: 'cancelled-rides-high',
      severity: cancelRate >= 35 ? 'critical' : 'warning',
      title: 'High Ride Cancellations',
      message: `${signals.cancelledRides24h} rides cancelled in the last 24h (${cancelRate.toFixed(1)}%).`,
      metricValue: signals.cancelledRides24h,
      threshold: '>= 10 cancelled rides and >= 25% cancellation rate (24h)',
      observedAt,
    });
  }

  if (signals.staleOnlineDrivers >= 5) {
    alerts.push({
      id: 'stale-online-drivers',
      severity: signals.staleOnlineDrivers >= 12 ? 'critical' : 'warning',
      title: 'Drivers Possibly Offline Unexpectedly',
      message: `${signals.staleOnlineDrivers} drivers are marked online but have stale location updates (>5 min).`,
      metricValue: signals.staleOnlineDrivers,
      threshold: '>= 5 stale online drivers',
      observedAt,
    });
  }

  if (signals.paymentFailures24h >= 3) {
    alerts.push({
      id: 'payment-failures',
      severity: signals.paymentFailures24h >= 8 ? 'critical' : 'warning',
      title: 'Payment Failures Increasing',
      message: `${signals.paymentFailures24h} failed payments were recorded in the last 24h.`,
      metricValue: signals.paymentFailures24h,
      threshold: '>= 3 failed payments (24h)',
      observedAt,
    });
  }

  const previous = Math.max(1, signals.supportTicketsPrev24h);
  const spikeRatio = signals.supportTickets24h / previous;
  if (signals.supportTickets24h >= 10 && spikeRatio >= 1.5) {
    alerts.push({
      id: 'support-spike',
      severity: spikeRatio >= 2 ? 'critical' : 'warning',
      title: 'Support Ticket Spike',
      message: `${signals.supportTickets24h} tickets in the last 24h (${spikeRatio.toFixed(1)}x previous 24h).`,
      metricValue: signals.supportTickets24h,
      threshold: '>= 10 tickets and >= 1.5x vs previous 24h',
      observedAt,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'ops-stable',
      severity: 'info',
      title: 'Operations Stable',
      message: 'No active operational alert exceeded configured thresholds.',
      metricValue: 0,
      threshold: 'All alert thresholds below trigger levels',
      observedAt,
    });
  }

  return alerts;
}

export async function getOperationalAlerts(): Promise<OperationalAlert[]> {
  const signals = await collectSignals();
  return evaluateRules(signals).sort((a, b) => {
    const rank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity];
  });
}
