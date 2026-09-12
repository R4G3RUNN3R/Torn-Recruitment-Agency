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

test('company core results keep the full candidate set while merging company workflow state', () => {
  const rows = Shell.buildCandidateRows({
    domain:'company',
    players:[{userId:'1',name:'Alpha',lastActive:1_757_689_000_000},{userId:'2',name:'Bravo'}],
    candidates:[{userId:'1',stats:{end:100,man:200,int:300}},{userId:'2',name:'Bravo Legacy',stats:{end:400,man:500,int:600}}],
    company:[{userId:'2',pipelineStage:'Replied'}],
    faction:[]
  });
  assert.deepEqual(rows.map(row=>row.userId),['1','2']);
  assert.equal(rows[1].workflow.pipelineStage,'Replied');
  assert.equal(rows[1].man,500);
});

test('faction core results remain faction-scoped but reuse shared candidate stats', () => {
  const rows = Shell.buildCandidateRows({
    domain:'faction',
    players:[{userId:'1',name:'Alpha'},{userId:'2',name:'Bravo'}],
    candidates:[{userId:'1',stats:{end:100}},{userId:'2',stats:{end:900,man:800,int:700}}],
    company:[],
    faction:[{userId:'2',pipelineStage:'Evaluating'}]
  });
  assert.deepEqual(rows.map(row=>row.userId),['2']);
  assert.equal(rows[0].end,900);
});

test('last online accepts legacy seconds and falls back to candidate activity when shared intelligence is absent', () => {
  const rows = Shell.buildCandidateRows({
    domain:'company',
    players:[],
    candidates:[{userId:'1',name:'Alpha',lastActive:1_757_689_000,stats:{}}],
    company:[],
    faction:[]
  });
  assert.equal(rows[0].lastActive,1_757_689_000_000);
  assert.equal(Shell.formatLastOnline(1_757_689_000,1_757_689_060_000),'1 minute ago');
});

test('startup collapses legacy saved routes back to the selected simple core surface', () => {
  assert.equal(Shell.startupRoute('company-overview',{domain:'company'}),'company-candidates');
  assert.equal(Shell.startupRoute('faction-candidates',{domain:'company'}),'company-candidates');
  assert.equal(Shell.startupRoute('scout',{domain:'faction'}),'faction-candidates');
  assert.equal(Shell.startupRoute('settings',{domain:'faction'}),'settings');
});
