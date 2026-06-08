// payments/providers.js — mobile-money collection + settlement.
//
// ┌───────────────────────────────────────────────────────────────────────┐
// │ HONEST STATUS                                                          │
// │ Real mobile-money collection needs a MERCHANT ACCOUNT and API          │
// │ credentials from each provider (or an aggregator). Those can't be      │
// │ created from code. This module is the integration layer:               │
// │   • PAYMENTS_MODE=simulate (default) → instant fake capture, so the    │
// │     whole booking/escrow flow works end-to-end today.                  │
// │   • PAYMENTS_MODE=live → each adapter shows exactly where to call the  │
// │     provider's collection API. Wire your credentials + endpoints there.│
// │ Settlement (where the money lands) is your Access Bank account, set in │
// │ .env via SETTLEMENT_ACCOUNT_NUMBER. Funds are paid out by the provider │
// │ to that bank account per your merchant agreement.                      │
// └───────────────────────────────────────────────────────────────────────┘

const MODE = process.env.PAYMENTS_MODE === 'live' ? 'live' : 'simulate';

export const SETTLEMENT = {
  bank: process.env.SETTLEMENT_BANK || 'Access Bank Botswana',
  accountName: process.env.SETTLEMENT_ACCOUNT_NAME || 'Nimbus (settlement)',
  accountNumber: process.env.SETTLEMENT_ACCOUNT_NUMBER || '', // set in .env — do NOT commit
};

const maskAcct = (n) => (n ? n.replace(/.(?=.{4})/g, '•') : 'not configured');

export function settlementInfo() {
  const bank = process.env.SETTLEMENT_BANK || SETTLEMENT.bank;
  const accountName = process.env.SETTLEMENT_ACCOUNT_NAME || SETTLEMENT.accountName;
  const accountNumber = process.env.SETTLEMENT_ACCOUNT_NUMBER || SETTLEMENT.accountNumber;
  return { bank, accountName, accountMasked: maskAcct(accountNumber), mode: MODE };
}

// ---- provider registry ----
export const PROVIDERS = {
  orange_money: { id: 'orange_money', name: 'Orange Money', color: '#ff7900' },
  myzaka:       { id: 'myzaka',       name: 'MyZaka (Mascom)', color: '#0a3d91' },
  smega:        { id: 'smega',        name: 'Smega (beMobile)', color: '#00a89c' },
};

export const isProvider = (p) => Object.prototype.hasOwnProperty.call(PROVIDERS, p);
export const paymentsMode = () => MODE;

const simRef = (p) => `SIM-${p.toUpperCase().slice(0, 3)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

// Each adapter collects `amountBwp` from the payer's wallet into Nimbus's
// merchant balance, which settles to SETTLEMENT.accountNumber.
const adapters = {
  async orange_money({ amountBwp, phone, reference, description }) {
    if (MODE === 'simulate') return { status: 'captured', providerRef: simRef('orange') };
    // LIVE: Orange Money Web Payment / Collection API.
    //   POST https://api.orange.com/orange-money-webpay/.../webPayment
    //   Auth: OAuth bearer from OM_CLIENT_ID/OM_CLIENT_SECRET (env).
    //   Pass amount (BWP), reference, return/notif URLs (your /webhook).
    //   Returns a payment_url for USSD/redirect; final state via webhook.
    throw new Error('Orange Money live mode not configured (set OM_CLIENT_ID / OM_CLIENT_SECRET and implement the call).');
  },
  async myzaka({ amountBwp, phone, reference, description }) {
    if (MODE === 'simulate') return { status: 'captured', providerRef: simRef('myzaka') };
    // LIVE: Mascom MyZaka merchant collection (push-to-pay / USSD prompt).
    //   Use your MyZaka merchant code + API key (env). Initiate a collection
    //   to `phone` for `amountBwp`; confirm via /webhook callback.
    throw new Error('MyZaka live mode not configured.');
  },
  async smega({ amountBwp, phone, reference, description }) {
    if (MODE === 'simulate') return { status: 'captured', providerRef: simRef('smega') };
    // LIVE: Smega (beMobile) collection, typically via an aggregator
    //   (e.g. DPO/Flutterwave) or beMobile merchant API. Initiate collection,
    //   confirm via /webhook.
    throw new Error('Smega live mode not configured.');
  },
};

/**
 * Collect a payment. Returns { status: 'captured'|'pending', providerRef }.
 * In simulate mode always 'captured'. In live mode 'pending' until the
 * provider's webhook confirms (your webhook then funds the escrow).
 */
export async function collect({ provider, amountBwp, phone, reference, description }) {
  if (!isProvider(provider)) throw new Error('Unknown payment provider');
  if (!(amountBwp > 0)) throw new Error('Invalid amount');
  return adapters[provider]({ amountBwp, phone, reference, description });
}

/**
 * Verify a provider webhook. In live mode you MUST check the signature/secret
 * the provider sends. Returns the reference + captured flag.
 */
export function parseWebhook(provider, body, _headers) {
  // LIVE: verify HMAC/signature against PAYMENTS_WEBHOOK_SECRET here before trusting `body`.
  const reference = body?.reference || body?.metadata?.reference || null;
  const captured = MODE === 'simulate' ? true : Boolean(body?.success || body?.status === 'SUCCESS');
  return { reference, captured, providerRef: body?.providerRef || body?.transaction_id || null };
}
