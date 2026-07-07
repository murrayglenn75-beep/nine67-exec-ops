// Deterministic signal engine. Per AGENTS.md: "Signals before AI" — this
// module computes flags from raw project/team rows with no model calls
// involved. lib/digest.ts feeds the output of this file to Claude; Claude
// narrates over these flags, it does not invent its own analysis.

export interface ProjectRow {
  id: number;
  client_id: number;
  name: string;
  status: string | null;
  due_date: string | null;
  budget: number | null;
  spent: number | null;
  hours_per_week: number | null;
  lead: string | null;
  notes: string | null;
  updated_at: string;
  created_at: string;
}

export interface TeamRow {
  id: number;
  name: string;
  role: string;
  email: string | null;
  weekly_capacity_hours: number | null;
}

export type NormalizedStatus = "ok" | "risk" | "unclear";

export type DueDateKind = "iso" | "dmy" | "recurring" | "unparseable";

export interface ParsedDueDate {
  raw: string | null;
  kind: DueDateKind;
  date: Date | null;
}

export type FlagSeverity = "info" | "warning" | "critical";

export type FlagCode =
  | "stale"
  | "no-budget-recorded"
  | "near-budget"
  | "over-budget"
  | "status-unclear"
  | "status-notes-conflict"
  | "recurring-due-date"
  | "unparseable-due-date"
  | "missing-lead"
  | "over-allocated-lead";

export interface Flag {
  code: FlagCode;
  severity: FlagSeverity;
  message: string;
}

export interface ProjectWithSignals {
  project: ProjectRow;
  normalizedStatus: NormalizedStatus;
  daysSinceUpdate: number;
  dueDate: ParsedDueDate;
  burnRate: number | null;
  flags: Flag[];
  // Heuristic ordering only: a severity-weighted count of flags, used to
  // sort "what needs attention first" in the UI. It is NOT a calibrated
  // risk score and must never be presented to users as a precise measurement.
  orderingScore: number;
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function buildUtcDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject values that overflowed (e.g. "2026-02-30" rolling into March)
  // rather than silently accepting a rounded date.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Loose due-date parser. Handles ISO ("2026-08-14") and DD/MM/YYYY
 * ("15/09/2026"). Recognizes "monthly" as a recurring cadence rather than a
 * fixed date. Anything else (e.g. "June 2") is flagged unparseable instead
 * of thrown — due dates in this dataset are free text, not a date type.
 */
export function parseDueDate(raw: string | null): ParsedDueDate {
  if (raw == null) {
    return { raw, kind: "unparseable", date: null };
  }

  const trimmed = raw.trim();

  if (trimmed.toLowerCase() === "monthly") {
    return { raw, kind: "recurring", date: null };
  }

  const isoMatch = ISO_DATE_RE.exec(trimmed);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const date = buildUtcDate(Number(y), Number(m), Number(d));
    if (date) return { raw, kind: "iso", date };
  }

  const dmyMatch = DMY_DATE_RE.exec(trimmed);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const date = buildUtcDate(Number(y), Number(m), Number(d));
    if (date) return { raw, kind: "dmy", date };
  }

  return { raw, kind: "unparseable", date: null };
}

const OK_STATUSES = new Set(["on track", "green"]);
const RISK_STATUSES = new Set(["at risk", "red"]);

/**
 * Normalizes free-text status values entered inconsistently over time
 * ("On Track" / "on-track" / "Green" / "At Risk" / "Red" / "??" / null)
 * into a small, closed set. Anything not recognized — including "??" and
 * null — normalizes to "unclear" rather than being guessed at.
 */
export function normalizeStatus(raw: string | null): NormalizedStatus {
  if (raw == null) return "unclear";

  const cleaned = raw.trim().toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");

  if (OK_STATUSES.has(cleaned)) return "ok";
  if (RISK_STATUSES.has(cleaned)) return "risk";
  return "unclear";
}

const NEGATIVE_NOTE_KEYWORDS = [
  "behind",
  "pushing",
  "escalate",
  "unclear",
  "no update",
  "left the agency",
  "pending",
  "threatening",
];

function matchNegativeKeywords(notes: string | null): string[] {
  if (!notes) return [];
  const lower = notes.toLowerCase();
  return NEGATIVE_NOTE_KEYWORDS.filter((kw) => lower.includes(kw));
}

function computeBurnRate(spent: number | null, budget: number | null): number | null {
  if (budget == null || budget === 0 || spent == null) return null;
  return spent / budget;
}

