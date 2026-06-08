// ab.js — A/B experiment definition + assignment logic
//
// One experiment is defined here. To run a different test, edit the
// variant strings below (they are matched against the HTML template by
// exact substring replacement) or add a new experiment object.

export const EXPERIMENT = {
  id: 'hero_headline_v1',

  // 50/50 split. Weights must sum to 1.
  weights: { A: 0.5, B: 0.5 },

  // Variant A is what's written literally in public/index.html, so it is
  // the default a static viewer sees. The server only rewrites the page
  // when a visitor is assigned variant B.
  variants: {
    A: {
      headline: `Finding a home shouldn't be the <span class="em-italic">hardest part</span> of your degree.`,
      cta: `Join waitlist →`,
    },
    B: {
      headline: `Student housing in Gaborone, <span class="em-italic">finally</span> done right.`,
      cta: `Reserve my spot →`,
    },
  },
};

export const VARIANTS = Object.keys(EXPERIMENT.variants); // ['A','B']

export function isValidVariant(v) {
  return VARIANTS.includes(v);
}

// Weighted random assignment.
export function assignVariant(rand = Math.random) {
  const r = rand();
  let cumulative = 0;
  for (const v of VARIANTS) {
    cumulative += EXPERIMENT.weights[v] ?? 0;
    if (r < cumulative) return v;
  }
  return VARIANTS[VARIANTS.length - 1]; // float-safety fallback
}

// Render the HTML template for a given variant.
// Variant A == the template as written, so we only rewrite for others.
export function renderVariant(template, variant) {
  let html = template;
  if (variant !== 'A' && EXPERIMENT.variants[variant]) {
    const A = EXPERIMENT.variants.A;
    const V = EXPERIMENT.variants[variant];
    html = html.replace(A.headline, V.headline);
    html = html.replace(A.cta, V.cta);
  }
  return html;
}
