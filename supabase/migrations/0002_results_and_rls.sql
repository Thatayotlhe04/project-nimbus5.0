-- 0002_results_and_rls.sql
-- Reporting view + row-level-security lockdown.

-- ============================================================
-- ab_results — conversion rate per variant, ready to read.
--   visitors        = unique assignments
--   signups         = unique conversions
--   conversion_pct  = signups / visitors * 100
-- Query it directly:  select * from ab_results;
-- ============================================================
create or replace view public.ab_results as
select
  a.experiment,
  a.variant,
  count(distinct a.session_id) as visitors,
  count(distinct s.id)         as signups,
  round(
    100.0 * count(distinct s.id) / nullif(count(distinct a.session_id), 0),
    2
  )                            as conversion_pct
from public.ab_assignments a
left join public.waitlist_signups s
  on s.session_id = a.session_id
group by a.experiment, a.variant
order by a.experiment, a.variant;

-- ============================================================
-- Row Level Security.
-- The Express server uses the SERVICE ROLE key, which bypasses RLS.
-- We enable RLS and add NO permissive policies, so the public/anon key
-- can neither read nor write these tables directly. If you ever want the
-- browser to read aggregate results, expose ab_results through a SECURITY
-- DEFINER RPC instead of opening the base tables.
-- ============================================================
alter table public.ab_assignments  enable row level security;
alter table public.waitlist_signups enable row level security;
alter table public.ab_events        enable row level security;
