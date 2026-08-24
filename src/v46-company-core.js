(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RA_V46CompanyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COMPANY_PIPELINE = Object.freeze(['Not Contacted','Contacted','Replied','Shortlisted','Hired','Rejected']);
  const VACANCY_STATES = Object.freeze(['Draft','Open','Paused','Filled','Archived']);
  const REQUIREMENT_LEVELS = Object.freeze(['Hard','Preferred']);
  const OPERATORS = Object.freeze(['gte','lte','eq','contains','in']);
  const BASELINE_ID = 'company-default';

  function text(value) { return String(value ?? '').trim(); }
  function finite(value) {
    if (value === null || value === undefined || value === '') return null;
    const out = Number(value);
    return Number.isFinite(out) ? out : null;
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function uniqueStrings(values) { return [...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))]; }
  function makeId(prefix = 'item') { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }

  function normalizeLevel(value) {
    const raw = text(value).toLowerCase();
    return REQUIREMENT_LEVELS.find(item => item.toLowerCase() === raw) || 'Preferred';
  }
  function normalizeOperator(value) {
    const raw = text(value).toLowerCase();
    return OPERATORS.includes(raw) ? raw : 'gte';
  }
  function normalizeVacancyState(value) {
    const raw = text(value).toLowerCase();
    return VACANCY_STATES.find(item => item.toLowerCase() === raw) || 'Draft';
  }

  function normalizeRequirement(input = {}) {
    const requirementId = text(input.requirementId || input.id) || makeId('req');
    const operator = normalizeOperator(input.operator);
    let value = input.value;
    if (operator === 'in') value = uniqueStrings(Array.isArray(value) ? value : text(value).split(',').map(item => item.trim()));
    else if (['gte','lte'].includes(operator)) value = finite(value);
    else value = text(value);
    return {
      requirementId,
      label:text(input.label) || text(input.field) || requirementId,
      field:text(input.field),
      operator,
      value,
      level:normalizeLevel(input.level),
      weight:clamp(finite(input.weight) ?? 0, 0, 100000),
      active:input.active !== false
    };
  }

  function normalizeBaseline(input = {}) {
    const now = Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : Date.now();
    return {
      baselineId:BASELINE_ID,
      name:text(input.name) || 'Company Baseline',
      requirements:(Array.isArray(input.requirements) ? input.requirements : []).map(normalizeRequirement),
      version:Math.max(1, Math.floor(finite(input.version) ?? 1)),
      versionHistory:Array.isArray(input.versionHistory) ? input.versionHistory.map(item => ({...item})) : [],
      createdAt:input.createdAt ?? now,
      updatedAt:now
    };
  }

  function normalizeVacancy(input = {}) {
    const now = Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : Date.now();
    const name = text(input.name) || text(input.role) || 'Untitled Vacancy';
    const role = text(input.role) || name;
    return {
      vacancyId:text(input.vacancyId || input.id) || makeId('vac'),
      name,
      role,
      roleLower:role.toLowerCase(),
      openings:clamp(Math.floor(finite(input.openings) ?? 1), 1, 9999),
      status:normalizeVacancyState(input.status),
      requirements:(Array.isArray(input.requirements) ? input.requirements : []).map(normalizeRequirement),
      salaryBudget:finite(input.salaryBudget),
      availabilityExpectation:text(input.availabilityExpectation),
      notes:text(input.notes),
      version:Math.max(1, Math.floor(finite(input.version) ?? 1)),
      versionHistory:Array.isArray(input.versionHistory) ? input.versionHistory.map(item => ({...item})) : [],
      createdAt:input.createdAt ?? now,
      updatedAt:now
    };
  }

  function readField(context = {}, path = '') {
    const parts = text(path).split('.').filter(Boolean);
    let value = context;
    for (const part of parts) {
      if (value == null || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, part)) return undefined;
      value = value[part];
    }
    return value;
  }

  function isKnown(value) {
    return !(value === undefined || value === null || (typeof value === 'string' && value.trim() === ''));
  }

  function criterionScore(actual, requirement) {
    if (!isKnown(actual)) return {known:false, pass:false, score:null};
    const op = requirement.operator;
    const target = requirement.value;
    if (op === 'gte') {
      const a = finite(actual), t = finite(target);
      if (a === null || t === null) return {known:false, pass:false, score:null};
      if (t <= 0) return {known:true, pass:a >= t, score:a >= t ? 100 : 0};
      return {known:true, pass:a >= t, score:clamp((a / t) * 100, 0, 100)};
    }
    if (op === 'lte') {
      const a = finite(actual), t = finite(target);
      if (a === null || t === null) return {known:false, pass:false, score:null};
      if (a <= t) return {known:true, pass:true, score:100};
      if (a <= 0) return {known:true, pass:true, score:100};
      return {known:true, pass:false, score:clamp((t / a) * 100, 0, 100)};
    }
    if (op === 'contains') {
      const pass = text(actual).toLowerCase().includes(text(target).toLowerCase());
      return {known:true, pass, score:pass ? 100 : 0};
    }
    if (op === 'in') {
      const values = (Array.isArray(target) ? target : []).map(item => text(item).toLowerCase());
      const pass = values.includes(text(actual).toLowerCase());
      return {known:true, pass, score:pass ? 100 : 0};
    }
    const a = typeof actual === 'string' ? text(actual).toLowerCase() : actual;
    const t = typeof target === 'string' ? text(target).toLowerCase() : target;
    const pass = a === t;
    return {known:true, pass, score:pass ? 100 : 0};
  }

  function isActiveWaiver(waiver = {}, requirementId = '') {
    if (text(waiver.requirementId) !== text(requirementId)) return false;
    if (waiver.resolvedAt) return false;
    const state = text(waiver.state || 'Active').toLowerCase();
    return state === 'active' || state === 'review due';
  }

  function evaluateRequirements(context = {}, requirements = [], waivers = []) {
    const criteria = [];
    const hardFailures = [];
    const hardUnknown = [];
    const waivedFailures = [];
    let weightedScore = 0;
    let knownWeight = 0;

    for (const raw of Array.isArray(requirements) ? requirements : []) {
      const requirement = normalizeRequirement(raw);
      if (!requirement.active) continue;
      const actual = readField(context, requirement.field);
      const evaluated = criterionScore(actual, requirement);
      let status = 'UNKNOWN';
      let underlyingStatus = 'UNKNOWN';
      if (evaluated.known) {
        underlyingStatus = evaluated.pass ? 'PASS' : 'FAIL';
        status = underlyingStatus;
        const weight = requirement.weight;
        knownWeight += weight;
        weightedScore += (evaluated.score ?? 0) * weight;
      }
      const hard = requirement.level === 'Hard';
      if (hard && !evaluated.known) hardUnknown.push(requirement.requirementId);
      if (hard && evaluated.known && !evaluated.pass) {
        if ((Array.isArray(waivers) ? waivers : []).some(waiver => isActiveWaiver(waiver, requirement.requirementId))) {
          status = 'WAIVED';
          waivedFailures.push(requirement.requirementId);
        } else {
          hardFailures.push(requirement.requirementId);
        }
      }
      criteria.push({
        requirementId:requirement.requirementId,
        label:requirement.label,
        field:requirement.field,
        level:requirement.level,
        operator:requirement.operator,
        target:requirement.value,
        actual:isKnown(actual) ? actual : null,
        status,
        underlyingStatus,
        score:evaluated.score == null ? null : Math.round(evaluated.score * 100) / 100,
        weight:requirement.weight
      });
    }

    const rawMatch = knownWeight > 0 ? Math.round((weightedScore / knownWeight) * 100) / 100 : null;
    let eligibility = 'ELIGIBLE';
    if (hardFailures.length) eligibility = 'NOT CURRENTLY ELIGIBLE';
    else if (hardUnknown.length) eligibility = 'NEEDS DATA';
    else if (waivedFailures.length) eligibility = 'ELIGIBLE BY WAIVER';

    return {eligibility,rawMatch,hardFailures,hardUnknown,waivedFailures,criteria};
  }

  function evaluateVacancy(context = {}, vacancyInput = {}, waivers = []) {
    const vacancy = normalizeVacancy(vacancyInput);
    const result = evaluateRequirements(context, vacancy.requirements, waivers);
    return {
      vacancyId:vacancy.vacancyId,
      vacancyName:vacancy.name,
      role:vacancy.role,
      status:vacancy.status,
      version:vacancy.version,
      ...result,
      eligibility:result.eligibility === 'NOT CURRENTLY ELIGIBLE' ? 'NOT ELIGIBLE' : result.eligibility
    };
  }

  function eligibleForSuggestion(evaluation = {}) {
    return evaluation.status === 'Open' && ['ELIGIBLE','ELIGIBLE BY WAIVER'].includes(evaluation.eligibility);
  }

  function chooseSuggestedVacancy(evaluations = [], pinnedVacancyId = '') {
    const eligible = (Array.isArray(evaluations) ? evaluations : [])
      .filter(eligibleForSuggestion)
      .sort((a,b)=>(Number(b.rawMatch ?? -1) - Number(a.rawMatch ?? -1)) || text(a.vacancyId).localeCompare(text(b.vacancyId)));
    const suggestedVacancyId = text(eligible[0]?.vacancyId);
    const pin = text(pinnedVacancyId);
    return {
      suggestedVacancyId,
      effectiveVacancyId:pin || suggestedVacancyId,
      pinned:!!pin,
      suggestionChanged:!!pin && !!suggestedVacancyId && pin !== suggestedVacancyId
    };
  }

  function candidateFacts(player = {}, recruitment = {}) {
    return {
      ...(recruitment || {}),
      ...((recruitment && recruitment.stats) || {}),
      ...(player || {}),
      ...((player && player.stats) || {})
    };
  }

  function evaluateCompanyCandidate(input = {}) {
    const player = input.player || {};
    const recruitment = input.recruitment || {};
    const facts = candidateFacts(player,recruitment);
    const waivers = Array.isArray(recruitment.waivers) ? recruitment.waivers : [];
    const baseline = evaluateRequirements(facts, normalizeBaseline(input.baseline || {}).requirements, waivers);
    const vacancies = (Array.isArray(input.vacancies) ? input.vacancies : [])
      .map(normalizeVacancy)
      .filter(vacancy => vacancy.status === 'Open')
      .map(vacancy => evaluateVacancy(facts,vacancy,waivers));
    const selection = chooseSuggestedVacancy(vacancies,recruitment.pinnedVacancyId);
    return {baseline,vacancies,...selection};
  }

  return Object.freeze({
    COMPANY_PIPELINE,
    VACANCY_STATES,
    REQUIREMENT_LEVELS,
    OPERATORS,
    BASELINE_ID,
    normalizeRequirement,
    normalizeBaseline,
    normalizeVacancy,
    evaluateRequirements,
    evaluateVacancy,
    chooseSuggestedVacancy,
    evaluateCompanyCandidate
  });
});
