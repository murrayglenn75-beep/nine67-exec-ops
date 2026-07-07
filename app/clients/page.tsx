import { createServerSupabaseClient } from "@/lib/supabase";
import { computeProjectSignals, type ProjectRow, type TeamRow } from "@/lib/signals";
import { FlagPill } from "@/app/components/FlagPill";

export const dynamic = "force-dynamic";

interface ClientRow {
  id: number;
  name: string;
  industry: string | null;
  created_at: string;
}

export default async function ClientsPage() {
  const supabase = createServerSupabaseClient();

  const [clientsRes, projectsRes, teamRes] = await Promise.all([
    supabase.from("clients").select("*"),
    supabase.from("projects").select("*"),
    supabase.from("team").select("*"),
  ]);

  if (clientsRes.error) throw clientsRes.error;
  if (projectsRes.error) throw projectsRes.error;
  if (teamRes.error) throw teamRes.error;

  const clients = (clientsRes.data ?? []) as ClientRow[];
  const projects = (projectsRes.data ?? []) as ProjectRow[];
  const team = (teamRes.data ?? []) as TeamRow[];

  // No dedup by name here — "Meridian Health" and "Meridian Healthcare" are
  // two distinct rows in the clients table (a real data-entry duplicate) and
  // must render as two separate cards, not be merged into one.
  const signals = computeProjectSignals(projects, team);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-12 sm:px-10">
        <header className="mb-10 flex items-baseline justify-between border-b border-zinc-800 pb-6">
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-zinc-50">
            Clients
          </h1>
          <p className="font-mono text-xs text-zinc-500">{clients.length} tracked</p>
        </header>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {clients.map((client) => {
            const clientSignals = signals.filter((s) => s.project.client_id === client.id);
            const flaggedProjects = clientSignals.filter((s) => s.flags.length > 0);

            return (
              <article
                key={client.id}
                className="rounded-md border border-zinc-800 bg-zinc-900/50 p-6"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-sans text-lg font-semibold text-zinc-50">
                      {client.name}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      {client.industry ?? "Industry not recorded"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-zinc-700/60 bg-zinc-800/40 px-2.5 py-1 font-mono text-[11px] text-zinc-300">
                    {clientSignals.length} active
                  </span>
                </div>

                {flaggedProjects.length === 0 ? (
                  <p className="border-t border-zinc-800 pt-4 text-sm text-zinc-500">
                    No flagged projects.
                  </p>
                ) : (
                  <ul className="space-y-3 border-t border-zinc-800 pt-4">
                    {flaggedProjects.map((item) => (
                      <li key={item.project.id}>
                        <p className="text-sm font-medium text-zinc-200">{item.project.name}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {item.flags.map((flag) => (
                            <FlagPill key={flag.code} flag={flag} />
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
