// data/seed.js — the demo marketplace dataset.
// Coordinates are approximate real Gaborone locations. This same data
// drives the in-memory store AND is compiled into 0004_seed.sql, so the
// app behaves identically with or without Supabase.

// ---- Campuses ----
export const campuses = [
  { id: 'ub',      name: 'University of Botswana',          short: 'UB',      lat: -24.6647, lng: 25.9389 },
  { id: 'bac',     name: 'Botswana Accountancy College',    short: 'BAC',     lat: -24.6520, lng: 25.9180 },
  { id: 'botho',   name: 'Botho University',                short: 'Botho',   lat: -24.6790, lng: 25.8870 },
  { id: 'baisago', name: 'BA ISAGO University',             short: 'BA ISAGO',lat: -24.6560, lng: 25.9050 },
];

// Neighbourhood centroids (used as combi pickup points + listing anchors).
const N = {
  block6:       { lat: -24.6470, lng: 25.9300 },
  block7:       { lat: -24.6545, lng: 25.9350 },
  block8:       { lat: -24.6605, lng: 25.9425 },
  block9:       { lat: -24.6700, lng: 25.9305 },
  block10:      { lat: -24.6755, lng: 25.9255 },
  extension:    { lat: -24.6600, lng: 25.9355 },
  nearUB:       { lat: -24.6630, lng: 25.9370 },
  gabwest2:     { lat: -24.6620, lng: 25.8950 },
  phase4:       { lat: -24.6705, lng: 25.8985 },
  broadhurst:   { lat: -24.6305, lng: 25.9300 },
  phakalane:    { lat: -24.5850, lng: 25.9650 },
  tlokweng:     { lat: -24.6655, lng: 25.9760 },
  mogoditshane: { lat: -24.6280, lng: 25.8650 },
  naledi:       { lat: -24.6755, lng: 25.9105 },
  nearBAC:      { lat: -24.6540, lng: 25.9150 },
  nearBotho:    { lat: -24.6770, lng: 25.8900 },
};

// ---- Combi routes ----
export const routes = [
  { id: 'r1', name: 'Blocks → UB Gate',        color: '#C97B5E', fare: 4.5, servesCampusIds: ['ub'],
    pickups: [N.block6, N.block7, N.block8, N.extension, N.nearUB] },
  { id: 'r2', name: 'Tlokweng → Main Mall',    color: '#6E8462', fare: 5.0, servesCampusIds: ['ub'],
    pickups: [N.tlokweng, N.extension, N.nearUB] },
  { id: 'r3', name: 'Gaborone West → CBD',     color: '#A85A3D', fare: 4.5, servesCampusIds: ['bac', 'baisago', 'botho'],
    pickups: [N.gabwest2, N.phase4, N.nearBAC] },
  { id: 'r4', name: 'Broadhurst → Station',    color: '#4F6147', fare: 4.5, servesCampusIds: ['bac', 'baisago'],
    pickups: [N.broadhurst, N.block6, N.nearBAC] },
  { id: 'r5', name: 'Mogoditshane → Station',  color: '#8a6d3b', fare: 6.5, servesCampusIds: ['botho', 'baisago'],
    pickups: [N.mogoditshane, N.nearBotho] },
  { id: 'r6', name: 'Phakalane → CBD',         color: '#b08968', fare: 7.0, servesCampusIds: ['bac'],
    pickups: [N.phakalane, N.nearBAC] },
  { id: 'r7', name: 'Block 9/10 → UB',         color: '#93A786', fare: 4.5, servesCampusIds: ['ub'],
    pickups: [N.block9, N.block10, N.nearUB] },
];

// small deterministic jitter so markers don't stack
const j = (base, dlat, dlng) => ({ lat: base.lat + dlat, lng: base.lng + dlng });

