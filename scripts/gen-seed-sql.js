// scripts/gen-seed-sql.js
// Compiles data/seed.js into supabase/migrations/0004_seed.sql so the SQL
// seed and the in-memory seed can never drift. Run: npm run seed:sql
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { campuses, routes, listings } from '../data/seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '..', 'supabase', 'migrations', '0004_seed.sql');

const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const jsonb = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const arr = (a) => `array[${a.map(q).join(', ')}]`;

let sql = `-- 0004_seed.sql  (AUTO-GENERATED from data/seed.js — do not edit by hand)
-- Regenerate with: npm run seed:sql
-- Idempotent: re-running upserts the same rows.

`;

// campuses
sql += '-- campuses\n';
for (const c of campuses) {
  sql += `insert into public.campuses (id, name, short, lat, lng) values (${q(c.id)}, ${q(c.name)}, ${q(c.short)}, ${c.lat}, ${c.lng})\n` +
         `  on conflict (id) do update set name=excluded.name, short=excluded.short, lat=excluded.lat, lng=excluded.lng;\n`;
}

// combi_routes
sql += '\n-- combi_routes\n';
for (const r of routes) {
  sql += `insert into public.combi_routes (id, name, color, fare, serves_campus_ids, pickups) values ` +
         `(${q(r.id)}, ${q(r.name)}, ${q(r.color)}, ${r.fare}, ${arr(r.servesCampusIds)}, ${jsonb(r.pickups)})\n` +
         `  on conflict (id) do update set name=excluded.name, color=excluded.color, fare=excluded.fare, ` +
         `serves_campus_ids=excluded.serves_campus_ids, pickups=excluded.pickups;\n`;
}

// listings
sql += '\n-- listings\n';
for (const l of listings) {
  sql += `insert into public.listings (id, title, neighbourhood, room_type, rent, deposit, verified, beds, baths, amenities, description, lat, lng) values ` +
         `(${q(l.id)}, ${q(l.title)}, ${q(l.neighbourhood)}, ${q(l.roomType)}, ${l.rent}, ${l.deposit}, ${l.verified}, ${l.beds}, ${l.baths}, ${jsonb(l.amenities)}, ${q(l.description)}, ${l.lat}, ${l.lng})\n` +
         `  on conflict (id) do update set title=excluded.title, neighbourhood=excluded.neighbourhood, room_type=excluded.room_type, ` +
         `rent=excluded.rent, deposit=excluded.deposit, verified=excluded.verified, beds=excluded.beds, baths=excluded.baths, ` +
         `amenities=excluded.amenities, description=excluded.description, lat=excluded.lat, lng=excluded.lng;\n`;
}

fs.writeFileSync(out, sql);
console.log(`Wrote ${out}\n  ${campuses.length} campuses, ${routes.length} routes, ${listings.length} listings`);
