// test/bookings.test.js — integration tests for the marketplace + booking
// escrow endpoints, against the in-memory store.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { default: app } = await import('../server.js');

let server, base;
before(async () => {
  await new Promise((res) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; res(); }); });
});
after(() => server && server.close());

const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });

test('GET /api/campuses returns the four campuses', async () => {
  const { campuses } = await (await fetch(base + '/api/campuses')).json();
  assert.equal(campuses.length, 4);
  assert.ok(campuses.find((c) => c.id === 'ub'));
});

test('GET /api/listings ranks by combi score when campus is set', async () => {
  const data = await (await fetch(base + '/api/listings?campus=ub')).json();
  assert.ok(data.count > 0);
  assert.ok(data.listings[0].combi, 'listings enriched with combi data');
  for (let i = 1; i < data.listings.length; i++) {
    assert.ok(data.listings[i - 1].combi.score >= data.listings[i].combi.score);
  }
});

test('GET /api/listings/:id 404s for unknown id', async () => {
  const res = await fetch(base + '/api/listings/does-not-exist');
  assert.equal(res.status, 404);
});

test('booking happy path: create → held_in_escrow → verify → released', async () => {
  const create = await post('/api/bookings', {
    listingId: 'blk7-studio', studentName: 'Kabo Test', studentEmail: 'kabo@students.ub.ac.bw',
    studentPhone: '71234567', moveInDate: '2026-02-01', paymentProvider: 'orange_money',
  });
  assert.equal(create.status, 201);
  const { reference, booking } = await create.json();
  assert.match(reference, /^NMB-[0-9A-F]{6}$/);
  assert.equal(booking.status, 'held_in_escrow');
  // escrow = rent + deposit = 2900 + 2900
  assert.equal(Number(booking.escrow_held), 5800);

  // fetch by reference
  const got = await (await fetch(base + '/api/bookings/' + reference)).json();
  assert.equal(got.booking.reference, reference);
  assert.equal(got.listing.id, 'blk7-studio');

  // verify move-in -> released
  const verify = await post('/api/bookings/' + reference + '/verify');
  assert.equal(verify.status, 200);
  const verified = (await verify.json()).booking;
  assert.equal(verified.status, 'released');
  assert.ok(verified.verified_at);

  // verifying again must fail (no longer in escrow)
  const again = await post('/api/bookings/' + reference + '/verify');
  assert.equal(again.status, 409);
});

test('booking refund path: create → refund → cannot verify', async () => {
  const { reference } = await (await post('/api/bookings', {
    listingId: 'ext-shared', studentName: 'Lorato Test', studentEmail: 'lorato@example.com',
    moveInDate: '2026-02-15', paymentProvider: 'myzaka',
  })).json();

  const refund = await post('/api/bookings/' + reference + '/refund');
  assert.equal(refund.status, 200);
  assert.equal((await refund.json()).booking.status, 'refunded');

  const verify = await post('/api/bookings/' + reference + '/verify');
  assert.equal(verify.status, 409, 'cannot verify a refunded booking');
});

test('booking validation: rejects bad email, missing provider, unknown listing', async () => {
  assert.equal((await post('/api/bookings', { listingId: 'blk7-studio', studentName: 'X Y', studentEmail: 'bad', moveInDate: '2026-02-01', paymentProvider: 'orange_money' })).status, 400);
  assert.equal((await post('/api/bookings', { listingId: 'blk7-studio', studentName: 'X Y', studentEmail: 'x@y.com', moveInDate: '2026-02-01', paymentProvider: 'paypal' })).status, 400);
  assert.equal((await post('/api/bookings', { listingId: 'nope', studentName: 'X Y', studentEmail: 'x@y.com', moveInDate: '2026-02-01', paymentProvider: 'smega' })).status, 404);
});

test('page routes serve their shells', async () => {
  for (const p of ['/browse', '/listing/blk7-studio', '/book/blk7-studio', '/booking/NMB-ABCDEF']) {
    const res = await fetch(base + p);
    assert.equal(res.status, 200, `${p} should serve`);
    assert.ok((await res.text()).includes('<!DOCTYPE html>'));
  }
});
