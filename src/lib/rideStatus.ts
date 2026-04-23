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
    label: "Demandee",
    helper: "En attente d'attribution d'un chauffeur.",
    tone: "warning",
    icon: "R",
  },
  [RIDE_STATUS.ACCEPTED]: {
    status: RIDE_STATUS.ACCEPTED,
    label: "Acceptee",
    helper: "Le chauffeur se dirige vers la prise en charge.",
    tone: "info",
    icon: "A",
  },
  [RIDE_STATUS.ARRIVED]: {
    status: RIDE_STATUS.ARRIVED,
    label: "Arrivee",
    helper: "Le chauffeur est arrive au point de prise en charge.",
    tone: "primary",
    icon: "P",
  },
  [RIDE_STATUS.STARTED]: {
    status: RIDE_STATUS.STARTED,
    label: "Demarree",
    helper: "La course a commence et est en cours.",
    tone: "primary",
    icon: "S",
  },
  [RIDE_STATUS.COMPLETED]: {
    status: RIDE_STATUS.COMPLETED,
    label: "Terminee",
    helper: "La course est terminee avec succes.",
    tone: "success",
    icon: "C",
  },
  [RIDE_STATUS.CANCELLED]: {
    status: RIDE_STATUS.CANCELLED,
    label: "Annulee",
    helper: "La course a ete annulee.",
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
