-- =============================================================================
-- Signal Desk — schema + seed data
-- =============================================================================
-- Run this whole file in the Supabase SQL Editor. It drops and recreates
-- everything, so it's safe to re-run any time you want to reset to a known
-- state.
--
-- THE MESS IN THIS DATA IS DELIBERATE. Per AGENTS.md: "Signals before AI" —
-- lib/signals.ts must compute flags (staleness, burn rate, status-vs-notes
-- conflicts, missing data, over-allocation) from real-world-shaped data, and
-- the AI narrates over those signals rather than inventing analysis. That
-- only works if the seed data actually contains the mess a real agency's
-- spreadsheets would have:
--   - status values entered inconsistently by different people over time
--     ("On Track" vs "on-track" vs "Green" vs "??" vs left blank)
--   - due dates typed as free text, not picked from a date widget
--     (ISO dates, DD/MM/YYYY, "June 2", "monthly" for recurring work)
--   - a project with no budget entered yet
--   - a client whose name was typed two different ways by two different
--     account people, creating a phantom "duplicate client" problem
--   - a project whose lead left the agency and was never reassigned
--
-- Do NOT "clean up" this file to make the seed data look nicer. That defeats
-- the point of the exercise — the signal engine and the grounding prompt are
-- supposed to handle exactly this kind of mess gracefully, not assume tidy
-- input.
-- =============================================================================


-- =============================================================================
-- DROP (idempotent re-run)
-- =============================================================================
drop table if exists q3_revenue_commitments cascade;
drop table if exists projects cascade;
drop table if exists team cascade;
drop table if exists clients cascade;


-- =============================================================================
-- SCHEMA
-- =============================================================================

-- Clients as entered by account staff over time. Note there is no uniqueness
-- constraint on name — see the Meridian Health / Meridian Healthcare rows
-- below. That's not a bug in this schema; it's the bug the product has to
-- surface (missing/duplicate-data signal), not silently fix.
create table clients (
  id         integer primary key,
  name       text not null,
  industry   text,
  created_at timestamptz not null default now()
);

-- Team roster. weekly_capacity_hours is the person's nominal available hours
-- per week, used against projects.hours_per_week to flag over-allocation.
create table team (
  id                    integer primary key,
  name                  text not null,
  role                  text not null,
  email                 text,
  weekly_capacity_hours numeric
);

create table projects (
  id              integer primary key,
  client_id       integer not null references clients(id),
  name            text not null,
  -- Free-text status, entered by whoever last touched the project tracker.
  -- Deliberately inconsistent: "On Track", "on-track", "Green", "??", NULL.
  -- lib/signals.ts normalizes what it can and flags what it can't.
  status          text,
  -- Due date as TEXT, not DATE. Real spreadsheet exports from account teams
  -- mix ISO dates, DD/MM/YYYY, natural language ("June 2"), and recurring
  -- cadences ("monthly"). Parsers must fail gracefully and flag what they
  -- can't parse, not throw.
  due_date        text,
  -- USD. NULL where budget hasn't been finalized with the client yet —
  -- a real gap, not a data-entry oversight, so it must render as a flag,
  -- not a fake zero.
  budget          numeric,
  -- Money already spent against the budget, used for burn-rate signals.
  spent           numeric,
  -- Nominal hours/week the lead has allocated to this project, used against
  -- team.weekly_capacity_hours for the over-allocation signal.
  hours_per_week  numeric,
  -- Free-text lead name (not a FK to team) because the lead can be
  -- "— unassigned —", i.e. someone who no longer exists in the team table.
  lead            text,
  notes           text,
  updated_at      timestamptz not null,
  created_at      timestamptz not null default now()
);

create table q3_revenue_commitments (
  id               integer primary key,
  client_id        integer not null references clients(id),
  committed_month  text not null, -- 'July' | 'August' | 'September'
  -- NULL amount on one row: a verbally committed deal that hasn't been
  -- quantified yet. Missing-data flag, not zero revenue.
  amount           numeric,
  status           text, -- 'Committed' | 'Verbal' | 'At Risk' | 'Closed Won'
  notes            text
);


-- =============================================================================
-- SEED — clients (6 rows, includes the duplicate-spelling client)
-- =============================================================================
insert into clients (id, name, industry) values
  (1, 'Meridian Health',      'Healthcare'),
  -- Same real-world client as #1, typed differently by a second account
  -- person. This is the duplicate-client mess the product must surface.
  (2, 'Meridian Healthcare',  'Healthcare'),
  (3, 'Atlas Foods',          'Consumer Packaged Goods'),
  (4, 'Nordkap Logistics',    'Logistics'),
  (5, 'Bluepeak Retail',      'Retail'),
  (6, 'Vantage Legal',        'Professional Services');


