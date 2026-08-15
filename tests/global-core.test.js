const test = require('node:test');
const assert = require('node:assert/strict');
const GlobalCore = require('../src/global-core');

test('sanitizeObservation emits only the approved global whitelist', () => {
  const out = GlobalCore.sanitizeObservation({
    playerId: 3877028,
    name: 'R4G3',
    observedAt: 1786788000000,
    level: 52,
    ee: 9,
    activity30: 142,
    xanax30: 61,
    refills30: 27,
    attacks30: 216,
    rwHits30: 44,
    networth: 2100000000,
    fit: 86,
    fitType: 'official',
    lastActive: 1786787700000,
    scoutStatus: 'fresh',
    apiKey: 'SECRET',
    notes: 'private',
    contactHistory: [{ at: 1 }],
    settings: { anything: true }
  }, '4.3.0');

  assert.deepEqual(Object.keys(out), GlobalCore.GLOBAL_FIELDS);
  assert.equal(out.playerId, 3877028);
  assert.equal(out.sourceVersion, '4.3.0');
  assert.equal('apiKey' in out, false);
  assert.equal('notes' in out, false);
  assert.equal('contactHistory' in out, false);
  assert.equal('settings' in out, false);
});

test('sanitizeObservation permits unavailable optional values but rejects bad identity and timestamp', () => {
  const out = GlobalCore.sanitizeObservation({
    playerId: 1,
    name: '=FORMULA',
    observedAt: 1786788000000,
    activity30: null,
    fit: undefined
  }, '4.3.0');
  assert.equal(out.activity30, null);
  assert.equal(out.fit, null);
  assert.equal(out.name.startsWith("'="), true);
  assert.throws(() => GlobalCore.sanitizeObservation({ playerId: 0, observedAt: 1 }, '4.3.0'), /playerId/i);
  assert.throws(() => GlobalCore.sanitizeObservation({ playerId: 1, observedAt: 0 }, '4.3.0'), /observedAt/i);
});

test('sanitizeObservation does not preserve negative counters', () => {
  const out = GlobalCore.sanitizeObservation({ playerId: 10, observedAt: 1786788000000, xanax30: -5 }, '4.3.0');
  assert.equal(out.xanax30, null);
});

test('buildObservePayload is reconstructed from sanitized fields only', () => {
  const payload = GlobalCore.buildObservePayload({
    playerId: 10,
    name: 'Ten',
    observedAt: 1786788000000,
    level: 20,
    notes: 'never upload this',
    apiKey: 'also never upload this'
  }, '4.3.0');
  assert.equal(payload.action, 'observe');
  assert.equal(payload.schema, 1);
  assert.deepEqual(payload.player, { id: 10, name: 'Ten', level: 20 });
  assert.equal('notes' in payload.observation, false);
  assert.equal('apiKey' in payload.observation, false);
});

test('materiallyEqual ignores sourceVersion and scoutStatus-only changes', () => {
  const a = { level: 10, fit: 80, sourceVersion: '4.3.0', scoutStatus: 'fresh' };
  const b = { level: 10, fit: 80, sourceVersion: '4.3.1', scoutStatus: 'cached' };
  assert.equal(GlobalCore.materiallyEqual(a, b), true);
  assert.equal(GlobalCore.materiallyEqual(a, { ...b, fit: 81 }), false);
});

test('pickPreferredValue honors LIVE > LOCAL > GLOBAL > HISTORICAL > forum', () => {
  assert.deepEqual(GlobalCore.pickPreferredValue({ local: 3, global: 2 }), { value: 3, provenance: 'LOCAL' });
  assert.deepEqual(GlobalCore.pickPreferredValue({ global: 2, historical: 1 }), { value: 2, provenance: 'GLOBAL' });
  assert.deepEqual(GlobalCore.pickPreferredValue({ live: 5, local: 4, global: 3 }), { value: 5, provenance: 'LIVE' });
  assert.deepEqual(GlobalCore.pickPreferredValue({ live: null, local: null, global: 7 }), { value: 7, provenance: 'GLOBAL' });
});

test('classifyRetry distinguishes permanent data failures from transient failures', () => {
  assert.equal(GlobalCore.classifyRetry({ ok: false, code: 'INVALID_SCHEMA' }), 'permanent');
  assert.equal(GlobalCore.classifyRetry({ ok: false, code: 'INVALID_BODY' }), 'permanent');
  assert.equal(GlobalCore.classifyRetry({ ok: false, code: 'RATE_LIMIT' }), 'retry');
  assert.equal(GlobalCore.classifyRetry(new Error('network')), 'retry');
});

test('normalizePlayerHistory bounds and sanitizes service output', () => {
  const raw = {
    ok: true,
    playerId: 10,
    latest: { playerId: 10, name: 'Ten', observedAt: 1786788000000, fit: 80, secret: 'x' },
    history: Array.from({ length: 120 }, (_, i) => ({ playerId: 10, name: 'Ten', observedAt: 1786788000000 - i * 1000, fit: 80 - i / 10, secret: 'x' })),
    observationCount: 120,
    firstSeen: 1786000000000,
    lastSeen: 1786788000000
  };
  const out = GlobalCore.normalizePlayerHistory(raw);
  assert.equal(out.history.length, 100);
  assert.equal('secret' in out.latest, false);
  assert.equal('secret' in out.history[0], false);
});

test('makeQueueId is deterministic from player and observation time', () => {
  const obs = { playerId: 3877028, observedAt: 1786788000000 };
  assert.equal(GlobalCore.makeQueueId(obs), '3877028:1786788000000');
  assert.equal(GlobalCore.makeQueueId(obs), GlobalCore.makeQueueId({ ...obs }));
});
