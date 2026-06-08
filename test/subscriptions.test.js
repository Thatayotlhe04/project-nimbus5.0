// test/subscriptions.test.js — recurring plans end-to-end (in-memory).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, isTier, listTiers, tierPrice, collectSubscription } from '../payments/subscriptions.js';

process.env.NODE_ENV = 'test';
const { default: app } = await import('../server.js');
let server, base;
before(async () => { await new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }); });
after(() => server && server.close());

const post = (p, b) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) });

// ---- unit ----
test('tiers: two plans with sane prices', () => {
  assert.equal(listTiers().length, 2);
  assert.equal(tierPrice('landlord_pro'), 299);
  assert.equal(tierPrice('university_portal'), 4999);
  assert.equal(isTier('landlord_pro'), true);
  assert.equal(isTier('enterprise'), false);
});

test('collectSubscription charges the tier price (simulate capture)', async () => {
  const cap = await collectSubscription({ tier: 'landlord_pro', userId: 'u1', provider: 'orange_money', phone: '71000000' });
  assert.equal(cap.status, 'captured');
  assert.match(cap.providerRef, /^SIM-/);
});

// ---- endpoints ----
test('GET /api/subscriptions/plans lists the plans', async () => {
  const d = await (await fetch(base + '/api/subscriptions/plans')).json();
  assert.equal(d.plans.length, 2);
  assert.ok(d.plans.find((p) => p.id === 'landlord_pro' && p.priceBwp === 299));
});

test('start → active with renewal date + provider ref', async () => {
  const r = await post('/api/subscriptions/start', { userId: 'khumo@properties.bw', tier: 'landlord_pro', paymentProvider: 'orange_money', phone: '71234567' });
  assert.equal(r.status, 201);
  const { subscription } = await r.json();
  assert.equal(subscription.tier, 'landlord_pro');
  assert.equal(subscription.status, 'active');
  assert.equal(subscription.amount_bwp, 299);
  assert.match(subscription.provider_ref, /^SIM-/);
  assert.ok(new Date(subscription.renews_at) > new Date());
});

test('get returns the active subscription, 404 when none', async () => {
  await post('/api/subscriptions/start', { userId: 'acc-get', tier: 'university_portal', paymentProvider: 'smega' });
  const ok = await fetch(base + '/api/subscriptions/acc-get');
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).subscription.tier, 'university_portal');
  assert.equal((await fetch(base + '/api/subscriptions/nobody')).status, 404);
});

test('starting again upgrades the SAME account (one record, new tier)', async () => {
  await post('/api/subscriptions/start', { userId: 'up1', tier: 'landlord_pro', paymentProvider: 'orange_money' });
  const r2 = await post('/api/subscriptions/start', { userId: 'up1', tier: 'university_portal', paymentProvider: 'orange_money' });
  assert.equal(r2.status, 201);
  const got = await (await fetch(base + '/api/subscriptions/up1')).json();
  assert.equal(got.subscription.tier, 'university_portal');
  assert.equal(got.subscription.amount_bwp, 4999);
});

test('cancel stops auto-renew (still active until period end), 409 when none', async () => {
  await post('/api/subscriptions/start', { userId: 'acc-cancel', tier: 'landlord_pro', paymentProvider: 'myzaka' });
  const c = await post('/api/subscriptions/acc-cancel/cancel');
  assert.equal(c.status, 200);
  const sub = (await c.json()).subscription;
  assert.equal(sub.auto_renew, false);
  assert.ok(sub.canceled_at);
  // cancelling again -> nothing active to cancel
  assert.equal((await post('/api/subscriptions/never/cancel')).status, 409);
});

test('start validation: bad account, bad tier, bad provider', async () => {
  assert.equal((await post('/api/subscriptions/start', { userId: 'x', tier: 'landlord_pro', paymentProvider: 'orange_money' })).status, 400);
  assert.equal((await post('/api/subscriptions/start', { userId: 'okname', tier: 'nope', paymentProvider: 'orange_money' })).status, 400);
  assert.equal((await post('/api/subscriptions/start', { userId: 'okname', tier: 'landlord_pro', paymentProvider: 'paypal' })).status, 400);
});
