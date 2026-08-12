const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'R4G3RUNN3R-Recruitment-Agency.user.js');

function source() {
  return fs.readFileSync(file, 'utf8');
}

test('userscript is version 4.0.1 and loads the tested Scout core', () => {
  const s = source();
  assert.match(s, /@version\s+4\.0\.1/);
  assert.match(s, /@require\s+https:\/\/raw\.githubusercontent\.com\/R4G3RUNN3R\/Torn-Recruitment-Agency\/main\/src\/scout-core\.js/);
});

test('userscript never depends on the Recruit Scout paid backend', () => {
  const s = source();
  assert.doesNotMatch(s, /rs\.dnonetwork\.com/i);
  assert.doesNotMatch(s, /script-session|\/api\/grade|membership/i);
});

test('userscript upgrades IndexedDB additively and defines Scout stores', () => {
  const s = source();
  assert.match(s, /REQUIRED_DB_VERSION\s*=\s*9/);
  assert.match(s, /scoutLatest/);
  assert.match(s, /scoutHistory/);
  assert.doesNotMatch(s, /deleteObjectStore\s*\(\s*["']users["']/);
});

test('userscript exposes all three modes and hybrid Scout actions', () => {
  const s = source();
  assert.match(s, /value=["']company["']/);
  assert.match(s, /value=["']faction["']/);
  assert.match(s, /value=["']scout["']/);
  assert.match(s, /Scout Selected/);
  assert.match(s, /Scout All/);
  assert.match(s, /autoScoutNew/);
});

test('userscript contains current, seven-day and thirty-day Scout collection', () => {
  const s = source();
  assert.match(s, /7\s*\*\s*86400/);
  assert.match(s, /30\s*\*\s*86400/);
  assert.match(s, /selections[^\n]+personalstats/);
  assert.match(s, /rankedwarhits/);
  assert.match(s, /bestactivestreak/);
});

test('Scout API scheduler defaults to and hard-caps at 75 calls per minute', () => {
  const s = source();
  assert.match(s, /rate:\s*75/);
  assert.match(s, /Math\.min\(75,\s*n\(settings\.scout\.rate,\s*75\)\)/);
  assert.match(s, /60000\s*\/\s*Math\.max\(10,\s*Math\.min\(75,/);
});

test('dark theme uses neon green text and light theme uses black text', () => {
  const s = source();
  assert.match(s, /:root\{[^}]*--ra-text:#39ff14[^}]*--ra-muted:#39ff14/);
  assert.match(s, /:root\[data-ra-theme="light"\]\{[^}]*--ra-text:#000000[^}]*--ra-muted:#111111/);
});

test('userscript contains cache, queue and cache-diagnostic controls', () => {
  const s = source();
  assert.match(s, /12\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  assert.match(s, /historyGapMs/);
  assert.match(s, /32000/);
  assert.match(s, /runCacheDiagnostic/);
  assert.match(s, /pauseScout/);
  assert.match(s, /resumeScout/);
  assert.match(s, /cancelScout/);
});

test('userscript retains forum recruitment scanning and work-stat parsing', () => {
  const s = source();
  assert.match(s, /DEFAULT_COMPANY_CATEGORY_ID\s*=\s*46/);
  assert.match(s, /DEFAULT_FACTION_CATEGORY_ID\s*=\s*24/);
  assert.match(s, /parseUserFromApiPost/);
  assert.match(s, /manual\s*\\s\+labou/i);
  assert.match(s, /fetchForumThreads/);
  assert.match(s, /fetchForumPosts/);
});
