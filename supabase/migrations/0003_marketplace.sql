-- 0003_marketplace.sql
-- Listings marketplace + bookings (escrow) schema.

-- ============================================================
-- campuses
-- ============================================================
create table if not exists public.campuses (
  id    text primary key,
  name  text not null,
  short text not null,
  lat   double precision not null,
  lng   double precision not null
);

-- ============================================================
-- combi_routes — pickups is a jsonb array of {lat,lng} points;
-- serves_campus_ids lists the campuses the route reaches.
-- ============================================================
create table if not exists public.combi_routes (
  id                text primary key,
  name              text not null,
  color             text,
  fare              numeric(6,2) not null,
  serves_campus_ids text[] not null,
  pickups           jsonb  not null
);

-- ============================================================
-- listings
-- ============================================================
create table if not exists public.listings (
  id            text primary key,
  title         text not null,
  neighbourhood text not null,
  room_type     text not null check (room_type in ('studio','private','shared')),
  rent          numeric(10,2) not null,
  deposit       numeric(10,2) not null,
  verified      boolean not null default false,
  beds          int not null default 1,
  baths         int not null default 1,
  amenities     jsonb not null default '[]'::jsonb,
  description   text,
  lat           double precision not null,
  lng           double precision not null,
  created_at    timestamptz not null default now()
);
create index if not exists listings_room_type_idx on public.listings (room_type);
create index if not exists listings_rent_idx       on public.listings (rent);

-- ============================================================
-- bookings — escrow state machine
--   held_in_escrow -> released  (student verifies move-in)
--   held_in_escrow -> refunded  (dispute / no-show)
-- ============================================================
create table if not exists public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  reference           text unique not null,
  listing_id          text references public.listings (id),
  student_name        text not null,
  student_email       text not null,
  student_phone       text,
  move_in_date        date not null,
  room_type           text,
  rent                numeric(10,2) not null,
  deposit             numeric(10,2) not null,
  service_fee         numeric(10,2) not null,
  escrow_held         numeric(10,2) not null,
  total_paid          numeric(10,2) not null,
  platform_commission numeric(10,2) not null,
  landlord_payout     numeric(10,2) not null,
  payment_provider    text not null check (payment_provider in ('orange_money','smega','myzaka')),
  provider_ref        text,
  status              text not null default 'held_in_escrow'
                        check (status in ('held_in_escrow','released','refunded','cancelled')),
  created_at          timestamptz not null default now(),
  verified_at         timestamptz,
  refunded_at         timestamptz
);
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_email_idx   on public.bookings (lower(student_email));

-- ============================================================
-- RLS. The Express server uses the service role key (bypasses RLS).
-- Anon/public key gets nothing by default. If you later want the browser
-- to read the public catalogue directly from Supabase, uncomment the
-- read policies below — but keep bookings locked to the server.
-- ============================================================
alter table public.campuses     enable row level security;
alter table public.combi_routes enable row level security;
alter table public.listings     enable row level security;
alter table public.bookings     enable row level security;

-- create policy "public read campuses"  on public.campuses     for select using (true);
-- create policy "public read routes"     on public.combi_routes for select using (true);
-- create policy "public read listings"   on public.listings     for select using (true);
