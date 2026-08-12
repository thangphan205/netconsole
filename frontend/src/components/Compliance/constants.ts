/**
 * Shared compliance vocabulary. These maps used to be redeclared in every
 * compliance component, which is how the dashboard and the detail view drifted
 * into showing the same status in different colors.
 */

export const STATUS_COLORS: Record<string, string> = {
  pass: "green",
  fail: "red",
  skipped: "yellow",
  not_applicable: "gray",
  error: "orange",
}

export const STATUS_LABELS: Record<string, string> = {
  pass: "Pass",
  fail: "Fail",
  skipped: "Skipped",
  not_applicable: "N/A",
  error: "Error",
}

export const SEVERITY_COLORS: Record<string, string> = {
  high: "red",
  medium: "orange",
  low: "blue",
}

/** Matches SEVERITY_WEIGHTS in backend/app/automation/compliance_rules.py. */
export const SEVERITY_WEIGHTS: Record<string, number> = {
  high: 5,
  medium: 3,
  low: 1,
}

export const SEVERITY_ORDER = ["high", "medium", "low"] as const

export const SCORE_EXPLAINER =
  "Severity-weighted share of evaluated rules that pass " +
  "(high ×5, medium ×3, low ×1). Skipped and not-applicable rules are excluded."

export const statusColor = (status: string) => STATUS_COLORS[status] ?? "gray"
export const statusLabel = (status: string) =>
  STATUS_LABELS[status] ?? status.toUpperCase()
export const severityColor = (severity: string) =>
  SEVERITY_COLORS[severity] ?? "gray"

/** Green ≥90, amber ≥70, red below — the same thresholds across every view. */
export function scoreColor(score: number | null | undefined): string {
  if (score == null) return "gray"
  if (score >= 90) return "green"
  if (score >= 70) return "yellow"
  return "red"
}

export function formatScore(score: number | null | undefined): string {
  return score == null ? "—" : `${Math.round(score)}%`
}
