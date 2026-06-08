// geo.js — distance + commute estimation.
//
// NOTE: these are transparent ESTIMATES from straight-line (haversine)
// distance, not a routing/transit API. They're honest approximations good
// enough for ranking + display. To get true door-to-door times, swap
// estimateCommute() for a call to a routing provider (Google Directions,
// Mapbox, OpenRouteService) — the rest of the app doesn't need to change.

const R = 6371; // earth radius km
const toRad = (d) => (d * Math.PI) / 180;

export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Road distance is longer than straight line. ~1.3x is a reasonable Gaborone factor.
const ROAD_FACTOR = 1.3;
const WALK_KMH = 4.8;
const COMBI_KMH = 22; // average incl. stops in city traffic
const COMBI_WAIT_MIN = 7; // typical wait at the rank/stop

export function estimateCommute(from, to, { hasDirectCombi } = {}) {
  const straight = haversineKm(from, to);
  const road = straight * ROAD_FACTOR;

  const walkMin = Math.round((road / WALK_KMH) * 60);

  let combi = null;
  if (hasDirectCombi) {
    combi = Math.round((road / COMBI_KMH) * 60 + COMBI_WAIT_MIN);
  }

  return {
    km: Math.round(road * 10) / 10,
    walkMin,
    combiMin: combi, // null when no direct combi route
    walkable: walkMin <= 25,
  };
}
