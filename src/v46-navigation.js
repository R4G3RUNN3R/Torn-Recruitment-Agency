(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RA_V46Navigation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GROUPS = Object.freeze([
    Object.freeze({id:'recruitment',label:'RECRUITMENT',pages:Object.freeze([
      Object.freeze({id:'overview',label:'Overview'}),
      Object.freeze({id:'discover',label:'Discover'}),
      Object.freeze({id:'candidates',label:'Candidates'}),
      Object.freeze({id:'pipeline',label:'Pipeline'})
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

  function complexityValue(value) {
    return String(value || '').trim().toLowerCase() === 'advanced' ? 'advanced' : 'simple';
  }

  function normalizeRoute(value, complexity = 'simple') {
    const requested = String(value || '').trim().toLowerCase();
    if (!ROUTES.includes(requested)) return 'overview';
    if (requested === 'logs' && complexityValue(complexity) !== 'advanced') return 'overview';
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
    if (value === undefined) return ['recruitment'];
    if (!Array.isArray(value)) return ['recruitment'];
    const requested = new Set(value.map(item => String(item || '').trim().toLowerCase()));
    return GROUP_IDS.filter(id => requested.has(id));
  }

  function toggleExpandedGroup(current, groupId) {
    const id = String(groupId || '').trim().toLowerCase();
    const normalized = normalizeExpandedGroups(Array.isArray(current) ? current : undefined);
    if (!GROUP_IDS.includes(id)) return normalized;
    const open = new Set(normalized);
    if (open.has(id)) open.delete(id);
    else open.add(id);
    return GROUP_IDS.filter(group => open.has(group));
  }

  return Object.freeze({GROUPS,GROUP_IDS,ROUTES,normalizeRoute,visibleGroups,normalizeExpandedGroups,toggleExpandedGroup});
});
