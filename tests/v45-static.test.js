const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname,'..','next','R4G3RUNN3R-Recruitment-Agency-v4.5.user.js');
function source(){ return fs.readFileSync(file,'utf8'); }

test('v4.5 replacement userscript loads all required cores and targets DB12', () => {
  const s=source();
  assert.match(s, /@version\s+4\.5\.0/);
  assert.match(s, /SCRIPT_VERSION\s*=\s*['"]4\.5\.0['"]/);
  assert.match(s, /REQUIRED_DB_VERSION\s*=\s*12/);
  for (const core of ['scout-core','results-core','global-core','match-core','forum-core','v45-runtime']) assert.match(s,new RegExp(`src/${core}\\.js`));
  assert.doesNotMatch(s,/deleteObjectStore\s*\(/);
});

test('v4.5 DB migration adds forum sources with exact indexes and sync checkpoints', () => {
  const s=source();
  assert.match(s,/createObjectStore\('forumSources',\s*\{keyPath:'sourceId'\}\)/);
  for (const index of ['userId','postedAt','sourceType','threadId']) assert.match(s,new RegExp(`createIndex\\('${index}','${index}'`));
  assert.match(s,/createObjectStore\('forumSyncState',\s*\{keyPath:'feedId'\}\)/);
  assert.match(s,/createObjectStore\('candidateLocal',\s*\{keyPath:'userId'\}\)/);
});

test('new application shell is movable resizable routed and responsive', () => {
  const s=source();
  assert.match(s,/#ra-v45-app\{[^}]*resize:both/);
  assert.match(s,/function\s+bindWindowDrag\s*\(/);
  assert.match(s,/function\s+saveGeometry\s*\(/);
  assert.match(s,/function\s+restoreGeometry\s*\(/);
  assert.match(s,/data-ra-page/);
  assert.match(s,/route\(page/);
  assert.match(s,/@media\(max-width:900px\)/);
  assert.match(s,/@media\(max-width:640px\)/);
});

test('sidebar exposes exact v4.5 page labels and Simple hides Logs through runtime navigation', () => {
  const s=source();
  for (const label of ['Overview','Discover','Candidates','Pipeline','Scout','Smart Match','Global Intelligence','Settings','Data','Logs']) assert.ok(s.includes(label),`missing page label ${label}`);
  assert.match(s,/V45\.visiblePages\(settings\.complexity\)/);
});

test('Settings is a routed page with all eight approved sections', () => {
  const s=source();
  assert.match(s,/settings:renderSettings/);
  for (const section of ['General','Recruitment','Scout','Candidates','Smart Match','Global Intelligence','Data & Reset','Danger Zone']) assert.ok(s.includes(section),`missing settings section ${section}`);
  assert.match(s,/activePage:'overview'/);
  assert.match(s,/route\('settings'/);
});

test('Danger Zone contains the explicit biohazard NUKE control and double confirmation', () => {
  const s=source();
  assert.match(s,/☣ NUKE IT ALL!/);
  assert.match(s,/function\s+hardLocalReset\s*\(/);
  assert.match(s,/confirm\('NUKE IT ALL/);
  assert.match(s,/Type NUKE to confirm/);
  assert.match(s,/\.trim\(\)\.toUpperCase\(\) !== 'NUKE'/);
});

test('context help is attached to panel or section headers and clamps to viewport', () => {
  const s=source();
  assert.match(s,/class=\"ra-v45-panel-head\"/);
  assert.match(s,/helpButton\(helpKey\)/);
  assert.match(s,/function\s+positionHelp\s*\(/);
  assert.match(s,/getBoundingClientRect/);
  assert.match(s,/innerWidth/);
  assert.match(s,/innerHeight/);
  assert.match(s,/event\.key==='Escape'/);
});

test('dark theme uses readable off-white text and restrained green accents while light stays black', () => {
  const s=source();
  assert.match(s,/:root\{[^}]*--ra-text:#edf4ef[^}]*--ra-accent:#46c96f/);
  assert.match(s,/:root\[data-ra-theme="light"\]\{[^}]*--ra-text:#000000/);
  assert.doesNotMatch(s,/:root\{[^}]*--ra-text:#39ff14/);
});

test('shared Torn scheduler enforces 75 per minute and at least 800ms between calls', () => {
  const s=source();
  assert.match(s,/MIN_API_GAP_MS\s*=\s*800/);
  assert.match(s,/HARD_API_RATE\s*=\s*75/);
  assert.match(s,/Math\.max\(MIN_API_GAP_MS,\s*60000\s*\/\s*clampRate\(settings\.scout\.rate\)\)/);
  assert.match(s,/async function tornRequest/);
  assert.match(s,/await reserveApiCall\(\)/);
});

test('v4.5 shell contains no automatic Torn message send or implicit Contacted transition', () => {
  const s=source();
  assert.doesNotMatch(s,/auto.?send/i);
  assert.doesNotMatch(s,/sendMessage\s*\(/);
  assert.doesNotMatch(s,/pipelineStage\s*=\s*['"]Contacted['"]/);
  assert.match(s,/Opening profiles, forum posts or message compose never changes stage automatically/);
});

test('Torn launcher and fallback launcher are both present', () => {
  const s=source();
  assert.match(s,/ensureTornLauncher/);
  assert.match(s,/ra-v45-sidebar-launcher/);
  assert.match(s,/ra-v45-launch/);
  assert.match(s,/MutationObserver/);
});
