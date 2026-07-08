import { createServerSupabaseClient } from "@/lib/supabase";
import { computeProjectSignals, type ProjectRow, type TeamRow } from "@/lib/signals";
import { formatUSD } from "@/lib/format";
import { FlagPill } from "@/app/components/FlagPill";
import { BriefPanel } from "@/app/components/BriefPanel";

export const dynamic = "force-dynamic";

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

const AT_RISK_REVENUE_STATUSES = new Set(["At Risk", "Verbal"]);

export default async function Home() {
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
  const attentionItems = signals
    .filter((item) => item.flags.length >= 2)
    .sort((a, b) => b.orderingScore - a.orderingScore);

  const flaggedProjectCount = signals.filter((item) => item.flags.length > 0).length;

  const revenueAtRisk = revenue
    .filter((r) => r.status != null && AT_RISK_REVENUE_STATUSES.has(r.status))
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);

  // Reuse the engine's own over-allocated-lead flag rather than
  // re-deriving the capacity comparison here.
  const overAllocatedLeadCount = new Set(
    signals
      .filter((item) => item.flags.some((f) => f.code === "over-allocated-lead"))
      .map((item) => item.project.lead)
      .filter((lead): lead is string => Boolean(lead))
  ).size;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-12 sm:px-10">
        <header className="mb-10 border-b border-zinc-800 pb-6">
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-zinc-50">
            This Week
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            A grounded snapshot of what needs leadership&apos;s attention right now.
          </p>
        </header>

        <div className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <MetricCard
            label="Flagged projects"
            value={`${flaggedProjectCount} / ${projects.length}`}
          />
          <MetricCard label="Revenue at risk" value={formatUSD(revenueAtRisk)} />
          <MetricCard label="Over-allocated leads" value={String(overAllocatedLeadCount)} />
        </div>

        <BriefPanel />

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-sans text-lg font-semibold text-zinc-50">Attention Rail</h2>
            <p className="font-mono text-xs text-zinc-500">{attentionItems.length} flagged</p>
          </div>

          {attentionItems.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing has 2+ open flags right now.</p>
          ) : (
            <ul className="divide-y divide-zinc-800 rounded-md border border-zinc-800">
              {attentionItems.map((item) => (
                <li
                  key={item.project.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{item.project.name}</p>
                    <p className="text-xs text-zinc-500">
                      {clientNameById.get(item.project.client_id) ?? "Unknown client"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    {item.flags.map((flag) => (
                      <FlagPill key={flag.code} flag={flag} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-5">
      <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold text-zinc-50">{value}</p>
    </div>
  );
}
