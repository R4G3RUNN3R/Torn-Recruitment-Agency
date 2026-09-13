const test=require('node:test');
const assert=require('node:assert/strict');
const N=require('../src/v46-navigation');

const COMPANY_ROUTES=[
  'company-candidates','company-overview','company-today','company-discover','company-pipeline',
  'company-vacancies','company-campaigns','company-followups','company-timeline','company-stage-aging',
  'company-contact-outcomes','company-recruitment-sessions','company-talent-pool','company-reactivation',
  'company-opportunity','company-compare'
];
const FACTION_ROUTES=[
  'faction-candidates','faction-overview','faction-today','faction-discover','faction-pipeline',
  'faction-requirements','faction-campaigns','faction-followups','faction-timeline','faction-stage-aging',
  'faction-contact-outcomes','faction-recruitment-sessions','faction-reactivation','faction-opportunity','faction-compare'
];

test('navigation retains every Company and Faction capability while default visible navigation stays core-only',()=>{
  const company=N.GROUPS.find(g=>g.id==='company-recruitment');
  const faction=N.GROUPS.find(g=>g.id==='faction-recruitment');
  assert.deepEqual(company.pages.map(p=>p.id),COMPANY_ROUTES);
  assert.deepEqual(faction.pages.map(p=>p.id),FACTION_ROUTES);
  const visible=N.visibleGroups({complexity:'simple',optionalModules:{}});
  assert.deepEqual(visible.map(g=>g.label),['COMPANY','FACTION']);
  assert.deepEqual(visible[0].pages.map(p=>p.id),['company-candidates']);
  assert.deepEqual(visible[1].pages.map(p=>p.id),['faction-candidates']);
});

test('optional workspaces appear only when explicitly enabled',()=>{
  const groups=N.visibleGroups({complexity:'advanced',optionalModules:{companyPipeline:true,factionRequirements:true,scout:true,data:true,logs:true}});
  assert.deepEqual(groups.find(g=>g.id==='company-recruitment').pages.map(p=>p.id),['company-candidates','company-pipeline']);
  assert.deepEqual(groups.find(g=>g.id==='faction-recruitment').pages.map(p=>p.id),['faction-candidates','faction-requirements']);
  assert.deepEqual(groups.find(g=>g.id==='intelligence').pages.map(p=>p.id),['scout']);
  assert.deepEqual(groups.find(g=>g.id==='application').pages.map(p=>p.id),['data','logs']);
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
});

test('Settings stays routable, legacy recruitment aliases migrate, and invalid/simple Logs fail back to core Search & Results',()=>{
  assert.equal(N.normalizeRoute('settings','simple'),'settings');
  assert.equal(N.normalizeRoute('logs','simple'),'company-candidates');
  assert.equal(N.normalizeRoute('logs','advanced'),'logs');
  assert.equal(N.normalizeRoute('candidates','simple'),'company-candidates');
  assert.equal(N.normalizeRoute('overview','simple'),'company-overview');
  assert.equal(N.normalizeRoute('faction-overview','simple'),'faction-overview');
  assert.equal(N.normalizeRoute('faction-requirements','advanced'),'faction-requirements');
  assert.equal(N.normalizeRoute('not-a-route','advanced'),'company-candidates');
});
