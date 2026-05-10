-- Nimbus-Habor initial Supabase schema.
-- Run this in the Supabase SQL editor before wiring the public anon key into the landing page.

create extension if not exists pgcrypto;

create table if not exists public.waitlist_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  email text not null check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  phone text,
  role text not null check (role in ('Student', 'Landlord', 'University partner', 'Parent / guardian')),
  message text,
  campus_preference text,
  budget_preference text,
  move_in_preference text,
  accommodation_preference text,
  source text not null default 'landing_page',
  created_at timestamptz not null default now()
);

alter table public.waitlist_leads enable row level security;

create policy "Anyone can join the waitlist"
  on public.waitlist_leads
  for insert
  to anon, authenticated
  with check (true);

create policy "Waitlist leads are private"
  on public.waitlist_leads
  for select
  to anon, authenticated
  using (false);

create index if not exists waitlist_leads_created_at_idx on public.waitlist_leads (created_at desc);
create index if not exists waitlist_leads_role_idx on public.waitlist_leads (role);
