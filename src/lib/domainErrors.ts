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

export function getAdminErrorMessage(code?: string, fallback = "An error occurred.") {
  switch (code) {
    case DOMAIN_ERROR_CODE.NO_DRIVER_AVAILABLE:
      return "No driver is available right now.";
    case DOMAIN_ERROR_CODE.ACTIVE_RIDE_EXISTS:
      return "This account already has an active ride.";
    case DOMAIN_ERROR_CODE.RIDE_ALREADY_TAKEN:
      return "This ride was already taken by another driver.";
    case DOMAIN_ERROR_CODE.REQUEST_EXPIRED:
      return "This request has expired.";
    case DOMAIN_ERROR_CODE.DRIVER_NOT_ELIGIBLE:
      return "The driver is no longer eligible to accept this ride.";
    case DOMAIN_ERROR_CODE.INVALID_OTP:
      return "The OTP code is invalid or expired.";
    case DOMAIN_ERROR_CODE.RIDE_NOT_FOUND:
      return "Ride not found.";
    case DOMAIN_ERROR_CODE.UNAUTHORIZED_TRANSITION:
      return "This action is not allowed for the current ride state.";
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
