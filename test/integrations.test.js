// test/integrations.test.js — payments + Heisenberg client.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { scoreListings, heisenbergConfigured } from '../nubia.js';
import { collect, settlementInfo, isProvider, paymentsMode } from '../payments/providers.js';
import { campuses, routes, listings } from '../data/seed.js';

process.env.NODE_ENV = 'test';
const { default: app } = await import('../server.js');
let server, base;
before(async () => { await new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }); });
after(() => server && server.close());

const post = (p, b) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) });

// ---- Heisenberg client fallback ----
test('Heisenberg client falls back to local scoring when unconfigured', async () => {
  assert.equal(heisenbergConfigured(), false, 'no API url/key in test env');
  const ub = campuses.find((c) => c.id === 'ub');
  const map = await scoreListings(listings, ub, routes);
  assert.ok(map['blk7-studio'], 'returns a score per listing');
  assert.equal(map['blk7-studio'].source, 'local');
  assert.ok(map['blk7-studio'].score >= 55);
  assert.equal(map['phakalane-studio'].score, 0);
  assert.ok(Array.isArray(map['blk7-studio'].routes));
});

// ---- payments module ----
test('payments: providers + simulate capture + settlement masking', async () => {
  assert.equal(paymentsMode(), 'simulate');
  assert.ok(isProvider('orange_money') && isProvider('myzaka') && isProvider('smega'));
  assert.equal(isProvider('paypal'), false);

  const cap = await collect({ provider: 'orange_money', amountBwp: 5800, phone: '71234567', reference: 'PAY-TEST' });
  assert.equal(cap.status, 'captured');
  assert.match(cap.providerRef, /^SIM-/);

  const s = settlementInfo();
  assert.equal(s.mode, 'simulate');
  // account number must be masked (no full digits exposed)
  if (process.env.SETTLEMENT_ACCOUNT_NUMBER) assert.ok(s.accountMasked.includes('•'));
});

// ---- payments endpoints ----
test('GET /api/payments/info returns providers + masked settlement', async () => {
  const d = await (await fetch(base + '/api/payments/info')).json();
  assert.equal(d.providers.length, 3);
  assert.ok(d.settlement.bank);
  assert.ok(!/\d{6,}/.test(d.settlement.accountMasked), 'no long digit run leaks');
});

test('payment webhook acks known provider, 404s unknown', async () => {
  assert.equal((await post('/api/payments/orange_money/webhook', { reference: 'PAY-X', success: true })).status, 200);
  assert.equal((await post('/api/payments/paypal/webhook', {})).status, 404);
});

// ---- booking now records a provider ref ----
test('booking stores a provider reference from the capture', async () => {
  const { booking } = await (await post('/api/bookings', {
    listingId: 'blk6-private', studentName: 'Test User', studentEmail: 't@u.com',
    moveInDate: '2026-03-01', paymentProvider: 'smega',
  })).json();
  assert.ok(booking.provider_ref, 'provider_ref persisted');
  assert.match(booking.provider_ref, /^SIM-/);
});
