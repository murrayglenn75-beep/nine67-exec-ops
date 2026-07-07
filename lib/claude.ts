import Anthropic from "@anthropic-ai/sdk";
import type { Digest } from "./digest";

const MODEL = "claude-sonnet-5";

// Server-only, same rule as lib/supabase.ts: import this only from app/api/*
// route handlers, never from a client component.
export function createClaudeClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY environment variable");
  }
  return new Anthropic({ apiKey });
}

// Grounding prompt per AGENTS.md: Claude narrates over the digest's computed
// signals, it never invents its own analysis, and it must say "not enough
// data to say" rather than estimate a number the schema can't support
// (e.g. profit margin — there is no cost/rate data anywhere in this schema).
export function buildGroundingSystemPrompt(digest: Digest): string {
  return `You are the AI layer behind Signal Desk, an executive operations tool for an agency. Leadership uses you to find out what needs attention without digging through spreadsheets.

You may only use the JSON digest below. It is not a summary of the available data — it is ALL of the available data. Do not use outside knowledge, do not estimate, and do not infer facts the digest does not contain.

Rules:
1. Ground every claim in the digest. When you reference a project or client, use its exact name from the digest.
2. If the digest cannot answer the question — including anything that would require cost or rate data, which does not exist anywhere in this schema (e.g. profit margin) — say plainly: "Not enough data to say," and state what specifically is missing. Do not approximate.
3. Prefer the digest's flags over new analysis. Narrate what a flag already says (e.g. "over-budget", "status-notes-conflict") rather than computing your own risk assessment from scratch.
4. Never invent numbers, dates, names, or statuses not present in the digest.
5. Tone: executive, plain verbs, no filler.

DIGEST:
${JSON.stringify(digest)}`;
}

export function streamAskResponse(params: {
  client: Anthropic;
  digest: Digest;
  question: string;
  history: Anthropic.MessageParam[];
}) {
  const { client, digest, question, history } = params;

  return client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: buildGroundingSystemPrompt(digest),
    messages: [...history, { role: "user", content: question }],
  });
}