// ---- Listings ----
export const listings = [
  { id: 'blk7-studio', title: 'Bright studio, Block 7', neighbourhood: 'Block 7',
    roomType: 'studio', rent: 2900, deposit: 2900, verified: true, beds: 1, baths: 1,
    amenities: ['Furnished', 'Prepaid electricity', 'Wi-Fi ready', 'Security bars', 'Study desk'],
    description: 'A self-contained studio a short walk from the UB gate — your own bathroom, kitchenette, and a quiet street.',
    ...j(N.block7, 0.0010, -0.0008) },

  { id: 'blk6-private', title: 'Private room, family home in Block 6', neighbourhood: 'Block 6',
    roomType: 'private', rent: 1800, deposit: 1800, verified: true, beds: 1, baths: 1,
    amenities: ['Shared kitchen', 'Water included', 'Wi-Fi', 'Parking', 'Furnished'],
    description: 'Private room with a shared kitchen in a secure family compound. Great combi access in every direction.',
    ...j(N.block6, -0.0009, 0.0011) },

  { id: 'ext-shared', title: 'Shared twin room near UB', neighbourhood: 'Extension 12',
    roomType: 'shared', rent: 1300, deposit: 1300, verified: true, beds: 2, baths: 1,
    amenities: ['Shared kitchen', 'Water included', 'Walk to campus', 'Study desk'],
    description: 'Split the rent with a roommate, minutes on foot from UB. Best value for first-years.',
    ...j(N.extension, 0.0006, 0.0006) },

  { id: 'blk8-studio', title: 'New-build studio, Block 8', neighbourhood: 'Block 8',
    roomType: 'studio', rent: 3200, deposit: 3200, verified: false, beds: 1, baths: 1,
    amenities: ['En-suite bathroom', 'Prepaid electricity', 'Furnished', 'Security bars'],
    description: 'A brand-new self-contained studio. Inspection pending — request a verified visit before you book.',
    ...j(N.block8, 0.0008, -0.0010) },

  { id: 'tlokweng-private', title: 'Private room in Tlokweng', neighbourhood: 'Tlokweng',
    roomType: 'private', rent: 1600, deposit: 1600, verified: true, beds: 1, baths: 1,
    amenities: ['Shared kitchen', 'Wi-Fi', 'Parking', 'Water included'],
    description: 'Spacious private room on the Tlokweng combi line straight to UB. Quieter, greener, cheaper.',
    ...j(N.tlokweng, -0.0007, -0.0009) },

  { id: 'phakalane-studio', title: 'Upmarket studio, Phakalane', neighbourhood: 'Phakalane',
    roomType: 'studio', rent: 3500, deposit: 3500, verified: true, beds: 1, baths: 1,
    amenities: ['En-suite bathroom', 'Furnished', 'Wi-Fi', 'Parking', 'Backup water'],
    description: 'A premium studio in leafy Phakalane for students who want their own space and don\u2019t mind the commute.',
    ...j(N.phakalane, 0.0011, 0.0007) },

  { id: 'gabwest2-private', title: 'Private room, Gaborone West Phase 2', neighbourhood: 'Gaborone West Phase 2',
    roomType: 'private', rent: 1750, deposit: 1750, verified: true, beds: 1, baths: 1,
    amenities: ['Shared kitchen', 'Wi-Fi', 'Water included', 'Furnished'],
    description: 'Close to BAC, BA ISAGO and Botho via the West\u2013CBD combi. Tidy room in a well-kept yard.',
    ...j(N.gabwest2, -0.0008, 0.0010) },

  { id: 'phase4-shared', title: 'Shared room, Phase 4', neighbourhood: 'Phase 4',
    roomType: 'shared', rent: 1200, deposit: 1200, verified: true, beds: 2, baths: 1,
    amenities: ['Shared kitchen', 'Water included', 'Wi-Fi'],
    description: 'Budget shared room with easy combi links toward the CBD campuses.',
    ...j(N.phase4, 0.0006, -0.0006) },

  { id: 'broadhurst-studio', title: 'Studio flat, Broadhurst', neighbourhood: 'Broadhurst',
    roomType: 'studio', rent: 2700, deposit: 2700, verified: true, beds: 1, baths: 1,
    amenities: ['Furnished', 'Prepaid electricity', 'Wi-Fi', 'Security bars'],
    description: 'Independent studio in busy Broadhurst, walkable to shops and on the Station combi route.',
    ...j(N.broadhurst, -0.0010, 0.0008) },

  { id: 'mogoditshane-private', title: 'Private room, Mogoditshane', neighbourhood: 'Mogoditshane',
    roomType: 'private', rent: 1400, deposit: 1400, verified: false, beds: 1, baths: 1,
    amenities: ['Shared kitchen', 'Water included', 'Parking'],
    description: 'Affordable private room west of the city. Inspection pending.',
    ...j(N.mogoditshane, 0.0009, 0.0011) },

  { id: 'blk9-private', title: 'Private en-suite, Block 9', neighbourhood: 'Block 9',
    roomType: 'private', rent: 1900, deposit: 1900, verified: true, beds: 1, baths: 1,
    amenities: ['En-suite bathroom', 'Shared kitchen', 'Wi-Fi', 'Furnished'],
    description: 'Private room with its own bathroom, on the Block 9/10 combi line to UB.',
    ...j(N.block9, 0.0007, -0.0007) },

  { id: 'blk10-shared', title: 'Shared room, Block 10', neighbourhood: 'Block 10',
    roomType: 'shared', rent: 1250, deposit: 1250, verified: true, beds: 2, baths: 1,
    amenities: ['Shared kitchen', 'Water included', 'Study desk'],
    description: 'Cheap and cheerful shared room with a direct combi to UB.',
    ...j(N.block10, -0.0006, 0.0009) },

  { id: 'naledi-shared', title: 'Shared room, Old Naledi', neighbourhood: 'Old Naledi',
    roomType: 'shared', rent: 1100, deposit: 1100, verified: false, beds: 2, baths: 1,
    amenities: ['Shared kitchen', 'Water included'],
    description: 'The cheapest option on Nimbus right now. Inspection pending — book a verified visit first.',
    ...j(N.naledi, 0.0008, 0.0006) },

  { id: 'blk7-ensuite', title: 'En-suite studio, Block 7', neighbourhood: 'Block 7',
    roomType: 'studio', rent: 3100, deposit: 3100, verified: true, beds: 1, baths: 1,
    amenities: ['En-suite bathroom', 'Furnished', 'Prepaid electricity', 'Wi-Fi', 'Parking'],
    description: 'Premium en-suite studio walkable to UB, with secure parking and fast Wi-Fi.',
    ...j(N.block7, -0.0011, 0.0007) },
];

export const ROOM_TYPES = {
  studio:  'Independent studio',
  private: 'Private room (shared kitchen)',
  shared:  'Shared room',
};
