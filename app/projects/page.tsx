import { createServerSupabaseClient } from "@/lib/supabase";
import {
  computeProjectSignals,
  type NormalizedStatus,
  type ProjectRow,
  type ProjectWithSignals,
  type TeamRow,
} from "@/lib/signals";
import { FlagPill } from "@/app/components/FlagPill";
import { ExplainRiskButton } from "@/app/components/ExplainRiskButton";

export const dynamic = "force-dynamic";

interface ClientRow {
  id: number;
  name: string;
  industry: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<NormalizedStatus, string> = {
  ok: "On Track",
  risk: "At Risk",
  unclear: "Unclear",
};

const STATUS_DOT_CLASS: Record<NormalizedStatus, string> = {
  ok: "bg-emerald-400",
  risk: "bg-orange-500",
  unclear: "bg-accent",
};

function formatParsedDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function formatBRL(amount: number): string {
  return currencyFormatter.format(amount);
}

export default async function ProjectsPage() {
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
  const sorted = [...signals].sort((a, b) => b.orderingScore - a.orderingScore);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
        <header className="mb-10 flex items-baseline justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="font-sans text-3xl font-semibold tracking-tight text-zinc-50">
              Projects
            </h1>
          </div>
          <p className="font-mono text-xs text-zinc-500">
            {sorted.length} tracked
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((item) => (
            <ProjectCard
              key={item.project.id}
              item={item}
              clientName={clientNameById.get(item.project.client_id) ?? "Unknown client"}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function ProjectCard({
  item,
  clientName,
}: {
  item: ProjectWithSignals;
  clientName: string;
}) {
  const { project, normalizedStatus, dueDate, burnRate, flags } = item;

  const rawStatus = project.status?.trim() ?? null;
  const showRawStatus =
    rawStatus !== null && rawStatus.toLowerCase() !== STATUS_LABEL[normalizedStatus].toLowerCase();

  const isLeadMissing = flags.some((f) => f.code === "missing-lead");

  return (
    <article className="border-l-2 border-l-accent/40 rounded-md border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-sans text-lg font-semibold leading-snug text-zinc-50">
            {project.name}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">{clientName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-700/60 bg-zinc-800/40 px-2.5 py-1">
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASS[normalizedStatus]}`} />
          <span className="font-mono text-[11px] uppercase tracking-wide text-zinc-300">
            {STATUS_LABEL[normalizedStatus]}
            {showRawStatus && (
              <span className="text-zinc-500"> ({rawStatus})</span>
            )}
          </span>
        </div>
      </div>

      <dl className="mb-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <dt className="text-zinc-500">Due</dt>
          <dd className="font-mono text-zinc-200">
            {dueDate.kind === "iso" || dueDate.kind === "dmy" ? (
              formatParsedDate(dueDate.date as Date)
            ) : dueDate.kind === "recurring" ? (
              <span className="text-zinc-400">Monthly (recurring)</span>
            ) : (
              <span className="italic text-accent/80">
                {dueDate.raw ? `"${dueDate.raw}"` : "not set"} — unparseable
              </span>
            )}
          </dd>
        </div>

        <div className="flex items-center justify-between text-sm">
          <dt className="text-zinc-500">Lead</dt>
          <dd
            className={
              isLeadMissing
                ? "font-mono text-sm italic text-orange-300"
                : "font-mono text-sm text-zinc-200"
            }
          >
            {isLeadMissing ? "Unassigned" : project.lead}
          </dd>
        </div>

        <BurnBar budget={project.budget} spent={project.spent} burnRate={burnRate} />
      </dl>

      {flags.length > 0 && (
        <div className="border-t border-zinc-800 pt-4">
          <div className="flex flex-wrap gap-1.5">
            {flags.map((flag) => (
              <FlagPill key={flag.code} flag={flag} />
            ))}
          </div>
          <ExplainRiskButton projectId={project.id} />
        </div>
      )}
    </article>
  );
}

function BurnBar({
  budget,
  spent,
  burnRate,
}: {
  budget: number | null;
  spent: number | null;
  burnRate: number | null;
}) {
  if (budget == null) {
    return (
      <div className="text-sm">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Budget</span>
          <span className="font-mono italic text-zinc-500">no budget recorded</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full rounded-full border border-dashed border-zinc-700" />
      </div>
    );
  }

  const pct = burnRate == null ? 0 : burnRate * 100;
  const barWidth = Math.min(pct, 100);
  const barColor =
    burnRate != null && burnRate >= 1
      ? "bg-orange-500"
      : burnRate != null && burnRate >= 0.9
        ? "bg-accent"
        : "bg-accent/50";

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between">
        <span className="text-zinc-500">Budget</span>
        <span className="font-mono text-zinc-200">
          {spent != null ? formatBRL(spent) : "—"} / {formatBRL(budget)}
          {burnRate != null && (
            <span className="ml-1.5 text-zinc-500">({Math.round(pct)}%)</span>
          )}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}