-- =============================================================================
-- SEED — team (6 rows)
-- =============================================================================
-- Note: Sam Ortiz, the former lead on the Vantage Legal rebrand (see
-- projects below), intentionally does NOT appear here — they left the
-- agency and were never re-added or replaced in the tracker.
insert into team (id, name, role, email, weekly_capacity_hours) values
  (1, 'Priya Shah',    'Strategist',   'priya.shah@nine67.agency',    30),
  (2, 'Marcus Webb',   'Producer',     'marcus.webb@nine67.agency',   32),
  (3, 'Dana Kim',      'Designer',     'dana.kim@nine67.agency',      35),
  (4, 'Tom Alves',     'Account Lead', 'tom.alves@nine67.agency',     30),
  (5, 'Ines Duarte',   'Copywriter',   'ines.duarte@nine67.agency',   25),
  (6, 'Leo Farkas',    'Developer',    'leo.farkas@nine67.agency',    35);


-- =============================================================================
-- SEED — projects (10 rows)
-- =============================================================================
insert into projects
  (id, client_id, name, status, due_date, budget, spent, hours_per_week, lead, notes, updated_at)
values
  -- 1: clean-ish baseline, status "On Track"
  (1, 1, 'Website Relaunch', 'On Track', '2026-08-14', 180000, 62000, 12, 'Priya Shah',
    'Kickoff done, on schedule.', now() - interval '3 days'),

  -- 2: lowercase/hyphenated status variant, DD/MM/YYYY due date
  (2, 2, 'Patient Portal Campaign', 'on-track', '15/09/2026', 95000, 41000, 10, 'Tom Alves',
    'Client sign-off pending, otherwise fine.', now() - interval '5 days'),

  -- 3: another status spelling ("Green"), natural-language due date
  (3, 3, 'Q3 Brand Refresh', 'Green', 'June 2', 220000, 205000, 15, 'Dana Kim',
    'Assets in review with client.', now() - interval '10 days'),

  -- 4: "??" status, recurring cadence due date, NULL budget (the required
  -- null-budget row) — scope and money are both still unresolved
  (4, 3, 'Retail Media Push', '??', 'monthly', null, 8000, 8, 'Marcus Webb',
    'Scope unclear, budget still being finalized with client finance team.',
    now() - interval '21 days'),

  -- 5: NULL status entirely, no update in a long time — staleness signal
  (5, 4, 'Fleet Rebrand', null, '2026-07-30', 150000, 30000, 20, 'Ines Duarte',
    'No status update since Q1 handoff.', now() - interval '96 days'),

  -- 6: status/notes conflict candidate — status reads fine-ish, notes say
  -- otherwise; also DD/MM/YYYY due date
  (6, 4, 'Driver Recruitment Campaign', 'At Risk', '10/08/2026', 60000, 51000, 18, 'Leo Farkas',
    'Behind on creative, client pushing timeline.', now() - interval '2 days'),

  -- 7: over-budget and status says Red — Priya Shah's second project, which
  -- combined with #1 (12 + 25 = 37 hrs/week) exceeds her 30 hr capacity
  (7, 5, 'Holiday Launch', 'Red', '2026-11-01', 310000, 338000, 25, 'Priya Shah',
    'Overspent already, escalate to account lead.', now() - interval '1 days'),

  -- 8: healthy, low-drama recurring project
  (8, 5, 'Loyalty App Content', 'On Track', 'monthly', 45000, 19000, 10, 'Dana Kim',
    'Steady drip content, no concerns.', now() - interval '4 days'),

  -- 9: the required leadless project — previous lead left the agency and it
  -- was never reassigned; hours_per_week is NULL since no one is charging
  -- time to it right now
  (9, 6, 'Rebrand & Website', 'on-track', '2026-09-22', 130000, 22000, null, '— unassigned —',
    'Previous lead (Sam Ortiz) left the agency in May; project reassigned pending new lead confirmation.',
    now() - interval '45 days'),

  -- 10: small, clean, on schedule
  (10, 6, 'Litigation Support Microsite', 'Green', '2026-08-01', 40000, 12000, 12, 'Tom Alves',
    'Small scope, on track.', now() - interval '6 days');


-- =============================================================================
-- SEED — Q3 revenue commitments (8 rows across the 6 clients)
-- =============================================================================
insert into q3_revenue_commitments
  (id, client_id, committed_month, amount, status, notes)
values
  (1, 1, 'July',      180000, 'Committed', 'Website relaunch retainer, signed.'),
  (2, 2, 'September',  95000,  'Committed', 'Patient portal campaign, PO received.'),
  (3, 3, 'July',      220000, 'Committed', 'Q3 brand refresh milestone payment.'),
  -- Verbal commitment, amount not yet quantified — missing-data flag, not $0
  (4, 3, 'August',    null,   'Verbal',    'Retail media push scope/budget still TBD with client finance.'),
  (5, 4, 'August',     60000, 'At Risk',   'Client threatening to pause driver recruitment spend.'),
  (6, 5, 'September', 310000, 'Committed', 'Holiday launch, contract signed despite overspend.'),
  (7, 5, 'July',       45000, 'Committed', 'Loyalty app monthly content retainer.'),
  (8, 6, 'August',     40000, 'Verbal',    'Litigation microsite, awaiting signed SOW.');
