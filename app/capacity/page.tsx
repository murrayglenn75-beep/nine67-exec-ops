import { createServerSupabaseClient } from "@/lib/supabase";
import { computeProjectSignals, type Flag, type ProjectRow, type TeamRow } from "@/lib/signals";
import { FlagPill } from "@/app/components/FlagPill";

export const dynamic = "force-dynamic";

export default async function CapacityPage() {
  const supabase = createServerSupabaseClient();

  const [teamRes, projectsRes] = await Promise.all([
    supabase.from("team").select("*"),
    supabase.from("projects").select("*"),
  ]);

  if (teamRes.error) throw teamRes.error;
  if (projectsRes.error) throw projectsRes.error;

  const team = (teamRes.data ?? []) as TeamRow[];
  const projects = (projectsRes.data ?? []) as ProjectRow[];

  const signals = computeProjectSignals(projects, team);

  const hoursByLead = new Map<string, number>();
  for (const project of projects) {
    if (!project.lead || project.hours_per_week == null) continue;
    hoursByLead.set(project.lead, (hoursByLead.get(project.lead) ?? 0) + project.hours_per_week);
  }

  // Reuse the engine's own over-allocated-lead flag rather than
  // re-deriving the capacity comparison here.
  const overAllocatedFlagByLead = new Map<string, Flag>();
  for (const item of signals) {
    if (!item.project.lead) continue;
    const flag = item.flags.find((f) => f.code === "over-allocated-lead");
    if (flag) overAllocatedFlagByLead.set(item.project.lead, flag);
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:px-10">
        <header className="mb-10 border-b border-zinc-800 pb-6">
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-zinc-50">
            Capacity
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Weekly hours allocated across active projects vs. each person&apos;s nominal
            capacity.
          </p>
        </header>

        <ul className="space-y-5">
          {team.map((member) => {
            const allocated = hoursByLead.get(member.name) ?? 0;
            const capacity = member.weekly_capacity_hours;
            const overAllocatedFlag = overAllocatedFlagByLead.get(member.name);
            const pct = capacity ? Math.min((allocated / capacity) * 100, 100) : 0;

            return (
              <li
                key={member.id}
                className="rounded-md border border-zinc-800 bg-zinc-900/50 p-5"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{member.name}</p>
                    <p className="text-xs text-zinc-500">{member.role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {overAllocatedFlag && <FlagPill flag={overAllocatedFlag} />}
                    <span className="font-mono text-xs text-zinc-400">
                      {allocated}h / {capacity != null ? `${capacity}h` : "—"}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${
                      overAllocatedFlag ? "bg-orange-500" : "bg-accent/60"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
