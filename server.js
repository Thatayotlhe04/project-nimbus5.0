// server.js — Express server for the Nimbus site.
//
// Pages:  /  /browse  /listing/:id  /book/:id  /booking/:ref
// APIs :  /api/campuses  /api/listings[/:id]  /api/bookings[...]  +  waitlist/event/stats
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXPERIMENT, assignVariant, isValidVariant, renderVariant } from './ab.js';
import { filterAndRank, enrichListing } from './marketplace.js';
import { scoreListings as heisenbergScore } from './nubia.js';
import { bookingBreakdown } from './fees.js';
import * as payments from './payments/providers.js';
import * as subs from './payments/subscriptions.js';
import * as db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const PROVIDERS = new Set(['orange_money', 'smega', 'myzaka']);

const TEMPLATE_PATH = path.join(PUBLIC_DIR, 'index.html');
let cachedTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');
const getTemplate = () =>
  process.env.NODE_ENV === 'production' ? cachedTemplate : fs.readFileSync(TEMPLATE_PATH, 'utf8');

const app = express();
app.use(express.json());
app.use(cookieParser());

const COOKIE_OPTS = {
  httpOnly: true, sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 1000 * 60 * 60 * 24 * 180,
};

app.use(express.static(PUBLIC_DIR, { index: false }));

app.get('/healthz', (_req, res) => res.json({ ok: true, supabase: db.usingSupabase() }));

// ---------- Landing page with A/B assignment ----------
app.get('/', async (req, res, next) => {
  try {
    let sid = req.cookies.nimbus_sid;
    let variant = req.cookies.nimbus_variant;
    let isNew = false;

    if (!sid) { sid = crypto.randomUUID(); res.cookie('nimbus_sid', sid, COOKIE_OPTS); isNew = true; }
    if (!isValidVariant(variant)) { variant = assignVariant(); res.cookie('nimbus_variant', variant, COOKIE_OPTS); isNew = true; }

    if (isNew) {
      db.recordAssignment({ sessionId: sid, experiment: EXPERIMENT.id, variant,
        referrer: req.get('referer'), userAgent: req.get('user-agent') })
        .catch((e) => console.error('[assignment]', e.message));
    }

    const inject = `<script>window.__AB__=${JSON.stringify({ variant, sessionId: sid, experiment: EXPERIMENT.id })};</script>`;
    let html = renderVariant(getTemplate(), variant).replace('<!--AB_INJECT-->', inject);
    res.set('Cache-Control', 'no-store').type('html').send(html);
  } catch (err) { next(err); }
});

// ---------- App pages (static shells; data via API) ----------
const page = (file) => (_req, res) => res.sendFile(path.join(PUBLIC_DIR, file));
app.get('/browse', page('browse.html'));
app.get('/listing/:id', page('listing.html'));
app.get('/book/:id', page('book.html'));
app.get('/booking/:ref', page('confirmation.html'));
app.get('/pricing', page('pricing.html'));
app.get('/landlord', page('landlord.html'));
app.get('/about', page('about.html'));
app.get('/legal/privacy', page('legal-privacy.html'));
app.get('/legal/terms', page('legal-terms.html'));
app.get('/legal/cookies', page('legal-cookies.html'));

// ---------- Marketplace API ----------
app.get('/api/campuses', async (_req, res) => {
  try { res.json({ campuses: await db.getCampuses() }); }
  catch (e) { console.error('[campuses]', e.message); res.status(500).json({ error: 'failed' }); }
});

app.get('/api/listings', async (req, res) => {
  try {
    const [listings, routes, campuses] = await Promise.all([db.getListings(), db.getRoutes(), db.getCampuses()]);
    const campus = req.query.campus ? campuses.find((c) => c.id === req.query.campus) : null;
    const scoresById = campus ? await heisenbergScore(listings, campus, routes) : undefined;
    const result = filterAndRank(listings, {
      campusId: req.query.campus || null,
      roomType: req.query.roomType || null,
      maxRent: req.query.maxRent || null,
      combiOnly: req.query.combiOnly === 'true',
      verifiedOnly: req.query.verifiedOnly === 'true',
    }, routes, campuses, scoresById);
    res.json(result);
  } catch (e) { console.error('[listings]', e.message); res.status(500).json({ error: 'failed' }); }
});

