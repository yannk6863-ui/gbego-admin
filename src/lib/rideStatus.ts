import {
  RIDE_STATUS,
  type RideStatus,
  normalizeRideStatus as normalizeCanonicalRideStatus,
} from "@/lib/rideLifecycle";

export type RideStatusMeta = {
  status: RideStatus;
  label: string;
  helper?: string;
  tone: "warning" | "info" | "primary" | "success" | "danger";
  icon: string;
};

const STATUS_ORDER: RideStatus[] = [
  RIDE_STATUS.REQUESTED,
  RIDE_STATUS.ACCEPTED,
  RIDE_STATUS.ARRIVED,
  RIDE_STATUS.STARTED,
  RIDE_STATUS.COMPLETED,
];

const STATUS_META: Record<RideStatus, RideStatusMeta> = {
  [RIDE_STATUS.REQUESTED]: {
    status: RIDE_STATUS.REQUESTED,
    label: "Requested",
    helper: "Waiting for a driver assignment.",
    tone: "warning",
    icon: "R",
  },
  [RIDE_STATUS.ACCEPTED]: {
    status: RIDE_STATUS.ACCEPTED,
    label: "Accepted",
    helper: "Driver is heading to pickup.",
    tone: "info",
    icon: "A",
  },
  [RIDE_STATUS.ARRIVED]: {
    status: RIDE_STATUS.ARRIVED,
    label: "Arrived",
    helper: "Driver reached pickup point.",
    tone: "primary",
    icon: "P",
  },
  [RIDE_STATUS.STARTED]: {
    status: RIDE_STATUS.STARTED,
    label: "Started",
    helper: "Trip started and in progress.",
    tone: "primary",
    icon: "S",
  },
  [RIDE_STATUS.COMPLETED]: {
    status: RIDE_STATUS.COMPLETED,
    label: "Completed",
    helper: "Trip completed successfully.",
    tone: "success",
    icon: "C",
  },
  [RIDE_STATUS.CANCELLED]: {
    status: RIDE_STATUS.CANCELLED,
    label: "Cancelled",
    helper: "Trip was cancelled.",
    tone: "danger",
    icon: "X",
  },
};

export function normalizeRideStatus(status: string | null | undefined): RideStatus {
  return normalizeCanonicalRideStatus(status);
}

export function getRideStatusMeta(status: string | null | undefined) {
  return STATUS_META[normalizeRideStatus(status)];
}

export function getRideProgress(status: string | null | undefined) {
  const normalized = normalizeRideStatus(status);
  if (normalized === RIDE_STATUS.CANCELLED) {
    return [
      {
        status: RIDE_STATUS.CANCELLED as RideStatus,
        label: STATUS_META[RIDE_STATUS.CANCELLED].label,
        icon: STATUS_META[RIDE_STATUS.CANCELLED].icon,
        done: true,
        active: true,
        state: "current" as const,
      },
    ];
  }

  const index = STATUS_ORDER.indexOf(normalized);
  return STATUS_ORDER.map((step, stepIndex) => ({
    status: step,
    label: STATUS_META[step].label,
    icon: STATUS_META[step].icon,
    done: stepIndex <= index,
    active: stepIndex === index,
    state: stepIndex < index ? ("completed" as const) : stepIndex === index ? ("current" as const) : ("upcoming" as const),
  }));
}
