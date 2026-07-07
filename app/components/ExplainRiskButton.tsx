"use client";

import { useState } from "react";

export function ExplainRiskButton({ projectId }: { projectId: number }) {
  const [expanded, setExpanded] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchExplanation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as { explanation: string };
      setExplanation(data.explanation);
    } catch {
      setError("Couldn't generate an explanation. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && !explanation && !loading) void fetchExplanation();
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggle}
        className="font-mono text-[11px] uppercase tracking-wide text-accent hover:text-accent/80"
      >
        {expanded ? "Hide explanation" : "Explain risk"}
      </button>

      {expanded && (
        <div className="mt-2">
          {loading && <p className="text-sm text-zinc-500">Thinking…</p>}
          {error && <p className="text-sm text-orange-300">{error}</p>}
          {explanation && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
              {explanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
