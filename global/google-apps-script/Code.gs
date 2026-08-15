const SCHEMA_VERSION = 1;
const SERVICE_VERSION = '4.3.0';
const DEDUPE_WINDOW_MS = 30 * 60 * 1000;
const MAX_HISTORY = 100;
const MAX_BODY_BYTES = 16384;
const PLAYERS = 'Players';
const OBSERVATIONS = 'Observations';
const META = 'Meta';
const OBS_HEADERS = ['playerId','name','observedAt','level','ee','activity30','xanax30','refills30','attacks30','rwHits30','networth','fit','fitType','lastActive','scoutStatus','sourceVersion'];
const PLAYER_HEADERS = OBS_HEADERS.concat(['firstSeen','observationCount']);
const MATERIAL_FIELDS = ['level','ee','activity30','xanax30','refills30','attacks30','rwHits30','networth','fit','fitType','lastActive'];

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const action = String(e && e.parameter && e.parameter.action || 'meta');
    rateLimit_('get:' + action, 120, 60);
    if (action === 'player') return json_(handlePlayer_(e.parameter.id));
    if (action === 'meta') return json_(handleMeta_());
    return json_({ok:false, code:'INVALID_ACTION'});
  } catch (error) {
    return json_(safeError_(error));
  }
}

function doPost(e) {
  try {
    const raw = String(e && e.postData && e.postData.contents || '');
    if (!raw || raw.length > MAX_BODY_BYTES) return json_({ok:false, code:'INVALID_BODY'});
    const payload = JSON.parse(raw);
    if (!payload || payload.action !== 'observe') return json_({ok:false, code:'INVALID_ACTION'});
    rateLimit_('observe:' + String(payload && payload.player && payload.player.id || 'unknown'), 20, 60);
    return json_(handleObserve_(payload));
  } catch (error) {
    return json_(safeError_(error));
  }
}

function setup() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    ensureSchema_();
    return handleMeta_();
  } finally {
    lock.releaseLock();
  }
}

function handleObserve_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    ensureSchema_();
    const obs = sanitizePayload_(payload);
    const latest = findPlayerRow_(obs.playerId);
    if (latest && Date.now() - Number(latest.observedAt || 0) < DEDUPE_WINDOW_MS && materiallyEqual_(latest, obs)) {
      return summaryResponse_(obs.playerId, latest, false, true);
    }
    appendObservation_(obs);
    upsertPlayer_(obs, latest);
    return summaryResponse_(obs.playerId, findPlayerRow_(obs.playerId), true, false);
  } finally {
    lock.releaseLock();
  }
}

function handlePlayer_(idValue) {
  ensureSchema_();
  const playerId = parsePlayerId_(idValue);
  const latest = findPlayerRow_(playerId);
  if (!latest) {
    return {ok:true, playerId:playerId, latest:null, history:[], observationCount:0, firstSeen:null, lastSeen:null};
  }

  const sheet = getSpreadsheet_().getSheetByName(OBSERVATIONS);
  const values = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = values.length - 1; i >= 1 && rows.length < MAX_HISTORY; i--) {
    if (Number(values[i][0]) === playerId) rows.push(rowToObservation_(values[i], OBS_HEADERS));
  }

  return {
    ok:true,
    playerId:playerId,
    latest:stripPlayerMeta_(latest),
    history:rows,
    observationCount:Number(latest.observationCount || rows.length || 0),
    firstSeen:Number(latest.firstSeen || latest.observedAt || 0) || null,
    lastSeen:Number(latest.observedAt || 0) || null
  };
}

function handleMeta_() {
  return {
    ok:true,
    schemaVersion:SCHEMA_VERSION,
    serviceVersion:SERVICE_VERSION,
    dedupeWindowMinutes:30,
    maxHistory:MAX_HISTORY
  };
}

function sanitizePayload_(payload) {
  if (Number(payload && payload.schema) !== SCHEMA_VERSION) throw codedError_('INVALID_SCHEMA');
  const player = payload && payload.player || {};
  const input = payload && payload.observation || {};
  const playerId = parsePlayerId_(player.id != null ? player.id : input.playerId);
  const observedAt = requiredTimestamp_(input.observedAt);
  if (observedAt > Date.now() + 10 * 60 * 1000) throw codedError_('INVALID_DATA');

  const obs = {
    playerId:playerId,
    name:safeText_(player.name != null ? player.name : input.name, 32),
    observedAt:observedAt,
    level:boundedNumber_(player.level != null ? player.level : input.level, 0, 10000),
    ee:boundedNumber_(input.ee, 0, 100),
    activity30:boundedNumber_(input.activity30, 0, 24 * 31),
    xanax30:boundedNumber_(input.xanax30, 0, 1000000),
    refills30:boundedNumber_(input.refills30, 0, 1000000),
    attacks30:boundedNumber_(input.attacks30, 0, 100000000),
    rwHits30:boundedNumber_(input.rwHits30, 0, 100000000),
    networth:boundedNumber_(input.networth, 0, 1e18),
    fit:boundedNumber_(input.fit, 0, 100),
    fitType:safeText_(input.fitType, 24),
    lastActive:boundedNumber_(input.lastActive, 0, Date.now() + 10 * 60 * 1000),
    scoutStatus:safeText_(input.scoutStatus, 24),
    sourceVersion:safeText_(input.sourceVersion, 16)
  };
  return obs;
}

