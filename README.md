

# Signal Desk

AI-powered executive operations tool for a growing agency. Built with Next.js, TypeScript, Tailwind, Supabase, and the Claude API, deployed on Vercel.

Live demo: https://nine67-exec-ops.vercel.app
Demo login: demo@signaldesk.app

## Stack

Next.js App Router, TypeScript, Tailwind CSS, Supabase (Postgres and Auth), Anthropic Claude API, deployed on Vercel, built with Claude Code.

## What's here

This Week: weekly AI brief plus an attention rail of flagged projects.
Projects: every project with computed signal flags and an explain-risk button.
Clients: client roster with flagged projects, includes an intentional duplicate client to test messy-data handling.
Capacity: team allocation versus capacity, over-allocated leads flagged.
Ask: grounded chat that says not enough data to say when the schema cannot answer.

## Running locally

npm install
Create .env.local with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
Run supabase/seed.sql in the Supabase SQL Editor
npm run dev
Visit http://localhost:3000

## Tests

npm test

See NOTES.md for assumptions, what gave me pause, and what I would build next.