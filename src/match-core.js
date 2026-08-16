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

  function finitePositiveOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function normalizeRole(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function normalizeCompany(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function normalizeAvailability(value) {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
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

  return Object.freeze({
    CRITERIA_KEYS,
    AVAILABILITY_VALUES,
    normalizeRole,
    normalizeCompany,
    normalizeAvailability,
    scoreNumeric,
    scoreSalary,
    scoreCategorical
  });
});
