const test=require('node:test');
const assert=require('node:assert/strict');
const N=require('../src/v46-navigation');
const App=require('../src/v45-app');

test('Company Recruitment exposes the exact first-slice routes and no Faction routes',()=>{
  const groups=N.visibleGroups({complexity:'advanced'});
  assert.deepEqual(groups.map(g=>g.label),['COMPANY RECRUITMENT','INTELLIGENCE','APPLICATION']);
  assert.deepEqual(groups[0].pages.map(p=>p.id),[
    'company-overview','company-today','company-discover','company-candidates','company-pipeline','company-vacancies'
  ]);
  assert.equal(groups.flatMap(g=>g.pages).some(p=>String(p.id).startsWith('faction-')),false);
  assert.equal(groups.flatMap(g=>g.pages).some(p=>p.id==='settings'),false);
});

test('legacy v4.5 routes restore into their Company equivalents',()=>{
  assert.equal(N.normalizeRoute('overview','simple'),'company-overview');
  assert.equal(N.normalizeRoute('discover','simple'),'company-discover');
  assert.equal(N.normalizeRoute('candidates','simple'),'company-candidates');
  assert.equal(N.normalizeRoute('pipeline','simple'),'company-pipeline');
  assert.equal(N.normalizeRoute('company-vacancies','simple'),'company-vacancies');
  assert.equal(N.normalizeRoute('settings','simple'),'settings');
  assert.equal(N.normalizeRoute('logs','simple'),'company-overview');
  assert.equal(N.normalizeRoute('not-a-route','advanced'),'company-overview');
});

test('legacy recruitment expansion migrates to the Company group and multiple groups remain supported',()=>{
  assert.deepEqual(N.normalizeExpandedGroups(undefined),['company-recruitment']);
  assert.deepEqual(N.normalizeExpandedGroups(['recruitment']),['company-recruitment']);
  assert.deepEqual(N.normalizeExpandedGroups(['company-recruitment','intelligence']),['company-recruitment','intelligence']);
  assert.deepEqual(N.toggleExpandedGroup(['company-recruitment'],'intelligence'),['company-recruitment','intelligence']);
  assert.deepEqual(N.toggleExpandedGroup(['company-recruitment'],'company-recruitment'),[]);
});

test('Company discovery feed set includes Company/Training only and excludes Faction Forum',()=>{
  const settings=App.mergeSettings({recruitment:{
    companyThreadId:'15907925',factionThreadId:'15909136',trainingThreadId:'12345678'
  }});
  const feeds=App._test.companyDiscoveryFeeds(settings.recruitment);
  assert.deepEqual(feeds.map(f=>f.feedId),['company','training']);
  assert.deepEqual(feeds.map(f=>f.sourceType),['COMPANY FORUM','TRAIN BUYER']);
  assert.equal(feeds.some(f=>f.feedId==='faction'||f.sourceType==='FACTION FORUM'),false);
});
