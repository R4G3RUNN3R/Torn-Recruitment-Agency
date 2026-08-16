// ==UserScript==
// @name         R4G3RUNN3R's Recruitment Agency
// @namespace    r4g3runn3r.recruitment.agency
// @version      4.5.0
// @description  Recruitment discovery, candidate pipeline, Scout intelligence and local recruitment workflow for Torn.
// @author       R4G3RUNN3R[3877028]
// @license      MIT
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/scout-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/results-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/global-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/match-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/forum-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/v45-runtime.js
// @downloadURL  https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/R4G3RUNN3R-Recruitment-Agency.user.js
// @updateURL    https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/R4G3RUNN3R-Recruitment-Agency.user.js
// ==/UserScript==

(() => {
  'use strict';

  if (window.__R4G3_RECRUITMENT_AGENCY_V45__) return;
  window.__R4G3_RECRUITMENT_AGENCY_V45__ = true;

  const ScoutCore = window.RA_ScoutCore;
  const ResultsCore = window.RA_ResultsCore;
  const GlobalCore = window.RA_GlobalCore;
  const MatchCore = window.RA_MatchCore;
  const ForumCore = window.RA_ForumCore;
  const V45 = window.RA_V45Runtime;
  if (!ScoutCore || !ResultsCore || !GlobalCore || !MatchCore || !ForumCore || !V45) {
    console.error('[RA] v4.5 required core module did not load.');
    return;
  }

  const SCRIPT_VERSION = '4.5.0';
  const DB_NAME = 'tornWorkerDB';
  const REQUIRED_DB_VERSION = 12;
  const API_BASE = 'https://api.torn.com/v2';
  const API_COMMENT = 'R4G3RUNN3R Recruitment Agency';
  const MIN_API_GAP_MS = 800;
  const HARD_API_RATE = 75;
  const DEFAULT_COMPANY_THREAD_ID = '15907925';
  const DEFAULT_FACTION_THREAD_ID = '15909136';

  const DEFAULT_SETTINGS = Object.freeze({
    theme:'dark',
    density:'comfortable',
    complexity:'simple',
    sidebarCollapsed:false,
    dockEnabled:true,
    includeInactive:false,
    activePage:'overview',
    apiKey:'',
    scout:{rate:75,workers:3,budget:900},
    recruitment:V45.normalizeRecruitmentSettings({
      companyThreadId:DEFAULT_COMPANY_THREAD_ID,
      factionThreadId:DEFAULT_FACTION_THREAD_ID
    }),
    global:{enabled:true,endpoint:''},
    candidates:{view:'table',visibleColumns:[...ResultsCore.DEFAULT_VISIBLE_COLUMNS]},
    match:{activeProfileId:''}
  });

  let db = null;
  let settings = null;
  let currentPage = 'overview';
  let topZ = 2147483400;
  let helpPinned = false;
  let helpAnchor = null;
  let resizeTimer = null;

  const apiRuntime = {gate:Promise.resolve(),nextAt:0};

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function n(value, fallback = 0) { const out = Number(value); return Number.isFinite(out) ? out : fallback; }
  function clampRate(value) { return Math.max(10, Math.min(HARD_API_RATE, n(value, HARD_API_RATE))); }

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, REQUIRED_DB_VERSION);
      request.onupgradeneeded = event => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains('users')) database.createObjectStore('users', {keyPath:'recordId'});
        if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta', {keyPath:'key'});
        if (!database.objectStoreNames.contains('scoutLatest')) database.createObjectStore('scoutLatest', {keyPath:'userId'});
        if (!database.objectStoreNames.contains('scoutHistory')) {
          const store = database.createObjectStore('scoutHistory', {keyPath:'snapshotId'});
          store.createIndex('userId','userId',{unique:false});
          store.createIndex('capturedAt','capturedAt',{unique:false});
        }
        if (!database.objectStoreNames.contains('globalLatest')) database.createObjectStore('globalLatest', {keyPath:'userId'});
        if (!database.objectStoreNames.contains('globalHistory')) {
          const store = database.createObjectStore('globalHistory', {keyPath:'snapshotId'});
          store.createIndex('userId','userId',{unique:false});
          store.createIndex('observedAt','observedAt',{unique:false});
        }
        if (!database.objectStoreNames.contains('globalSyncQueue')) database.createObjectStore('globalSyncQueue', {keyPath:'queueId'});
        if (!database.objectStoreNames.contains('candidateLocal')) database.createObjectStore('candidateLocal', {keyPath:'userId'});
        if (!database.objectStoreNames.contains('matchProfiles')) database.createObjectStore('matchProfiles', {keyPath:'profileId'});
        if (!database.objectStoreNames.contains('forumSources')) {
          const store = database.createObjectStore('forumSources', {keyPath:'sourceId'});
          store.createIndex('userId','userId',{unique:false});
          store.createIndex('postedAt','postedAt',{unique:false});
          store.createIndex('sourceType','sourceType',{unique:false});
          store.createIndex('threadId','threadId',{unique:false});
        }
        if (!database.objectStoreNames.contains('forumSyncState')) database.createObjectStore('forumSyncState', {keyPath:'feedId'});
        if (!database.objectStoreNames.contains('appLogs')) database.createObjectStore('appLogs', {keyPath:'logId'});
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
      request.onblocked = () => reject(new Error('IndexedDB v12 upgrade is blocked by another Torn tab.'));
    });
  }

  const idb = {
    get(store,key) { return new Promise(resolve => { try { const q=db.transaction(store,'readonly').objectStore(store).get(key); q.onsuccess=()=>resolve(q.result||null); q.onerror=()=>resolve(null); } catch { resolve(null); } }); },
    getAll(store) { return new Promise(resolve => { try { const q=db.transaction(store,'readonly').objectStore(store).getAll(); q.onsuccess=()=>resolve(q.result||[]); q.onerror=()=>resolve([]); } catch { resolve([]); } }); },
    put(store,value) { return new Promise((resolve,reject)=>{ try { const tx=db.transaction(store,'readwrite'); tx.objectStore(store).put(value); tx.oncomplete=()=>resolve(true); tx.onerror=()=>reject(tx.error); } catch(error){ reject(error); } }); },
    clear(store) { return new Promise(resolve => { try { const q=db.transaction(store,'readwrite').objectStore(store).clear(); q.onsuccess=()=>resolve(true); q.onerror=()=>resolve(false); } catch { resolve(false); } }); },
    delete(store,key) { return new Promise(resolve => { try { const q=db.transaction(store,'readwrite').objectStore(store).delete(key); q.onsuccess=()=>resolve(true); q.onerror=()=>resolve(false); } catch { resolve(false); } }); }
  };

  function mergeSettings(raw = {}) {
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      complexity:raw.complexity === 'advanced' ? 'advanced' : 'simple',
      scout:{...DEFAULT_SETTINGS.scout,...(raw.scout||{}),rate:clampRate(raw.scout?.rate)},
      recruitment:V45.normalizeRecruitmentSettings({...DEFAULT_SETTINGS.recruitment,...(raw.recruitment||{})}),
      global:{...DEFAULT_SETTINGS.global,...(raw.global||{})},
      candidates:{...DEFAULT_SETTINGS.candidates,...(raw.candidates||{})},
      match:{...DEFAULT_SETTINGS.match,...(raw.match||{})}
    };
  }

  async function getMeta() {
    return await idb.get('meta','global') || {key:'global',settings:DEFAULT_SETTINGS,ui:{windowGeometry:{}}};
  }

  async function saveSettings(patch) {
    const meta = await getMeta();
    meta.settings = mergeSettings({...meta.settings,...patch});
    await idb.put('meta',meta);
    settings = meta.settings;
  }

  async function logEvent(type, message, details = {}) {
    if (!db) return;
    const entry = V45.makeLogEntry(type,message,details);
    entry.logId = `${entry.at}:${Math.random().toString(36).slice(2,8)}`;
    await idb.put('appLogs',entry);
    const all = await idb.getAll('appLogs');
    if (all.length > 500) {
      all.sort((a,b)=>a.at-b.at);
      for (const old of all.slice(0, all.length - 500)) await idb.delete('appLogs',old.logId);
    }
  }

  async function reserveApiCall() {
    let unlock;
    const previous = apiRuntime.gate;
    apiRuntime.gate = new Promise(resolve => { unlock = resolve; });
    await previous;
    try {
      const gap = Math.max(MIN_API_GAP_MS, 60000 / clampRate(settings.scout.rate));
      const wait = Math.max(0, apiRuntime.nextAt - Date.now());
      if (wait) await sleep(wait);
      apiRuntime.nextAt = Date.now() + gap;
    } finally {
      unlock();
    }
  }

  async function ensureApiKey(force = false) {
    if (!force && settings.apiKey && settings.apiKey.length >= 8) return settings.apiKey;
    const key = String(prompt('Enter your Torn PUBLIC API key:', settings.apiKey || '') || '').trim();
    if (!key) throw new Error('A Torn API key is required.');
    await saveSettings({apiKey:key});
    return key;
  }

  async function tornRequest(path, params = {}) {
    await reserveApiCall();
    const key = await ensureApiKey(false);
    const url = new URL(`${API_BASE}/${String(path).replace(/^\/+/, '')}`);
    url.searchParams.set('key',key);
    url.searchParams.set('comment',API_COMMENT);
    for (const [name,value] of Object.entries(params)) if (value !== '' && value != null) url.searchParams.set(name,String(value));
    const response = await fetch(url,{method:'GET',cache:'no-store',credentials:'omit'});
    const data = await response.json().catch(()=>null);
    if (!response.ok || data?.error) throw new Error(data?.error?.error || data?.error?.message || `Torn API HTTP ${response.status}`);
    return data;
  }

  function injectStyles() {
    if (document.getElementById('ra-v45-css')) return;
    const style = document.createElement('style');
    style.id = 'ra-v45-css';
    style.textContent = `
:root{--ra-bg:#0b0f0d;--ra-panel:#121815;--ra-panel2:#18211c;--ra-line:#2a3830;--ra-text:#edf4ef;--ra-muted:#9aaa9f;--ra-accent:#46c96f;--ra-accent2:#67e38c;--ra-danger:#e65d62;--ra-warning:#d79a45;--ra-pad:12px}
:root[data-ra-theme="light"]{--ra-bg:#f4f6f5;--ra-panel:#ffffff;--ra-panel2:#f8faf9;--ra-line:#ced7d1;--ra-text:#000000;--ra-muted:#333333;--ra-accent:#16803c;--ra-accent2:#0f9f45;--ra-danger:#b4232a;--ra-warning:#8c5b13}
:root[data-ra-density="compact"]{--ra-pad:8px}
#ra-v45-launch,#ra-v45-app{font:12px/1.4 Arial,sans-serif;color:var(--ra-text);box-sizing:border-box}
#ra-v45-launch{position:fixed;right:12px;bottom:72px;z-index:2147483645;width:52px;height:52px;border-radius:50%;border:1px solid var(--ra-line);background:var(--ra-accent);color:#061009;font-weight:900;cursor:pointer;display:none}
#ra-v45-app{position:fixed;left:7vw;top:6vh;width:86vw;height:84vh;z-index:2147483401;background:var(--ra-bg);border:1px solid var(--ra-line);border-radius:12px;box-shadow:0 18px 50px #0009;display:none;resize:both;overflow:hidden;min-width:560px;min-height:420px;max-width:calc(100vw - 8px);max-height:calc(100vh - 8px)}
.ra-v45-titlebar{height:42px;padding:0 10px;display:flex;align-items:center;justify-content:space-between;background:var(--ra-panel);border-bottom:1px solid var(--ra-line);cursor:move}.ra-v45-titlebar button{cursor:pointer}
.ra-v45-shell{display:grid;grid-template-columns:210px minmax(0,1fr);height:calc(100% - 42px)}.ra-v45-shell.is-collapsed{grid-template-columns:58px minmax(0,1fr)}
.ra-v45-sidebar{background:var(--ra-panel);border-right:1px solid var(--ra-line);overflow:auto;padding:8px}.ra-v45-sidebar-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.ra-v45-brand{font-weight:900}.is-collapsed .ra-v45-brand,.is-collapsed .ra-v45-group-label,.is-collapsed .ra-v45-nav-text{display:none}
.ra-v45-group-label{font-size:9px;font-weight:900;color:var(--ra-muted);letter-spacing:.08em;margin:12px 8px 4px}.ra-v45-nav{display:grid;gap:3px}.ra-v45-nav button{display:flex;align-items:center;gap:8px;width:100%;border:0;border-radius:7px;padding:8px;background:transparent;color:var(--ra-text);text-align:left;cursor:pointer}.ra-v45-nav button:hover,.ra-v45-nav button.is-active{background:var(--ra-panel2)}.ra-v45-nav button.is-active{box-shadow:inset 3px 0 0 var(--ra-accent)}.ra-v45-icon{width:18px;text-align:center;color:var(--ra-accent2);font-weight:900}
.ra-v45-main{min-width:0;display:flex;flex-direction:column}.ra-v45-pagehead{padding:14px 16px;border-bottom:1px solid var(--ra-line);background:var(--ra-panel);display:flex;justify-content:space-between;gap:10px;align-items:center}.ra-v45-pagehead h2{margin:0;font-size:17px}.ra-v45-pagehead p{margin:2px 0 0;color:var(--ra-muted)}.ra-v45-content{overflow:auto;padding:var(--ra-pad);flex:1}
.ra-v45-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ra-v45-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}.ra-v45-kpi,.ra-v45-panel{border:1px solid var(--ra-line);border-radius:9px;background:var(--ra-panel);padding:12px}.ra-v45-kpi span{display:block;color:var(--ra-muted);font-size:10px;text-transform:uppercase;font-weight:900}.ra-v45-kpi b{display:block;font-size:20px;margin-top:4px}.ra-v45-panel{margin-bottom:10px}.ra-v45-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.ra-v45-panel-head h3{margin:0;font-size:13px}.ra-v45-panel-head p{margin:2px 0 0;color:var(--ra-muted)}
.ra-v45-btn{border:1px solid var(--ra-line);background:var(--ra-panel2);color:var(--ra-text);border-radius:7px;padding:7px 10px;font-weight:700;cursor:pointer}.ra-v45-btn-primary{border-color:var(--ra-accent);background:color-mix(in srgb,var(--ra-accent) 18%,var(--ra-panel2))}.ra-v45-btn-danger{border-color:var(--ra-danger);color:#ffdfe0}.ra-v45-actions{display:flex;flex-wrap:wrap;gap:7px}.ra-v45-formgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.ra-v45-field label{display:block;color:var(--ra-muted);font-size:10px;font-weight:900;text-transform:uppercase;margin-bottom:3px}.ra-v45-field input,.ra-v45-field select,.ra-v45-field textarea{width:100%;box-sizing:border-box;border:1px solid var(--ra-line);border-radius:7px;background:var(--ra-panel2);color:var(--ra-text);padding:7px}.ra-v45-help{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;border:1px solid var(--ra-line);background:var(--ra-panel2);color:var(--ra-accent2);font-weight:900;cursor:pointer}.ra-v45-help-popover{position:fixed;z-index:2147483647;max-width:min(340px,calc(100vw - 16px));background:var(--ra-panel2);border:1px solid var(--ra-accent);border-radius:8px;padding:10px;box-shadow:0 12px 30px #0009}.ra-v45-help-popover p{margin:5px 0 0;color:var(--ra-muted)}.ra-v45-toastbox{position:fixed;right:18px;top:18px;z-index:2147483647;display:grid;gap:6px}.ra-v45-toast{min-width:230px;max-width:380px;background:var(--ra-panel2);border:1px solid var(--ra-line);border-left:4px solid var(--ra-accent);border-radius:7px;padding:9px;box-shadow:0 8px 24px #0008}.ra-v45-toast.is-bad{border-left-color:var(--ra-danger)}
.ra-v45-settings details{border:1px solid var(--ra-line);border-radius:8px;background:var(--ra-panel);margin-bottom:8px}.ra-v45-settings summary{padding:10px 12px;font-weight:900;cursor:pointer}.ra-v45-settings .ra-v45-settings-body{padding:0 12px 12px}.ra-v45-danger{border-color:color-mix(in srgb,var(--ra-danger) 70%,var(--ra-line))!important}.ra-v45-nuke{font-size:15px;padding:10px 14px;border:1px solid var(--ra-danger);background:color-mix(in srgb,var(--ra-danger) 16%,var(--ra-panel2));color:#ffe6e6;border-radius:8px;font-weight:900;cursor:pointer}
.ra-v45-log{font:11px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;background:#050806;border:1px solid var(--ra-line);border-radius:7px;padding:9px;max-height:50vh;overflow:auto;white-space:pre-wrap}.ra-v45-muted{color:var(--ra-muted)}
@media(max-width:900px){#ra-v45-app{left:3vw;top:4vh;width:94vw;height:90vh}.ra-v45-shell{grid-template-columns:58px minmax(0,1fr)}.ra-v45-brand,.ra-v45-group-label,.ra-v45-nav-text{display:none}.ra-v45-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){#ra-v45-app{left:4px;top:44px;width:calc(100vw - 8px);height:calc(100vh - 52px);min-width:0}.ra-v45-shell{grid-template-columns:minmax(0,1fr)}.ra-v45-sidebar{position:absolute;left:0;top:42px;bottom:0;width:230px;z-index:8;transform:translateX(-105%);transition:transform .15s}.ra-v45-shell.sidebar-open .ra-v45-sidebar{transform:translateX(0)}.ra-v45-brand,.ra-v45-group-label,.ra-v45-nav-text{display:initial}.ra-v45-grid,.ra-v45-formgrid,.ra-v45-kpis{grid-template-columns:1fr}}
`;
    document.head.appendChild(style);
  }

  function iconFor(pageId) {
    return ({overview:'⌂',discover:'⌕',candidates:'◎',pipeline:'▦',scout:'◈','smart-match':'◇','global-intelligence':'◉',settings:'⚙',data:'▤',logs:'≡'})[pageId] || '•';
  }

  function navHtml() {
    return V45.visiblePages(settings.complexity).map(group => `<div class="ra-v45-group"><div class="ra-v45-group-label">${esc(group.label)}</div><div class="ra-v45-nav">${group.pages.map(page => `<button type="button" data-ra-page="${esc(page.id)}"><span class="ra-v45-icon">${esc(iconFor(page.id))}</span><span class="ra-v45-nav-text">${esc(page.label)}</span></button>`).join('')}</div></div>`).join('');
  }

  function helpButton(key) {
    if (!V45.HELP_REGISTRY[key]) return '';
    return `<button type="button" class="ra-v45-help" data-help-key="${esc(key)}" aria-label="About ${esc(V45.HELP_REGISTRY[key].title)}">i</button>`;
  }

  function panel(title, description, body, helpKey = '') {
    return `<section class="ra-v45-panel"><div class="ra-v45-panel-head"><div><h3>${esc(title)}</h3>${description?`<p>${esc(description)}</p>`:''}</div>${helpKey?helpButton(helpKey):''}</div>${body}</section>`;
  }

  async function counts() {
    const candidates = (await idb.getAll('candidateLocal')).map(V45.normalizeCandidateRecord);
    const forumSources = await idb.getAll('forumSources');
    const logs = await idb.getAll('appLogs');
    return {candidates,forumSources,logs,kpis:V45.kpiCounts(candidates)};
  }

  async function renderOverview() {
    const state = await counts();
    return `<div class="ra-v45-kpis"><div class="ra-v45-kpi"><span>Active Candidates</span><b>${state.kpis.active}</b></div><div class="ra-v45-kpi"><span>High Match</span><b>${state.kpis.highMatch}</b></div><div class="ra-v45-kpi"><span>Shortlisted</span><b>${state.kpis.shortlisted}</b></div><div class="ra-v45-kpi"><span>Replied</span><b>${state.kpis.replied}</b></div></div><div class="ra-v45-grid">${panel('Recent Discoveries','Latest local forum imports',`<div class="ra-v45-muted">${state.forumSources.length ? `${state.forumSources.length} forum source observation(s) stored locally.` : 'No forum discoveries yet.'}</div>`,'discovery')}${panel('Candidates Needing Attention','Recruitment workflow overview',`<div class="ra-v45-muted">Pipeline actions will appear here as candidates move through the six approved stages.</div>`,'pipeline')}${panel('Sync Status','Forum source checkpoint state',`<div class="ra-v45-muted">Configured company, faction and training feeds use safe resumable checkpoints.</div>`,'sync')}${panel('Scout Status','Shared scheduler protection',`<div class="ra-v45-muted">Hard cap ${HARD_API_RATE}/min · minimum gap ${MIN_API_GAP_MS} ms.</div>`)}</div>`;
  }

  async function renderDiscover() {
    const state = await counts();
    return `${panel('Forum Discovery','Company, faction and train-buyer recruitment sources',`<div class="ra-v45-actions"><button class="ra-v45-btn ra-v45-btn-primary" id="ra-v45-sync-forums">Sync Forum Posts</button><button class="ra-v45-btn" id="ra-v45-add-candidate">Add Candidate</button><button class="ra-v45-btn" id="ra-v45-fill-companies">Fill Companies</button><button class="ra-v45-btn" id="ra-v45-cancel-sync" hidden>Cancel Sync</button></div>`,'sync')}${panel('Source Status','Local configured feeds',`<div class="ra-v45-grid"><div><b>Company Forum</b><div class="ra-v45-muted">${esc(settings.recruitment.companyThreadId)}</div></div><div><b>Faction Forum</b><div class="ra-v45-muted">${esc(settings.recruitment.factionThreadId)}</div></div><div><b>Train Buyers</b><div class="ra-v45-muted">${esc(settings.recruitment.trainingThreadId || 'Not configured')}</div></div><div><b>Stored observations</b><div class="ra-v45-muted">${state.forumSources.length}</div></div></div>`,'discovery')}${panel('Activity','Timestamped discovery activity',`<div class="ra-v45-log" id="ra-v45-discovery-log">Ready.</div>`)}`;
  }

  async function renderCandidates() {
    const state = await counts();
    return `<div class="ra-v45-kpis"><div class="ra-v45-kpi"><span>Active</span><b>${state.kpis.active}</b></div><div class="ra-v45-kpi"><span>High Match</span><b>${state.kpis.highMatch}</b></div><div class="ra-v45-kpi"><span>Shortlisted</span><b>${state.kpis.shortlisted}</b></div><div class="ra-v45-kpi"><span>Replied</span><b>${state.kpis.replied}</b></div></div>${panel('Candidates','Unified local candidate workspace',`<div class="ra-v45-actions"><button class="ra-v45-btn">Table / Cards</button><button class="ra-v45-btn">Columns</button><button class="ra-v45-btn">More Filters</button></div><div class="ra-v45-muted" style="margin-top:10px">${state.candidates.length ? `${state.candidates.length} candidate record(s). Table rendering is wired in the next candidate UI pass.` : 'No candidates yet.'}</div>`)}`;
  }

  async function renderPipeline() {
    const candidates = (await idb.getAll('candidateLocal')).map(V45.normalizeCandidateRecord);
    return `${panel('Pipeline','Explicit local stage changes only',`<div class="ra-v45-muted">Opening profiles, forum posts or message compose never changes stage automatically.</div>`,'pipeline')}<div class="ra-v45-grid">${V45.PIPELINE_STAGES.map(stage => `<section class="ra-v45-panel"><div class="ra-v45-panel-head"><h3>${esc(stage)}</h3><span>${candidates.filter(row=>row.pipelineStage===stage).length}</span></div><div class="ra-v45-muted">${candidates.filter(row=>row.pipelineStage===stage).map(row=>esc(row.name||`User ${row.userId}`)).join('<br>') || 'No candidates'}</div></section>`).join('')}</div>`;
  }

  async function renderScout() {
    return `${panel('Scout','Operational player intelligence queue',`<div class="ra-v45-formgrid"><div class="ra-v45-field"><label>Player IDs / profile URLs</label><textarea id="ra-v45-scout-ids"></textarea></div><div class="ra-v45-field"><label>Current scheduler</label><div class="ra-v45-muted">${esc(settings.scout.rate)} calls/min · ${MIN_API_GAP_MS} ms minimum gap · ${esc(settings.scout.workers)} workers</div></div></div><div class="ra-v45-actions"><button class="ra-v45-btn ra-v45-btn-primary">Scout</button><button class="ra-v45-btn">Pause</button><button class="ra-v45-btn">Cancel</button></div>`,'')}`;
  }

  async function renderSmartMatch() {
    return `${panel('Smart Match','Local-only vacancy matching',`<div class="ra-v45-muted">Smart Match remains local and consumes zero Torn API calls. Profile create/duplicate/delete/editor wiring will use the existing Match core.</div>`)}`;
  }

  async function renderGlobal() {
    return `${panel('Global Intelligence','Sanitized shared public-player observations',`<div class="ra-v45-muted">Only the existing approved 16-field Global Intelligence schema is shared. CRM, forum text, stages, notes, salary, availability overrides, messages and Match profiles remain local.</div><div class="ra-v45-actions"><button class="ra-v45-btn">Test Service</button><button class="ra-v45-btn">Retry Sync</button></div>`)}`;
  }

  function settingsSection(title, id, body, helpKey = '') {
    return `<details data-settings-section="${esc(id)}"><summary>${esc(title)} ${helpKey?helpButton(helpKey):''}</summary><div class="ra-v45-settings-body">${body}</div></details>`;
  }

  async function renderSettings() {
    const recruitment = settings.recruitment;
    return `<div class="ra-v45-settings">${settingsSection('General','general',`<div class="ra-v45-formgrid"><div class="ra-v45-field"><label>Theme</label><select id="ra-v45-theme"><option value="dark">Dark</option><option value="light">Light</option></select></div><div class="ra-v45-field"><label>Density</label><select id="ra-v45-density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></div><div class="ra-v45-field"><label>Interface mode</label><select id="ra-v45-complexity"><option value="simple">Simple</option><option value="advanced">Advanced</option></select></div><div class="ra-v45-field"><label>Include inactive candidates</label><select id="ra-v45-include-inactive"><option value="false">No</option><option value="true">Yes</option></select></div></div>`)}${settingsSection('Recruitment','recruitment',`<div class="ra-v45-formgrid"><div class="ra-v45-field"><label>Company thread</label><input id="ra-v45-company-thread" value="${esc(recruitment.companyThreadId)}"></div><div class="ra-v45-field"><label>Faction thread</label><input id="ra-v45-faction-thread" value="${esc(recruitment.factionThreadId)}"></div><div class="ra-v45-field"><label>Training thread</label><input id="ra-v45-training-thread" value="${esc(recruitment.trainingThreadId)}"></div><div class="ra-v45-field"><label>Recent import window (days)</label><input id="ra-v45-import-days" type="number" min="1" value="${esc(recruitment.recentImportDays)}"></div><div class="ra-v45-field" style="grid-column:1/-1"><label>Default Recruitment Message</label><textarea id="ra-v45-default-message">${esc(recruitment.defaultMessage)}</textarea></div></div><div class="ra-v45-muted">Stage and availability colours use local settings and can be reset to defaults.</div>`,'defaultMessage')}${settingsSection('Scout','scout',`<div class="ra-v45-formgrid"><div class="ra-v45-field"><label>API calls/min</label><input id="ra-v45-rate" type="number" min="10" max="75" value="${esc(settings.scout.rate)}"></div><div class="ra-v45-field"><label>Workers</label><input id="ra-v45-workers" type="number" min="1" max="8" value="${esc(settings.scout.workers)}"></div><div class="ra-v45-field"><label>Request budget</label><input id="ra-v45-budget" type="number" min="1" value="${esc(settings.scout.budget)}"></div></div><div class="ra-v45-actions"><button class="ra-v45-btn" id="ra-v45-set-key">Set / Change API Key</button></div>`)}${settingsSection('Candidates','candidates',`<div class="ra-v45-muted">Default Table/Cards view, visible columns, compact density and layout reset live here.</div>`)}${settingsSection('Smart Match','smart-match',`<div class="ra-v45-muted">Only Smart Match defaults/display settings live here. Full profile editing is on the Smart Match page.</div>`)}${settingsSection('Global Intelligence','global',`<div class="ra-v45-formgrid"><div class="ra-v45-field"><label>Enabled</label><select id="ra-v45-global-enabled"><option value="true">Enabled</option><option value="false">Disabled</option></select></div><div class="ra-v45-field"><label>Endpoint</label><input id="ra-v45-global-endpoint" value="${esc(settings.global.endpoint)}"></div></div>`)}${settingsSection('Data & Reset','data',`<div class="ra-v45-actions"><button class="ra-v45-btn" id="ra-v45-reset-layout">Reset Layout</button><button class="ra-v45-btn" id="ra-v45-clear-scout">Clear Scout Cache</button><button class="ra-v45-btn" id="ra-v45-clear-recruitment">Clear Local Candidate / Forum Data</button></div>`,'data')}<details class="ra-v45-danger" data-settings-section="danger"><summary>Danger Zone</summary><div class="ra-v45-settings-body"><p class="ra-v45-muted">Hard local reset deletes Recruitment Agency browser-local data only. It does not touch Torn account data.</p><button type="button" id="ra-v45-nuke" class="ra-v45-nuke">☣ NUKE IT ALL!</button></div></details><div class="ra-v45-actions"><button class="ra-v45-btn ra-v45-btn-primary" id="ra-v45-save-settings">Save Settings</button></div></div>`;
  }

  async function renderData() {
    const state = await counts();
    return `${panel('Local Data','IndexedDB v12 store summary',`<div class="ra-v45-grid"><div><b>Candidates</b><div class="ra-v45-muted">${state.candidates.length}</div></div><div><b>Forum sources</b><div class="ra-v45-muted">${state.forumSources.length}</div></div><div><b>Logs</b><div class="ra-v45-muted">${state.logs.length}</div></div><div><b>DB version</b><div class="ra-v45-muted">${REQUIRED_DB_VERSION}</div></div></div><div class="ra-v45-actions" style="margin-top:10px"><button class="ra-v45-btn">Export Candidate CSV</button></div>`,'data')}`;
  }

  async function renderLogs() {
    const logs = (await idb.getAll('appLogs')).sort((a,b)=>b.at-a.at).slice(0,200);
    return `${panel('Application Logs','Sanitized scheduler, forum, Scout, Global and reset events',`<div class="ra-v45-actions"><button class="ra-v45-btn" id="ra-v45-refresh-logs">Refresh</button><button class="ra-v45-btn" id="ra-v45-clear-logs">Clear Logs</button></div><div class="ra-v45-log" style="margin-top:8px">${logs.map(log=>`[${new Date(log.at).toLocaleString()}] ${esc(log.type.toUpperCase())} ${esc(log.message)}`).join('\n') || 'No log entries.'}</div>`,'logs')}`;
  }

  const PAGE_RENDERERS = Object.freeze({
    overview:renderOverview,
    discover:renderDiscover,
    candidates:renderCandidates,
    pipeline:renderPipeline,
    scout:renderScout,
    'smart-match':renderSmartMatch,
    'global-intelligence':renderGlobal,
    settings:renderSettings,
    data:renderData,
    logs:renderLogs
  });

  function pageMeta(page) {
    return ({
      overview:['Overview','Recruitment status and work needing attention.'],
      discover:['Discover','Import and enrich recruitment candidates from configured Torn forum sources.'],
      candidates:['Candidates','Filter, inspect and manage the unified local candidate workspace.'],
      pipeline:['Pipeline','Move candidates through the exact six approved recruitment stages.'],
      scout:['Scout','Collect official Torn player intelligence through the shared scheduler.'],
      'smart-match':['Smart Match','Score candidate suitability locally without Torn API calls.'],
      'global-intelligence':['Global Intelligence','Review sanitized shared intelligence service status.'],
      settings:['Settings','Application, recruitment, Scout, candidate and privacy configuration.'],
      data:['Data','Local IndexedDB counts, export and reset controls.'],
      logs:['Logs','Sanitized Recruitment Agency events for diagnostics.']
    })[page] || ['Overview','Recruitment Agency'];
  }

  async function route(page, persist = true) {
    currentPage = V45.normalizePage(page, settings.complexity);
    if (persist) await saveSettings({activePage:currentPage});
    const [title,description] = pageMeta(currentPage);
    document.getElementById('ra-v45-page-title').textContent = title;
    document.getElementById('ra-v45-page-description').textContent = description;
    document.querySelectorAll('[data-ra-page]').forEach(button => button.classList.toggle('is-active', button.dataset.raPage === currentPage));
    const renderer = PAGE_RENDERERS[currentPage] || renderOverview;
    document.getElementById('ra-v45-content').innerHTML = await renderer();
    bindPageControls();
    bindHelpButtons();
  }

  function toast(message, bad = false) {
    const box = document.getElementById('ra-v45-toastbox');
    if (!box) return;
    const item = document.createElement('div');
    item.className = `ra-v45-toast${bad?' is-bad':''}`;
    item.textContent = message;
    box.appendChild(item);
    setTimeout(()=>item.remove(),3500);
  }

  function positionHelp(anchor) {
    const pop = document.getElementById('ra-v45-help-popover');
    if (!pop || pop.hidden || !anchor) return;
    const r = anchor.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(340,pop.offsetWidth||300);
    const height = Math.max(90,pop.offsetHeight||120);
    let left = r.right + 7;
    let top = r.top;
    if (left + width > innerWidth - margin) left = r.left - width - 7;
    if (left < margin) left = Math.max(margin, Math.min(r.left, innerWidth - width - margin));
    if (top + height > innerHeight - margin) top = Math.max(margin, innerHeight - height - margin);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  function closeHelp(force = false) {
    if (helpPinned && !force) return;
    const pop = document.getElementById('ra-v45-help-popover');
    if (pop) pop.hidden = true;
    helpPinned = false;
    helpAnchor = null;
  }

  function openHelp(button, pinned = false) {
    const entry = V45.HELP_REGISTRY[button?.dataset?.helpKey];
    const pop = document.getElementById('ra-v45-help-popover');
    if (!entry || !pop || !button) return;
    helpPinned = !!pinned;
    helpAnchor = button;
    pop.innerHTML = `<b>${esc(entry.title)}</b><p>${esc(entry.body)}</p>`;
    pop.hidden = false;
    positionHelp(button);
  }

  function bindHelpButtons() {
    document.querySelectorAll('.ra-v45-help').forEach(button => {
      button.onpointerenter = () => { if (!helpPinned) openHelp(button,false); };
      button.onpointerleave = () => { if (!helpPinned) closeHelp(); };
      button.onfocus = () => { if (!helpPinned) openHelp(button,false); };
      button.onblur = () => { if (!helpPinned) closeHelp(); };
      button.onclick = event => { event.preventDefault(); event.stopPropagation(); if (helpPinned && helpAnchor === button) closeHelp(true); else openHelp(button,true); };
    });
  }

  async function saveSettingsFromPage() {
    const recruitment = V45.normalizeRecruitmentSettings({
      ...settings.recruitment,
      companyThreadId:document.getElementById('ra-v45-company-thread')?.value,
      factionThreadId:document.getElementById('ra-v45-faction-thread')?.value,
      trainingThreadId:document.getElementById('ra-v45-training-thread')?.value,
      recentImportDays:n(document.getElementById('ra-v45-import-days')?.value,30),
      defaultMessage:document.getElementById('ra-v45-default-message')?.value
    });
    await saveSettings({
      theme:document.getElementById('ra-v45-theme')?.value || settings.theme,
      density:document.getElementById('ra-v45-density')?.value || settings.density,
      complexity:document.getElementById('ra-v45-complexity')?.value || settings.complexity,
      includeInactive:document.getElementById('ra-v45-include-inactive')?.value === 'true',
      scout:{...settings.scout,rate:clampRate(document.getElementById('ra-v45-rate')?.value),workers:n(document.getElementById('ra-v45-workers')?.value,3),budget:n(document.getElementById('ra-v45-budget')?.value,900)},
      recruitment,
      global:{...settings.global,enabled:document.getElementById('ra-v45-global-enabled')?.value !== 'false',endpoint:String(document.getElementById('ra-v45-global-endpoint')?.value||'').trim()}
    });
    applyTheme();
    rebuildSidebar();
    await route('settings',false);
    toast('Settings saved.');
    await logEvent('settings','Settings saved',{complexity:settings.complexity,theme:settings.theme});
  }

  async function hardLocalReset() {
    const confirmed = confirm('NUKE IT ALL will permanently delete Recruitment Agency browser-local candidates, forum imports, Scout cache/history, Global cache/queue, Match Profiles, logs and settings. Torn account data is not touched. Continue?');
    if (!confirmed) return;
    const typed = prompt('Type NUKE to confirm the hard local reset:','');
    if (String(typed||'').trim().toUpperCase() !== 'NUKE') { toast('Hard reset cancelled.',true); return; }
    for (const store of ['users','scoutLatest','scoutHistory','globalLatest','globalHistory','globalSyncQueue','candidateLocal','matchProfiles','forumSources','forumSyncState','appLogs','meta']) await idb.clear(store);
    settings = mergeSettings({});
    currentPage = 'overview';
    applyTheme();
    rebuildSidebar();
    await route('overview',false);
    toast('Recruitment Agency local data was reset.');
  }

  async function clearRecruitmentData() {
    if (!confirm('Clear local candidate and forum discovery data?')) return;
    for (const store of ['candidateLocal','forumSources','forumSyncState','users']) await idb.clear(store);
    toast('Local candidate/forum data cleared.');
    await logEvent('reset','Candidate and forum data cleared');
    await route(currentPage,false);
  }

  async function resetLayout() {
    const meta = await getMeta();
    meta.ui = {windowGeometry:{}};
    await idb.put('meta',meta);
    const app = document.getElementById('ra-v45-app');
    Object.assign(app.style,{left:'7vw',top:'6vh',width:'86vw',height:'84vh'});
    toast('Window layout reset.');
  }

  function bindPageControls() {
    document.getElementById('ra-v45-save-settings')?.addEventListener('click',()=>saveSettingsFromPage().catch(error=>toast(error.message,true)));
    const theme=document.getElementById('ra-v45-theme'); if(theme)theme.value=settings.theme;
    const density=document.getElementById('ra-v45-density'); if(density)density.value=settings.density;
    const complexity=document.getElementById('ra-v45-complexity'); if(complexity)complexity.value=settings.complexity;
    const inactive=document.getElementById('ra-v45-include-inactive'); if(inactive)inactive.value=String(!!settings.includeInactive);
    const globalEnabled=document.getElementById('ra-v45-global-enabled'); if(globalEnabled)globalEnabled.value=String(!!settings.global.enabled);
    document.getElementById('ra-v45-set-key')?.addEventListener('click',()=>ensureApiKey(true).then(()=>toast('API key saved.')).catch(error=>toast(error.message,true)));
    document.getElementById('ra-v45-reset-layout')?.addEventListener('click',()=>resetLayout().catch(error=>toast(error.message,true)));
    document.getElementById('ra-v45-clear-scout')?.addEventListener('click',async()=>{ if(!confirm('Clear local Scout cache and history?'))return; await idb.clear('scoutLatest');await idb.clear('scoutHistory');toast('Scout cache cleared.');await logEvent('reset','Scout cache cleared'); });
    document.getElementById('ra-v45-clear-recruitment')?.addEventListener('click',()=>clearRecruitmentData().catch(error=>toast(error.message,true)));
    document.getElementById('ra-v45-nuke')?.addEventListener('click',()=>hardLocalReset().catch(error=>toast(error.message,true)));
    document.getElementById('ra-v45-refresh-logs')?.addEventListener('click',()=>route('logs',false));
    document.getElementById('ra-v45-clear-logs')?.addEventListener('click',async()=>{if(!confirm('Clear local application logs?'))return;await idb.clear('appLogs');await route('logs',false);});
  }

  function applyTheme() {
    document.documentElement.dataset.raTheme = settings.theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.raDensity = settings.density === 'compact' ? 'compact' : 'comfortable';
  }

  function rebuildSidebar() {
    const sidebar = document.getElementById('ra-v45-sidebar-nav');
    if (sidebar) sidebar.innerHTML = navHtml();
    const shell = document.querySelector('.ra-v45-shell');
    shell?.classList.toggle('is-collapsed',!!settings.sidebarCollapsed);
    document.querySelectorAll('[data-ra-page]').forEach(button => button.onclick = () => route(button.dataset.raPage).catch(error=>toast(error.message,true)));
  }

  async function saveGeometry() {
    const app = document.getElementById('ra-v45-app');
    if (!app) return;
    const rect = app.getBoundingClientRect();
    const meta = await getMeta();
    meta.ui = meta.ui || {};
    meta.ui.windowGeometry = meta.ui.windowGeometry || {};
    meta.ui.windowGeometry.main = {x:rect.left,y:rect.top,width:rect.width,height:rect.height};
    await idb.put('meta',meta);
  }

  async function restoreGeometry() {
    const app = document.getElementById('ra-v45-app');
    const meta = await getMeta();
    const saved = meta.ui?.windowGeometry?.main;
    if (!app || !saved) return;
    app.style.left = `${Math.max(4,Math.min(n(saved.x,30),innerWidth-48))}px`;
    app.style.top = `${Math.max(4,Math.min(n(saved.y,50),innerHeight-48))}px`;
    app.style.width = `${Math.max(560,Math.min(n(saved.width,900),innerWidth-8))}px`;
    app.style.height = `${Math.max(420,Math.min(n(saved.height,650),innerHeight-8))}px`;
  }

  function bindWindowDrag() {
    const app = document.getElementById('ra-v45-app');
    const handle = document.getElementById('ra-v45-titlebar');
    if (!app || !handle) return;
    let dragging=false,dx=0,dy=0;
    handle.addEventListener('pointerdown',event=>{ if(event.target.closest('button'))return; dragging=true; const rect=app.getBoundingClientRect();dx=event.clientX-rect.left;dy=event.clientY-rect.top;topZ++;app.style.zIndex=String(topZ);handle.setPointerCapture?.(event.pointerId);event.preventDefault(); });
    handle.addEventListener('pointermove',event=>{if(!dragging)return;app.style.left=`${Math.max(4,Math.min(event.clientX-dx,innerWidth-48))}px`;app.style.top=`${Math.max(4,Math.min(event.clientY-dy,innerHeight-48))}px`;});
    handle.addEventListener('pointerup',event=>{if(!dragging)return;dragging=false;try{handle.releasePointerCapture(event.pointerId);}catch{}saveGeometry().catch(()=>{});});
    const observer = new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>saveGeometry().catch(()=>{}),250);});
    observer.observe(app);
  }

  function openApp() {
    const app = document.getElementById('ra-v45-app');
    if (!app) return;
    app.style.display='block';
    topZ++; app.style.zIndex=String(topZ);
  }

  function findInformationSection() {
    const nodes = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,div,span')].filter(element => /^information$/i.test(String(element.textContent||'').trim()));
    for (const label of nodes) {
      let section=label.parentElement;
      for(let depth=0;section&&depth<5;depth++,section=section.parentElement){const links=section.querySelectorAll("a,button,[role='button']");if(links.length>=2&&links.length<=30)return section;}
    }
    return null;
  }

  function ensureTornLauncher() {
    if (document.getElementById('ra-v45-sidebar-launcher')) return true;
    const section = findInformationSection();
    if (!section) return false;
    const button = document.createElement('button');
    button.id='ra-v45-sidebar-launcher';
    button.type='button';
    button.title='Recruitment Agency';
    button.setAttribute('aria-label','Recruitment Agency');
    button.style.cssText='border:0;background:transparent;color:#46c96f;padding:2px 4px;cursor:pointer;font-weight:900;';
    button.textContent='RA';
    button.onclick=openApp;
    section.appendChild(button);
    const fallback=document.getElementById('ra-v45-launch');if(fallback)fallback.style.display='none';
    return true;
  }

  function mount() {
    injectStyles();
    const fallback=document.createElement('button');
    fallback.id='ra-v45-launch';fallback.textContent='RA';fallback.title='Recruitment Agency';fallback.onclick=openApp;document.body.appendChild(fallback);
    const app=document.createElement('div');
    app.id='ra-v45-app';
    app.innerHTML=`<div class="ra-v45-titlebar" id="ra-v45-titlebar"><b>Recruitment Agency <span class="ra-v45-muted">v${SCRIPT_VERSION}</span></b><div class="ra-v45-actions"><button type="button" class="ra-v45-btn" id="ra-v45-mobile-menu">☰</button><button type="button" class="ra-v45-btn" id="ra-v45-close">×</button></div></div><div class="ra-v45-shell"><aside class="ra-v45-sidebar"><div class="ra-v45-sidebar-head"><span class="ra-v45-brand">Recruitment Agency</span><button type="button" class="ra-v45-btn" id="ra-v45-collapse">≡</button></div><div id="ra-v45-sidebar-nav"></div></aside><main class="ra-v45-main"><header class="ra-v45-pagehead"><div><h2 id="ra-v45-page-title">Overview</h2><p id="ra-v45-page-description"></p></div><div id="ra-v45-page-actions"></div></header><div class="ra-v45-content" id="ra-v45-content"></div></main></div>`;
    document.body.appendChild(app);
    const help=document.createElement('div');help.id='ra-v45-help-popover';help.className='ra-v45-help-popover';help.hidden=true;help.setAttribute('role','dialog');document.body.appendChild(help);
    const toasts=document.createElement('div');toasts.id='ra-v45-toastbox';toasts.className='ra-v45-toastbox';document.body.appendChild(toasts);
    document.getElementById('ra-v45-close').onclick=()=>{app.style.display='none';};
    document.getElementById('ra-v45-collapse').onclick=async()=>{await saveSettings({sidebarCollapsed:!settings.sidebarCollapsed});rebuildSidebar();};
    document.getElementById('ra-v45-mobile-menu').onclick=()=>document.querySelector('.ra-v45-shell')?.classList.toggle('sidebar-open');
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeHelp(true);document.querySelector('.ra-v45-shell')?.classList.remove('sidebar-open');}});
    bindWindowDrag();
    rebuildSidebar();
    restoreGeometry().catch(()=>{});
  }

  async function init() {
    try {
      db = await openDB();
      const meta = await getMeta();
      settings = mergeSettings(meta.settings || {});
      currentPage = V45.normalizePage(settings.activePage,settings.complexity);
      meta.settings = settings;
      meta.ui = meta.ui || {windowGeometry:{}};
      await idb.put('meta',meta);
      if (document.readyState === 'loading') await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
      applyTheme();
      mount();
      await route(currentPage,false);
      ensureTornLauncher();
      if (!document.getElementById('ra-v45-sidebar-launcher')) document.getElementById('ra-v45-launch').style.display='block';
      const observer = new MutationObserver(()=>{if(!document.getElementById('ra-v45-sidebar-launcher'))ensureTornLauncher();});
      observer.observe(document.documentElement,{childList:true,subtree:true});
      await logEvent('startup','Recruitment Agency v4.5 started',{version:SCRIPT_VERSION,dbVersion:REQUIRED_DB_VERSION});
    } catch (error) {
      console.error('[RA] v4.5 init failed',error);
      alert(`Recruitment Agency could not start: ${error.message}`);
    }
  }

  init();
})();
