"use client";

import { useState } from "react";

export function BriefPanel() {
  const [brief, setBrief] = useState<string | null>(null);
  const [weekLabel, setWeekLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/brief", { method: "POST" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as { brief: string };
      setBrief(data.brief);
      setWeekLabel(
        new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      );
    } catch {
      setError("Couldn't generate the brief. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-sans text-lg font-semibold text-zinc-50">Weekly Brief</h2>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Generating…" : "Generate this week's brief"}
        </button>
      </div>

      {error && <p className="text-sm text-orange-300">{error}</p>}

      {brief ? (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/50">
          <div className="border-b border-zinc-800 px-6 py-3 font-mono text-[11px] uppercase tracking-wide text-zinc-500">
            Memo — Week of {weekLabel}
          </div>
          <div className="whitespace-pre-wrap px-6 py-5 text-sm leading-relaxed text-zinc-200">
            {brief}
          </div>
        </div>
      ) : (
        !loading &&
        !error && (
          <p className="text-sm text-zinc-500">
            Generate a grounded summary of what needs attention, client risk, capacity issues,
            and revenue at risk this quarter.
          </p>
        )
      )}
    </section>
  );
}
