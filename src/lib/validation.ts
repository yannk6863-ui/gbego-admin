export type ValidationIssue = {
  field: string;
  message: string;
  code?: string;
};

export function validateModerationReason(value: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const reason = String(value ?? "").trim();

  if (!reason) {
    issues.push({ field: "rejection_reason", message: "Please provide a rejection reason.", code: "required" });
    return issues;
  }

  if (reason.length < 8) {
    issues.push({ field: "rejection_reason", message: "Reason must be at least 8 characters.", code: "too_short" });
  }

  if (reason.length > 500) {
    issues.push({ field: "rejection_reason", message: "Reason must be 500 characters or less.", code: "too_long" });
  }

  return issues;
}

export function getFirstIssueMessage(issues: ValidationIssue[]): string {
  return issues[0]?.message ?? "Validation failed.";
}
