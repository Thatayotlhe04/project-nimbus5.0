// test/ab.test.js — pure unit tests for the A/B logic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENT, VARIANTS, assignVariant, isValidVariant, renderVariant } from '../ab.js';

test('weights sum to 1', () => {
  const sum = VARIANTS.reduce((acc, v) => acc + EXPERIMENT.weights[v], 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test('assignVariant always returns a valid variant', () => {
  for (let i = 0; i < 1000; i++) {
    assert.ok(isValidVariant(assignVariant()));
  }
});

test('assignVariant respects the boundary deterministically', () => {
  assert.equal(assignVariant(() => 0.0), 'A'); // bottom of range -> A
  assert.equal(assignVariant(() => 0.49), 'A'); // just under 0.5 -> A
  assert.equal(assignVariant(() => 0.5), 'B'); // at/over 0.5 -> B
  assert.equal(assignVariant(() => 0.999), 'B');
});

test('assignVariant is ~50/50 over many samples', () => {
  let a = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) if (assignVariant() === 'A') a++;
  const ratio = a / N;
  assert.ok(ratio > 0.45 && ratio < 0.55, `ratio was ${ratio}`);
});

test('renderVariant leaves variant A untouched', () => {
  const tpl = `<h1>${EXPERIMENT.variants.A.headline}</h1><button>${EXPERIMENT.variants.A.cta}</button>`;
  assert.equal(renderVariant(tpl, 'A'), tpl);
});

test('renderVariant swaps headline + CTA for variant B', () => {
  const tpl = `<h1>${EXPERIMENT.variants.A.headline}</h1><button>${EXPERIMENT.variants.A.cta}</button>`;
  const out = renderVariant(tpl, 'B');
  assert.ok(out.includes(EXPERIMENT.variants.B.headline));
  assert.ok(out.includes(EXPERIMENT.variants.B.cta));
  assert.ok(!out.includes(EXPERIMENT.variants.A.headline));
});

test('isValidVariant rejects junk', () => {
  assert.equal(isValidVariant('A'), true);
  assert.equal(isValidVariant('C'), false);
  assert.equal(isValidVariant(undefined), false);
});