app.get('/api/listings/:id', async (req, res) => {
  try {
    const listing = await db.getListing(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    const [routes, campuses] = await Promise.all([db.getRoutes(), db.getCampuses()]);
    const campus = req.query.campus ? campuses.find((c) => c.id === req.query.campus) : null;
    const scores = campus ? await heisenbergScore([listing], campus, routes) : {};
    res.json({ listing: enrichListing(listing, campus, routes, scores[listing.id]), campuses });
  } catch (e) { console.error('[listing]', e.message); res.status(500).json({ error: 'failed' }); }
});

// ---------- Bookings + escrow ----------
app.post('/api/bookings', async (req, res) => {
  try {
    const { listingId, studentName, studentEmail, studentPhone, moveInDate, paymentProvider } = req.body || {};

    if (!listingId) return res.status(400).json({ error: 'Missing listing.' });
    if (!studentName || studentName.trim().length < 2) return res.status(400).json({ error: 'Please enter your name.' });
    if (typeof studentEmail !== 'string' || !/^\S+@\S+\.\S+$/.test(studentEmail.trim()))
      return res.status(400).json({ error: 'Please enter a valid email.' });
    if (!moveInDate) return res.status(400).json({ error: 'Please choose a move-in date.' });
    if (!PROVIDERS.has(paymentProvider)) return res.status(400).json({ error: 'Choose a payment method.' });

    const listing = await db.getListing(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });

    const breakdown = bookingBreakdown({ rent: listing.rent, deposit: listing.deposit });

    // Collect the deposit + first month into the Nimbus merchant balance via
    // the chosen mobile-money provider. In simulate mode this is an instant
    // capture; in live mode it returns 'pending' and the provider webhook
    // (POST /api/payments/:provider/webhook) confirms it. Either way, funds
    // settle to the configured Access Bank account.
    const payRef = 'PAY-' + crypto.randomUUID().slice(0, 8).toUpperCase();
    let capture;
    try {
      capture = await payments.collect({
        provider: paymentProvider,
        amountBwp: breakdown.totalDueNow,
        phone: studentPhone,
        reference: payRef,
        description: `Nimbus · ${listing.title}`,
      });
    } catch (payErr) {
      return res.status(402).json({ error: payErr.message });
    }

    if (capture.status !== 'captured') {
      // Live async path: payment initiated, awaiting the on-phone approval.
      return res.status(202).json({ ok: true, pending: true, providerRef: capture.providerRef,
        message: 'Approve the prompt on your phone to finish paying into escrow.' });
    }

    const booking = await db.createBooking({
      listingId, studentName: studentName.trim(), studentEmail, studentPhone,
      moveInDate, roomType: listing.roomType, paymentProvider, breakdown,
      providerRef: capture.providerRef,
    });

    res.status(201).json({ ok: true, reference: booking.reference, booking });
  } catch (e) { console.error('[booking:create]', e.message); res.status(500).json({ error: 'Could not create booking.' }); }
});

app.get('/api/bookings/:idOrRef', async (req, res) => {
  try {
    const booking = await db.getBooking(req.params.idOrRef);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const listing = await db.getListing(booking.listing_id);
    res.json({ booking, listing });
  } catch (e) { console.error('[booking:get]', e.message); res.status(500).json({ error: 'failed' }); }
});

// Student verifies they walked through the door -> release escrow to landlord.
app.post('/api/bookings/:idOrRef/verify', async (req, res) => {
  try {
    const updated = await db.transitionBooking(req.params.idOrRef, 'released');
    if (!updated) return res.status(409).json({ error: 'Booking is not awaiting verification.' });
    res.json({ ok: true, booking: updated });
  } catch (e) { console.error('[booking:verify]', e.message); res.status(500).json({ error: 'failed' }); }
});

// Dispute / no-show -> refund the student.
app.post('/api/bookings/:idOrRef/refund', async (req, res) => {
  try {
    const updated = await db.transitionBooking(req.params.idOrRef, 'refunded');
    if (!updated) return res.status(409).json({ error: 'Booking is not refundable in its current state.' });
    res.json({ ok: true, booking: updated });
  } catch (e) { console.error('[booking:refund]', e.message); res.status(500).json({ error: 'failed' }); }
});

// ---------- Payments ----------
// Public, non-secret info for the checkout/pricing UI.
app.get('/api/payments/info', (_req, res) => {
  res.json({
    mode: payments.paymentsMode(),
    providers: Object.values(payments.PROVIDERS),
    settlement: payments.settlementInfo(),
  });
});

// Provider callback (live mode). Confirms a collection and funds the booking.
app.post('/api/payments/:provider/webhook', async (req, res) => {
  try {
    const { provider } = req.params;
    if (!payments.isProvider(provider)) return res.status(404).json({ error: 'Unknown provider' });
    const { reference, captured } = payments.parseWebhook(provider, req.body, req.headers);
    // In live mode you'd look up the pending booking by `reference`, and on
    // `captured` transition it from pending_payment -> held_in_escrow.
    console.log(`[webhook:${provider}] reference=${reference} captured=${captured}`);
    res.json({ ok: true, received: true });
  } catch (e) { console.error('[webhook]', e.message); res.status(500).json({ error: 'failed' }); }
});

