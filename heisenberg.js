// heisenberg.js — Combi-route convenience scoring.
//
// ┌─────────────────────────────────────────────────────────────────────┐
// │  NUBIA × NIMBUS                                                       │
// │  "Heisenberg" is Nubia's routing intelligence. This module is the     │
// │  integration seam: today it runs a transparent, deterministic         │
// │  heuristic so the product works end-to-end; later, swap the body of   │
// │  scoreCombiConvenience() for a call to Nubia's Heisenberg API and the │
// │  rest of Nimbus is unaffected.                                        │
// └─────────────────────────────────────────────────────────────────────┘
//
// The score answers: "how painless is the daily combi trip from this
// listing to this campus?" — 0..100, plus a human label and the routes
// that make it work.

import { haversineKm } from './geo.js';

// How close (km) a listing must be to a route's pickup area to "catch" it easily.
const PICKUP_RADIUS_KM = 0.8;

// A combi route "serves" a campus if the campus is in its destinations list.
function routeServesCampus(route, campusId) {
  return route.servesCampusIds.includes(campusId);
}

// Nearest pickup point on a route to a given coordinate.
function nearestPickupKm(route, coord) {
  let min = Infinity;
  for (const p of route.pickups) {
    const d = haversineKm(coord, p);
    if (d < min) min = d;
  }
  return min;
}

/**
 * @returns {{ score:number, label:string, directRoutes:Array, nearestPickupKm:number|null }}
 */
export function scoreCombiConvenience({ listing, campus, routes }) {
  const direct = [];
  let bestPickup = Infinity;

  for (const route of routes) {
    if (!routeServesCampus(route, campus.id)) continue;
    const pickup = nearestPickupKm(route, { lat: listing.lat, lng: listing.lng });
    if (pickup <= PICKUP_RADIUS_KM * 2.5) {
      direct.push({ ...route, pickupKm: Math.round(pickup * 100) / 100 });
      if (pickup < bestPickup) bestPickup = pickup;
    }
  }

  if (direct.length === 0) {
    return { score: 0, label: 'No direct combi', directRoutes: [], nearestPickupKm: null };
  }

  // Closer pickup -> higher score. Walking >PICKUP_RADIUS costs points.
  const walkPenalty = Math.max(0, bestPickup - PICKUP_RADIUS_KM) * 45; // pts per km over radius
  const routeBonus = Math.min(direct.length - 1, 2) * 8; // multiple options = more reliable
  let score = Math.round(100 - walkPenalty + routeBonus);
  score = Math.max(5, Math.min(100, score));

  const label =
    score >= 80 ? 'Excellent' : score >= 55 ? 'Good' : score >= 30 ? 'Workable' : 'Limited';

  // Sort the routes that serve this trip by closest pickup.
  direct.sort((a, b) => a.pickupKm - b.pickupKm);

  return {
    score,
    label,
    directRoutes: direct,
    nearestPickupKm: Math.round(bestPickup * 100) / 100,
  };
}
