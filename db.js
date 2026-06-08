// db.js — data access layer.
//
// With SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set, everything hits
// Supabase. Without them, an in-memory store (seeded from data/seed.js)
// is used so the whole site runs locally with zero setup. In-memory data
// is NOT persistent across restarts.

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { campuses as seedCampuses, routes as seedRoutes, listings as seedListings } from './data/seed.js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (url && serviceKey) {
  supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  console.log('[db] Connected to Supabase.');
} else {
  console.warn('[db] No Supabase creds — using in-memory store (data will NOT persist).');
}

export const usingSupabase = () => Boolean(supabase);

// ---------- in-memory store ----------
const mem = {
  assignments: new Map(),
  signups: new Map(),
  events: [],
  bookings: new Map(),
  subscriptions: new Map(), // keyed by user_id
};

const ref = () => 'NMB-' + crypto.randomBytes(3).toString('hex').toUpperCase();

// ============================================================
// Marketplace reads (campuses / routes / listings)
// ============================================================
export async function getCampuses() {
  if (!supabase) return seedCampuses;
  const { data, error } = await supabase.from('campuses').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function getRoutes() {
  if (!supabase) return seedRoutes;
  const { data, error } = await supabase.from('combi_routes').select('*');
  if (error) throw error;
  return data.map((r) => ({
    id: r.id, name: r.name, color: r.color, fare: Number(r.fare),
    servesCampusIds: r.serves_campus_ids, pickups: r.pickups,
  }));
}

export async function getListings() {
  if (!supabase) return seedListings;
  const { data, error } = await supabase.from('listings').select('*');
  if (error) throw error;
  return data.map(rowToListing);
}

export async function getListing(id) {
  if (!supabase) return seedListings.find((l) => l.id === id) || null;
  const { data, error } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToListing(data) : null;
}

function rowToListing(r) {
  return {
    id: r.id, title: r.title, neighbourhood: r.neighbourhood, roomType: r.room_type,
    rent: Number(r.rent), deposit: Number(r.deposit), verified: r.verified,
    beds: r.beds, baths: r.baths, amenities: r.amenities, description: r.description,
    lat: Number(r.lat), lng: Number(r.lng),
  };
}

// ============================================================
// Bookings + escrow state machine
//   held_in_escrow -> released   (student verifies move-in)
//   held_in_escrow -> refunded   (dispute / no-show)
// ============================================================
export async function createBooking(b) {
  const reference = ref();
  const row = {
    reference,
    listing_id: b.listingId,
    student_name: b.studentName,
    student_email: b.studentEmail.toLowerCase(),
    student_phone: b.studentPhone || null,
    move_in_date: b.moveInDate,
    room_type: b.roomType,
    rent: b.breakdown.rent,
    deposit: b.breakdown.deposit,
    service_fee: b.breakdown.serviceFee,
    escrow_held: b.breakdown.escrowHeld,
    total_paid: b.breakdown.totalDueNow,
    platform_commission: b.breakdown.platformCommission,
    landlord_payout: b.breakdown.landlordPayout,
    payment_provider: b.paymentProvider,
    provider_ref: b.providerRef || null,
    status: 'held_in_escrow',
  };

  if (supabase) {
    const { data, error } = await supabase.from('bookings').insert(row).select().single();
    if (error) throw error;
    return data;
  }
  const id = crypto.randomUUID();
  const record = { id, ...row, created_at: new Date().toISOString(), verified_at: null };
  mem.bookings.set(id, record);
  mem.bookings.set(reference, record);
  return record;
}

export async function getBooking(idOrRef) {
  if (supabase) {
    const col = idOrRef.startsWith('NMB-') ? 'reference' : 'id';
    const { data, error } = await supabase.from('bookings').select('*').eq(col, idOrRef).maybeSingle();
    if (error) throw error;
    return data;
  }
  return mem.bookings.get(idOrRef) || null;
}

export async function transitionBooking(idOrRef, toStatus) {
  const allowed = { released: 'verified_at', refunded: 'refunded_at' };
  if (!(toStatus in allowed)) throw new Error('bad status');

  if (supabase) {
    const col = idOrRef.startsWith('NMB-') ? 'reference' : 'id';
    const patch = { status: toStatus, [allowed[toStatus]]: new Date().toISOString() };
    const { data, error } = await supabase
      .from('bookings').update(patch).eq(col, idOrRef)
      .eq('status', 'held_in_escrow')
      .select().maybeSingle();
    if (error) throw error;
    return data;
  }

  const rec = mem.bookings.get(idOrRef);
  if (!rec || rec.status !== 'held_in_escrow') return null;
  rec.status = toStatus;
  rec[allowed[toStatus]] = new Date().toISOString();
  return rec;
}

// ============================================================
// Subscriptions (recurring revenue: landlord Pro, university portal)
//   One active subscription per user_id. Starting again upgrades/renews it.
// ============================================================
const addDays = (n) => new Date(Date.now() + n * 86400_000).toISOString();

export async function upsertSubscription(s) {
  const now = new Date().toISOString();
  const row = {
    user_id: s.userId,
    tier: s.tier,
    status: 'active',
    amount_bwp: s.amountBwp,
    interval: s.interval || 'monthly',
    payment_provider: s.paymentProvider,
    provider_ref: s.providerRef || null,
    billing_phone: s.billingPhone || null,
    started_at: now,
    renews_at: addDays(30),
    auto_renew: true,
    canceled_at: null,
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('subscriptions')
      .upsert(row, { onConflict: 'user_id' })
      .select().single();
    if (error) throw error;
    return data;
  }
  const existing = mem.subscriptions.get(s.userId);
  const record = { id: existing?.id || crypto.randomUUID(), ...row };
  mem.subscriptions.set(s.userId, record);
  return record;
}

export async function getSubscription(userId) {
  if (supabase) {
    const { data, error } = await supabase
      .from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data ? withExpiry(data) : null;
  }
  const rec = mem.subscriptions.get(userId);
  return rec ? withExpiry(rec) : null;
}

// A subscription whose period has lapsed without renewal reads as 'expired'.
function withExpiry(rec) {
  if (rec.status === 'active' && !rec.auto_renew && rec.renews_at && new Date(rec.renews_at) < new Date()) {
    return { ...rec, status: 'expired' };
  }
  return rec;
}

export async function cancelSubscription(userId) {
  if (supabase) {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ auto_renew: false, canceled_at: new Date().toISOString() })
      .eq('user_id', userId).eq('status', 'active')
      .select().maybeSingle();
    if (error) throw error;
    return data;
  }
  const rec = mem.subscriptions.get(userId);
  if (!rec || rec.status !== 'active') return null;
  rec.auto_renew = false;
  rec.canceled_at = new Date().toISOString();
  return rec;
}

