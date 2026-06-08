// nubia.js — Heisenberg client.
//
// Combi-convenience scoring is owned by Nubia's Heisenberg engine. Nimbus
// calls it over HTTP. If HEISENBERG_API_URL / HEISENBERG_API_KEY aren't set,
// or Nubia is unreachable, we fall back to the bundled local heuristic so the
// site never breaks. Either way the server gets the same result shape.

import { scoreCombiConvenience } from './heisenberg.js';

const API_URL = process.env.HEISENBERG_API_URL || '';       // e.g. https://nubia.app/api/heisenberg/combi-score
const API_KEY = process.env.HEISENBERG_API_KEY || '';
const TIMEOUT_MS = Number(process.env.HEISENBERG_TIMEOUT_MS || 4000);
const WANT_INSIGHT = process.env.HEISENBERG_INSIGHT === 'true';

export const heisenbergConfigured = () => Boolean(API_URL && API_KEY);

// Normalise a local heuristic result into the shared shape.
function localScore(listing, campus, routes) {
  const r = scoreCombiConvenience({ listing, campus, routes });
  return {
    score: r.score,
    label: r.label,
    nearestPickupKm: r.nearestPickupKm,
    routes: r.directRoutes.map((x) => ({ id: x.id, name: x.name, color: x.color, fare: x.fare, pickupKm: x.pickupKm })),
    source: 'local',
  };
}

function localAll(listings, campus, routes) {
  const map = {};
  for (const l of listings) map[l.id] = localScore(l, campus, routes);
  return map;
}

/**
 * Score every listing for a campus. Returns { [listingId]: { score, label,
 * nearestPickupKm, routes[], insight?, source } }. Never throws.
 */
export async function scoreListings(listings, campus, routes) {
  if (!campus) return {};
  if (!heisenbergConfigured()) return localAll(listings, campus, routes);

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        campus: { id: campus.id, name: campus.name, lat: campus.lat, lng: campus.lng },
        routes: routes.map((r) => ({
          id: r.id, name: r.name, color: r.color, fare: r.fare,
          servesCampusIds: r.servesCampusIds, pickups: r.pickups,
        })),
        listings: listings.map((l) => ({ id: l.id, lat: l.lat, lng: l.lng })),
        insight: WANT_INSIGHT,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Heisenberg ${res.status}`);

    const data = await res.json();
    const map = {};
    for (const r of data.results || []) {
      map[r.id] = {
        score: r.score,
        label: r.label,
        nearestPickupKm: r.nearestPickupKm,
        routes: (r.directRoutes || []).map((x) => ({ id: x.id, name: x.name, color: x.color, fare: x.fare, pickupKm: x.pickupKm })),
        insight: r.insight,
        source: 'nubia',
      };
    }
    // Any listing the API didn't return (shouldn't happen) gets a local score.
    for (const l of listings) if (!map[l.id]) map[l.id] = localScore(l, campus, routes);
    return map;
  } catch (err) {
    console.warn('[heisenberg] falling back to local scoring:', err.message);
    return localAll(listings, campus, routes);
  }
}
