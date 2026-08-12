const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('../src/scout-core.js');

test('normalizes scoring weights to 100 while preserving targets', () => {
  const cfg = core.normalizeScoring({
    targets: { xanax: 60, activityHours: 120, refills: 25, attacks: 200, rwHits: 40 },
    weights: { xanax: 10, activityHours: 20, refills: 30, attacks: 20, rwHits: 20 }
  });
  const sum = Object.values(cfg.weights).reduce((a, b) => a + b, 0);
  assert.equal(sum, 100);
  assert.equal(cfg.targets.xanax, 60);
  assert.equal(cfg.weights.xanax, 10);
});

test('falls back to equal weights when all configured weights are zero', () => {
  const cfg = core.normalizeScoring({ weights: { xanax: 0, activityHours: 0, refills: 0, attacks: 0, rwHits: 0 } });
  assert.deepEqual(cfg.weights, { xanax: 20, activityHours: 20, refills: 20, attacks: 20, rwHits: 20 });
});

test('default target activity earns a Fit of 100', () => {
  const fit = core.scoreFit({ xanax: 60, activityHours: 120, refills: 25, attacks: 200, rwHits: 40 });
  assert.equal(fit.score, 100);
  assert.equal(fit.components.xanax, 20);
});

test('linear scoring gives half credit and caps over-target activity', () => {
  const fit = core.scoreFit({ xanax: 30, activityHours: 240, refills: 0, attacks: 0, rwHits: 0 });
  assert.equal(fit.components.xanax, 10);
  assert.equal(fit.components.activityHours, 20);
  assert.equal(fit.score, 30);
});

test('deltaStats converts Torn lifetime totals into window metrics', () => {
  const current = {
    xantaken: 100, useractivity: 720000, refills: 50, statenhancersused: 9,
    attackswon: 300, attackslost: 40, rankedwarhits: 80, networth: 123456789,
    activestreak: 15, bestactivestreak: 90
  };
  const past = {
    xantaken: 80, useractivity: 360000, refills: 42, statenhancersused: 4,
    attackswon: 240, attackslost: 30, rankedwarhits: 50
  };
  assert.deepEqual(core.deltaStats(current, past), {
    xanax: 20,
    activityHours: 100,
    refills: 8,
    attacks: 70,
    rwHits: 30,
    statEnhancers: 5,
    networth: 123456789,
    activeStreak: 15,
    bestActiveStreak: 90
  });
});

test('deltaStats never creates negative activity deltas', () => {
  const d = core.deltaStats({ xantaken: 2, useractivity: 20 }, { xantaken: 5, useractivity: 30 });
  assert.equal(d.xanax, 0);
  assert.equal(d.activityHours, 0);
});

test('metricsFromTotals treats lifetime totals as the window for young accounts', () => {
  const m = core.metricsFromTotals({ xantaken: 8, useractivity: 36000, refills: 2, attackswon: 5, attackslost: 1, rankedwarhits: 3 });
  assert.equal(m.xanax, 8);
  assert.equal(m.activityHours, 10);
  assert.equal(m.attacks, 6);
});

test('weighted trend compares 7-day pace with 30-day pace', () => {
  const trend = core.computeTrend(
    { xanax: 14, activityHours: 28, refills: 7, attacks: 70, rwHits: 14 },
    { xanax: 30, activityHours: 60, refills: 15, attacks: 150, rwHits: 30 }
  );
  assert.equal(Math.round(trend.percent), 100);
  assert.equal(Math.round(trend.components.xanax), 100);
});

test('trend skips metrics whose 30-day baseline is zero', () => {
  const trend = core.computeTrend(
    { xanax: 7, activityHours: 0, refills: 0, attacks: 0, rwHits: 0 },
    { xanax: 30, activityHours: 0, refills: 0, attacks: 0, rwHits: 0 }
  );
  assert.equal(Math.round(trend.percent), 0);
  assert.deepEqual(Object.keys(trend.components), ['xanax']);
});

test('projectWindow projects a shorter trustworthy window to 30 days', () => {
  const projected = core.projectWindow({ xanax: 14, activityHours: 28, refills: 7, attacks: 70, rwHits: 14 }, 7, 30);
  assert.equal(projected.xanax, 60);
  assert.equal(projected.activityHours, 120);
  assert.equal(projected.attacks, 300);
});

test('provisional Fit uses projected metrics and reports confidence', () => {
  const p = core.provisionalFit({ xanax: 14, activityHours: 28, refills: 7, attacks: 70, rwHits: 14 }, 7);
  assert.equal(p.confidence, 'Low');
  assert.equal(p.days, 7);
  assert.equal(p.score, 100);
});

test('provisional confidence bands match the approved design', () => {
  assert.equal(core.provisionalConfidence(3), 'Very Low');
  assert.equal(core.provisionalConfidence(7), 'Low');
  assert.equal(core.provisionalConfidence(14), 'Medium');
  assert.equal(core.provisionalConfidence(21), 'High');
  assert.equal(core.provisionalConfidence(30), 'Official');
});

test('parseIds extracts unique numeric IDs up to a cap', () => {
  assert.deepEqual(core.parseIds('123, https://www.torn.com/profiles.php?XID=456 123 789', 2), [123, 456]);
});

test('signature is stable for equivalent Scout stat objects', () => {
  const a = { xantaken: 1, useractivity: 2, attackswon: 3, attackslost: 4, refills: 5, rankedwarhits: 6, statenhancersused: 7 };
  const b = { rankedwarhits: 6, refills: 5, attackslost: 4, attackswon: 3, useractivity: 2, xantaken: 1, statenhancersused: 7 };
  assert.equal(core.signature(a), core.signature(b));
});