// ============================================================
// Waitlist + A/B
// ============================================================
export async function recordAssignment({ sessionId, experiment, variant, referrer, userAgent }) {
  if (supabase) {
    const { error } = await supabase.from('ab_assignments').upsert(
      { session_id: sessionId, experiment, variant, referrer: referrer || null, user_agent: userAgent || null },
      { onConflict: 'session_id', ignoreDuplicates: true }
    );
    if (error) throw error;
    return;
  }
  if (!mem.assignments.has(sessionId)) {
    mem.assignments.set(sessionId, { session_id: sessionId, experiment, variant, created_at: new Date().toISOString() });
  }
}

export async function recordSignup({ email, sessionId, experiment, variant, source, referrer, userAgent }) {
  const lower = email.toLowerCase();
  if (supabase) {
    if (sessionId) {
      await supabase.from('ab_assignments').upsert(
        { session_id: sessionId, experiment, variant },
        { onConflict: 'session_id', ignoreDuplicates: true }
      );
    }
    const { error } = await supabase.from('waitlist_signups').insert({
      email: lower, session_id: sessionId || null, experiment, variant,
      source: source || null, referrer: referrer || null, user_agent: userAgent || null,
    });
    if (error) {
      if (error.code === '23505') return { alreadyJoined: true };
      throw error;
    }
    return { alreadyJoined: false };
  }
  if (mem.signups.has(lower)) return { alreadyJoined: true };
  mem.signups.set(lower, { email: lower, session_id: sessionId, experiment, variant, source, created_at: new Date().toISOString() });
  return { alreadyJoined: false };
}

export async function recordEvent({ sessionId, experiment, variant, eventType, metadata }) {
  if (supabase) {
    const { error } = await supabase.from('ab_events').insert({
      session_id: sessionId || null, experiment, variant, event_type: eventType, metadata: metadata || null,
    });
    if (error) throw error;
    return;
  }
  mem.events.push({ sessionId, experiment, variant, eventType, metadata, created_at: new Date().toISOString() });
}

export async function getStats(experiment) {
  if (supabase) {
    const { data, error } = await supabase.from('ab_results').select('*').eq('experiment', experiment);
    if (error) throw error;
    return data;
  }
  const byVariant = {};
  for (const a of mem.assignments.values()) {
    if (a.experiment !== experiment) continue;
    byVariant[a.variant] ??= { experiment, variant: a.variant, visitors: 0, signups: 0 };
    byVariant[a.variant].visitors++;
  }
  for (const s of mem.signups.values()) {
    if (s.experiment !== experiment) continue;
    byVariant[s.variant] ??= { experiment, variant: s.variant, visitors: 0, signups: 0 };
    byVariant[s.variant].signups++;
  }
  return Object.values(byVariant).map((r) => ({
    ...r, conversion_pct: r.visitors ? Math.round((1000 * r.signups) / r.visitors) / 10 : 0,
  })).sort((a, b) => a.variant.localeCompare(b.variant));
}

export function _resetMemory() {
  mem.assignments.clear(); mem.signups.clear(); mem.events.length = 0; mem.bookings.clear(); mem.subscriptions.clear();
}
