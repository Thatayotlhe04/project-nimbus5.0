// test/marketplace.test.js — unit tests for the pure logic modules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, estimateCommute } from '../geo.js';
import { tenantServiceFee, bookingBreakdown, LANDLORD_COMMISSION_RATE } from '../fees.js';
import { scoreCombiConvenience } from '../heisenberg.js';
import { filterAndRank } from '../marketplace.js';
import { campuses, routes, listings } from '../data/seed.js';

// ---------- geo ----------
test('haversine: same point is 0 km', () => {
  assert.equal(haversineKm({ lat: -24.6, lng: 25.9 }, { lat: -24.6, lng: 25.9 }), 0);
});

test('haversine: UB↔BAC is a few km, not absurd', () => {
  const ub = campuses.find((c) => c.id === 'ub');
  const bac = campuses.find((c) => c.id === 'bac');
  const d = haversineKm(ub, bac);
  assert.ok(d > 1 && d < 10, `got ${d}km`);
});

test('estimateCommute: combi only present when route exists', () => {
  const a = estimateCommute({ lat: -24.66, lng: 25.93 }, { lat: -24.665, lng: 25.94 }, { hasDirectCombi: true });
  const b = estimateCommute({ lat: -24.66, lng: 25.93 }, { lat: -24.665, lng: 25.94 }, { hasDirectCombi: false });
  assert.ok(a.combiMin != null && a.combiMin > 0);
  assert.equal(b.combiMin, null);
  assert.ok(a.walkMin > a.combiMin, 'walking should take longer than combi');
});

// ---------- fees ----------
test('tenant service fee is clamped to 150..300', () => {
  assert.equal(tenantServiceFee(500), 150);   // 8% = 40 -> floor 150
  assert.equal(tenantServiceFee(99999), 300); // -> cap 300
  assert.equal(tenantServiceFee(2500), 200);  // 8% = 200, in range
});

test('booking breakdown: escrow = rent + deposit, total adds service fee', () => {
  const b = bookingBreakdown({ rent: 2900, deposit: 2900 });
  assert.equal(b.escrowHeld, 5800);
  assert.equal(b.serviceFee, tenantServiceFee(2900));
  assert.equal(b.totalDueNow, 5800 + b.serviceFee);
  // landlord payout = escrow minus 6% commission of rent
  assert.equal(b.platformCommission, Math.round(2900 * LANDLORD_COMMISSION_RATE * 100) / 100);
  assert.equal(b.landlordPayout, Math.round((5800 - b.platformCommission) * 100) / 100);
});

// ---------- heisenberg ----------
test('combi score: a Block 7 listing scores well for UB', () => {
  const ub = campuses.find((c) => c.id === 'ub');
  const blk7 = listings.find((l) => l.id === 'blk7-studio');
  const r = scoreCombiConvenience({ listing: blk7, campus: ub, routes });
  assert.ok(r.score >= 55, `expected Good/Excellent, got ${r.score} (${r.label})`);
  assert.ok(r.directRoutes.length >= 1);
});

test('combi score: Phakalane has no direct combi to UB (score 0)', () => {
  const ub = campuses.find((c) => c.id === 'ub');
  const phak = listings.find((l) => l.id === 'phakalane-studio');
  const r = scoreCombiConvenience({ listing: phak, campus: ub, routes });
  assert.equal(r.score, 0);
  assert.equal(r.label, 'No direct combi');
});

// ---------- marketplace filter/rank ----------
test('filterAndRank: room-type filter works', () => {
  const r = filterAndRank(listings, { roomType: 'studio' }, routes, campuses);
  assert.ok(r.listings.length > 0);
  assert.ok(r.listings.every((l) => l.roomType === 'studio'));
});

test('filterAndRank: maxRent excludes pricier homes', () => {
  const r = filterAndRank(listings, { maxRent: 1500 }, routes, campuses);
  assert.ok(r.listings.every((l) => l.rent <= 1500));
});

test('filterAndRank: combiOnly with campus keeps only homes with a route', () => {
  const r = filterAndRank(listings, { campusId: 'ub', combiOnly: true }, routes, campuses);
  assert.ok(r.listings.length > 0);
  assert.ok(r.listings.every((l) => l.combi.score > 0));
  // results should be sorted by combi score descending
  for (let i = 1; i < r.listings.length; i++) {
    assert.ok(r.listings[i - 1].combi.score >= r.listings[i].combi.score);
  }
});

test('filterAndRank: verifiedOnly drops pending listings', () => {
  const r = filterAndRank(listings, { verifiedOnly: true }, routes, campuses);
  assert.ok(r.listings.every((l) => l.verified));
});
