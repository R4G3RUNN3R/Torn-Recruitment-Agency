const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'global', 'google-apps-script', 'Code.gs');

function source() {
  return fs.readFileSync(file, 'utf8');
}

test('Apps Script exposes observe, player, and meta endpoints with fixed sheets', () => {
  const s = source();
  assert.match(s, /function\s+doGet/);
  assert.match(s, /function\s+doPost/);
  assert.match(s, /function\s+handleObserve_/);
  assert.match(s, /function\s+handlePlayer_/);
  assert.match(s, /function\s+handleMeta_/);
  assert.match(s, /Players/);
  assert.match(s, /Observations/);
  assert.match(s, /Meta/);
  assert.match(s, /MAX_HISTORY\s*=\s*100/);
  assert.match(s, /DEDUPE_WINDOW_MS\s*=\s*30\s*\*\s*60\s*\*\s*1000/);
});

test('Apps Script validates and locks writes without accepting client-selected ranges', () => {
  const s = source();
  assert.match(s, /LockService/);
  assert.match(s, /sanitizePayload_/);
  assert.match(s, /materiallyEqual_/);
  assert.match(s, /CacheService/);
  assert.doesNotMatch(s, /setFormula/);
  assert.doesNotMatch(s, /getSheetByName\s*\(\s*payload/);
  assert.doesNotMatch(s, /getRange\s*\(\s*payload/);
});

test('Apps Script schema whitelist contains only approved global intelligence fields', () => {
  const s = source();
  for (const field of ['playerId','name','observedAt','level','ee','activity30','xanax30','refills30','attacks30','rwHits30','networth','fit','fitType','lastActive','scoutStatus','sourceVersion']) {
    assert.match(s, new RegExp(`['\"]${field}['\"]`));
  }
  for (const forbidden of ['apiKey','contactHistory','messageContents','recruiterNotes']) {
    assert.doesNotMatch(s, new RegExp(forbidden, 'i'));
  }
});
