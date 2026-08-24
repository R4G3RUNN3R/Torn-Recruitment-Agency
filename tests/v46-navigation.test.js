const test=require('node:test');
const assert=require('node:assert/strict');
const N=require('../src/v46-navigation');

test('Company Core navigation exposes only currently working routes',()=>{
  const groups=N.visibleGroups({complexity:'advanced'});
  assert.deepEqual(groups.map(g=>g.label),['COMPANY RECRUITMENT','INTELLIGENCE','APPLICATION']);
  assert.deepEqual(groups[0].pages.map(p=>p.id),['company-overview','company-today','company-discover','company-candidates','company-pipeline','company-vacancies']);
  assert.deepEqual(groups[1].pages.map(p=>p.id),['scout','smart-match','global-intelligence']);
  assert.deepEqual(groups[2].pages.map(p=>p.id),['data','logs']);
  assert.equal(groups.flatMap(g=>g.pages).some(p=>p.id==='settings'),false);
});

test('simple mode hides Logs but keeps every other working sidebar route',()=>{
  const groups=N.visibleGroups({complexity:'simple'});
  assert.deepEqual(groups[2].pages.map(p=>p.id),['data']);
});

test('multiple groups can remain expanded, legacy recruitment migrates, and all groups may be collapsed',()=>{
  assert.deepEqual(N.normalizeExpandedGroups(undefined),['company-recruitment']);
  assert.deepEqual(N.normalizeExpandedGroups([]),[]);
  assert.deepEqual(N.normalizeExpandedGroups(['bogus','intelligence','recruitment','intelligence']),['company-recruitment','intelligence']);
  let expanded=N.toggleExpandedGroup(['company-recruitment'],'intelligence');
  assert.deepEqual(expanded,['company-recruitment','intelligence']);
  expanded=N.toggleExpandedGroup(expanded,'company-recruitment');
  assert.deepEqual(expanded,['intelligence']);
  assert.deepEqual(N.toggleExpandedGroup(expanded,'bogus'),['intelligence']);
});

test('Settings stays routable and legacy generic routes migrate to Company routes',()=>{
  assert.equal(N.normalizeRoute('settings','simple'),'settings');
  assert.equal(N.normalizeRoute('logs','simple'),'company-overview');
  assert.equal(N.normalizeRoute('logs','advanced'),'logs');
  assert.equal(N.normalizeRoute('candidates','simple'),'company-candidates');
  assert.equal(N.normalizeRoute('company-candidates','simple'),'company-candidates');
  assert.equal(N.normalizeRoute('not-a-route','advanced'),'company-overview');
});
