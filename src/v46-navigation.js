(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RA_V46Navigation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COMPANY_PAGES = Object.freeze([
    Object.freeze({id:'company-overview',label:'Overview'}),
    Object.freeze({id:'company-today',label:'Today'}),
    Object.freeze({id:'company-discover',label:'Discover'}),
    Object.freeze({id:'company-candidates',label:'Candidates'}),
    Object.freeze({id:'company-pipeline',label:'Pipeline'}),
    Object.freeze({id:'company-vacancies',label:'Vacancies'}),
    Object.freeze({id:'company-campaigns',label:'Campaigns'}),
    Object.freeze({id:'company-followups',label:'Follow-ups'}),
    Object.freeze({id:'company-timeline',label:'Timeline'}),
    Object.freeze({id:'company-stage-aging',label:'Stage Aging'}),
    Object.freeze({id:'company-contact-outcomes',label:'Contact Outcomes'}),
    Object.freeze({id:'company-recruitment-sessions',label:'Recruitment Sessions'}),
    Object.freeze({id:'company-talent-pool',label:'Talent Pool'}),
    Object.freeze({id:'company-reactivation',label:'Reactivation'}),
    Object.freeze({id:'company-opportunity',label:'Opportunity Queue'}),
    Object.freeze({id:'company-compare',label:'Compare'})
  ]);

  const FACTION_PAGES = Object.freeze([
    Object.freeze({id:'faction-overview',label:'Overview'}),
    Object.freeze({id:'faction-today',label:'Today'}),
    Object.freeze({id:'faction-discover',label:'Discover'}),
    Object.freeze({id:'faction-candidates',label:'Candidates'}),
    Object.freeze({id:'faction-pipeline',label:'Pipeline'}),
    Object.freeze({id:'faction-requirements',label:'Requirements'}),
    Object.freeze({id:'faction-campaigns',label:'Campaigns'}),
    Object.freeze({id:'faction-followups',label:'Follow-ups'}),
    Object.freeze({id:'faction-timeline',label:'Timeline'}),
    Object.freeze({id:'faction-stage-aging',label:'Stage Aging'}),
    Object.freeze({id:'faction-contact-outcomes',label:'Contact Outcomes'}),
    Object.freeze({id:'faction-recruitment-sessions',label:'Recruitment Sessions'}),
    Object.freeze({id:'faction-reactivation',label:'Reactivation'}),
    Object.freeze({id:'faction-opportunity',label:'Opportunity Queue'}),
    Object.freeze({id:'faction-compare',label:'Compare'})
  ]);

  const GROUPS = Object.freeze([
    Object.freeze({id:'company-recruitment',label:'COMPANY RECRUITMENT',pages:COMPANY_PAGES}),
    Object.freeze({id:'faction-recruitment',label:'FACTION RECRUITMENT',pages:FACTION_PAGES}),
    Object.freeze({id:'intelligence',label:'INTELLIGENCE',pages:Object.freeze([
      Object.freeze({id:'scout',label:'Scout'}),
      Object.freeze({id:'smart-match',label:'Smart Match'}),
      Object.freeze({id:'global-intelligence',label:'Global Intelligence'})
    ])}),
    Object.freeze({id:'application',label:'APPLICATION',pages:Object.freeze([
      Object.freeze({id:'data',label:'Data'}),
      Object.freeze({id:'logs',label:'Logs',advancedOnly:true})
    ])})
  ]);

  const LEGACY_ROUTE_ALIASES = Object.freeze({
    overview:'company-overview',
    discover:'company-discover',
    candidates:'company-candidates',
    pipeline:'company-pipeline'
  });
  const GROUP_IDS = Object.freeze(GROUPS.map(group => group.id));
  const ROUTES = Object.freeze([...GROUPS.flatMap(group => group.pages.map(page => page.id)),'settings']);

  function complexityValue(value) {
    return String(value || '').trim().toLowerCase() === 'advanced' ? 'advanced' : 'simple';
  }

  function normalizeRoute(value, complexity = 'simple') {
    const raw = String(value || '').trim().toLowerCase();
    const requested = LEGACY_ROUTE_ALIASES[raw] || raw;
    if (!ROUTES.includes(requested)) return 'company-overview';
    if (requested === 'logs' && complexityValue(complexity) !== 'advanced') return 'company-overview';
    return requested;
  }

  function visibleGroups(settings = {}) {
    const complexity = complexityValue(settings.complexity);
    return GROUPS.map(group => ({
      id:group.id,
      label:group.label,
      pages:group.pages
        .filter(page => !page.advancedOnly || complexity === 'advanced')
        .map(page => ({...page}))
    }));
  }

  function normalizeExpandedGroups(value) {
    if (value === undefined) return ['company-recruitment'];
    if (!Array.isArray(value)) return ['company-recruitment'];
    const requested = new Set(value.map(item => String(item || '').trim().toLowerCase()).map(id => id === 'recruitment' ? 'company-recruitment' : id));
    return GROUP_IDS.filter(id => requested.has(id));
  }

  function toggleExpandedGroup(current, groupId) {
    let id = String(groupId || '').trim().toLowerCase();
    if (id === 'recruitment') id = 'company-recruitment';
    const normalized = normalizeExpandedGroups(Array.isArray(current) ? current : undefined);
    if (!GROUP_IDS.includes(id)) return normalized;
    const open = new Set(normalized);
    if (open.has(id)) open.delete(id);
    else open.add(id);
    return GROUP_IDS.filter(group => open.has(group));
  }

  return Object.freeze({COMPANY_PAGES,FACTION_PAGES,GROUPS,GROUP_IDS,ROUTES,LEGACY_ROUTE_ALIASES,normalizeRoute,visibleGroups,normalizeExpandedGroups,toggleExpandedGroup});
});
