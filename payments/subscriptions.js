// payments/subscriptions.js — recurring plans, billed via the same
// mobile-money adapters used for bookings. Settlement is the same Access
// Bank account configured in providers.js.

import { collect } from './providers.js';

// Monthly subscription tiers. Students stay free (they pay the per-booking
// service fee instead); these plans are how landlords and universities pay.
export const TIERS = {
  'landlord_pro': {
    id: 'landlord_pro',
    name: 'Landlord Pro',
    audience: 'landlords',
    priceBwp: 299,
    interval: 'monthly',
    features: ['Priority placement in search', 'Listing analytics dashboard', 'Bulk upload & calendar', 'Verified-landlord badge'],
  },
  'university_portal': {
    id: 'university_portal',
    name: 'University Portal',
    audience: 'universities',
    priceBwp: 4999,
    interval: 'monthly',
    features: ['White-label off-campus housing portal', 'Student housing directory', 'Occupancy & demand reporting', 'Priority support'],
  },
};

export const isTier = (t) => Object.prototype.hasOwnProperty.call(TIERS, t);
export const listTiers = () => Object.values(TIERS);
export const tierPrice = (t) => (isTier(t) ? TIERS[t].priceBwp : null);

/**
 * Charge the first (or renewal) period for a subscription tier. Uses the same
 * provider adapters as bookings, so simulate/live behaviour is identical.
 * Returns { status: 'captured'|'pending', providerRef }.
 */
export async function collectSubscription({ tier, userId, provider, phone }) {
  if (!isTier(tier)) throw new Error('Unknown subscription tier');
  const amountBwp = TIERS[tier].priceBwp;
  return collect({
    provider,
    amountBwp,
    phone,
    reference: `SUB-${userId}-${Date.now()}`,
    description: `Nimbus ${TIERS[tier].name} (${TIERS[tier].interval})`,
  });
}
