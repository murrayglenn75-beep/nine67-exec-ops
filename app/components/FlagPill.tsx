import type { Flag, FlagCode } from "@/lib/signals";

type Tone = "critical" | "warning" | "info";

// Explicit per-code overrides so the pill grouping matches how the desk
// actually wants attention drawn, even where it diverges from the flag's
// raw severity (e.g. a status/notes conflict reads as a mid-tier amber
// nudge here, not full critical red).
const FLAG_TONE_OVERRIDES: Partial<Record<FlagCode, Tone>> = {
  "status-unclear": "critical",
  "missing-lead": "critical",
  "over-budget": "critical",
  stale: "warning",
  "status-notes-conflict": "warning",
};

function toneForFlag(flag: Flag): Tone {
  return FLAG_TONE_OVERRIDES[flag.code] ?? flag.severity;
}

const TONE_CLASS: Record<Tone, string> = {
  critical: "border-orange-600/40 bg-orange-500/10 text-orange-300",
  warning: "border-accent/40 bg-accent/10 text-accent",
  info: "border-zinc-700/60 bg-zinc-800/50 text-zinc-400",
};

export function FlagPill({ flag }: { flag: Flag }) {
  return (
    <span
      title={flag.message}
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${TONE_CLASS[toneForFlag(flag)]}`}
    >
      {flag.code.replace(/-/g, " ")}
    </span>
  );
}
