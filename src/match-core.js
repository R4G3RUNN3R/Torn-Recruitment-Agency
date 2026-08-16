(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RA_MatchCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CRITERIA_KEYS = Object.freeze([
    'man', 'int', 'end', 'ee', 'fit', 'activity30', 'xanax30', 'refills30', 'attacks30', 'rwHits30',
    'company', 'role', 'salary', 'availability'
  ]);

  const AVAILABILITY_VALUES = Object.freeze(['immediate', 'soon', 'flexible', 'not_available']);

  const DEFAULT_CRITERIA = Object.freeze({
    man: { enabled: false, target: 0, weight: 10 },
    int: { enabled: false, target: 0, weight: 10 },
    end: { enabled: false, target: 0, weight: 10 },
    ee: { enabled: true, target: 7, weight: 15 },
    fit: { enabled: true, target: 70, weight: 20 },
    activity30: { enabled: true, target: 120, weight: 20 },
    xanax30: { enabled: false, target: 60, weight: 10 },
    refills30: { enabled: false, target: 25, weight: 10 },
    attacks30: { enabled: false, target: 200, weight: 10 },
    rwHits30: { enabled: false, target: 40, weight: 10 },
    company: { enabled: false, value: '', weight: 15 },
    role: { enabled: false, value: '', weight: 15 },
    salary: { enabled: false, max: 0, weight: 15 },
    availability: { enabled: false, value: '', weight: 10 }
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function finitePositiveOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function cleanText(value) {
    return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  }

  function normalizeRole(value) {
    return cleanText(value).toLowerCase();
  }

  function normalizeCompany(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function normalizeAvailability(value) {
    const raw = cleanText(value).toLowerCase().replace(/\s+/g, '_');
    const aliases = {
      now: 'immediate',
      available_now: 'immediate',
      asap: 'immediate',
      later: 'soon',
      negotiable: 'flexible'
    };
    const normalized = aliases[raw] || raw;
    return AVAILABILITY_VALUES.includes(normalized) ? normalized : '';
  }

  function scoreNumeric(actual, target, weight) {
    const a = finitePositiveOrNull(actual);
    const t = finitePositiveOrNull(target);
    const w = finitePositiveOrNull(weight) || 0;
    if (a === null || t === null || t <= 0 || w <= 0) {
      return { known: false, earned: 0, available: 0, ratio: null };
    }
    const ratio = Math.min(a / t, 1);
    return { known: true, earned: ratio * w, available: w, ratio };
  }

  function scoreSalary(expectedSalary, maxBudget, weight) {
    const salary = finitePositiveOrNull(expectedSalary);
    const budget = finitePositiveOrNull(maxBudget);
    const w = finitePositiveOrNull(weight) || 0;
    if (salary === null || budget === null || budget <= 0 || w <= 0) {
      return { known: false, earned: 0, available: 0, ratio: null };
    }
    const ratio = salary <= 0 ? 1 : Math.min(budget / salary, 1);
    return { known: true, earned: ratio * w, available: w, ratio };
  }

  function scoreCategorical(actual, expected, weight, normalizer) {
    const normalize = typeof normalizer === 'function' ? normalizer : normalizeRole;
    const a = normalize(actual);
    const e = normalize(expected);
    const w = finitePositiveOrNull(weight) || 0;
    if (!a || !e || w <= 0) {
      return { known: false, earned: 0, available: 0, ratio: null };
    }
    const ratio = a === e ? 1 : 0;
    return { known: true, earned: ratio * w, available: w, ratio };
  }

  function hasManualValue(source, key) {
    if (!source || !Object.prototype.hasOwnProperty.call(source, key)) return false;
    const value = source[key];
    return value !== null && value !== undefined && value !== '';
  }

  function mergeCandidateValues(input) {
    const manual = input && input.manual && typeof input.manual === 'object' ? input.manual : {};
    const parsed = input && input.parsed && typeof input.parsed === 'object' ? input.parsed : {};
    const pick = (key) => hasManualValue(manual, key) ? manual[key] : parsed[key];
    const salary = finitePositiveOrNull(pick('expectedSalary'));
    return {
      desiredCompany: cleanText(pick('desiredCompany')),
      desiredRole: cleanText(pick('desiredRole')),
      expectedSalary: salary,
      availability: normalizeAvailability(pick('availability')),
      recruiterNote: cleanText(pick('recruiterNote'))
    };
  }

  function normalizeCandidate(input) {
    const source = input && typeof input === 'object' ? input : {};
    const manualFields = source.manualFields && typeof source.manualFields === 'object' ? clone(source.manualFields) : {};
    const merged = mergeCandidateValues({
      manual: Object.assign({}, source, manualFields),
      parsed: source.parsed && typeof source.parsed === 'object' ? source.parsed : {}
    });
    return {
      userId: cleanText(source.userId || source.id || source.playerId),
      desiredCompany: merged.desiredCompany,
      desiredRole: merged.desiredRole,
      expectedSalary: merged.expectedSalary,
      availability: merged.availability,
      recruiterNote: merged.recruiterNote,
      manualFields: {
        desiredCompany: hasManualValue(manualFields, 'desiredCompany') || hasManualValue(source, 'desiredCompany'),
        desiredRole: hasManualValue(manualFields, 'desiredRole') || hasManualValue(source, 'desiredRole'),
        expectedSalary: hasManualValue(manualFields, 'expectedSalary') || hasManualValue(source, 'expectedSalary'),
        availability: hasManualValue(manualFields, 'availability') || hasManualValue(source, 'availability')
      },
      createdAt: cleanText(source.createdAt),
      updatedAt: cleanText(source.updatedAt)
    };
  }

  function normalizeCriterion(key, input) {
    const base = clone(DEFAULT_CRITERIA[key]);
    const source = input && typeof input === 'object' ? input : {};
    base.enabled = source.enabled === undefined ? base.enabled : !!source.enabled;
    base.weight = finitePositiveOrNull(source.weight) ?? base.weight;
    if (Object.prototype.hasOwnProperty.call(base, 'target')) {
      base.target = finitePositiveOrNull(source.target) ?? base.target;
    }
    if (Object.prototype.hasOwnProperty.call(base, 'max')) {
      base.max = finitePositiveOrNull(source.max) ?? base.max;
    }
    if (Object.prototype.hasOwnProperty.call(base, 'value')) {
      const rawValue = source.value === undefined ? base.value : source.value;
      if (key === 'availability') base.value = normalizeAvailability(rawValue);
      else if (key === 'company') base.value = cleanText(rawValue);
      else if (key === 'role') base.value = cleanText(rawValue);
      else base.value = cleanText(rawValue);
    }
    return base;
  }

  function normalizeProfile(input) {
    const source = input && typeof input === 'object' ? input : {};
    const criteriaSource = source.criteria && typeof source.criteria === 'object' ? source.criteria : {};
    const criteria = {};
    CRITERIA_KEYS.forEach((key) => {
      criteria[key] = normalizeCriterion(key, criteriaSource[key]);
    });
    return {
      profileId: cleanText(source.profileId) || `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: cleanText(source.name) || 'Smart Match',
      criteria,
      createdAt: cleanText(source.createdAt),
      updatedAt: cleanText(source.updatedAt)
    };
  }

  function createDefaultProfile(name) {
    return normalizeProfile({ name: cleanText(name) || 'Smart Match' });
  }

  return Object.freeze({
    CRITERIA_KEYS,
    AVAILABILITY_VALUES,
    createDefaultProfile,
    normalizeProfile,
    normalizeCandidate,
    normalizeRole,
    normalizeCompany,
    normalizeAvailability,
    scoreNumeric,
    scoreSalary,
    scoreCategorical,
    mergeCandidateValues
  });
});
