// fees.js — money math. Single source of truth for what a student pays,
// what's held in escrow, and what Nimbus earns. All amounts in BWP (pula).

export const TENANT_FEE_RATE = 0.08; // of one month's rent
export const TENANT_FEE_MIN = 150;
export const TENANT_FEE_MAX = 300;
export const LANDLORD_COMMISSION_RATE = 0.06; // taken from landlord payout, not the student

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round2 = (n) => Math.round(n * 100) / 100;

// One-time, non-refundable Nimbus service fee charged to the student.
export function tenantServiceFee(rent) {
  return Math.round(clamp(rent * TENANT_FEE_RATE, TENANT_FEE_MIN, TENANT_FEE_MAX));
}

/**
 * Full booking breakdown.
 * - deposit + first month's rent are HELD IN ESCROW (released to the
 *   landlord only after the student verifies move-in).
 * - the service fee is taken by Nimbus up front.
 * - landlordPayout / platformCommission show how the escrowed money splits
 *   when it's eventually released.
 */
export function bookingBreakdown({ rent, deposit }) {
  const serviceFee = tenantServiceFee(rent);
  const escrowHeld = round2(rent + deposit); // first month + deposit
  const totalDueNow = round2(escrowHeld + serviceFee);

  const platformCommission = round2(rent * LANDLORD_COMMISSION_RATE);
  const landlordPayout = round2(escrowHeld - platformCommission);

  return {
    rent: round2(rent),
    deposit: round2(deposit),
    serviceFee,
    escrowHeld,
    totalDueNow,
    platformCommission,
    landlordPayout,
    currency: 'BWP',
  };
}
