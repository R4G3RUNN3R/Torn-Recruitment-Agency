const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'R4G3RUNN3R-Recruitment-Agency.user.js');

function source() {
  return fs.readFileSync(file, 'utf8');
}

test('userscript v4.4 loads Scout, Results, Global and Match cores', () => {
  const s = source();
  assert.match(s, /@version\s+4\.4\.0/);
  assert.match(s, /SCRIPT_VERSION\s*=\s*["']4\.4\.0["']/);
  assert.match(s, /@require\s+https:\/\/raw\.githubusercontent\.com\/R4G3RUNN3R\/Torn-Recruitment-Agency\/main\/src\/scout-core\.js/);
  assert.match(s, /@require\s+https:\/\/raw\.githubusercontent\.com\/R4G3RUNN3R\/Torn-Recruitment-Agency\/main\/src\/results-core\.js/);
  assert.match(s, /@require\s+https:\/\/raw\.githubusercontent\.com\/R4G3RUNN3R\/Torn-Recruitment-Agency\/main\/src\/global-core\.js/);
  assert.match(s, /@require\s+https:\/\/raw\.githubusercontent\.com\/R4G3RUNN3R\/Torn-Recruitment-Agency\/main\/src\/match-core\.js/);
  assert.match(s, /RA_ResultsCore/);
  assert.match(s, /RA_GlobalCore/);
  assert.match(s, /RA_MatchCore/);
});

test('userscript never depends on the Recruit Scout paid backend', () => {
  const s = source();
  assert.doesNotMatch(s, /rs\.dnonetwork\.com/i);
  assert.doesNotMatch(s, /script-session|\/api\/grade|membership/i);
});

test('userscript upgrades IndexedDB additively and defines Scout, Global and Match stores', () => {
  const s = source();
  assert.match(s, /REQUIRED_DB_VERSION\s*=\s*11/);
  assert.match(s, /scoutLatest/);
  assert.match(s, /scoutHistory/);
  assert.match(s, /globalLatest/);
  assert.match(s, /globalHistory/);
  assert.match(s, /globalSyncQueue/);
  assert.match(s, /createObjectStore\(['"]candidateLocal['"],\s*\{\s*keyPath:\s*['"]userId['"]\s*\}\)/);
  assert.match(s, /createObjectStore\(['"]matchProfiles['"],\s*\{\s*keyPath:\s*['"]profileId['"]\s*\}\)/);
  assert.doesNotMatch(s, /deleteObjectStore\s*\(/);
});

test('v4.4 exposes local Smart Match persistence and evaluation helpers', () => {
  const s = source();
  for (const name of [
    'ensureDefaultMatchProfile', 'getActiveMatchProfile', 'saveMatchProfile', 'deleteMatchProfile',
    'getCandidateLocal', 'saveCandidateLocal', 'buildMatchInputRow', 'evaluateRowMatch', 'refreshMatchScores'
  ]) assert.match(s, new RegExp(`function\\s+${name}\\s*\\(`));
  assert.match(s, /activeProfileId/);
  assert.match(s, /candidateLocal/);
  assert.match(s, /matchProfiles/);
});

test('v4.4 Match and recruiter-private fields stay out of global observation construction', () => {
  const s = source();
  const start = s.indexOf('function buildGlobalObservation');
  assert.notEqual(start, -1);
  const end = s.indexOf('\n  }', start);
  const block = s.slice(start, end > start ? end + 4 : start + 2500);
  for (const field of ['desiredRole','expectedSalary','availability','recruiterNote','matchScore','matchProfiles']) {
    assert.equal(block.includes(field), false, `${field} must not enter buildGlobalObservation`);
  }
  assert.match(block, /GlobalCore\.sanitizeObservation/);
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

test('Simple UI is default and Advanced controls are marked', () => {
  const s = source();
  assert.match(s, /complexity:\s*["']simple["']/);
  assert.match(s, /ra-complexity-simple/);
  assert.match(s, /ra-complexity-advanced/);
  assert.match(s, /ra-advanced-only/);
  assert.match(s, /Fit Settings/);
  assert.match(s, /applyComplexityMode/);
});

test('Scout API scheduler defaults to and hard-caps at 75 calls per minute', () => {
  const s = source();
  assert.match(s, /rate:\s*75/);
  assert.match(s, /function\s+clampScoutRate/);
  assert.match(s, /Math\.min\(75,\s*n\(value,\s*75\)\)/);
  assert.match(s, /60000\s*\/\s*clampScoutRate\(settings\.scout\.rate\)/);
});

test('dark theme uses neon green text and light theme uses black text', () => {
  const s = source();
  assert.match(s, /:root\{[^}]*--ra-text:#39ff14[^}]*--ra-muted:#39ff14/);
  assert.match(s, /:root\[data-ra-theme="light"\]\{[^}]*--ra-text:#000000[^}]*--ra-muted:#111111/);
});

test('sidebar launcher and fallback exist', () => {
  const s = source();
  assert.match(s, /ensureSidebarLauncher/);
  assert.match(s, /ra-sidebar-launcher/);
  assert.match(s, /syncFallbackLauncher/);
  assert.match(s, /MutationObserver/);
});

test('shared window manager registers main results and history', () => {
  const s = source();
  assert.match(s, /registerManagedWindow/);
  assert.match(s, /windowGeometry/);
  assert.match(s, /registerManagedWindow\(["']main["']/);
  assert.match(s, /registerManagedWindow\(["']results["']/);
  assert.match(s, /registerManagedWindow\(["']history["']/);
  assert.match(s, /restoreWindowGeometry/);
  assert.match(s, /persistWindowGeometry/);
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

test('v4.2 Results workspace remains simple by default and expandable', () => {
  const s = source();
  assert.match(s, /ra-results-search/);
  assert.match(s, /ra-results-filters-toggle/);
  assert.match(s, /ra-results-columns-toggle/);
  assert.match(s, /ra-results-filters/);
  assert.match(s, /ra-results-columns/);
  assert.match(s, /ra-clear-filters/);
  assert.match(s, /aria-sort/);
  assert.match(s, /data-sort-key/);
  assert.match(s, /DEFAULT_VISIBLE_COLUMNS/);
});

test('v4.2 Results state and UX hardening remain present', () => {
  const s = source();
  assert.match(s, /resultsByMode/);
  assert.match(s, /normalizeResultsSettings/);
  assert.match(s, /resetWindowLayout/);
  assert.match(s, /syncBusyControls/);
  assert.match(s, /scheduleSidebarRecovery/);
  assert.match(s, /SIDEBAR_RETRY/);
});

test('v4.3 Global Intelligence client exposes sync, cache and service controls', () => {
  const s = source();
  assert.match(s, /buildGlobalObservation/);
  assert.match(s, /enqueueGlobalObservation/);
  assert.match(s, /flushGlobalSyncQueue/);
  assert.match(s, /fetchGlobalPlayerHistory/);
  assert.match(s, /testGlobalService/);
  assert.match(s, /ra-global-endpoint/);
  assert.match(s, /ra-global-enabled/);
  assert.match(s, /ra-global-test/);
  assert.match(s, /ra-global-retry/);
  assert.match(s, /ra-global-status/);
  assert.match(s, /Global Intelligence/);
  assert.match(s, /Test Global Service/);
  assert.match(s, /Retry Global Sync/);
});

test('v4.3 keeps global data lower priority and private data out of payload construction', () => {
  const s = source();
  assert.match(s, /LIVE/);
  assert.match(s, /LOCAL/);
  assert.match(s, /GLOBAL/);
  assert.match(s, /HISTORICAL/);
  assert.match(s, /GlobalCore\.sanitizeObservation/);
  assert.doesNotMatch(s, /buildObservePayload\s*\(\s*settings/);
  assert.doesNotMatch(s, /buildObservePayload\s*\(\s*.*apiKey/);
});
