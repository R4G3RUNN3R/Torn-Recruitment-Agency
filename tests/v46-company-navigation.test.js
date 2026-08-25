const test=require('node:test');
const assert=require('node:assert/strict');
const Navigation=require('../src/v46-navigation');

const COMPANY_ROUTES=[
  'company-overview','company-today','company-discover','company-candidates','company-pipeline',
  'company-vacancies','company-campaigns','company-followups','company-timeline','company-stage-aging',
  'company-contact-outcomes','company-recruitment-sessions','company-talent-pool','company-reactivation',
  'company-opportunity','company-compare'
];

test('Company Recruitment group exposes the complete current Company route shell',()=>{
  const group=Navigation.GROUPS.find(item=>item.id==='company-recruitment');
  assert.ok(group,'company-recruitment group');
  assert.equal(group.label,'COMPANY RECRUITMENT');
  assert.deepEqual(group.pages.map(page=>page.id),COMPANY_ROUTES);
});

test('Company routes are routable while future Faction routes remain hidden',()=>{
  for(const route of COMPANY_ROUTES){
    assert.ok(Navigation.ROUTES.includes(route),route);
    assert.equal(Navigation.normalizeRoute(route,'advanced'),route);
  }
  assert.equal(Navigation.ROUTES.includes('faction-overview'),false);
  assert.equal(Navigation.ROUTES.includes('faction-candidates'),false);
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

test('Company group participates in independent collapse persistence',()=>{
  const defaults=Navigation.normalizeExpandedGroups(undefined);
  assert.deepEqual(defaults,['company-recruitment']);
  const opened=Navigation.toggleExpandedGroup(defaults,'intelligence');
  assert.deepEqual(opened,['company-recruitment','intelligence']);
  const companyClosed=Navigation.toggleExpandedGroup(opened,'company-recruitment');
  assert.deepEqual(companyClosed,['intelligence']);
});
