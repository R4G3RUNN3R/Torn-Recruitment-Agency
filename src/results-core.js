(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RA_ResultsCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_VISIBLE_COLUMNS = Object.freeze(['player', 'ee', 'preferredCompany', 'activity30', 'lastActive', 'fit']);
  const DEFAULT_SORT = Object.freeze({ key: 'fit', direction: 'desc' });
  const SCOUT_STATUS_ORDER = Object.freeze(['live', 'fresh', 'cached', 'provisional', 'stale', 'failed', 'unscouted']);
  const SCOUT_STATUS_RANK = Object.freeze(Object.fromEntries(SCOUT_STATUS_ORDER.map((key, index) => [key, index])));

  const COMPANY_KEYS = Object.freeze([
    'adult_novelties','amusement_park','candle_shop','car_dealership','clothing_store','cruise_line','cyber_cafe',
    'detective_agency','farm','firework_stand','fitness_center','flower_shop','furniture_store','game_shop','gas_station',
    'gents_strip_club','grocery_store','gun_shop','hair_salon','ladies_strip_club','law_firm','lingerie_store',
    'logistics_management','meat_warehouse','mechanic_shop','mining_corporation','music_store','nightclub','oil_rig',
    'private_security_firm','property_broker','pub','restaurant','software_corporation','sweet_shop','television_network',
    'theater','toy_shop','travel_agency','wedding_chapel','zoo'
  ]);

  const COMPANY_ALIASES = new Map();
  for (const key of COMPANY_KEYS) {
    COMPANY_ALIASES.set(key, key);
    COMPANY_ALIASES.set(key.replace(/_/g, ' '), key);
  }
  Object.entries({
    an: 'adult_novelties',
    'adult novelty': 'adult_novelties',
    'adult novelties': 'adult_novelties',
    psf: 'private_security_firm',
    'private security': 'private_security_firm',
    lm: 'logistics_management',
    logistics: 'logistics_management',
    'logistics company': 'logistics_management',
    'oil rig': 'oil_rig',
    gents: 'gents_strip_club',
    'gentlemans club': 'gents_strip_club',
    'gentleman\'s club': 'gents_strip_club'
  }).forEach(([alias, key]) => COMPANY_ALIASES.set(alias, key));

  function finite(value) {
    if (value === null || value === undefined || value === '') return null;
    const x = Number(value);
    return Number.isFinite(x) ? x : null;
  }

  function parseCompactNumber(value) {
    const raw = String(value ?? '').trim().replace(/,/g, '');
    if (!raw) return { valid: true, empty: true, value: null };
    const m = raw.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*([kmb])?$/i);
    if (!m) return { valid: false, empty: false, value: null };
    const base = Number(m[1]);
    if (!Number.isFinite(base) || base < 0) return { valid: false, empty: false, value: null };
    const mult = ({ k: 1e3, m: 1e6, b: 1e9 })[(m[2] || '').toLowerCase()] || 1;
    const out = base * mult;
    return Number.isFinite(out) ? { valid: true, empty: false, value: out } : { valid: false, empty: false, value: null };
  }

  function normalizeCompany(value) {
    const raw = String(value ?? '').trim().toLowerCase().replace(/[.*]/g, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
    return COMPANY_ALIASES.get(raw) || '';
  }

  function parsePreferredCompany(text) {
    const raw = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    const intent = /(?:\blooking\s+for\b|\bseeking\b|\bprefer(?:ably|red|ring)?\b|\bwant(?:ing)?\b|\bafter\b)\s+(?:a\s+|an\s+|any\s+|\d+\s*\*?\s*)?([^,.;|]{1,80})/ig;
    let match;
    while ((match = intent.exec(raw))) {
      const phrase = match[1].toLowerCase().replace(/[()\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
      const candidates = [...COMPANY_ALIASES.keys()].sort((a, b) => b.length - a.length);
      for (const alias of candidates) {
        const re = new RegExp(`(?:^|\\b)${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\b|$)`, 'i');
        if (re.test(phrase)) return COMPANY_ALIASES.get(alias) || '';
      }
    }
    return '';
  }

  function formatCompany(key) {
    const normalized = normalizeCompany(key) || String(key || '').toLowerCase();
    if (!normalized) return '—';
    return normalized.split('_').map(x => x ? x[0].toUpperCase() + x.slice(1) : '').join(' ')
      .replace(/^Gents Strip Club$/, "Gents Strip Club");
  }

  function scoutOf(row) {
    return row?.scout || (row?.w30 || row?.profile ? row : null);
  }

  function profileOf(row) {
    return scoutOf(row)?.profile || row?.api || row?.profile || {};
  }

  function window30(row) {
    const s = scoutOf(row);
    return s?.w30 || s?.provisionalSource || {};
  }

  function fitOf(row) {
    const direct = finite(row?.fit);
    if (direct !== null) return direct;
    const s = scoutOf(row);
    if (!s) return null;
    for (const key of ['currentFit', 'fit', 'originalFit']) {
      const x = finite(s[key]);
      if (x !== null) return x;
    }
    return null;
  }

  function idleSeconds(row, nowMs = Date.now()) {
    const p = profileOf(row);
    const ts = finite(p.lastActionTs ?? p.last_action?.timestamp ?? row?.lastActionTs);
    if (ts === null || ts <= 0) return null;
    return Math.max(0, Math.floor(nowMs / 1000 - ts));
  }

  function classifyScoutStatus(row, nowMs = Date.now(), freshMs = 12 * 60 * 60 * 1000) {
    const s = scoutOf(row);
    if (!s) return 'unscouted';
    if (s.failed || s.error) return 'failed';
    const p = profileOf(row);
    if (/online/i.test(String(p.status || ''))) return 'live';
    if (s.official === false || s.originalFitType === 'provisional' || s.provisionalSource) return 'provisional';
    const capturedAt = finite(s.capturedAt);
    if (capturedAt === null) return 'cached';
    const age = Math.max(0, nowMs - capturedAt);
    if (age <= Math.min(freshMs, 15 * 60 * 1000)) return 'fresh';
    if (age <= freshMs) return 'cached';
    return 'stale';
  }

  const COLUMNS = Object.freeze([
    { key:'player', label:'Player', type:'text', sortable:true, defaultDirection:'asc', getValue:r => String(r?.name || profileOf(r)?.name || '').trim().toLowerCase() },
    { key:'man', label:'MAN', type:'number', sortable:true, defaultDirection:'desc', getValue:r => finite(r?.stats?.man) },
    { key:'int', label:'INT', type:'number', sortable:true, defaultDirection:'desc', getValue:r => finite(r?.stats?.int) },
    { key:'end', label:'END', type:'number', sortable:true, defaultDirection:'desc', getValue:r => finite(r?.stats?.end) },
    { key:'total', label:'TOTAL', type:'number', sortable:true, defaultDirection:'desc', getValue:r => finite(r?.stats?.total) },
    { key:'ee', label:'EE', type:'number', sortable:true, defaultDirection:'desc', getValue:r => finite(r?.ee) },
    { key:'preferredCompany', label:'Preferred Company', type:'text', sortable:true, defaultDirection:'asc', getValue:r => normalizeCompany(r?.preferredCompany || r?.company) || null },
    { key:'fit', label:'Fit', type:'number', sortable:true, defaultDirection:'desc', getValue:r => fitOf(r) },
    { key:'trend', label:'Trend', type:'number', sortable:true, defaultDirection:'desc', getValue:r => finite(scoutOf(r)?.trend ?? r?.trend) },
    { key:'activity30', label:'Activity', type:'number', sortable:true, defaultDirection:'desc', getValue:r => finite(window30(r)?.activityHours) },
    { key:'lastActive', label:'Last Active', type:'number', sortable:true, defaultDirection:'asc', getValue:(r,now) => idleSeconds(r, now) },
    { key:'scoutStatus', label:'Scout Status', type:'rank', sortable:true, defaultDirection:'asc', getValue:(r,now) => SCOUT_STATUS_RANK[classifyScoutStatus(r, now)] ?? 999 },
    { key:'level', label:'Level', type:'number', sortable:true, defaultDirection:'desc', getValue:r => finite(profileOf(r)?.level) },
    { key:'xanax30', label:'Xanax 30d', type:'number', sortable:true, defaultDirection:'desc', getValue:r => finite(window30(r)?.xanax) },
    { key:'refills30', label:'Refills 30d', type:'number', sortable:true, defaultDirection:'desc', getValue:r => finite(window30(r)?.refills) },
    { key:'attacks30', label:'Attacks 30d', type:'number', sortable:true, defaultDirection:'desc', getValue:r => finite(window30(r)?.attacks) },
    { key:'rwHits30', label:'RW Hits 30d', type:'number', sortable:true, defaultDirection:'desc', getValue:r => finite(window30(r)?.rwHits) },
    { key:'networth', label:'Net Worth', type:'number', sortable:true, defaultDirection:'desc', getValue:r => finite(scoutOf(r)?.extra?.networth) },
    { key:'activeStreak', label:'Active Streak', type:'number', sortable:true, defaultDirection:'desc', getValue:r => finite(scoutOf(r)?.extra?.activeStreak) },
    { key:'bestStreak', label:'Best Streak', type:'number', sortable:true, defaultDirection:'desc', getValue:r => finite(scoutOf(r)?.extra?.bestActiveStreak) },
    { key:'postDate', label:'Post Date', type:'number', sortable:true, defaultDirection:'desc', getValue:r => finite(r?.lastSeenPost) },
    { key:'scoutAge', label:'Scout Age', type:'number', sortable:true, defaultDirection:'asc', getValue:(r,now) => { const c=finite(scoutOf(r)?.capturedAt); return c===null?null:Math.max(0,now-c); } }
  ]);

  const COLUMN_MAP = Object.freeze(Object.fromEntries(COLUMNS.map(c => [c.key, c])));

  function getColumn(key) { return COLUMN_MAP[String(key || '')] || null; }

  function missing(value, type) {
    if (value === null || value === undefined || value === '') return true;
    if ((type === 'number' || type === 'rank') && !Number.isFinite(Number(value))) return true;
    return false;
  }

  function tieBreak(a, b) {
    const an = String(a?.name || profileOf(a)?.name || '').toLowerCase();
    const bn = String(b?.name || profileOf(b)?.name || '').toLowerCase();
    const byName = an.localeCompare(bn);
    if (byName) return byName;
    return (finite(a?.userId) || finite(a?.id) || 0) - (finite(b?.userId) || finite(b?.id) || 0);
  }

  function sortRows(rows, sortState = DEFAULT_SORT, nowMs = Date.now()) {
    const col = getColumn(sortState?.key) || getColumn(DEFAULT_SORT.key);
    const direction = sortState?.direction === 'asc' ? 'asc' : 'desc';
    const sign = direction === 'asc' ? 1 : -1;
    return [...(rows || [])].sort((a, b) => {
      const av = col.getValue(a, nowMs);
      const bv = col.getValue(b, nowMs);
      const am = missing(av, col.type);
      const bm = missing(bv, col.type);
      if (am !== bm) return am ? 1 : -1;
      if (am && bm) return tieBreak(a, b);
      let cmp = 0;
      if (col.type === 'text') cmp = String(av).localeCompare(String(bv));
      else cmp = Number(av) - Number(bv);
      return cmp ? cmp * sign : tieBreak(a, b);
    });
  }

  function numFilter(filters, key) {
    const raw = filters?.[key];
    if (raw === null || raw === undefined || raw === '') return null;
    const parsed = typeof raw === 'number' ? {valid:Number.isFinite(raw),empty:false,value:raw} : parseCompactNumber(raw);
    return parsed.valid && !parsed.empty ? parsed.value : null;
  }

  function applyFilters(rows, filters = {}, nowMs = Date.now()) {
    const q = String(filters.search || '').trim().toLowerCase();
    const minMan = numFilter(filters,'minMan');
    const minInt = numFilter(filters,'minInt');
    const minEnd = numFilter(filters,'minEnd');
    const minTotal = numFilter(filters,'minTotal');
    const minEe = numFilter(filters,'minEe');
    const maxEe = numFilter(filters,'maxEe');
    const minActivity30 = numFilter(filters,'minActivity30');
    const maxIdleDays = numFilter(filters,'maxIdleDays');
    const minFit = numFilter(filters,'minFit');
    const minLevel = numFilter(filters,'minLevel');
    const maxLevel = numFilter(filters,'maxLevel');
    const minNetworth = numFilter(filters,'minNetworth');
    const minActiveStreak = numFilter(filters,'minActiveStreak');
    const minBestStreak = numFilter(filters,'minBestStreak');
    const minStatEnhancers = numFilter(filters,'minStatEnhancers');
    const minXanax30 = numFilter(filters,'minXanax30');
    const minRefills30 = numFilter(filters,'minRefills30');
    const minAttacks30 = numFilter(filters,'minAttacks30');
    const minRwHits30 = numFilter(filters,'minRwHits30');
    const maxDataAgeDays = numFilter(filters,'maxDataAgeDays');
    const company = normalizeCompany(filters.preferredCompany);
    const scoutStatus = String(filters.scoutStatus || '').toLowerCase();
    const faction = String(filters.faction || 'any').toLowerCase();

    return (rows || []).filter(row => {
      const p = profileOf(row);
      const s = scoutOf(row);
      const w = window30(row);
      const name = String(row?.name || p?.name || '').toLowerCase();
      const id = String(row?.userId || row?.id || '');
      if (q && !name.includes(q) && !id.includes(q)) return false;
      if (minMan !== null && (finite(row?.stats?.man) === null || Number(row.stats.man) < minMan)) return false;
      if (minInt !== null && (finite(row?.stats?.int) === null || Number(row.stats.int) < minInt)) return false;
      if (minEnd !== null && (finite(row?.stats?.end) === null || Number(row.stats.end) < minEnd)) return false;
      if (minTotal !== null && (finite(row?.stats?.total) === null || Number(row.stats.total) < minTotal)) return false;
      const ee = finite(row?.ee);
      if (minEe !== null && (ee === null || ee < minEe)) return false;
      if (maxEe !== null && (ee === null || ee > maxEe)) return false;
      if (company && normalizeCompany(row?.preferredCompany || row?.company) !== company) return false;
      const act = finite(w?.activityHours);
      if (minActivity30 !== null && (act === null || act < minActivity30)) return false;
      const idle = idleSeconds(row, nowMs);
      if (maxIdleDays !== null && (idle === null || idle > maxIdleDays * 86400)) return false;
      const fit = fitOf(row);
      if (minFit !== null && (fit === null || fit < minFit)) return false;
      const level = finite(p?.level);
      if (minLevel !== null && (level === null || level < minLevel)) return false;
      if (maxLevel !== null && (level === null || level > maxLevel)) return false;
      if (minNetworth !== null && (finite(s?.extra?.networth) === null || Number(s.extra.networth) < minNetworth)) return false;
      if (scoutStatus && scoutStatus !== 'any' && classifyScoutStatus(row, nowMs) !== scoutStatus) return false;
      const factionId = finite(p?.factionId) || 0;
      if (faction === 'none' && factionId) return false;
      if (faction === 'has' && !factionId) return false;
      if (minActiveStreak !== null && (finite(s?.extra?.activeStreak) === null || Number(s.extra.activeStreak) < minActiveStreak)) return false;
      if (minBestStreak !== null && (finite(s?.extra?.bestActiveStreak) === null || Number(s.extra.bestActiveStreak) < minBestStreak)) return false;
      if (minStatEnhancers !== null && (finite(s?.extra?.statEnhancers30) === null || Number(s.extra.statEnhancers30) < minStatEnhancers)) return false;
      if (minXanax30 !== null && (finite(w?.xanax) === null || Number(w.xanax) < minXanax30)) return false;
      if (minRefills30 !== null && (finite(w?.refills) === null || Number(w.refills) < minRefills30)) return false;
      if (minAttacks30 !== null && (finite(w?.attacks) === null || Number(w.attacks) < minAttacks30)) return false;
      if (minRwHits30 !== null && (finite(w?.rwHits) === null || Number(w.rwHits) < minRwHits30)) return false;
      if (maxDataAgeDays !== null) {
        const captured = finite(s?.capturedAt);
        if (captured === null || Math.max(0, nowMs - captured) > maxDataAgeDays * 86400000) return false;
      }
      return true;
    });
  }

  function activeFilterCount(filters = {}) {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === 'search') return String(value || '').trim() !== '';
      if (value === null || value === undefined || value === '' || value === false || value === 'any') return false;
      return true;
    }).length;
  }

  function processRows(rows, filters = {}, sortState = DEFAULT_SORT, nowMs = Date.now()) {
    return sortRows(applyFilters(rows, filters, nowMs), sortState, nowMs);
  }

  return Object.freeze({
    DEFAULT_VISIBLE_COLUMNS,
    DEFAULT_SORT,
    SCOUT_STATUS_ORDER,
    SCOUT_STATUS_RANK,
    COMPANY_KEYS,
    COLUMNS,
    parseCompactNumber,
    normalizeCompany,
    parsePreferredCompany,
    formatCompany,
    idleSeconds,
    classifyScoutStatus,
    getColumn,
    sortRows,
    applyFilters,
    processRows,
    activeFilterCount
  });
});
