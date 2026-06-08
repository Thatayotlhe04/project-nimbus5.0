# Nimbus

A student accommodation marketplace for Gaborone — campus-based search, a live
map, combi-route convenience scoring, and a booking flow with **escrow** paid by
mobile money. Express + Supabase, with an A/B-tested marketing landing page.

> **What's real vs. simulated** — so you always know what you're shipping:
> - **Real & working now:** campus search, room-type/budget/combi/verified filters,
>   ranking, the live map, commute estimates, the booking + **escrow state machine**,
>   the fee math, A/B testing, Supabase persistence, the **Heisenberg API client**
>   (calls Nubia, falls back to a local scorer), and the **payments module** (3
>   provider adapters + settlement config + webhook seam).
> - **Needs your accounts to move real money:** live mobile-money collection
>   (Orange Money / MyZaka / Smega) requires a **merchant account + API credentials**
>   per provider — those can't be created from code. `PAYMENTS_MODE=simulate`
>   (default) captures instantly so the whole flow works today; `live` mode has the
>   real-call seam clearly marked in `payments/providers.js`. Commute times are
>   distance-based estimates, not a transit-routing API.

```
nimbus/
├─ public/
│  ├─ index.html         landing page (A/B tested)
│  ├─ browse.html        campus search + filters + live map
│  ├─ listing.html       listing detail + commute + combi routes
│  ├─ book.html          booking + escrow + mobile-money
│  ├─ confirmation.html  escrow status + move-in verification
│  ├─ pricing.html       revenue model + live profit calculator
│  ├─ about.html         mission / story / values
│  ├─ landlord.html      plan picker + subscription signup
│  ├─ legal-*.html       privacy · terms · cookies
│  ├─ chrome.js          cookie-consent banner + shared footer
│  ├─ app.css            shared design system
│  └─ images/            drop your illustrations here
├─ server.js             Express app (pages + APIs)
├─ ab.js                 A/B experiment config
├─ geo.js                distance + commute estimates
├─ heisenberg.js         local combi-scoring heuristic (fallback)
├─ nubia.js              Heisenberg API client → Nubia (with local fallback)
├─ payments/providers.js Orange Money / MyZaka / Smega + settlement
├─ payments/subscriptions.js  recurring plans (landlord Pro, uni portal)
├─ fees.js               escrow / fee math (single source of truth)
├─ marketplace.js        enrich + filter + rank listings
├─ db.js                 data layer (Supabase OR in-memory fallback)
├─ data/seed.js          campuses, combi routes, listings
├─ scripts/gen-seed-sql.js   compiles seed.js → 0004_seed.sql
├─ supabase/migrations/  0001 waitlist/AB · 0002 results+RLS · 0003 marketplace · 0004 seed · 0005 subscriptions
└─ test/                 node:test suites (ab, server, marketplace, bookings, integrations, subscriptions)
```

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 43 tests
npm start            # production mode
```

**No Supabase credentials needed to try it** — the server falls back to an
in-memory store seeded from `data/seed.js`, so search, booking and escrow all
work immediately. Data won't persist across restarts until you connect Supabase.

## The product

### Campus search + map (`/browse`)
Pick your university and listings are re-ranked by how painless the daily commute
is — best **combi convenience** first, then shortest trip, then verified, then
price. The map plots every home plus your campus; filters for room type, max
rent, "has a direct combi", and "verified only" all sync to the URL so searches
are shareable.

### Room types
`studio` (independent studio) · `private` (private room, shared kitchen) ·
`shared` (shared room).

### Combi-route mapping — "Heisenberg AI" (Nubia × Nimbus)
Combi convenience (0–100) is owned by **Nubia's Heisenberg engine**. Nimbus calls
it over HTTP via `nubia.js`, sending each listing/campus/route set and getting back
scores, the routes that make the trip work, and (optionally) a one-line natural-
language tip from Gemini. If `HEISENBERG_API_URL`/`HEISENBERG_API_KEY` are unset or
Nubia is unreachable, `nubia.js` **falls back to the bundled local heuristic**
(`heisenberg.js`) so the site never breaks. Each result is tagged
`source: "nubia" | "local"`.

The Nubia side of this lives in the Nubia repo at
`src/app/api/heisenberg/combi-score/route.ts` (engine in
`src/lib/heisenberg/combi-routing.ts`). Set the **same** `HEISENBERG_API_KEY` in
both apps.

### Booking protection (escrow)
`POST /api/bookings` collects the deposit + first month into **Nimbus escrow** and
records the booking as `held_in_escrow`. The landlord is **not** paid until the
student taps *"I've moved in"* on the confirmation page (`/booking/:ref`), which
transitions the booking to `released`. If the room isn't as described, `refunded`.
The state machine only allows `held_in_escrow → released | refunded`.

### Payments (`payments/providers.js`)
Students pay by **Orange Money, MyZaka, or Smega**. `collect()` dispatches to a
per-provider adapter:
- `PAYMENTS_MODE=simulate` (default) → instant capture, so booking → escrow works
  end-to-end with no credentials.
- `PAYMENTS_MODE=live` → each adapter has the exact spot to call the provider's
  collection API (OAuth/merchant keys via env). A `pending` capture is confirmed by
  the provider calling `POST /api/payments/:provider/webhook`.

### Subscriptions (`payments/subscriptions.js`)
Recurring revenue on top of the per-booking fees. Two monthly plans —
**Landlord Pro (P299)** and **University Portal (P4,999)** — billed through the
same mobile-money adapters (so simulate/live behave identically) and settling to
the same bank account. `/landlord` is the plan-picker + signup page. One active
subscription per account; starting again upgrades/renews it, and cancelling stops
auto-renew while leaving the plan active until the period ends.

**Settlement** (where money lands) is your bank, set via `SETTLEMENT_ACCOUNT_NUMBER`
in `.env`. `GET /api/payments/info` exposes the mode, providers, and the *masked*
account (e.g. `•••••••••0700`) for the UI. Real payouts require a **merchant
agreement** with each provider — the code can't create those.

### Fees (`fees.js`, one source of truth)
- **Tenant service fee:** 8% of one month's rent, clamped to **P150–P300** (one-time).
- **Landlord commission:** **6%** of rent, taken from the landlord's payout when
  escrow releases (not charged to the student).
- **Held in escrow:** first month's rent + refundable deposit.

See the **`/pricing`** page for the full revenue model and a live calculator.

### Content & legal pages
`/about` (mission), `/pricing` (revenue model + calculator), and `/legal/privacy`,
`/legal/terms`, `/legal/cookies` (Botswana-aware **templates** — have a lawyer
review before launch). A cookie-consent banner (`chrome.js`) shows on every page
and stores the choice in `nimbus_cookie_consent`.

## A/B test
One experiment (`hero_headline_v1`) on the hero headline + CTA, assigned 50/50
server-side via a sticky cookie (no flicker), with conversion tracked through
waitlist signups. Read results:

```bash
curl localhost:3000/api/stats -H "x-admin-token: YOUR_ADMIN_TOKEN"
# or in Supabase:  select * from ab_results;
```
Change the test by editing the variant strings in `ab.js`; start a fresh test by
bumping the experiment `id`. (Raw rates only — wait for a few hundred visitors per
variant before calling a winner.)

## Supabase setup

1. Create a project at supabase.com.
2. Run the migrations in order (SQL editor or `supabase db push`):
   `0001 → 0002 → 0003 → 0004_seed`.
   Regenerate the seed any time the data changes: `npm run seed:sql`.
3. `.env` (copy from `.env.example`):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service role — server-side only,
     never expose to the browser; it bypasses RLS)
   - `ADMIN_TOKEN` (`openssl rand -hex 24`) for the stats endpoint
   - `HEISENBERG_API_URL` + `HEISENBERG_API_KEY` to use Nubia's engine (blank =
     local fallback); `HEISENBERG_INSIGHT=true` to request Gemini tips
   - `PAYMENTS_MODE` (`simulate`/`live`) and `SETTLEMENT_ACCOUNT_NUMBER` (your
     Access Bank account — **keep `.env` out of git**; `.gitignore` already does)

RLS is enabled on every table with no public policies — only the server (service
role) can read/write. Optional public-read policies for the catalogue are included
but commented out in `0003`.

## Add your images
Drop into `public/images/` (exact names): `hero-students.png`,
`neighbourhood.png`, `support.png`. The neighbourhood image uses
`mix-blend-mode: multiply` to melt into the page — remove that line in the
landing CSS if your illustration has a dark background.

## API reference

| Method | Path                          | Purpose                                   |
| ------ | ----------------------------- | ----------------------------------------- |
| GET    | `/`                           | Landing page (A/B rendered)               |
| GET    | `/browse` `/listing/:id` `/book/:id` `/booking/:ref` | App pages         |
| GET    | `/pricing` `/landlord` `/about` `/legal/{privacy,terms,cookies}` | Content + legal |
| GET    | `/api/campuses`               | All campuses                              |
| GET    | `/api/listings`               | Filter/rank: `campus,roomType,maxRent,combiOnly,verifiedOnly` |
| GET    | `/api/listings/:id`           | One listing (`?campus=` for commute)      |
| POST   | `/api/bookings`               | Collect payment → create booking → escrow |
| GET    | `/api/bookings/:idOrRef`      | Booking + its listing                     |
| POST   | `/api/bookings/:idOrRef/verify` | Release escrow to landlord              |
| POST   | `/api/bookings/:idOrRef/refund` | Refund the student                      |
| GET    | `/api/payments/info`          | Mode, providers, masked settlement        |
| POST   | `/api/payments/:provider/webhook` | Provider confirmation (live mode)     |
| GET    | `/api/subscriptions/plans`    | Available monthly plans                   |
| POST   | `/api/subscriptions/start`    | Charge + activate a plan                  |
| GET    | `/api/subscriptions/:userId`  | Active plan + renewal date                |
| POST   | `/api/subscriptions/:userId/cancel` | Stop auto-renew                     |
| POST   | `/api/waitlist`               | Waitlist signup (A/B conversion)          |
| GET    | `/api/stats`                  | A/B results (admin token)                 |
| GET    | `/healthz`                    | Liveness + Supabase status                |

## Roadmap (business model, not yet built)
Moving/combi affiliate checkout (15%), prepaid BPC electricity top-ups
(micro-commission), paid verified inspections (P250), a landlord dashboard.
The landlord-Pro and university-portal subscriptions are now built (see above).
