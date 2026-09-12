const test = require('node:test');
const assert = require('node:assert/strict');
const Shell = require('../src/v48-shell');

test('defaults to Company core surface with optional modules hidden', () => {
  const prefs = Shell.normalizePrefs({});
  assert.equal(prefs.domain, 'company');
  assert.deepEqual(Shell.visibleOptionalRoutes(prefs, 'company'), []);
  assert.deepEqual(Shell.visibleOptionalRoutes(prefs, 'faction'), []);
});

test('only explicitly enabled optional routes are exposed for their domain', () => {
  const prefs = Shell.normalizePrefs({optional:{pipeline:true, scout:true, factionRequirements:true}});
  assert.deepEqual(Shell.visibleOptionalRoutes(prefs, 'company').map(x => x.id), ['company-pipeline','scout']);
  assert.deepEqual(Shell.visibleOptionalRoutes(prefs, 'faction').map(x => x.id), ['faction-pipeline','faction-requirements','scout']);
});

test('END MAN INT thresholds and text search filter candidate results', () => {
  const rows = [
    {userId:'1', name:'Alpha', man:80000, int:60000, end:130000},
    {userId:'2', name:'Bravo', man:120000, int:55000, end:95000},
    {userId:'3', name:'Charlie', man:null, int:200000, end:200000}
  ];
  assert.deepEqual(
    rows.filter(row => Shell.matchesCoreSearch(row,{text:'alp',minMan:'75k',minInt:'50k',minEnd:'100k'})).map(r=>r.userId),
    ['1']
  );
  assert.deepEqual(
    rows.filter(row => Shell.matchesCoreSearch(row,{text:'',minMan:'100k',minInt:'',minEnd:''})).map(r=>r.userId),
    ['2']
  );
});

test('unknown stats fail a requested stat threshold instead of being treated as zero or passing', () => {
  assert.equal(Shell.matchesCoreSearch({name:'Unknown',man:null,int:100000,end:100000},{minMan:'1'}), false);
  assert.equal(Shell.matchesCoreSearch({name:'Unknown',man:null,int:100000,end:100000},{minMan:''}), true);
});

test('last-online formatter is human readable and explicit when unavailable', () => {
  const now = Date.UTC(2026,8,12,16,0,0);
  assert.equal(Shell.formatLastOnline(now - 35_000, now), '35 seconds ago');
  assert.equal(Shell.formatLastOnline(now - 7*60_000, now), '7 minutes ago');
  assert.equal(Shell.formatLastOnline(now - 3*60*60_000, now), '3 hours ago');
  assert.equal(Shell.formatLastOnline(now - 4*24*60*60_000, now), '4 days ago');
  assert.equal(Shell.formatLastOnline(null, now), 'Unknown');
});

test('domain route keeps the simple Search and Results surface domain-specific', () => {
  assert.equal(Shell.coreRoute('company'), 'company-candidates');
  assert.equal(Shell.coreRoute('faction'), 'faction-candidates');
});

test('premium shell palette is Voidsmith graphite/red rather than the legacy green accent', () => {
  const css = Shell.premiumCss();
  assert.match(css, /--ra-accent:#d84a4a/i);
  assert.match(css, /#09090b/i);
  assert.doesNotMatch(css, /#46c96f/i);
});
