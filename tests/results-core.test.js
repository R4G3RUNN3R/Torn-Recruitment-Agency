const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/results-core.js');

function ids(rows) { return rows.map(r => r.userId); }

const NOW = Date.UTC(2026, 7, 15, 6, 0, 0);

function scout(id, overrides = {}) {
  return {
    userId: id,
    profile: {name:`User ${id}`, level:10, lastActionTs: Math.floor(NOW/1000)-3600, status:'Offline', factionId:0},
    w30: {activityHours:100, xanax:20, refills:10, attacks:30, rwHits:5},
    extra: {networth:1_000_000, activeStreak:5, bestActiveStreak:10, statEnhancers30:0},
    capturedAt: NOW - 60_000,
    official: true,
    currentFit: 50,
    trend: 2,
    ...overrides
  };
}

test('parseCompactNumber supports K/M/B and rejects junk', () => {
  assert.deepEqual(R.parseCompactNumber('50k'), {valid:true, empty:false, value:50000});
  assert.deepEqual(R.parseCompactNumber('2.5M'), {valid:true, empty:false, value:2500000});
  assert.deepEqual(R.parseCompactNumber('1b'), {valid:true, empty:false, value:1000000000});
  assert.deepEqual(R.parseCompactNumber('1,250'), {valid:true, empty:false, value:1250});
  assert.equal(R.parseCompactNumber('').empty, true);
  assert.equal(R.parseCompactNumber('potato').valid, false);
  assert.equal(R.parseCompactNumber('-5k').valid, false);
});

test('preferred company parser is conservative', () => {
  assert.equal(R.parsePreferredCompany('Looking for Adult Novelties, preferably 10*'), 'adult_novelties');
  assert.equal(R.parsePreferredCompany('Prefer AN, salary flexible'), 'adult_novelties');
  assert.equal(R.parsePreferredCompany('Looking for a logistics company'), 'logistics_management');
  assert.equal(R.parsePreferredCompany('Looking for 10* PSF'), 'private_security_firm');
  assert.equal(R.parsePreferredCompany('I used to work in AN but want anything'), '');
});

test('numeric sorting keeps missing values last in both directions', () => {
  const rows = [
    {userId:1,name:'Low',ee:7},
    {userId:2,name:'Missing',ee:null},
    {userId:3,name:'High',ee:10}
  ];
  assert.deepEqual(ids(R.sortRows(rows,{key:'ee',direction:'desc'},NOW)), [3,1,2]);
  assert.deepEqual(ids(R.sortRows(rows,{key:'ee',direction:'asc'},NOW)), [1,3,2]);
});

test('text, last active, scout status and deterministic ties sort correctly', () => {
  const rows = [
    {...scout(3), profile:{...scout(3).profile,name:'Zulu',lastActionTs:Math.floor(NOW/1000)-7200}},
    {...scout(2), profile:{...scout(2).profile,name:'Alpha',lastActionTs:Math.floor(NOW/1000)-60}},
    {...scout(1), profile:{...scout(1).profile,name:'Alpha',lastActionTs:Math.floor(NOW/1000)-3600}}
  ];
  assert.deepEqual(ids(R.sortRows(rows,{key:'player',direction:'asc'},NOW)), [1,2,3]);
  assert.deepEqual(ids(R.sortRows(rows,{key:'lastActive',direction:'asc'},NOW)), [2,1,3]);

  const statuses = [
    {...scout(10), capturedAt:NOW-15*86400000},
    {...scout(11), profile:{...scout(11).profile,status:'Online'}},
    {userId:12,name:'No Scout'},
    {...scout(13), official:false, provisionalSource:{activityHours:50}}
  ];
  assert.deepEqual(ids(R.sortRows(statuses,{key:'scoutStatus',direction:'asc'},NOW)), [11,13,10,12]);
});

test('filter combinations work across forum and scout fields', () => {
  const good = {
    userId:1,name:'Alice',stats:{man:60000,int:1000,end:2000,total:63000},ee:9,preferredCompany:'adult_novelties',
    scout:scout(1,{currentFit:82,w30:{activityHours:140,xanax:70,refills:25,attacks:220,rwHits:50},extra:{networth:2_000_000_000,activeStreak:12,bestActiveStreak:20,statEnhancers30:1}})
  };
  const bad = {
    userId:2,name:'Bob',stats:{man:1000,int:1000,end:1000,total:3000},ee:5,preferredCompany:'pub',scout:scout(2,{currentFit:40,w30:{activityHours:20,xanax:2,refills:1,attacks:5,rwHits:0}})
  };
  const filters = {search:'ali',minMan:'50k',minEe:'8',preferredCompany:'AN',minActivity30:'100',maxIdleDays:'1',minFit:'70',minNetworth:'1b',minXanax30:'60',minRefills30:'20',minAttacks30:'200',minRwHits30:'40'};
  assert.deepEqual(ids(R.applyFilters([bad,good],filters,NOW)), [1]);
  assert.equal(R.activeFilterCount(filters), 12);
});

test('processRows filters before sorting and does not mutate input', () => {
  const rows = [
    {userId:1,name:'A',ee:7},
    {userId:2,name:'B',ee:10},
    {userId:3,name:'C',ee:3}
  ];
  const original = [...rows];
  const out = R.processRows(rows,{minEe:'7'},{key:'ee',direction:'desc'},NOW);
  assert.deepEqual(ids(out), [2,1]);
  assert.deepEqual(rows, original);
});

test('default visible columns stay intentionally compact', () => {
  assert.deepEqual([...R.DEFAULT_VISIBLE_COLUMNS], ['player','ee','preferredCompany','activity30','lastActive','fit']);
  assert.deepEqual(R.DEFAULT_SORT, {key:'fit',direction:'desc'});
});
