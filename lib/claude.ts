import Anthropic from "@anthropic-ai/sdk";
import type { Digest, DigestProject } from "./digest";

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

const BRIEF_INSTRUCTION =
  "Write this week's executive brief in exactly 4 short paragraphs, covering in order: (1) what needs attention this week, (2) client risk, (3) capacity and allocation issues, (4) revenue at risk this quarter. Each paragraph is at most 3 sentences — synthesize and name only the highest-priority items per section, not every flagged project. Plain prose, no headers or bullet lists.";

export async function generateWeeklyBrief(params: {
  client: Anthropic;
  digest: Digest;
}): Promise<string> {
  const { client, digest } = params;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: buildGroundingSystemPrompt(digest),
    messages: [{ role: "user", content: BRIEF_INSTRUCTION }],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export async function explainProjectRisk(params: {
  client: Anthropic;
  digest: Digest;
  project: DigestProject;
}): Promise<string> {
  const { client, digest, project } = params;

  const instruction = `Explain the risk on "${project.name}" (client: ${project.client}) in under 120 words. Cover, as flowing prose (no headers or bullet lists): (1) what's driving the risk, citing the specific flags and numbers behind it, (2) what's uncertain or missing in the data for this project, (3) one concrete, specific next action to recommend. Executive tone.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildGroundingSystemPrompt(digest),
    messages: [{ role: "user", content: instruction }],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
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
