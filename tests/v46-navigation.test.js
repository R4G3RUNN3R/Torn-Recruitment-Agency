const test=require('node:test');
const assert=require('node:assert/strict');
const N=require('../src/v46-navigation');

const COMPANY_ROUTES=[
  'company-overview','company-today','company-discover','company-candidates','company-pipeline',
  'company-vacancies','company-campaigns','company-followups','company-timeline','company-stage-aging',
  'company-contact-outcomes','company-recruitment-sessions','company-talent-pool','company-reactivation',
  'company-opportunity','company-compare'
];
const FACTION_ROUTES=[
  'faction-overview','faction-today','faction-discover','faction-candidates','faction-pipeline',
  'faction-requirements','faction-campaigns','faction-followups','faction-timeline','faction-stage-aging',
  'faction-contact-outcomes','faction-recruitment-sessions','faction-reactivation','faction-opportunity','faction-compare'
];

test('navigation exposes independent Company and Faction route shells plus shared groups',()=>{
  const groups=N.visibleGroups({complexity:'advanced'});
  assert.deepEqual(groups.map(g=>g.label),['COMPANY RECRUITMENT','FACTION RECRUITMENT','INTELLIGENCE','APPLICATION']);
  assert.deepEqual(groups[0].pages.map(p=>p.id),COMPANY_ROUTES);
  assert.deepEqual(groups[1].pages.map(p=>p.id),FACTION_ROUTES);
  assert.deepEqual(groups[2].pages.map(p=>p.id),['scout','smart-match','global-intelligence']);
  assert.deepEqual(groups[3].pages.map(p=>p.id),['data','logs']);
  assert.equal(groups.flatMap(g=>g.pages).some(p=>p.id==='settings'),false);
});

test('simple mode hides Logs but keeps every other working sidebar route',()=>{
  const groups=N.visibleGroups({complexity:'simple'});
  assert.deepEqual(groups[3].pages.map(p=>p.id),['data']);
  assert.deepEqual(groups[0].pages.map(p=>p.id),COMPANY_ROUTES);
  assert.deepEqual(groups[1].pages.map(p=>p.id),FACTION_ROUTES);
});

test('multiple groups can remain expanded and all groups may be collapsed',()=>{
  assert.deepEqual(N.normalizeExpandedGroups(undefined),['company-recruitment']);
  assert.deepEqual(N.normalizeExpandedGroups([]),[]);
  assert.deepEqual(N.normalizeExpandedGroups(['bogus','faction-recruitment','intelligence','company-recruitment','intelligence']),['company-recruitment','faction-recruitment','intelligence']);
  assert.deepEqual(N.normalizeExpandedGroups(['recruitment']),['company-recruitment']);
  let expanded=N.toggleExpandedGroup(['company-recruitment'],'faction-recruitment');
  assert.deepEqual(expanded,['company-recruitment','faction-recruitment']);
  expanded=N.toggleExpandedGroup(expanded,'intelligence');
  assert.deepEqual(expanded,['company-recruitment','faction-recruitment','intelligence']);
  expanded=N.toggleExpandedGroup(expanded,'company-recruitment');
  assert.deepEqual(expanded,['faction-recruitment','intelligence']);
  assert.deepEqual(N.toggleExpandedGroup(expanded,'bogus'),['faction-recruitment','intelligence']);
});

test('Settings stays routable, old recruitment routes migrate, Faction routes are routable, and Logs remains advanced-only',()=>{
  assert.equal(N.normalizeRoute('settings','simple'),'settings');
  assert.equal(N.normalizeRoute('logs','simple'),'company-overview');
  assert.equal(N.normalizeRoute('logs','advanced'),'logs');
  assert.equal(N.normalizeRoute('candidates','simple'),'company-candidates');
  assert.equal(N.normalizeRoute('overview','simple'),'company-overview');
  assert.equal(N.normalizeRoute('faction-overview','simple'),'faction-overview');
  assert.equal(N.normalizeRoute('faction-requirements','advanced'),'faction-requirements');
  assert.equal(N.normalizeRoute('not-a-route','advanced'),'company-overview');
});
