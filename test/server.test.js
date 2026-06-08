// test/server.test.js — boots the Express app on an ephemeral port and
// exercises the real endpoints against the in-memory DB fallback.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.ADMIN_TOKEN = 'test-admin-token';

const { default: app } = await import('../server.js');

let server, base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => server && server.close());

// Tiny cookie jar so we can simulate a sticky visitor across requests.
function jarFrom(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  return raw.map((c) => c.split(';')[0]).join('; ');
}

test('GET / serves the page, sets cookies, and renders a known variant', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  const cookies = res.headers.getSetCookie();
  assert.ok(cookies.some((c) => c.startsWith('nimbus_sid=')), 'sets sid cookie');
  assert.ok(cookies.some((c) => c.startsWith('nimbus_variant=')), 'sets variant cookie');

  const html = await res.text();
  assert.ok(html.includes('window.__AB__'), 'injects AB config');
  assert.ok(!html.includes('<!--AB_INJECT-->'), 'placeholder consumed');
  // Should contain one of the two headlines.
  assert.ok(
    html.includes('hardest part') || html.includes('finally'),
    'renders a variant headline'
  );
});

test('variant assignment is sticky across requests', async () => {
  const r1 = await fetch(`${base}/`);
  const jar = jarFrom(r1);
  const v1 = jar.match(/nimbus_variant=([AB])/)[1];

  const r2 = await fetch(`${base}/`, { headers: { cookie: jar } });
  const html = await r2.text();
  // The same visitor should keep their variant -> no new variant cookie issued.
  assert.equal(r2.headers.getSetCookie().length, 0, 'no new cookies for returning visitor');
  const expected =
    v1 === 'A' ? 'hardest part' : 'finally';
  assert.ok(html.includes(expected), `variant ${v1} stays consistent`);
});

test('POST /api/waitlist rejects a bad email', async () => {
  const res = await fetch(`${base}/api/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email' }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/waitlist records a signup, dedupes a repeat', async () => {
  // First, become a visitor to get cookies (so signup is attributed).
  const page = await fetch(`${base}/`);
  const jar = jarFrom(page);
  const email = `student${Date.now()}@ub.ac.bw`;

  const first = await fetch(`${base}/api/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: jar },
    body: JSON.stringify({ email, source: 'hero' }),
  });
  assert.equal(first.status, 201);
  const firstBody = await first.json();
  assert.equal(firstBody.alreadyJoined, false);

  const second = await fetch(`${base}/api/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: jar },
    body: JSON.stringify({ email: email.toUpperCase(), source: 'hero' }),
  });
  assert.equal(second.status, 201);
  const secondBody = await second.json();
  assert.equal(secondBody.alreadyJoined, true, 'case-insensitive dedupe');
});

test('GET /api/stats is gated and returns per-variant rows', async () => {
  const unauth = await fetch(`${base}/api/stats`);
  assert.equal(unauth.status, 401);

  const ok = await fetch(`${base}/api/stats`, {
    headers: { 'x-admin-token': 'test-admin-token' },
  });
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.experiment, 'hero_headline_v1');
  assert.ok(Array.isArray(body.results));
  // We created at least one visitor + one signup above.
  const totalVisitors = body.results.reduce((n, r) => n + r.visitors, 0);
  const totalSignups = body.results.reduce((n, r) => n + r.signups, 0);
  assert.ok(totalVisitors >= 1);
  assert.ok(totalSignups >= 1);
});
