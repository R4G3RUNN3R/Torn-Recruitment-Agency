(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RA_GlobalCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GLOBAL_SCHEMA_VERSION = 1;
  const GLOBAL_FIELDS = Object.freeze([
    'playerId','name','observedAt','level','ee','activity30','xanax30','refills30',
    'attacks30','rwHits30','networth','fit','fitType','lastActive','scoutStatus','sourceVersion'
  ]);
  const MATERIAL_FIELDS = Object.freeze([
    'level','ee','activity30','xanax30','refills30','attacks30','rwHits30',
    'networth','fit','fitType','lastActive'
  ]);
  const PERMANENT_CODES = new Set(['INVALID_SCHEMA','INVALID_BODY','INVALID_ACTION','INVALID_PLAYER','INVALID_DATA']);

  function finiteOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const x = Number(value);
    return Number.isFinite(x) && x >= 0 ? x : null;
  }

  function safeText(value, max) {
    let s = String(value ?? '').trim().slice(0, max);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return s;
  }

  function sanitizeObservation(input, sourceVersion) {
    const playerId = Number(input?.playerId ?? input?.userId ?? input?.id);
    const observedAt = Number(input?.observedAt ?? input?.capturedAt);
    if (!Number.isSafeInteger(playerId) || playerId <= 0) throw new Error('Invalid playerId');
    if (!Number.isFinite(observedAt) || observedAt <= 0) throw new Error('Invalid observedAt');

    return {
      playerId,
      name: safeText(input?.name, 32),
      observedAt,
      level: finiteOrNull(input?.level),
      ee: finiteOrNull(input?.ee),
      activity30: finiteOrNull(input?.activity30),
      xanax30: finiteOrNull(input?.xanax30),
      refills30: finiteOrNull(input?.refills30),
      attacks30: finiteOrNull(input?.attacks30),
      rwHits30: finiteOrNull(input?.rwHits30),
      networth: finiteOrNull(input?.networth),
      fit: finiteOrNull(input?.fit),
      fitType: safeText(input?.fitType || '', 24),
      lastActive: finiteOrNull(input?.lastActive),
      scoutStatus: safeText(input?.scoutStatus || '', 24),
      sourceVersion: safeText(sourceVersion || input?.sourceVersion || '', 16)
    };
  }

  function buildObservePayload(input, sourceVersion) {
    const obs = sanitizeObservation(input, sourceVersion);
    return {
      action: 'observe',
      schema: GLOBAL_SCHEMA_VERSION,
      player: { id: obs.playerId, name: obs.name, level: obs.level },
      observation: { ...obs }
    };
  }

  function materiallyEqual(a, b) {
    return MATERIAL_FIELDS.every(key => {
      const av = a?.[key] ?? null;
      const bv = b?.[key] ?? null;
      return av === bv;
    });
  }

  function normalizeServiceResponse(raw) {
    if (!raw || typeof raw !== 'object') return { ok: false, code: 'INVALID_RESPONSE' };
    return {
      ok: raw.ok === true,
      code: safeText(raw.code || '', 40),
      accepted: raw.accepted === true,
      deduped: raw.deduped === true,
      playerId: Number.isSafeInteger(Number(raw.playerId)) ? Number(raw.playerId) : null,
      observationCount: finiteOrNull(raw.observationCount),
      firstSeen: finiteOrNull(raw.firstSeen),
      lastSeen: finiteOrNull(raw.lastSeen),
      schemaVersion: finiteOrNull(raw.schemaVersion),
      serviceVersion: safeText(raw.serviceVersion || '', 24),
      dedupeWindowMinutes: finiteOrNull(raw.dedupeWindowMinutes),
      maxHistory: finiteOrNull(raw.maxHistory)
    };
  }

  function sanitizeHistoryObservation(input) {
    if (!input || typeof input !== 'object') return null;
    try {
      return sanitizeObservation({
        ...input,
        playerId: input.playerId ?? input.userId ?? input.id,
        observedAt: input.observedAt
      }, input.sourceVersion || '');
    } catch {
      return null;
    }
  }

  function normalizePlayerHistory(raw) {
    if (!raw || raw.ok !== true) return null;
    const playerId = Number(raw.playerId);
    if (!Number.isSafeInteger(playerId) || playerId <= 0) return null;

    const latest = raw.latest ? sanitizeHistoryObservation({ ...raw.latest, playerId }) : null;
    const history = Array.isArray(raw.history)
      ? raw.history.map(item => sanitizeHistoryObservation({ ...item, playerId })).filter(Boolean).slice(0, 100)
      : [];

    return {
      ok: true,
      playerId,
      latest,
      history,
      observationCount: finiteOrNull(raw.observationCount) ?? history.length,
      firstSeen: finiteOrNull(raw.firstSeen),
      lastSeen: finiteOrNull(raw.lastSeen)
    };
  }

  function hasValue(value) {
    return value !== null && value !== undefined && value !== '';
  }

  function pickPreferredValue(values = {}) {
    const order = [
      ['live', 'LIVE'],
      ['local', 'LOCAL'],
      ['global', 'GLOBAL'],
      ['historical', 'HISTORICAL'],
      ['forum', 'FORUM']
    ];
    for (const [key, provenance] of order) {
      if (hasValue(values[key])) return { value: values[key], provenance };
    }
    return { value: null, provenance: 'NONE' };
  }

  function classifyRetry(errorOrResponse) {
    if (errorOrResponse instanceof Error) return 'retry';
    const code = String(errorOrResponse?.code || '').toUpperCase();
    if (PERMANENT_CODES.has(code)) return 'permanent';
    if (errorOrResponse?.ok === true) return 'done';
    return 'retry';
  }

  function makeQueueId(observation) {
    const playerId = Number(observation?.playerId);
    const observedAt = Number(observation?.observedAt);
    if (!Number.isSafeInteger(playerId) || playerId <= 0 || !Number.isFinite(observedAt) || observedAt <= 0) {
      throw new Error('Invalid queue observation identity');
    }
    return `${playerId}:${observedAt}`;
  }

  return Object.freeze({
    GLOBAL_SCHEMA_VERSION,
    GLOBAL_FIELDS,
    MATERIAL_FIELDS,
    sanitizeObservation,
    buildObservePayload,
    materiallyEqual,
    normalizeServiceResponse,
    normalizePlayerHistory,
    pickPreferredValue,
    classifyRetry,
    makeQueueId
  });
});
