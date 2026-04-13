export const RIDE_STATUS = {
  REQUESTED: "requested",
  ACCEPTED: "accepted",
  ARRIVED: "arrived",
  STARTED: "started",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export const RIDE_STATUSES = [
  RIDE_STATUS.REQUESTED,
  RIDE_STATUS.ACCEPTED,
  RIDE_STATUS.ARRIVED,
  RIDE_STATUS.STARTED,
  RIDE_STATUS.COMPLETED,
  RIDE_STATUS.CANCELLED,
] as const;

export type RideStatus = (typeof RIDE_STATUSES)[number];

export const ACTIVE_RIDE_STATUSES = [
  RIDE_STATUS.REQUESTED,
  RIDE_STATUS.ACCEPTED,
  RIDE_STATUS.ARRIVED,
  RIDE_STATUS.STARTED,
] as const;

export const TERMINAL_RIDE_STATUSES = [
  RIDE_STATUS.COMPLETED,
  RIDE_STATUS.CANCELLED,
] as const;

export const RIDE_STATUS_TRANSITIONS: Record<RideStatus, readonly RideStatus[]> = {
  [RIDE_STATUS.REQUESTED]: [RIDE_STATUS.ACCEPTED, RIDE_STATUS.CANCELLED],
  [RIDE_STATUS.ACCEPTED]: [RIDE_STATUS.ARRIVED, RIDE_STATUS.CANCELLED],
  [RIDE_STATUS.ARRIVED]: [RIDE_STATUS.STARTED, RIDE_STATUS.CANCELLED],
  [RIDE_STATUS.STARTED]: [RIDE_STATUS.COMPLETED, RIDE_STATUS.CANCELLED],
  [RIDE_STATUS.COMPLETED]: [],
  [RIDE_STATUS.CANCELLED]: [],
};

export function normalizeRideStatus(value: string | null | undefined): RideStatus {
  if (!value) return RIDE_STATUS.REQUESTED;
  const normalized = value.toLowerCase() === "canceled" ? RIDE_STATUS.CANCELLED : value.toLowerCase();
  return (RIDE_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as RideStatus)
    : RIDE_STATUS.REQUESTED;
}

export function canTransitionRideStatus(from: string | null | undefined, to: string | null | undefined, options?: { allowSame?: boolean }) {
  const fromStatus = normalizeRideStatus(from);
  const toStatus = normalizeRideStatus(to);

  if (fromStatus === toStatus) return options?.allowSame === true;
  return RIDE_STATUS_TRANSITIONS[fromStatus].includes(toStatus);
}
