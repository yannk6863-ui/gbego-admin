export const DOMAIN_ERROR_CODE = {
  NO_DRIVER_AVAILABLE: "no_driver_available",
  ACTIVE_RIDE_EXISTS: "active_ride_exists",
  RIDE_ALREADY_TAKEN: "ride_already_taken",
  REQUEST_EXPIRED: "request_expired",
  DRIVER_NOT_ELIGIBLE: "driver_not_eligible",
  INVALID_OTP: "invalid_otp",
  RIDE_NOT_FOUND: "ride_not_found",
  UNAUTHORIZED_TRANSITION: "unauthorized_transition",
  SERVICE_UNAVAILABLE_ZONE: "service_unavailable_zone",
} as const;

export function getAdminErrorMessage(code?: string, fallback = "Une erreur est survenue.") {
  switch (code) {
    case DOMAIN_ERROR_CODE.NO_DRIVER_AVAILABLE:
      return "Aucun chauffeur n'est disponible pour le moment.";
    case DOMAIN_ERROR_CODE.ACTIVE_RIDE_EXISTS:
      return "Ce compte a deja une course active.";
    case DOMAIN_ERROR_CODE.RIDE_ALREADY_TAKEN:
      return "Cette course a deja ete prise par un autre chauffeur.";
    case DOMAIN_ERROR_CODE.REQUEST_EXPIRED:
      return "Cette demande a expire.";
    case DOMAIN_ERROR_CODE.DRIVER_NOT_ELIGIBLE:
      return "Le chauffeur n'est plus eligible pour accepter cette course.";
    case DOMAIN_ERROR_CODE.INVALID_OTP:
      return "Le code OTP est invalide ou expire.";
    case DOMAIN_ERROR_CODE.RIDE_NOT_FOUND:
      return "Course introuvable.";
    case DOMAIN_ERROR_CODE.UNAUTHORIZED_TRANSITION:
      return "Cette action n'est pas autorisee pour l'etat actuel de la course.";
    case DOMAIN_ERROR_CODE.SERVICE_UNAVAILABLE_ZONE:
      return "Service indisponible pour la zone demandee.";
    default:
      return fallback;
  }
}

export function extractAdminErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { code?: string; error?: { code?: string } };
  return candidate.code ?? candidate.error?.code;
}
