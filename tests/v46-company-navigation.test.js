const test=require('node:test');
const assert=require('node:assert/strict');
const Navigation=require('../src/v46-navigation');

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

test('Company Recruitment group exposes the complete current Company route shell',()=>{
  const group=Navigation.GROUPS.find(item=>item.id==='company-recruitment');
  assert.ok(group,'company-recruitment group');
  assert.equal(group.label,'COMPANY RECRUITMENT');
  assert.deepEqual(group.pages.map(page=>page.id),COMPANY_ROUTES);
});

test('Company and Faction routes are independently routable while Settings stays title-bar only',()=>{
  for(const route of [...COMPANY_ROUTES,...FACTION_ROUTES]){
    assert.ok(Navigation.ROUTES.includes(route),route);
    assert.equal(Navigation.normalizeRoute(route,'advanced'),route);
  }
  const faction=Navigation.GROUPS.find(item=>item.id==='faction-recruitment');
  assert.ok(faction,'faction-recruitment group');
  assert.equal(faction.label,'FACTION RECRUITMENT');
  assert.deepEqual(faction.pages.map(page=>page.id),FACTION_ROUTES);
  assert.equal(Navigation.ROUTES.includes('settings'),true);
  assert.equal(Navigation.GROUPS.some(group=>group.pages.some(page=>page.id==='settings')),false);
});

test('legacy generic recruitment routes restore into their Company equivalents',()=>{
  const aliases={
    overview:'company-overview',
    discover:'company-discover',
    candidates:'company-candidates',
    pipeline:'company-pipeline'
  };
  for(const [legacy,current] of Object.entries(aliases)) assert.equal(Navigation.normalizeRoute(legacy,'advanced'),current,legacy);
});

test('Company and Faction groups participate in independent collapse persistence',()=>{
  const defaults=Navigation.normalizeExpandedGroups(undefined);
  assert.deepEqual(defaults,['company-recruitment']);
  const factionOpened=Navigation.toggleExpandedGroup(defaults,'faction-recruitment');
  assert.deepEqual(factionOpened,['company-recruitment','faction-recruitment']);
  const intelligenceOpened=Navigation.toggleExpandedGroup(factionOpened,'intelligence');
  assert.deepEqual(intelligenceOpened,['company-recruitment','faction-recruitment','intelligence']);
  const companyClosed=Navigation.toggleExpandedGroup(intelligenceOpened,'company-recruitment');
  assert.deepEqual(companyClosed,['faction-recruitment','intelligence']);
});
