# Nimbus-Habor

Nimbus-Habor is a landing page and early-access concept for student accommodation around Gaborone, Botswana.

## Database direction

Nimbus-Habor is planned around Supabase, not Firebase. The first production table should capture waitlist interest, then the schema can expand into student profiles, landlord profiles, accommodation posts, messages, receipts, reviews, and policy records.

Suggested initial table:

```sql
create table waitlist_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  role text not null,
  message text,
  campus_preference text,
  budget_preference text,
  move_in_preference text,
  accommodation_preference text,
  source text not null default 'landing_page',
  created_at timestamptz not null default now()
);
```

## Local checks

```bash
npm run check
npm run serve
```

## Supabase waitlist wiring

The landing page can write directly to Supabase REST when these values are provided by the deployment shell before `app.js` runs:

```html
<script>
  window.NIMBUSHABOR_SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
  window.NIMBUSHABOR_SUPABASE_ANON_KEY = 'YOUR_PUBLIC_ANON_KEY';
</script>
```

The older `window.NIMBUS_SUPABASE_URL` and `window.NIMBUS_SUPABASE_ANON_KEY` names are still accepted as fallbacks. If the values are not present, the form keeps the preview experience working by saving the most recent lead locally in the browser.

## Recommended RLS

The full starter SQL, including row-level security policies that allow public inserts while keeping submitted leads private, lives in `supabase/schema.sql`.
