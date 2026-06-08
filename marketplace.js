// marketplace.js — turns raw listing rows into ranked, enriched results.
// Pure functions over data passed in, so it works the same whether rows
// come from Supabase or the in-memory store.

import { estimateCommute } from './geo.js';
import { scoreCombiConvenience } from './heisenberg.js';
import { ROOM_TYPES } from './data/seed.js';

export function enrichListing(listing, campus, routes, precomputedCombi) {
  const base = { ...listing, roomTypeLabel: ROOM_TYPES[listing.roomType] || listing.roomType };
  if (!campus) return base;

  let combi;
  if (precomputedCombi) {
    // Already in shared shape (from Nubia's Heisenberg or the client fallback).
    combi = precomputedCombi;
  } else {
    const scored = scoreCombiConvenience({ listing, campus, routes });
    combi = {
      score: scored.score,
      label: scored.label,
      nearestPickupKm: scored.nearestPickupKm,
      routes: scored.directRoutes.map((r) => ({ id: r.id, name: r.name, color: r.color, fare: r.fare, pickupKm: r.pickupKm })),
    };
  }

  const commute = estimateCommute(
    { lat: listing.lat, lng: listing.lng },
    { lat: campus.lat, lng: campus.lng },
    { hasDirectCombi: combi.routes.length > 0 }
  );

  return { ...base, campusId: campus.id, commute, combi };
}

export function filterAndRank(listings, opts, routes, campuses, scoresById) {
  const { campusId, roomType, maxRent, combiOnly, verifiedOnly } = opts;
  const campus = campuses.find((c) => c.id === campusId) || null;

  let rows = listings.map((l) => enrichListing(l, campus, routes, scoresById ? scoresById[l.id] : undefined));

  if (roomType) rows = rows.filter((r) => r.roomType === roomType);
  if (maxRent) rows = rows.filter((r) => r.rent <= Number(maxRent));
  if (verifiedOnly) rows = rows.filter((r) => r.verified);
  if (combiOnly && campus) rows = rows.filter((r) => r.combi && r.combi.score > 0);

  rows.sort((a, b) => {
    if (campus) {
      // Best combi convenience first, then shortest commute, then verified, then price.
      if (b.combi.score !== a.combi.score) return b.combi.score - a.combi.score;
      const am = a.commute.combiMin ?? a.commute.walkMin;
      const bm = b.commute.combiMin ?? b.commute.walkMin;
      if (am !== bm) return am - bm;
    }
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    return a.rent - b.rent;
  });

  return { campus, count: rows.length, listings: rows };
}
