import { createServerSupabaseClient } from "@/lib/supabase";
import { computeProjectSignals, type ProjectRow, type TeamRow } from "@/lib/signals";
import { FlagPill } from "@/app/components/FlagPill";
import { BriefPanel } from "@/app/components/BriefPanel";

export const dynamic = "force-dynamic";

interface ClientRow {
  id: number;
  name: string;
  industry: string | null;
  created_at: string;
}

export default async function Home() {
  const supabase = createServerSupabaseClient();

  const [projectsRes, teamRes, clientsRes] = await Promise.all([
    supabase.from("projects").select("*"),
    supabase.from("team").select("*"),
    supabase.from("clients").select("*"),
  ]);

  if (projectsRes.error) throw projectsRes.error;
  if (teamRes.error) throw teamRes.error;
  if (clientsRes.error) throw clientsRes.error;

  const projects = (projectsRes.data ?? []) as ProjectRow[];
  const team = (teamRes.data ?? []) as TeamRow[];
  const clients = (clientsRes.data ?? []) as ClientRow[];
  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

  const signals = computeProjectSignals(projects, team);
  const attentionItems = signals
    .filter((item) => item.flags.length >= 2)
    .sort((a, b) => b.orderingScore - a.orderingScore);

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
