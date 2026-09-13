(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RA_V46Navigation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COMPANY_PAGES = Object.freeze([
    Object.freeze({id:'company-candidates',label:'Search & Results',core:true}),
    Object.freeze({id:'company-overview',label:'Overview',flag:'companyOverview'}),
    Object.freeze({id:'company-today',label:'Today',flag:'companyToday'}),
    Object.freeze({id:'company-discover',label:'Discovery',flag:'companyDiscovery'}),
    Object.freeze({id:'company-pipeline',label:'Pipeline',flag:'companyPipeline'}),
    Object.freeze({id:'company-vacancies',label:'Vacancies',flag:'companyVacancies'}),
    Object.freeze({id:'company-campaigns',label:'Campaigns',flag:'companyCampaigns'}),
    Object.freeze({id:'company-followups',label:'Follow-ups',flag:'companyFollowups'}),
    Object.freeze({id:'company-timeline',label:'Timeline',flag:'companyTimeline'}),
    Object.freeze({id:'company-stage-aging',label:'Stage Aging',flag:'companyStageAging'}),
    Object.freeze({id:'company-contact-outcomes',label:'Contact Outcomes',flag:'companyContactOutcomes'}),
    Object.freeze({id:'company-recruitment-sessions',label:'Recruitment Sessions',flag:'companySessions'}),
    Object.freeze({id:'company-talent-pool',label:'Talent Pool',flag:'companyTalentPool'}),
    Object.freeze({id:'company-reactivation',label:'Reactivation',flag:'companyReactivation'}),
    Object.freeze({id:'company-opportunity',label:'Opportunity Queue',flag:'companyOpportunity'}),
    Object.freeze({id:'company-compare',label:'Compare',flag:'companyCompare'})
  ]);

  const FACTION_PAGES = Object.freeze([
    Object.freeze({id:'faction-candidates',label:'Search & Results',core:true}),
    Object.freeze({id:'faction-overview',label:'Overview',flag:'factionOverview'}),
    Object.freeze({id:'faction-today',label:'Today',flag:'factionToday'}),
    Object.freeze({id:'faction-discover',label:'Discovery',flag:'factionDiscovery'}),
    Object.freeze({id:'faction-pipeline',label:'Pipeline',flag:'factionPipeline'}),
    Object.freeze({id:'faction-requirements',label:'Requirements',flag:'factionRequirements'}),
    Object.freeze({id:'faction-campaigns',label:'Campaigns',flag:'factionCampaigns'}),
    Object.freeze({id:'faction-followups',label:'Follow-ups',flag:'factionFollowups'}),
    Object.freeze({id:'faction-timeline',label:'Timeline',flag:'factionTimeline'}),
    Object.freeze({id:'faction-stage-aging',label:'Stage Aging',flag:'factionStageAging'}),
    Object.freeze({id:'faction-contact-outcomes',label:'Contact Outcomes',flag:'factionContactOutcomes'}),
    Object.freeze({id:'faction-recruitment-sessions',label:'Recruitment Sessions',flag:'factionSessions'}),
    Object.freeze({id:'faction-reactivation',label:'Reactivation',flag:'factionReactivation'}),
    Object.freeze({id:'faction-opportunity',label:'Opportunity Queue',flag:'factionOpportunity'}),
    Object.freeze({id:'faction-compare',label:'Compare',flag:'factionCompare'})
  ]);

  const GROUPS = Object.freeze([
    Object.freeze({id:'company-recruitment',label:'COMPANY',pages:COMPANY_PAGES}),
    Object.freeze({id:'faction-recruitment',label:'FACTION',pages:FACTION_PAGES}),
    Object.freeze({id:'intelligence',label:'OPTIONAL TOOLS',pages:Object.freeze([
      Object.freeze({id:'scout',label:'Scout',flag:'scout'}),
      Object.freeze({id:'smart-match',label:'Smart Match',flag:'smartMatch'}),
      Object.freeze({id:'global-intelligence',label:'Global Intelligence',flag:'globalIntelligence'})
    ])}),
    Object.freeze({id:'application',label:'ADVANCED',pages:Object.freeze([
      Object.freeze({id:'data',label:'Data',flag:'data'}),
      Object.freeze({id:'logs',label:'Logs',flag:'logs',advancedOnly:true})
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
    if (!ROUTES.includes(requested)) return 'company-candidates';
    if (requested === 'logs' && complexityValue(complexity) !== 'advanced') return 'company-candidates';
    return requested;
  }

  function moduleEnabled(settings, page) {
    if (page.core) return true;
    if (page.advancedOnly && complexityValue(settings?.complexity) !== 'advanced') return false;
    return settings?.optionalModules?.[page.flag] === true;
  }

  function visibleGroups(settings = {}) {
    return GROUPS.map(group => ({
      id:group.id,
      label:group.label,
      pages:group.pages.filter(page => moduleEnabled(settings, page)).map(page => ({id:page.id,label:page.label}))
    })).filter(group => group.pages.length > 0);
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
