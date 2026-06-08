-- 0001_init.sql
-- Core tables for the Nimbus waitlist + A/B test.
-- Run against Supabase (Postgres).

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ============================================================
-- ab_assignments — one row per unique visitor session.
-- This is the DENOMINATOR for conversion-rate math.
-- ============================================================
create table if not exists public.ab_assignments (
  session_id  uuid        primary key default gen_random_uuid(),
  experiment  text        not null,
  variant     text        not null check (variant in ('A', 'B')),
  referrer    text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists ab_assignments_experiment_variant_idx
  on public.ab_assignments (experiment, variant);

-- ============================================================
-- waitlist_signups — the conversion event.
-- session_id FK ties a signup back to the variant the visitor saw.
-- ============================================================
create table if not exists public.waitlist_signups (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null,
  session_id  uuid        references public.ab_assignments (session_id) on delete set null,
  experiment  text,
  variant     text        check (variant in ('A', 'B')),
  source      text,        -- 'hero' | 'final' | ...
  referrer    text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- One signup per email (case-insensitive). A repeat submit is treated as
-- "already joined" by the server (catches unique_violation = 23505).
create unique index if not exists waitlist_signups_email_unique_idx
  on public.waitlist_signups (lower(email));

create index if not exists waitlist_signups_experiment_variant_idx
  on public.waitlist_signups (experiment, variant);

-- ============================================================
-- ab_events — optional generic event log (button clicks, scroll, etc.)
-- ============================================================
create table if not exists public.ab_events (
  id          bigint generated always as identity primary key,
  session_id  uuid,
  experiment  text,
  variant     text,
  event_type  text        not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists ab_events_event_type_idx on public.ab_events (event_type);
create index if not exists ab_events_session_idx     on public.ab_events (session_id);