// ---------- Subscriptions (recurring plans) ----------
app.get('/api/subscriptions/plans', (_req, res) => {
  res.json({ plans: subs.listTiers() });
});

// Start (or upgrade/renew) a subscription: charges the tier, then activates it.
app.post('/api/subscriptions/start', async (req, res) => {
  try {
    const { userId, tier, paymentProvider, phone } = req.body || {};
    if (!userId || String(userId).trim().length < 2) return res.status(400).json({ error: 'Missing account id.' });
    if (!subs.isTier(tier)) return res.status(400).json({ error: 'Unknown plan.' });
    if (!payments.isProvider(paymentProvider)) return res.status(400).json({ error: 'Choose a payment method.' });

    let capture;
    try {
      capture = await subs.collectSubscription({ tier, userId, provider: paymentProvider, phone });
    } catch (payErr) {
      return res.status(402).json({ error: payErr.message });
    }
    if (capture.status !== 'captured') {
      return res.status(202).json({ ok: true, pending: true, providerRef: capture.providerRef,
        message: 'Approve the prompt on your phone to activate your plan.' });
    }

    const subscription = await db.upsertSubscription({
      userId, tier, amountBwp: subs.tierPrice(tier),
      paymentProvider, providerRef: capture.providerRef, billingPhone: phone,
    });
    res.status(201).json({ ok: true, subscription });
  } catch (e) { console.error('[sub:start]', e.message); res.status(500).json({ error: 'Could not start subscription.' }); }
});

app.get('/api/subscriptions/:userId', async (req, res) => {
  try {
    const sub = await db.getSubscription(req.params.userId);
    if (!sub) return res.status(404).json({ error: 'No subscription for this account.' });
    res.json({ subscription: sub });
  } catch (e) { console.error('[sub:get]', e.message); res.status(500).json({ error: 'failed' }); }
});

// Cancel auto-renew; the plan stays active until the period ends.
app.post('/api/subscriptions/:userId/cancel', async (req, res) => {
  try {
    const updated = await db.cancelSubscription(req.params.userId);
    if (!updated) return res.status(409).json({ error: 'No active subscription to cancel.' });
    res.json({ ok: true, subscription: updated });
  } catch (e) { console.error('[sub:cancel]', e.message); res.status(500).json({ error: 'failed' }); }
});

// ---------- Waitlist / events / stats ----------
app.post('/api/waitlist', async (req, res) => {
  try {
    const { email, source } = req.body || {};
    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim()))
      return res.status(400).json({ error: 'Please enter a valid email address.' });

    const sessionId = req.cookies.nimbus_sid || req.body.sessionId || null;
    const variant = isValidVariant(req.cookies.nimbus_variant) ? req.cookies.nimbus_variant
      : isValidVariant(req.body.variant) ? req.body.variant : 'A';

    const result = await db.recordSignup({
      email: email.trim(), sessionId, experiment: EXPERIMENT.id, variant, source,
      referrer: req.get('referer'), userAgent: req.get('user-agent'),
    });
    res.status(201).json({ ok: true, ...result });
  } catch (e) { console.error('[waitlist]', e.message); res.status(500).json({ error: 'Could not save your signup.' }); }
});

app.post('/api/event', async (req, res) => {
  try {
    const { eventType, metadata } = req.body || {};
    if (!eventType) return res.status(400).json({ error: 'eventType required' });
    await db.recordEvent({ sessionId: req.cookies.nimbus_sid || null, experiment: EXPERIMENT.id,
      variant: req.cookies.nimbus_variant || null, eventType, metadata });
    res.status(201).json({ ok: true });
  } catch (e) { console.error('[event]', e.message); res.status(500).json({ error: 'failed' }); }
});

app.get('/api/stats', async (req, res) => {
  const token = req.get('x-admin-token');
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN)
    return res.status(401).json({ error: 'Unauthorized' });
  try {
    const experiment = req.query.experiment || EXPERIMENT.id;
    res.json({ experiment, results: await db.getStats(experiment) });
  } catch (e) { console.error('[stats]', e.message); res.status(500).json({ error: 'failed' }); }
});

app.use((err, _req, res, _next) => { console.error(err); res.status(500).send('Internal server error'); });

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[nimbus] http://localhost:${PORT}  (supabase: ${db.usingSupabase()})`);
  });
}

export default app;