function materiallyEqual_(a, b) {
  for (let i = 0; i < MATERIAL_FIELDS.length; i++) {
    const key = MATERIAL_FIELDS[i];
    const av = a[key] == null || a[key] === '' ? null : a[key];
    const bv = b[key] == null || b[key] === '' ? null : b[key];
    if (String(av) !== String(bv)) return false;
  }
  return true;
}

function ensureSchema_() {
  const ss = getSpreadsheet_();
  ensureSheet_(ss, PLAYERS, PLAYER_HEADERS);
  ensureSheet_(ss, OBSERVATIONS, OBS_HEADERS);
  const meta = ensureSheet_(ss, META, ['key','value']);
  const current = meta.getDataRange().getValues();
  const entries = {};
  for (let i = 1; i < current.length; i++) entries[String(current[i][0])] = current[i][1];
  const needed = [
    ['schemaVersion', SCHEMA_VERSION],
    ['serviceVersion', SERVICE_VERSION],
    ['dedupeWindowMinutes', 30]
  ];
  for (let i = 0; i < needed.length; i++) {
    if (entries[needed[i][0]] == null) meta.appendRow(needed[i]);
  }
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else {
    const existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0].map(String);
    for (let i = 0; i < headers.length; i++) {
      if (existing[i] !== headers[i]) throw codedError_('SCHEMA_MISMATCH');
    }
  }
  return sheet;
}

function appendObservation_(obs) {
  const sheet = getSpreadsheet_().getSheetByName(OBSERVATIONS);
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, OBS_HEADERS.length).setValues([OBS_HEADERS.map(function (key) { return obs[key] == null ? '' : obs[key]; })]);
}

function upsertPlayer_(obs, latest) {
  const sheet = getSpreadsheet_().getSheetByName(PLAYERS);
  const firstSeen = latest ? Number(latest.firstSeen || latest.observedAt || obs.observedAt) : obs.observedAt;
  const observationCount = latest ? Number(latest.observationCount || 0) + 1 : 1;
  const rowObj = Object.assign({}, obs, {firstSeen:firstSeen, observationCount:observationCount});
  const row = PLAYER_HEADERS.map(function (key) { return rowObj[key] == null ? '' : rowObj[key]; });
  if (latest && latest.__row) sheet.getRange(latest.__row, 1, 1, row.length).setValues([row]);
  else sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

function findPlayerRow_(playerId) {
  const sheet = getSpreadsheet_().getSheetByName(PLAYERS);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (Number(values[i][0]) === Number(playerId)) {
      const obj = rowToObservation_(values[i], PLAYER_HEADERS);
      obj.__row = i + 1;
      return obj;
    }
  }
  return null;
}

function rowToObservation_(row, headers) {
  const out = {};
  for (let i = 0; i < headers.length; i++) out[headers[i]] = row[i] === '' ? null : row[i];
  return out;
}

function stripPlayerMeta_(row) {
  const out = {};
  for (let i = 0; i < OBS_HEADERS.length; i++) out[OBS_HEADERS[i]] = row[OBS_HEADERS[i]] == null ? null : row[OBS_HEADERS[i]];
  return out;
}

function summaryResponse_(playerId, latest, accepted, deduped) {
  return {
    ok:true,
    accepted:accepted === true,
    deduped:deduped === true,
    playerId:playerId,
    observationCount:Number(latest && latest.observationCount || 0),
    firstSeen:Number(latest && latest.firstSeen || latest && latest.observedAt || 0) || null,
    lastSeen:Number(latest && latest.observedAt || 0) || null
  };
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw codedError_('NOT_CONFIGURED');
  return SpreadsheetApp.openById(id);
}

function parsePlayerId_(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw codedError_('INVALID_PLAYER');
  return id;
}

function requiredTimestamp_(value) {
  const x = Number(value);
  if (!Number.isFinite(x) || x <= 0) throw codedError_('INVALID_DATA');
  return x;
}

function boundedNumber_(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const x = Number(value);
  if (!Number.isFinite(x) || x < min || x > max) throw codedError_('INVALID_DATA');
  return x;
}

function safeText_(value, max) {
  let s = String(value == null ? '' : value).trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function rateLimit_(key, limit, seconds) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'rl:' + key;
  const current = Number(cache.get(cacheKey) || 0);
  if (current >= limit) throw codedError_('RATE_LIMIT');
  cache.put(cacheKey, String(current + 1), seconds);
}

function codedError_(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function safeError_(error) {
  const code = String(error && error.code || error && error.message || 'SERVER_ERROR').toUpperCase();
  const allowed = ['INVALID_SCHEMA','INVALID_BODY','INVALID_ACTION','INVALID_PLAYER','INVALID_DATA','SCHEMA_MISMATCH','NOT_CONFIGURED','RATE_LIMIT'];
  return {ok:false, code:allowed.indexOf(code) >= 0 ? code : 'SERVER_ERROR'};
}
