# AGENTS.md — Signal Desk (Nine-67 Take-Home)

## What this is
AI-powered executive operations tool for an agency. Leadership answers
"what needs attention" without digging through spreadsheets. The AI layer
IS the product; charts/tables are supporting evidence.

## Stack (mandated, do not substitute)
Next.js App Router · TypeScript · Tailwind · Supabase (Postgres + Auth) ·
Anthropic Claude API · Vercel.

## Architecture rules
1. Signals before AI. lib/signals.ts computes deterministic flags
   (staleness, burn rate, status-vs-notes conflicts, missing data,
   over-allocation). AI narrates over computed signals + raw records —
   it never invents analysis from thin air.
2. AI is server-side only. All Claude calls go through app/api/*
   route handlers. ANTHROPIC_API_KEY never reaches the client.
3. Honesty over confidence. The grounding prompt forces "not enough
   data to say" when the data cannot answer (e.g. profit margin — no cost
   data exists). This is a feature, demo it, never patch it away.
4. The mess is intentional. Seed data has inconsistent statuses
   ("On Track"/"on-track"/"??"/null), unparseable dates ("June 2",
   "monthly"), a null budget, duplicate client spellings (Meridian
   Health / Meridian Healthcare), a leadless project. Do NOT clean it.
   Handle it: due dates are text columns, parsers fail gracefully,
   unparseable values become flags.
5. Flags over fake precision. Prefer explainable flags to opaque
   composite scores. If a risk score exists, label it a heuristic ordering.

## Layout
- lib/signals.ts — deterministic signal engine (unit tested)
- lib/digest.ts — Supabase -> signals -> compact JSON context for Claude
- lib/claude.ts — Anthropic client + grounding prompt
- app/api/brief|ask|explain/route.ts — the three AI endpoints (stream chat)
- app/(dashboard) pages: this-week, projects, clients, capacity, ask —
  server components fetch, small "use client" islands interact
- supabase/seed.sql — schema + intentionally messy seed, commented

## Environment
Supabase keys use the new format: NEXT_PUBLIC_SUPABASE_ANON_KEY holds an
sb_publishable_ key, SUPABASE_SERVICE_ROLE_KEY holds an sb_secret_ key.
supabase-js accepts these transparently.

## Conventions
- Server components by default; "use client" only where interactive.
- Currency BRL. "Today" for staleness math = server date.
- Keep AI context small: digest, not row dumps of everything.
- Tone of UI copy: executive, plain verbs, no filler.
- Dark instrument-panel aesthetic: near-black background, amber accent,
  monospace font for data values.
