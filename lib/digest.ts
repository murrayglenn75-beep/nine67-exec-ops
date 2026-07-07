import { createServerSupabaseClient } from "./supabase";
import { computeProjectSignals, type ProjectRow, type TeamRow } from "./signals";

interface ClientRow {
  id: number;
  name: string;
  industry: string | null;
  created_at: string;
}

interface RevenueCommitmentRow {
  id: number;
  client_id: number;
  committed_month: string;
  amount: number | null;
  status: string | null;
  notes: string | null;
}

export interface DigestProject {
  id: number;
  name: string;
  client: string;
  status: { normalized: string; raw: string | null };
  dueDate: { kind: string; date: string | null; raw: string | null };
  budget: { amount: number | null; spent: number | null; burnRatePct: number | null };
  lead: string;
  flags: { code: string; severity: string; message: string }[];
}

export interface DigestClient {
  name: string;
  industry: string | null;
  activeProjectCount: number;
}

export interface DigestTeamMember {
  name: string;
  role: string;
  weeklyCapacityHours: number | null;
  allocatedHours: number;
  overAllocated: boolean;
}

export interface DigestRevenueCommitment {
  client: string;
  month: string;
  amount: number | null;
  status: string | null;
}

// Compact, LLM-facing snapshot of the world — signals + light table summaries,
// never raw row dumps. This is the only context Claude sees; if a fact isn't
// in here, the grounding prompt requires "not enough data to say" instead of
// a guess.
export interface Digest {
  generatedAt: string;
  projects: DigestProject[];
  clients: DigestClient[];
  team: DigestTeamMember[];
  revenueCommitments: DigestRevenueCommitment[];
}

export async function buildDigest(): Promise<Digest> {
  const supabase = createServerSupabaseClient();

  const [projectsRes, teamRes, clientsRes, revenueRes] = await Promise.all([
    supabase.from("projects").select("*"),
    supabase.from("team").select("*"),
    supabase.from("clients").select("*"),
    supabase.from("q3_revenue_commitments").select("*"),
  ]);

  if (projectsRes.error) throw projectsRes.error;
  if (teamRes.error) throw teamRes.error;
  if (clientsRes.error) throw clientsRes.error;
  if (revenueRes.error) throw revenueRes.error;

  const projects = (projectsRes.data ?? []) as ProjectRow[];
  const team = (teamRes.data ?? []) as TeamRow[];
  const clients = (clientsRes.data ?? []) as ClientRow[];
  const revenue = (revenueRes.data ?? []) as RevenueCommitmentRow[];

  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));
  const signals = computeProjectSignals(projects, team);

  // Recomputed here (not exposed by computeProjectSignals) purely to attach
  // numeric allocated-hours totals to each team member in the digest.
  const hoursByLead = new Map<string, number>();
  for (const project of projects) {
    if (!project.lead || project.hours_per_week == null) continue;
    hoursByLead.set(project.lead, (hoursByLead.get(project.lead) ?? 0) + project.hours_per_week);
  }

  const digestProjects: DigestProject[] = signals.map(
    ({ project, normalizedStatus, dueDate, burnRate, flags }) => ({
      id: project.id,
      name: project.name,
      client: clientNameById.get(project.client_id) ?? "Unknown client",
      status: { normalized: normalizedStatus, raw: project.status },
      dueDate: {
        kind: dueDate.kind,
        date: dueDate.date ? dueDate.date.toISOString().slice(0, 10) : null,
        raw: dueDate.raw,
      },
      budget: {
        amount: project.budget,
        spent: project.spent,
        burnRatePct: burnRate != null ? Math.round(burnRate * 100) : null,
      },
      lead: project.lead ?? "unassigned",
      flags: flags.map((f) => ({ code: f.code, severity: f.severity, message: f.message })),
    })
  );

  const digestClients: DigestClient[] = clients.map((client) => ({
    name: client.name,
    industry: client.industry,
    activeProjectCount: projects.filter((p) => p.client_id === client.id).length,
  }));

  const digestTeam: DigestTeamMember[] = team.map((member) => {
    const allocatedHours = hoursByLead.get(member.name) ?? 0;
    return {
      name: member.name,
      role: member.role,
      weeklyCapacityHours: member.weekly_capacity_hours,
      allocatedHours,
      overAllocated:
        member.weekly_capacity_hours != null && allocatedHours > member.weekly_capacity_hours,
    };
  });

  const digestRevenue: DigestRevenueCommitment[] = revenue.map((r) => ({
    client: clientNameById.get(r.client_id) ?? "Unknown client",
    month: r.committed_month,
    amount: r.amount,
    status: r.status,
  }));

  return {
    generatedAt: new Date().toISOString(),
    projects: digestProjects,
    clients: digestClients,
    team: digestTeam,
    revenueCommitments: digestRevenue,
  };
}