function daysSince(isoTimestamp: string, now: Date): number {
  const updated = new Date(isoTimestamp);
  const diffMs = now.getTime() - updated.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function isMissingLead(lead: string | null, teamByName: Map<string, TeamRow>): boolean {
  if (!lead) return true;
  if (lead.trim() === "— unassigned —") return true;
  return !teamByName.has(lead);
}

const SEVERITY_WEIGHT: Record<FlagSeverity, number> = {
  info: 1,
  warning: 2,
  critical: 3,
};

function computeOrderingScore(flags: Flag[]): number {
  return flags.reduce((sum, flag) => sum + SEVERITY_WEIGHT[flag.severity], 0);
}

/**
 * Computes deterministic signals for every project: staleness, burn rate,
 * status normalization, status-vs-notes conflicts, due-date parsing,
 * missing-lead detection, and per-lead over-allocation. No AI involved —
 * this is the layer the grounding prompt narrates over.
 */
export function computeProjectSignals(
  projects: ProjectRow[],
  team: TeamRow[],
  now: Date = new Date()
): ProjectWithSignals[] {
  const teamByName = new Map(team.map((member) => [member.name, member]));

  // Over-allocation: sum hours_per_week per lead name across all projects,
  // then compare against that person's weekly_capacity_hours.
  const hoursByLead = new Map<string, number>();
  for (const project of projects) {
    if (!project.lead || project.hours_per_week == null) continue;
    hoursByLead.set(
      project.lead,
      (hoursByLead.get(project.lead) ?? 0) + project.hours_per_week
    );
  }

  const overAllocatedLeads = new Set<string>();
  for (const [leadName, totalHours] of hoursByLead) {
    const member = teamByName.get(leadName);
    if (member?.weekly_capacity_hours != null && totalHours > member.weekly_capacity_hours) {
      overAllocatedLeads.add(leadName);
    }
  }

  return projects.map((project) => {
    const flags: Flag[] = [];

    const daysSinceUpdate = daysSince(project.updated_at, now);
    if (daysSinceUpdate > 14) {
      flags.push({
        code: "stale",
        severity: "warning",
        message: `No update in ${daysSinceUpdate} days.`,
      });
    }

    const burnRate = computeBurnRate(project.spent, project.budget);
    if (project.budget == null) {
      flags.push({
        code: "no-budget-recorded",
        severity: "info",
        message: "No budget recorded for this project.",
      });
    } else if (burnRate != null) {
      if (burnRate >= 1) {
        flags.push({
          code: "over-budget",
          severity: "critical",
          message: `Spent ${Math.round(burnRate * 100)}% of budget.`,
        });
      } else if (burnRate >= 0.9) {
        flags.push({
          code: "near-budget",
          severity: "warning",
          message: `Spent ${Math.round(burnRate * 100)}% of budget.`,
        });
      }
    }

    const normalizedStatus = normalizeStatus(project.status);
    if (normalizedStatus === "unclear") {
      flags.push({
        code: "status-unclear",
        severity: "warning",
        message: `Status "${project.status ?? "(none)"}" doesn't map to a known state.`,
      });
    }

    if (normalizedStatus === "ok") {
      const matchedKeywords = matchNegativeKeywords(project.notes);
      if (matchedKeywords.length > 0) {
        flags.push({
          code: "status-notes-conflict",
          severity: "critical",
          message: `Status reads OK but notes mention: ${matchedKeywords.join(", ")}.`,
        });
      }
    }

    const dueDate = parseDueDate(project.due_date);
    if (dueDate.kind === "recurring") {
      flags.push({
        code: "recurring-due-date",
        severity: "info",
        message: "Recurring cadence, not a fixed due date.",
      });
    } else if (dueDate.kind === "unparseable") {
      flags.push({
        code: "unparseable-due-date",
        severity: "warning",
        message: `Could not parse due date "${project.due_date ?? "(none)"}".`,
      });
    }

    if (isMissingLead(project.lead, teamByName)) {
      flags.push({
        code: "missing-lead",
        severity: "critical",
        message: "No active lead assigned to this project.",
      });
    } else if (project.lead && overAllocatedLeads.has(project.lead)) {
      const totalHours = hoursByLead.get(project.lead) ?? 0;
      const capacity = teamByName.get(project.lead)?.weekly_capacity_hours ?? 0;
      flags.push({
        code: "over-allocated-lead",
        severity: "warning",
        message: `${project.lead} is allocated ${totalHours}h/week against a ${capacity}h capacity.`,
      });
    }

    return {
      project,
      normalizedStatus,
      daysSinceUpdate,
      dueDate,
      burnRate,
      flags,
      orderingScore: computeOrderingScore(flags),
    };
  });
}
