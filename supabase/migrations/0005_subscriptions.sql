-- 0005_subscriptions.sql — recurring plans (landlord Pro, university portal).

create table if not exists public.subscriptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null unique,
  tier             text not null check (tier in ('landlord_pro','university_portal')),
  status           text not null default 'active' check (status in ('active','expired','canceled')),
  amount_bwp       numeric not null,
  interval         text not null default 'monthly',
  payment_provider text not null check (payment_provider in ('orange_money','smega','myzaka')),
  provider_ref     text,
  billing_phone    text,
  started_at       timestamptz not null default now(),
  renews_at        timestamptz,
  auto_renew       boolean not null default true,
  canceled_at      timestamptz
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

-- RLS on, no public policies: only the server (service role) touches this table.
alter table public.subscriptions enable row level security;
