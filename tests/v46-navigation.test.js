const test=require('node:test');
const assert=require('node:assert/strict');
const N=require('../src/v46-navigation');

test('foundation navigation exposes only currently working routes',()=>{
  const groups=N.visibleGroups({complexity:'advanced'});
  assert.deepEqual(groups.map(g=>g.label),['RECRUITMENT','INTELLIGENCE','APPLICATION']);
  assert.deepEqual(groups[0].pages.map(p=>p.id),['overview','discover','candidates','pipeline']);
  assert.deepEqual(groups[1].pages.map(p=>p.id),['scout','smart-match','global-intelligence']);
  assert.deepEqual(groups[2].pages.map(p=>p.id),['data','logs']);
  assert.equal(groups.flatMap(g=>g.pages).some(p=>p.id==='settings'),false);
});

test('simple mode hides Logs but keeps every other working sidebar route',()=>{
  const groups=N.visibleGroups({complexity:'simple'});
  assert.deepEqual(groups[2].pages.map(p=>p.id),['data']);
});

test('multiple groups can remain expanded and all groups may be collapsed',()=>{
  assert.deepEqual(N.normalizeExpandedGroups(undefined),['recruitment']);
  assert.deepEqual(N.normalizeExpandedGroups([]),[]);
  assert.deepEqual(N.normalizeExpandedGroups(['bogus','intelligence','recruitment','intelligence']),['recruitment','intelligence']);
  let expanded=N.toggleExpandedGroup(['recruitment'],'intelligence');
  assert.deepEqual(expanded,['recruitment','intelligence']);
  expanded=N.toggleExpandedGroup(expanded,'recruitment');
  assert.deepEqual(expanded,['intelligence']);
  assert.deepEqual(N.toggleExpandedGroup(expanded,'bogus'),['intelligence']);
});

test('Settings stays routable but absent from sidebar groups',()=>{
  assert.equal(N.normalizeRoute('settings','simple'),'settings');
  assert.equal(N.normalizeRoute('logs','simple'),'overview');
  assert.equal(N.normalizeRoute('logs','advanced'),'logs');
  assert.equal(N.normalizeRoute('candidates','simple'),'candidates');
  assert.equal(N.normalizeRoute('not-a-route','advanced'),'overview');
});
