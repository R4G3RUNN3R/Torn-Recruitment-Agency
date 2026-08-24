(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RA_V46Navigation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GROUPS = Object.freeze([
    Object.freeze({id:'company-recruitment',label:'COMPANY RECRUITMENT',pages:Object.freeze([
      Object.freeze({id:'company-overview',label:'Overview'}),
      Object.freeze({id:'company-today',label:'Today'}),
      Object.freeze({id:'company-discover',label:'Discover'}),
      Object.freeze({id:'company-candidates',label:'Candidates'}),
      Object.freeze({id:'company-pipeline',label:'Pipeline'}),
      Object.freeze({id:'company-vacancies',label:'Vacancies'})
    ])}),
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

  const GROUP_IDS = Object.freeze(GROUPS.map(group => group.id));
  const ROUTES = Object.freeze([...GROUPS.flatMap(group => group.pages.map(page => page.id)),'settings']);
  const LEGACY_ROUTE_ALIASES = Object.freeze({
    overview:'company-overview',
    discover:'company-discover',
    candidates:'company-candidates',
    pipeline:'company-pipeline'
  });

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
    if (value === undefined || !Array.isArray(value)) return ['company-recruitment'];
    const requested = new Set(value.map(item => {
      const id=String(item || '').trim().toLowerCase();
      return id==='recruitment'?'company-recruitment':id;
    }));
    return GROUP_IDS.filter(id => requested.has(id));
  }

  function toggleExpandedGroup(current, groupId) {
    let id = String(groupId || '').trim().toLowerCase();
    if(id==='recruitment')id='company-recruitment';
    const normalized = normalizeExpandedGroups(Array.isArray(current) ? current : undefined);
    if (!GROUP_IDS.includes(id)) return normalized;
    const open = new Set(normalized);
    if (open.has(id)) open.delete(id);
    else open.add(id);
    return GROUP_IDS.filter(group => open.has(group));
  }

  return Object.freeze({GROUPS,GROUP_IDS,ROUTES,LEGACY_ROUTE_ALIASES,normalizeRoute,visibleGroups,normalizeExpandedGroups,toggleExpandedGroup});
});
