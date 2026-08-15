// ==UserScript==
// @name         R4G3RUNN3R's Recruitment Agency
// @namespace    r4g3runn3r.recruitment.agency
// @version      4.3.0
// @description  Company/faction recruitment scanner plus local Scout intelligence, Fit, Trend and history for Torn.
// @author       R4G3RUNN3R[3877028]
// @license      MIT
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/scout-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/results-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/global-core.js
// @downloadURL  https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/R4G3RUNN3R-Recruitment-Agency.user.js
// @updateURL    https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/R4G3RUNN3R-Recruitment-Agency.user.js
// ==/UserScript==

(() => {
    "use strict";

    if (window.__R4G3_RECRUITMENT_AGENCY_V4__) return;
    window.__R4G3_RECRUITMENT_AGENCY_V4__ = true;

    const Core = window.RA_ScoutCore;
    const ResultsCore = window.RA_ResultsCore;
    const GlobalCore = window.RA_GlobalCore;
    if (!Core || !ResultsCore || !GlobalCore) {
        console.error("[RA] Required core module did not load.");
        return;
    }

    const SCRIPT_VERSION = "4.3.0";
    const DB_NAME = "tornWorkerDB";
    const REQUIRED_DB_VERSION = 10;
    const API_BASE = "https://api.torn.com/v2";
    const API_COMMENT = "R4G3RUNN3R Recruitment Agency";
    const PAGE_SIZE = 20;
    const THREAD_LIST_LIMIT = 100;
    const CACHE_TTL = 12 * 60 * 60 * 1000;
    const DEFAULT_COMPANY_THREAD_ID = "15907925";
    const DEFAULT_FACTION_THREAD_ID = "15909136";
    const DEFAULT_COMPANY_CATEGORY_ID = 46;
    const DEFAULT_FACTION_CATEGORY_ID = 24;
    const SCOUT_STAT_LIST = "xantaken,useractivity,refills,statenhancersused,attackswon,attackslost,rankedwarhits,networth,activestreak,bestactivestreak";
    const MIN_API_GAP_MS = 800;

    const COMPANY_OPTIONS = [
        "adult_novelties", "amusement_park", "candle_shop", "car_dealership", "clothing_store", "cruise_line",
        "cyber_cafe", "detective_agency", "farm", "firework_stand", "fitness_center", "flower_shop",
        "furniture_store", "game_shop", "gas_station", "gents_strip_club", "grocery_store", "gun_shop",
        "hair_salon", "ladies_strip_club", "law_firm", "lingerie_store", "logistics_management", "meat_warehouse",
        "mechanic_shop", "mining_corporation", "music_store", "nightclub", "oil_rig", "private_security_firm",
        "property_broker", "pub", "restaurant", "software_corporation", "sweet_shop", "television_network",
        "theater", "toy_shop", "travel_agency", "wedding_chapel", "zoo"
    ];

    const DEFAULT_SCOUT = {
        rate: 75,
        workers: 3,
        budget: 900,
        historyGapMs: 0,
        maxCandidates: 60,
        autoScoutNew: false,
        cacheVerdict: "unknown",
        scoring: Core.DEFAULT_SCORING,
        filters: {
            faction: "any",
            activity: "any",
            minLevel: 0,
            maxLevel: 0,
            maxIdleDays: 0,
            minFit: 0,
            minNetworth: 0,
            minActiveStreak: 0,
            minBestStreak: 0,
            minStatEnhancers: 0
        }
    };

    const DEFAULT_SETTINGS = {
        theme: "dark",
        density: "comfortable",
        complexity: "simple",
        dockEnabled: true,
        includeInactive: false,
        activeMode: "company",
        apiKey: "",
        forumScope: "thread",
        forumDays: 30,
        forumEnrich: false,
        view: "table",
        resultSort: "fit",
        resultsByMode: {
            company: {sort:{key:"fit",direction:"desc"},filters:{},visibleColumns:[...ResultsCore.DEFAULT_VISIBLE_COLUMNS]},
            faction: {sort:{key:"fit",direction:"desc"},filters:{},visibleColumns:[...ResultsCore.DEFAULT_VISIBLE_COLUMNS]},
            scout: {sort:{key:"fit",direction:"desc"},filters:{},visibleColumns:[...ResultsCore.DEFAULT_VISIBLE_COLUMNS]}
        },
        resultsPanels: {filtersOpen:false,columnsOpen:false},
        global: {
            enabled: true,
            endpoint: "",
            lookupCacheMs: 30 * 60 * 1000,
            maxRetryAttempts: 5
        },
        scout: DEFAULT_SCOUT
    };

    let db = null;
    let mode = "company";
    let activeThreadId = "";
    let resultRows = [];
    let selectedIds = new Set();
    let settings = null;
    let uiMounted = false;
    let forumScanning = false;
    let observerTimer = null;

    const managedWindows = new Map();
    let topZ = 2147483400;

    const apiRuntime = {
        gate: Promise.resolve(),
        nextAt: 0
    };

    const scoutRuntime = {
        running: false,
        paused: false,
        cancelled: false,
        calls: 0,
        done: 0,
        total: 0,
        ids: []
    };

    const globalRuntime = {
        syncing: false,
        serviceCompatible: null
    };

    function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
    function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
    function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }
    function fmt(v, dp = 0) { return Number.isFinite(Number(v)) ? Number(v).toLocaleString(undefined, {maximumFractionDigits: dp}) : "—"; }
    function money(v) { const x = n(v, NaN); if (!Number.isFinite(x)) return "—"; if (x >= 1e12) return `$${(x/1e12).toFixed(2)}T`; if (x >= 1e9) return `$${(x/1e9).toFixed(2)}B`; if (x >= 1e6) return `$${(x/1e6).toFixed(1)}M`; return `$${Math.round(x).toLocaleString()}`; }
    function ageText(ts) { if (!ts) return "—"; const s = Math.max(0, Math.floor((Date.now() - ts) / 1000)); if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s/60)}m`; if (s < 86400) return `${Math.floor(s/3600)}h`; return `${Math.floor(s/86400)}d`; }
    function profileUrl(id) { return `https://www.torn.com/profiles.php?XID=${id}`; }
    function messageUrl(id) { return `https://www.torn.com/messages.php#/p=compose&XID=${id}`; }
    function forumUrl(threadId) { return `https://www.torn.com/forums.php?a=0&p=threads&t=${threadId}`; }
    function modeLabel(m) { return m === "company" ? "Company" : m === "faction" ? "Faction" : "Scout"; }
    function clampScoutRate(value) { return Math.max(10, Math.min(75, n(value, 75))); }
    function setStatus(text, bad = false) { const el = document.getElementById("ra-status"); if (el) { el.textContent = text; el.classList.toggle("ra-bad", bad); } }
    function setProgress(done, total, text = "") { const p = document.getElementById("ra-progress-fill"); const t = document.getElementById("ra-progress-text"); if (p) p.style.width = `${total ? Math.min(100, done/total*100) : 0}%`; if (t) t.textContent = text || `${done}/${total}`; }

    function normalizeResultsSettings(raw = {}) {
        const legacy = {fit:{key:"fit",direction:"desc"},recent:{key:"postDate",direction:"desc"},trend:{key:"trend",direction:"desc"},name:{key:"player",direction:"asc"},level:{key:"level",direction:"desc"},networth:{key:"networth",direction:"desc"}};
        const fallbackSort = legacy[raw.resultSort] || ResultsCore.DEFAULT_SORT;
        const out = {};
        for (const key of ["company","faction","scout"]) {
            const prior = raw.resultsByMode?.[key] || {};
            out[key] = {
                sort: {key:prior.sort?.key || fallbackSort.key,direction:prior.sort?.direction === "asc" ? "asc" : "desc"},
                filters: {...(prior.filters || {})},
                visibleColumns: Array.isArray(prior.visibleColumns) && prior.visibleColumns.length ? [...new Set(["player",...prior.visibleColumns])] : [...ResultsCore.DEFAULT_VISIBLE_COLUMNS]
            };
        }
        return out;
    }

    function getModeResultsSettings() {
        settings.resultsByMode = settings.resultsByMode || normalizeResultsSettings(settings);
        return settings.resultsByMode[mode] || settings.resultsByMode.company;
    }

    async function saveResultsModeState(patch) {
        const all = normalizeResultsSettings(settings);
        all[mode] = {...all[mode],...patch};
        await saveMetaSettings({resultsByMode:all});
    }

    function mergeSettings(raw = {}) {
        const scout = raw.scout || {};
        const global = raw.global || {};
        const scoring = Core.normalizeScoring({
            targets: {...Core.DEFAULT_SCORING.targets, ...(scout.scoring?.targets || {})},
            weights: {...Core.DEFAULT_SCORING.weights, ...(scout.scoring?.weights || {})}
        });
        return {
            ...DEFAULT_SETTINGS,
            ...raw,
            complexity: raw.complexity === "advanced" ? "advanced" : "simple",
            resultsByMode: normalizeResultsSettings(raw),
            resultsPanels: {...DEFAULT_SETTINGS.resultsPanels,...(raw.resultsPanels || {})},
            global: {...DEFAULT_SETTINGS.global, ...global},
            scout: {
                ...DEFAULT_SCOUT,
                ...scout,
                rate: clampScoutRate(scout.rate),
                scoring,
                filters: {...DEFAULT_SCOUT.filters, ...(scout.filters || {})}
            }
        };
    }

    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, REQUIRED_DB_VERSION);
            req.onupgradeneeded = e => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains("users")) d.createObjectStore("users", {keyPath: "recordId"});
                if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", {keyPath: "key"});
                if (!d.objectStoreNames.contains("scoutLatest")) d.createObjectStore("scoutLatest", {keyPath: "userId"});
                if (!d.objectStoreNames.contains("scoutHistory")) {
                    const h = d.createObjectStore("scoutHistory", {keyPath: "snapshotId"});
                    h.createIndex("userId", "userId", {unique: false});
                    h.createIndex("capturedAt", "capturedAt", {unique: false});
                }
                if (!d.objectStoreNames.contains("globalLatest")) d.createObjectStore("globalLatest", {keyPath: "userId"});
                if (!d.objectStoreNames.contains("globalHistory")) {
                    const g = d.createObjectStore("globalHistory", {keyPath: "snapshotId"});
                    g.createIndex("userId", "userId", {unique: false});
                    g.createIndex("observedAt", "observedAt", {unique: false});
                }
                if (!d.objectStoreNames.contains("globalSyncQueue")) d.createObjectStore("globalSyncQueue", {keyPath: "queueId"});
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
            req.onblocked = () => reject(new Error("IndexedDB upgrade is blocked by another Torn tab."));
        });
    }

    const idb = {
        get(store, key) { return new Promise(resolve => { try { const q = db.transaction(store, "readonly").objectStore(store).get(key); q.onsuccess = () => resolve(q.result || null); q.onerror = () => resolve(null); } catch { resolve(null); } }); },
        put(store, value) { return new Promise((resolve, reject) => { try { const tx = db.transaction(store, "readwrite"); tx.objectStore(store).put(value); tx.oncomplete = () => resolve(true); tx.onerror = () => reject(tx.error); } catch (e) { reject(e); } }); },
        getAll(store) { return new Promise(resolve => { try { const q = db.transaction(store, "readonly").objectStore(store).getAll(); q.onsuccess = () => resolve(q.result || []); q.onerror = () => resolve([]); } catch { resolve([]); } }); },
        clear(store) { return new Promise(resolve => { try { const q = db.transaction(store, "readwrite").objectStore(store).clear(); q.onsuccess = () => resolve(true); q.onerror = () => resolve(false); } catch { resolve(false); } }); },
        delete(store, key) { return new Promise(resolve => { try { const q = db.transaction(store, "readwrite").objectStore(store).delete(key); q.onsuccess = () => resolve(true); q.onerror = () => resolve(false); } catch { resolve(false); } }); }
    };

    async function getMeta() {
        return await idb.get("meta", "global") || {key: "global", settings: DEFAULT_SETTINGS, syncHistory: {}, ui: {windowGeometry: {}}};
    }

    async function saveMetaSettings(patch) {
        const m = await getMeta();
        m.settings = mergeSettings({...m.settings, ...patch});
        await idb.put("meta", m);
        settings = m.settings;
    }

    async function saveSync(modeName, patch) {
        const m = await getMeta();
        m.syncHistory = m.syncHistory || {};
        m.syncHistory[modeName] = {...(m.syncHistory[modeName] || {}), ...patch};
        await idb.put("meta", m);
    }

    async function saveWindowGeometry(id, geometry) {
        const m = await getMeta();
        m.ui = m.ui || {};
        m.ui.windowGeometry = m.ui.windowGeometry || {};
        m.ui.windowGeometry[id] = geometry;
        await idb.put("meta", m);
    }

    async function ensureApiKey(force = false) {
        if (!force && settings.apiKey && settings.apiKey.length >= 8) return settings.apiKey;
        const key = String(prompt("Enter your Torn PUBLIC API key:", settings.apiKey || "") || "").trim();
        if (!key) throw new Error("A Torn API key is required.");
        await saveMetaSettings({apiKey: key});
        return key;
    }

    async function reserveApiCall({scout = false} = {}) {
        let unlock;
        const previous = apiRuntime.gate;
        apiRuntime.gate = new Promise(resolve => { unlock = resolve; });
        await previous;
        try {
            if (scout) {
                while (scoutRuntime.paused && !scoutRuntime.cancelled) await sleep(200);
                if (scoutRuntime.cancelled) throw Object.assign(new Error("Scout cancelled."), {cancelled: true});
                if (scoutRuntime.calls >= Math.max(1, n(settings.scout.budget, 900))) throw Object.assign(new Error("Scout API budget reached."), {budget: true});
            }
            const rateGap = 60000 / clampScoutRate(settings.scout.rate);
            const gap = Math.max(MIN_API_GAP_MS, rateGap);
            const wait = Math.max(0, apiRuntime.nextAt - Date.now());
            if (wait) await sleep(wait);
            apiRuntime.nextAt = Date.now() + gap;
            if (scout) scoutRuntime.calls++;
        } finally {
            unlock();
        }
    }

    async function reserveScoutCall() {
        return reserveApiCall({scout: true});
    }

    async function rawTorn(path, params = {}) {
        const key = await ensureApiKey(false);
        const u = new URL(`${API_BASE}/${String(path).replace(/^\/+/, "")}`);
        u.searchParams.set("key", key);
        u.searchParams.set("comment", API_COMMENT);
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v)); });
        const r = await fetch(u.toString(), {method: "GET", cache: "no-store", credentials: "omit"});
        let data;
        try { data = await r.json(); } catch { throw new Error(`Torn returned HTTP ${r.status}.`); }
        if (!r.ok || data?.error) {
            const err = new Error(data?.error?.error || data?.error?.message || `Torn API error ${data?.error?.code || r.status}`);
            err.code = Number(data?.error?.code || 0);
            err.http = r.status;
            throw err;
        }
        return data;
    }

    async function tornTorn(path, params = {}) {
        await reserveApiCall();
        return rawTorn(path, params);
    }

    async function validateApiKey() { await tornTorn("key/info"); return true; }

    async function scoutTorn(path, params = {}, attempt = 0) {
        await reserveScoutCall();
        try { return await rawTorn(path, params); }
        catch (e) {
            if (e.code === 5 && attempt < 2 && !scoutRuntime.cancelled) { await sleep(1200 * (attempt + 1)); return scoutTorn(path, params, attempt + 1); }
            if ([2, 8, 14, 16].includes(e.code)) scoutRuntime.cancelled = true;
            throw e;
        }
    }

    function extractStats(data) {
        const p = data?.personalstats || data?.personal_stats || data?.personalStats || {};
        return (p && typeof p === "object") ? p : {};
    }

    function extractProfile(data, userId) {
        const p = data?.profile?.profile || data?.profile || data?.basic?.basic || data?.basic || data || {};
        const factionObj = p.faction || {};
        const last = p.last_action || p.lastAction || {};
        const statusObj = p.status || {};
        return {
            id: Number(p.id || p.player_id || userId),
            name: String(p.name || p.username || `User ${userId}`),
            level: n(p.level),
            age: n(p.age),
            factionId: n(factionObj.id || p.faction_id),
            factionName: String(factionObj.name || p.faction_name || ""),
            status: String(statusObj.state || statusObj.description || p.online_status || last.status || "Unknown"),
            lastActionTs: n(last.timestamp || last.time || p.last_action_timestamp)
        };
    }

    async function fetchCurrentScout(userId) {
        return scoutTorn(`user/${userId}`, {selections: "profile,personalstats", stat: SCOUT_STAT_LIST});
    }

    async function fetchHistoricalStats(userId, timestamp) {
        const data = await scoutTorn(`user/${userId}`, {selections: "personalstats", stat: SCOUT_STAT_LIST, timestamp});
        return extractStats(data);
    }

    async function waitHistoryGap(label) {
        const ms = Math.max(0, n(settings.scout.historyGapMs));
        if (!ms) return;
        const until = Date.now() + ms;
        while (Date.now() < until) {
            if (scoutRuntime.cancelled) throw Object.assign(new Error("Scout cancelled."), {cancelled: true});
            while (scoutRuntime.paused) await sleep(200);
            setStatus(`${label} (${Math.ceil((until-Date.now())/1000)}s)`);
            await sleep(Math.min(1000, Math.max(0, until-Date.now())));
        }
    }

    function snapshotFit(snapshot, scoring = settings.scout.scoring) {
        if (snapshot?.official && snapshot.w30) return Core.scoreFit(snapshot.w30, scoring).score;
        if (snapshot?.provisionalSource && snapshot.provisionalDays) return Core.provisionalFit(snapshot.provisionalSource, snapshot.provisionalDays, scoring).score;
        return null;
    }

    async function persistScout(snapshot) {
        await idb.put("scoutLatest", snapshot);
        await idb.put("scoutHistory", snapshot);
        try {
            const observation = buildGlobalObservation(snapshot);
            await enqueueGlobalObservation(observation);
            void flushGlobalSyncQueue({manual:false});
        } catch (error) {
            console.warn("[RA] Global observation skipped:", error?.message || error);
        }
    }

    function normalizeGlobalEndpoint(value) {
        return String(value || "").trim().replace(/\/+$/, "");
    }

    function globalEnabled() {
        return !!settings?.global?.enabled && !!normalizeGlobalEndpoint(settings?.global?.endpoint) && globalRuntime.serviceCompatible !== false;
    }

    function buildGlobalObservation(rowOrScout) {
        const source = rowOrScout || {};
        const scout = source.scout || (source.profile ? source : null) || source;
        const userId = Number(source.userId || source.id || scout?.userId || scout?.profile?.id);
        const context = resultRows.find(row => Number(row.userId) === userId) || source;
        const profile = scout?.profile || context.api || context.profile || {};
        const w = scout?.w30 || scout?.provisionalSource || {};
        const rawLast = Number(profile.lastActionTs ?? profile.last_action?.timestamp ?? 0);
        const lastActive = rawLast > 0 ? (rawLast < 1e12 ? rawLast * 1000 : rawLast) : null;
        return GlobalCore.sanitizeObservation({
            playerId: userId,
            name: context.name || profile.name || "User " + userId,
            observedAt: scout?.capturedAt || Date.now(),
            level: profile.level,
            ee: context.ee,
            activity30: w.activityHours,
            xanax30: w.xanax,
            refills30: w.refills,
            attacks30: w.attacks,
            rwHits30: w.rwHits,
            networth: scout?.extra?.networth,
            fit: snapshotFit(scout),
            fitType: scout?.official ? "official" : (scout?.provisionalSource ? "provisional" : "unmeasured"),
            lastActive,
            scoutStatus: ResultsCore.classifyScoutStatus({...context, scout})
        }, SCRIPT_VERSION);
    }

    async function enqueueGlobalObservation(observation) {
        if (!observation) return false;
        const queueId = GlobalCore.makeQueueId(observation);
        const existing = await idb.get("globalSyncQueue", queueId);
        await idb.put("globalSyncQueue", existing || {
            queueId,
            userId: observation.playerId,
            observation,
            attempts: 0,
            createdAt: Date.now(),
            nextRetryAt: 0,
            lastError: ""
        });
        renderGlobalStatus().catch(() => {});
        return true;
    }

    async function globalJson(url, options = {}) {
        const method = String(options.method || "GET").toUpperCase();
        const body = options.body == null ? null : String(options.body);
        const headers = {...(options.headers || {})};
        if (typeof GM_xmlhttpRequest === "function") {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method,
                    url,
                    headers,
                    data: body,
                    anonymous: true,
                    timeout: 15000,
                    onload: response => {
                        const status = Number(response.status || 0);
                        if (status < 200 || status >= 300) return reject(new Error("Global service HTTP " + status));
                        try { resolve(JSON.parse(String(response.responseText || ""))); }
                        catch { reject(new Error("Global service returned invalid JSON")); }
                    },
                    ontimeout: () => reject(new Error("Global service timed out")),
                    onerror: () => reject(new Error("Global service request failed"))
                });
            });
        }
        const response = await fetch(url, {redirect:"follow", cache:"no-store", method, headers, body});
        if (!response.ok) throw new Error("Global service HTTP " + response.status);
        const text = await response.text();
        try { return JSON.parse(text); } catch { throw new Error("Global service returned invalid JSON"); }
    }

    async function submitGlobalObservation(item) {
        const endpoint = normalizeGlobalEndpoint(settings?.global?.endpoint);
        if (!endpoint) throw new Error("Global service is not configured");
        const raw = await globalJson(endpoint, {
            method: "POST",
            headers: {"Content-Type":"text/plain;charset=utf-8"},
            body: JSON.stringify(GlobalCore.buildObservePayload(item.observation, SCRIPT_VERSION))
        });
        return GlobalCore.normalizeServiceResponse(raw);
    }

    async function flushGlobalSyncQueue({manual=false} = {}) {
        if (globalRuntime.syncing || !globalEnabled()) return {processed:0,pending:(await idb.getAll("globalSyncQueue")).length};
        globalRuntime.syncing = true;
        let processed = 0;
        try {
            const now = Date.now();
            const maxAttempts = Math.max(1, Number(settings.global.maxRetryAttempts || 5));
            const items = (await idb.getAll("globalSyncQueue")).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
            for (const item of items) {
                if (!manual && (Number(item.attempts || 0) >= maxAttempts || Number(item.nextRetryAt || 0) > now)) continue;
                try {
                    const result = await submitGlobalObservation(item);
                    const retryClass = GlobalCore.classifyRetry(result);
                    if (retryClass === "done" || retryClass === "permanent") {
                        await idb.delete("globalSyncQueue", item.queueId);
                    } else {
                        throw Object.assign(new Error(result.code || "Global service rejected observation"), {serviceResponse:result});
                    }
                } catch (error) {
                    const response = error?.serviceResponse || null;
                    if (GlobalCore.classifyRetry(response) === "permanent") {
                        await idb.delete("globalSyncQueue", item.queueId);
                        console.warn("[RA] Global observation permanently rejected", response?.code || error?.message);
                    } else {
                        const attempts = Number(item.attempts || 0) + 1;
                        item.attempts = attempts;
                        item.lastError = String(response?.code || error?.message || "sync failure").slice(0,160);
                        item.nextRetryAt = Date.now() + Math.min(6 * 60 * 60 * 1000, 60 * 1000 * (2 ** Math.min(attempts, 8)));
                        await idb.put("globalSyncQueue", item);
                    }
                }
                processed++;
            }
        } finally {
            globalRuntime.syncing = false;
            await renderGlobalStatus().catch(() => {});
        }
        return {processed,pending:(await idb.getAll("globalSyncQueue")).length};
    }

    async function saveGlobalHistoryResponse(response) {
        if (!response?.ok || !response.playerId) return;
        const userId = Number(response.playerId);
        await idb.put("globalLatest", {userId, fetchedAt:Date.now(), response});
        for (const observation of response.history || []) {
            const observedAt = Number(observation.observedAt || 0);
            if (!observedAt) continue;
            await idb.put("globalHistory", {snapshotId:String(userId) + ":" + String(observedAt), userId, observedAt, observation});
        }
    }

    async function fetchGlobalPlayerHistory(userId, {force=false} = {}) {
        const id = Number(userId);
        if (!id || !settings?.global?.enabled) return null;
        const endpoint = normalizeGlobalEndpoint(settings?.global?.endpoint);
        if (!endpoint) return null;
        const cached = await idb.get("globalLatest", id);
        const ttl = Math.max(60000, Number(settings.global.lookupCacheMs || 30 * 60 * 1000));
        if (!force && cached?.response && Date.now() - Number(cached.fetchedAt || 0) < ttl) return cached.response;
        try {
            const join = endpoint.includes("?") ? "&" : "?";
            const raw = await globalJson(endpoint + join + "action=player&id=" + encodeURIComponent(id));
            const normalized = GlobalCore.normalizePlayerHistory(raw);
            await saveGlobalHistoryResponse(normalized);
            return normalized;
        } catch (error) {
            console.warn("[RA] Global history lookup failed", error?.message || error);
            return cached?.response || null;
        }
    }

    async function testGlobalService() {
        const endpoint = normalizeGlobalEndpoint(document.getElementById("ra-global-endpoint")?.value || settings?.global?.endpoint);
        if (!endpoint) throw new Error("Set the Apps Script /exec endpoint first.");
        const join = endpoint.includes("?") ? "&" : "?";
        const raw = await globalJson(endpoint + join + "action=meta");
        const normalized = GlobalCore.normalizeServiceResponse(raw);
        if (!normalized.ok) throw new Error("Global service error: " + (normalized.code || "unknown"));
        if (Number(normalized.schemaVersion) !== Number(GlobalCore.GLOBAL_SCHEMA_VERSION)) {
            globalRuntime.serviceCompatible = false;
            await renderGlobalStatus("Schema mismatch: service " + normalized.schemaVersion + ", client " + GlobalCore.GLOBAL_SCHEMA_VERSION, true);
            throw new Error("Global service schema is incompatible.");
        }
        globalRuntime.serviceCompatible = true;
        await renderGlobalStatus("Connected · service " + (normalized.serviceVersion || "unknown"));
        return normalized;
    }

    async function renderGlobalStatus(message = "", bad = false) {
        const el = document.getElementById("ra-global-status");
        if (!el || !db) return;
        const pending = (await idb.getAll("globalSyncQueue")).length;
        let text = message;
        if (!text) {
            if (!settings?.global?.enabled) text = "Disabled";
            else if (!normalizeGlobalEndpoint(settings?.global?.endpoint)) text = "Not configured";
            else if (globalRuntime.serviceCompatible === false) text = "Schema incompatible";
            else text = "Enabled · " + pending + " queued";
        } else if (pending) text += " · " + pending + " queued";
        el.textContent = text;
        el.classList.toggle("ra-bad", bad);
    }

    async function scoutPlayer(userId, options = {}) {
        const id = Number(userId);
        if (!id) throw new Error("Invalid player ID.");
        const cached = await idb.get("scoutLatest", id);
        if (!options.force && cached && Date.now() - cached.capturedAt < CACHE_TTL) return {...cached, cacheHit: true};

        setStatus(`Scouting ${id}: current totals...`);
        const currentData = await fetchCurrentScout(id);
        const current = extractStats(currentData);
        const profile = extractProfile(currentData, id);
        const now = Math.floor(Date.now() / 1000);
        let past7 = null, past30 = null, w7 = null, w30 = null;

        if (profile.age >= 7) {
            await waitHistoryGap(`Scouting ${id}: waiting before 7d history`);
            setStatus(`Scouting ${id}: 7 days ago...`);
            past7 = await fetchHistoricalStats(id, now - 7 * 86400);
            w7 = Core.deltaStats(current, past7);
        }

        if (profile.age >= 30) {
            await waitHistoryGap(`Scouting ${id}: waiting before 30d history`);
            setStatus(`Scouting ${id}: 30 days ago...`);
            past30 = await fetchHistoricalStats(id, now - 30 * 86400);
            w30 = Core.deltaStats(current, past30);
        }

        const official = profile.age >= 30 && !!w30;
        let provisionalSource = null;
        let provisionalDays = 0;
        if (!official) {
            if (profile.age > 0 && profile.age < 30) {
                provisionalSource = Core.metricsFromTotals(current);
                provisionalDays = Math.max(1, Math.min(29, profile.age));
            } else if (w7) {
                provisionalSource = w7;
                provisionalDays = 7;
            }
        }

        const fitObj = official ? Core.scoreFit(w30, settings.scout.scoring) : null;
        const provisionalObj = !official && provisionalSource ? Core.provisionalFit(provisionalSource, provisionalDays, settings.scout.scoring) : null;
        const trendObj = w7 && w30 ? Core.computeTrend(w7, w30, settings.scout.scoring) : {percent: null, components: {}};
        const capturedAt = Date.now();
        const snapshot = {
            snapshotId: `${id}:${capturedAt}`,
            userId: id,
            capturedAt,
            source: options.source || "scout",
            profile,
            currentRaw: current,
            past7Raw: past7,
            past30Raw: past30,
            w7,
            w30,
            official,
            provisionalSource,
            provisionalDays,
            provisionalConfidence: provisionalObj?.confidence || null,
            originalFit: fitObj?.score ?? provisionalObj?.score ?? null,
            originalFitType: official ? "official" : (provisionalObj ? "provisional" : "unmeasured"),
            trend: trendObj.percent,
            trendComponents: trendObj.components,
            formula: Core.normalizeScoring(settings.scout.scoring),
            extra: {
                networth: n(current.networth),
                activeStreak: n(current.activestreak),
                bestActiveStreak: n(current.bestactivestreak),
                statEnhancers30: w30?.statEnhancers ?? (provisionalSource?.statEnhancers ?? 0)
            }
        };
        await persistScout(snapshot);
        return snapshot;
    }

    function pauseScout() { if (scoutRuntime.running) { scoutRuntime.paused = true; setStatus("Scout paused."); syncScoutButtons(); } }
    function resumeScout() { if (scoutRuntime.running) { scoutRuntime.paused = false; setStatus("Scout resumed."); syncScoutButtons(); } }
    function cancelScout() { if (scoutRuntime.running) { scoutRuntime.cancelled = true; scoutRuntime.paused = false; setStatus("Cancelling Scout..."); syncScoutButtons(); } }

    function syncBusyControls() {
        const busy=forumScanning || scoutRuntime.running;
        ["ra-full-scan","ra-update-scan","ra-scout-ids","ra-scout-page","ra-scout-selected","ra-scout-all"].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=busy;});
    }

    function syncScoutButtons() {
        const pause = document.getElementById("ra-pause-scout");
        if (pause) pause.textContent = scoutRuntime.paused ? "Resume" : "Pause";
        const cancel = document.getElementById("ra-cancel-scout");
        if (cancel) cancel.disabled = !scoutRuntime.running;
        syncBusyControls();
    }

    async function runScoutQueue(ids, options = {}) {
        if (scoutRuntime.running) throw new Error("A Scout run is already active.");
        const unique = [...new Set(ids.map(Number).filter(Boolean))].slice(0, Math.max(1, n(settings.scout.maxCandidates, 60)));
        if (!unique.length) { setStatus("No players to Scout.", true); return []; }
        scoutRuntime.running = true;
        scoutRuntime.paused = false;
        scoutRuntime.cancelled = false;
        scoutRuntime.calls = 0;
        scoutRuntime.done = 0;
        scoutRuntime.total = unique.length;
        scoutRuntime.ids = unique;
        syncScoutButtons();
        const output = [];
        let cursor = 0;
        const worker = async () => {
            while (!scoutRuntime.cancelled) {
                const idx = cursor++;
                if (idx >= unique.length) break;
                const id = unique[idx];
                try {
                    const snap = await scoutPlayer(id, options);
                    output.push(snap);
                } catch (e) {
                    if (!e.cancelled) console.warn(`[RA] Scout ${id} failed`, e);
                    if ([2,8,14,16].includes(e.code)) setStatus(`Scout stopped: ${e.message}`, true);
                } finally {
                    scoutRuntime.done++;
                    setProgress(scoutRuntime.done, scoutRuntime.total, `Scout ${scoutRuntime.done}/${scoutRuntime.total} · ${scoutRuntime.calls} API calls`);
                }
            }
        };
        try {
            const count = Math.max(1, Math.min(8, n(settings.scout.workers, 3), unique.length));
            await Promise.all(Array.from({length: count}, worker));
        } finally {
            scoutRuntime.running = false;
            scoutRuntime.paused = false;
            syncScoutButtons();
            setStatus(scoutRuntime.cancelled ? `Scout stopped. ${output.length} completed.` : `Scout complete. ${output.length} player(s).`);
            await refreshResults();
        }
        return output;
    }

    async function runCacheDiagnostic(userId) {
        if (scoutRuntime.running) throw new Error("Finish the current Scout run first.");
        const id = Number(userId) || Core.parseIds(prompt("Active player ID for cache test:", "") || "", 1)[0] || "";
        if (!id) throw new Error("A player ID is required for the cache test.");
        scoutRuntime.running = true;
        scoutRuntime.cancelled = false;
        scoutRuntime.paused = false;
        scoutRuntime.calls = 0;
        try {
            const now = Math.floor(Date.now()/1000);
            const params = {selections: "personalstats", stat: SCOUT_STAT_LIST};
            setStatus("Cache test: 7-day request...");
            const a = Core.signature(extractStats(await scoutTorn(`user/${id}`, {...params, timestamp: now - 7 * 86400})));
            setStatus("Cache test: immediate 30-day request...");
            const b = Core.signature(extractStats(await scoutTorn(`user/${id}`, {...params, timestamp: now - 30 * 86400})));
            for (let left = 35; left > 0; left--) { setStatus(`Cache test: waiting ${left}s...`); await sleep(1000); if (scoutRuntime.cancelled) throw new Error("Cache test cancelled."); }
            setStatus("Cache test: repeating 30-day request...");
            const c = Core.signature(extractStats(await scoutTorn(`user/${id}`, {...params, timestamp: now - 30 * 86400})));
            const verdict = a === b && b === c ? "flat" : a === b && b !== c ? "cached" : a !== b && b === c ? "clear" : "odd";
            const scout = {...settings.scout, cacheVerdict: verdict, historyGapMs: verdict === "cached" ? 32000 : settings.scout.historyGapMs};
            await saveMetaSettings({scout});
            if (verdict === "cached") setStatus("Cache test: cached responses detected. Historical gap set to 32s.", true);
            else if (verdict === "clear") setStatus("Cache test: historical responses look clear.");
            else if (verdict === "flat") setStatus("Cache test: player appears flat; no automatic gap change.");
            else setStatus("Cache test: inconclusive; settings unchanged.", true);
            populateSettingsUI();
            return verdict;
        } finally {
            scoutRuntime.running = false;
            syncScoutButtons();
        }
    }

    function parseThreadId(value) {
        const s = String(value || "").trim();
        if (!s) return "";
        return s.match(/[?&]t=(\d+)/i)?.[1] || s.match(/\b(\d{5,})\b/)?.[1] || s;
    }

    function parseCompanyFromText(text) {
        const names = COMPANY_OPTIONS.map(x => x.replaceAll("_", " ").replace("gents strip club", "gentleman's club")).join("|");
        const m = String(text).match(new RegExp(`\\b(${names})\\b`, "i"));
        if (!m) return "";
        return m[1].toLowerCase().replace("gentleman's club", "gents strip club").replace(/\s+/g, "_");
    }

    function parseUserFromApiPost(post) {
        if (!post?.author?.id) return null;
        const text = String(post.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (!text) return null;
        const grab = re => { const m = text.match(re); return m ? n(String(m[1]).replace(/,/g, "")) : 0; };
        const man = grab(/(?:manual\s+labou?r|manual|man)[:\s-]*([0-9,]+)/i);
        const intel = grab(/(?:intelligence|int)[:\s-]*([0-9,]+)/i);
        const end = grab(/(?:endurance|end)[:\s-]*([0-9,]+)/i);
        const ee = text.match(/\b(\d{1,2})\s*(?:\/\s*10\s*)?(?:ee\b|effectiveness)/i);
        return {
            userId: Number(post.author.id),
            name: String(post.author.username || post.author.name || `User ${post.author.id}`),
            stats: {man, int: intel, end, total: man + intel + end},
            ee: ee ? n(ee[1]) : null,
            company: ResultsCore.parsePreferredCompany(text),
            status: /closed|found|filled|job found|not looking|no longer looking|position filled/i.test(text) ? "inactive" : "active",
            rawText: text.slice(0, 1600),
            postId: n(post.id),
            lastSeenPost: n(post.created_time || post.created_at) * 1000
        };
    }

    async function fetchForumThreads(categoryId, from, to) {
        return tornTorn(`forum/${categoryId}/threads`, {limit: THREAD_LIST_LIMIT, sort: "DESC", from, to});
    }

    async function fetchForumPosts(threadId, offset, from, to) {
        return tornTorn(`forum/${threadId}/posts`, {limit: PAGE_SIZE, offset, sort: "DESC", from, to});
    }

    async function persistForumUser(user, threadId, sourceMode) {
        const recordId = `${sourceMode}::${threadId}::${user.userId}`;
        const old = await idb.get("users", recordId);
        await idb.put("users", {
            ...(old || {}), ...user, recordId, sourceMode, threadId: String(threadId),
            lastSeenPost: Math.max(old?.lastSeenPost || 0, user.lastSeenPost || 0)
        });
    }

    async function clearForumMode(sourceMode, threadId = "") {
        const all = await idb.getAll("users");
        for (const row of all) if (row.sourceMode === sourceMode && (!threadId || String(row.threadId) === String(threadId))) await idb.delete("users", row.recordId);
    }

    async function enrichForumRecord(row) {
        try {
            const d = await tornTorn(`user/${row.userId}`, {selections: "profile"});
            const p = extractProfile(d, row.userId);
            row.name = p.name || row.name;
            row.api = p;
            await idb.put("users", row);
        } catch (e) {
            console.warn("[RA] Forum enrichment failed", row.userId, e);
        }
    }

    async function scanOneThread(threadId, from, to, sourceMode) {
        let offset = 0;
        const found = [];
        for (let page = 1; page <= 200; page++) {
            if (!forumScanning) break;
            setStatus(`Scanning thread ${threadId}, page ${page}...`);
            const data = await fetchForumPosts(threadId, offset, from, to);
            const posts = Array.isArray(data?.posts) ? data.posts : [];
            if (!posts.length) break;
            for (const post of posts) {
                const user = parseUserFromApiPost(post);
                if (!user) continue;
                await persistForumUser(user, threadId, sourceMode);
                found.push(user);
            }
            if (!data?._metadata?.links?.next || posts.length < PAGE_SIZE) break;
            offset += posts.length;
        }
        return found;
    }

    async function runForumScan(full) {
        if (forumScanning || scoutRuntime.running || mode === "scout") return;
        forumScanning = true;
        syncBusyControls();
        try {
            await ensureApiKey();
            await validateApiKey();
            const scope = document.getElementById("ra-forum-scope")?.value || settings.forumScope;
            const days = Math.max(0, n(document.getElementById("ra-forum-days")?.value, settings.forumDays));
            activeThreadId = parseThreadId(document.getElementById("ra-target-thread")?.value || activeThreadId);
            const now = Math.floor(Date.now()/1000);
            const from = days ? now - days * 86400 : "";
            const to = now;
            await saveMetaSettings({forumScope: scope, forumDays: days});
            await saveSync(mode, {lastThreadId: activeThreadId, lastRunAt: Date.now()});
            if (full) await clearForumMode(mode, scope === "thread" ? activeThreadId : "");
            let threads;
            if (scope === "thread") {
                if (!activeThreadId) throw new Error("Set a target thread first.");
                threads = [{id: activeThreadId}];
            } else {
                const categoryId = mode === "company" ? DEFAULT_COMPANY_CATEGORY_ID : DEFAULT_FACTION_CATEGORY_ID;
                const data = await fetchForumThreads(categoryId, from, to);
                threads = Array.isArray(data?.threads) ? data.threads : [];
            }
            const discovered = new Set();
            for (let i = 0; i < threads.length && forumScanning; i++) {
                setProgress(i, threads.length, `Thread ${i+1}/${threads.length}`);
                const users = await scanOneThread(String(threads[i].id), from, to, mode);
                users.forEach(u => discovered.add(u.userId));
            }
            if (settings.forumEnrich) {
                const rows = (await idb.getAll("users")).filter(r => r.sourceMode === mode && discovered.has(r.userId));
                for (let i = 0; i < rows.length && forumScanning; i++) {
                    setStatus(`Enriching ${i+1}/${rows.length}...`);
                    await enrichForumRecord(rows[i]);
                }
            }
            setStatus(`Forum scan complete. ${discovered.size} player(s) discovered.`);
            if (settings.scout.autoScoutNew && discovered.size) await runScoutQueue([...discovered], {source: mode});
            await refreshResults();
        } catch (e) {
            setStatus(`Forum scan failed: ${e.message}`, true);
            console.error(e);
        } finally {
            forumScanning = false;
            syncBusyControls();
            setProgress(0, 0, "Idle");
        }
    }

    function readSearchUsersPage() {
        const selectors = ['a[href*="profiles.php?XID="]','a[href*="UserProfile&XID="]','a[href*="XID="]'];
        const seen = new Set();
        const out = [];
        document.querySelectorAll(selectors.join(",")).forEach(a => {
            let id = 0;
            try {
                const u = new URL(a.href, location.origin);
                id = n(u.searchParams.get("XID") || u.searchParams.get("ID") || u.searchParams.get("userId"));
            } catch {}
            if (!id || seen.has(id)) return;
            const row = a.closest("li,tr,[class*='user'],[class*='profile'],[class*='row']") || a.parentElement;
            const name = String(a.textContent || "").trim();
            if (!name) return;
            seen.add(id);
            out.push({id, name, rowText: String(row?.textContent || "")});
        });
        return out.slice(0, Math.max(1, n(settings.scout.maxCandidates, 60)));
    }

    function passesScoutFilters(s) {
        const f = settings.scout.filters;
        const p = s.profile || {};
        const fit = snapshotFit(s);
        const idleDays = p.lastActionTs ? (Date.now()/1000 - p.lastActionTs) / 86400 : 0;
        if (f.faction === "none" && p.factionId) return false;
        if (f.faction === "has" && !p.factionId) return false;
        if (f.activity === "online" && !/online/i.test(p.status)) return false;
        if (f.activity === "active" && p.lastActionTs && idleDays > 1) return false;
        if (n(f.minLevel) && p.level < n(f.minLevel)) return false;
        if (n(f.maxLevel) && p.level > n(f.maxLevel)) return false;
        if (n(f.maxIdleDays) && idleDays > n(f.maxIdleDays)) return false;
        if (n(f.minFit) && (fit === null || fit < n(f.minFit))) return false;
        if (n(f.minNetworth) && n(s.extra?.networth) < n(f.minNetworth)) return false;
        if (n(f.minActiveStreak) && n(s.extra?.activeStreak) < n(f.minActiveStreak)) return false;
        if (n(f.minBestStreak) && n(s.extra?.bestActiveStreak) < n(f.minBestStreak)) return false;
        if (n(f.minStatEnhancers) && n(s.extra?.statEnhancers30) < n(f.minStatEnhancers)) return false;
        return true;
    }

    function rowFit(row) { return snapshotFit(row?.scout || row || {}); }

    function normalizeResultRow(row) {
        if (mode === "scout") return {...row,name:row.profile?.name || `User ${row.userId}`,fit:rowFit(row),preferredCompany:""};
        return {...row,name:row.name || row.api?.name || `User ${row.userId}`,preferredCompany:row.company || ResultsCore.parsePreferredCompany(row.rawText || ""),fit:rowFit(row)};
    }

    function currentResultFilters() {
        const state = getModeResultsSettings();
        const search = String(document.getElementById("ra-results-search")?.value || state.filters?.search || "").trim();
        return {...(state.filters || {}), search};
    }

    function getProcessedResultRows() {
        return ResultsCore.processRows(resultRows.map(normalizeResultRow), currentResultFilters(), getModeResultsSettings().sort, Date.now());
    }

    async function refreshResults() {
        if (!db) return;
        if (mode === "scout") resultRows = await idb.getAll("scoutLatest");
        else {
            const users = (await idb.getAll("users")).filter(r => r.sourceMode === mode && (settings.includeInactive || r.status !== "inactive"));
            const latest = new Map((await idb.getAll("scoutLatest")).map(x => [Number(x.userId),x]));
            resultRows = users.map(u => ({...u,scout:latest.get(Number(u.userId)) || null}));
        }
        renderResults();
    }

    function scoutFitText(s) {
        if (!s) return "—";
        const fit = snapshotFit(s);
        if (fit === null) return "Not measured";
        return `${fit.toFixed(1)}${s.official ? "" : ` P/${s.provisionalConfidence || "?"}`}`;
    }

    function trendText(v) {
        if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
        const x = Number(v);
        return `${x >= 0 ? "+" : ""}${x.toFixed(1)}%`;
    }

    function lastActiveText(row) {
        const idle = ResultsCore.idleSeconds(row, Date.now());
        if (idle === null) return "—";
        if (/online/i.test(String((row.scout || row).profile?.status || row.api?.status || ""))) return "Online";
        if (idle < 60) return `${idle}s`; if (idle < 3600) return `${Math.floor(idle/60)}m`; if (idle < 86400) return `${Math.floor(idle/3600)}h`; return `${Math.floor(idle/86400)}d`;
    }

    function displayColumn(row,key) {
        const s=row.scout || (row.profile ? row : null), w=s?.w30 || s?.provisionalSource || {};
        if(key==="player") return `<a href="${profileUrl(row.userId)}" target="_blank">${esc(row.name || s?.profile?.name || row.userId)}</a><small>${row.userId}</small>`;
        if(key==="man") return fmt(row.stats?.man); if(key==="int") return fmt(row.stats?.int); if(key==="end") return fmt(row.stats?.end); if(key==="total") return fmt(row.stats?.total);
        if(key==="ee") return row.ee ?? "—"; if(key==="preferredCompany") return esc(ResultsCore.formatCompany(row.preferredCompany || row.company));
        if(key==="fit") return scoutFitText(s); if(key==="trend") return trendText(s?.trend); if(key==="activity30") return fmt(w.activityHours,1);
        if(key==="lastActive") return lastActiveText(row); if(key==="scoutStatus") return ResultsCore.classifyScoutStatus(row).toUpperCase();
        if(key==="level") return fmt(s?.profile?.level || row.api?.level); if(key==="xanax30") return fmt(w.xanax,1); if(key==="refills30") return fmt(w.refills,1);
        if(key==="attacks30") return fmt(w.attacks,1); if(key==="rwHits30") return fmt(w.rwHits,1); if(key==="networth") return money(s?.extra?.networth);
        if(key==="activeStreak") return fmt(s?.extra?.activeStreak); if(key==="bestStreak") return fmt(s?.extra?.bestActiveStreak);
        if(key==="postDate") return row.lastSeenPost ? new Date(row.lastSeenPost).toLocaleDateString() : "—"; if(key==="scoutAge") return s?.capturedAt ? ageText(s.capturedAt) : "—"; return "—";
    }

    function setResultsSort(key) {
        const state=getModeResultsSettings(), col=ResultsCore.getColumn(key); if(!col?.sortable)return;
        const direction=state.sort?.key===key ? (state.sort.direction==="asc"?"desc":"asc") : col.defaultDirection;
        saveResultsModeState({sort:{key,direction}}).then(renderResults);
    }

    function renderResultsFilters() {
        const box=document.getElementById("ra-results-filters"); if(!box)return; const f=getModeResultsSettings().filters || {};
        const companies=ResultsCore.COMPANY_KEYS.map(k=>`<option value="${k}" ${f.preferredCompany===k?"selected":""}>${esc(ResultsCore.formatCompany(k))}</option>`).join("");
        box.innerHTML=`<div class="ra-filter-grid">${[["minMan","MAN ≥"],["minInt","INT ≥"],["minEnd","END ≥"],["minTotal","TOTAL ≥"],["minEe","EE ≥"],["maxEe","EE ≤"],["minActivity30","Activity 30d ≥"],["maxIdleDays","Last Active ≤ days"],["minFit","Fit ≥"],["minLevel","Level ≥"],["maxLevel","Level ≤"],["minNetworth","Net Worth ≥"],["minActiveStreak","Active Streak ≥"],["minBestStreak","Best Streak ≥"],["minStatEnhancers","Stat Enhancers ≥"],["minXanax30","Xanax 30d ≥"],["minRefills30","Refills 30d ≥"],["minAttacks30","Attacks 30d ≥"],["minRwHits30","RW Hits 30d ≥"],["maxDataAgeDays","Scout Age ≤ days"]].map(([k,l])=>`<label>${l}<input class="ra-results-filter" data-filter="${k}" value="${esc(f[k]??"")}" inputmode="decimal"></label>`).join("")}<label>Preferred Company<select class="ra-results-filter" data-filter="preferredCompany"><option value="">Any</option>${companies}</select></label><label>Scout Status<select class="ra-results-filter" data-filter="scoutStatus"><option value="">Any</option>${ResultsCore.SCOUT_STATUS_ORDER.map(x=>`<option value="${x}" ${f.scoutStatus===x?"selected":""}>${x.toUpperCase()}</option>`).join("")}</select></label><label>Faction<select class="ra-results-filter" data-filter="faction"><option value="any">Any</option><option value="none" ${f.faction==="none"?"selected":""}>No faction</option><option value="has" ${f.faction==="has"?"selected":""}>Has faction</option></select></label></div>`;
        const numericFilters=new Set(["minMan","minInt","minEnd","minTotal","minEe","maxEe","minActivity30","maxIdleDays","minFit","minLevel","maxLevel","minNetworth","minActiveStreak","minBestStreak","minStatEnhancers","minXanax30","minRefills30","minAttacks30","minRwHits30","maxDataAgeDays"]);
        box.querySelectorAll(".ra-results-filter").forEach(el=>el.addEventListener("change",async()=>{const next={...getModeResultsSettings().filters}; const key=el.dataset.filter; if(numericFilters.has(key) && el.value){const parsed=ResultsCore.parseCompactNumber(el.value);el.classList.toggle("ra-invalid",!parsed.valid);el.setAttribute("aria-invalid",parsed.valid?"false":"true");if(!parsed.valid)return;} if(el.value) next[key]=el.value; else delete next[key]; await saveResultsModeState({filters:next}); renderResults();}));
    }

    function renderResultsColumns() {
        const box=document.getElementById("ra-results-columns"); if(!box)return; const state=getModeResultsSettings();
        box.innerHTML=`<div class="ra-column-grid">${ResultsCore.COLUMNS.map(c=>`<label><input type="checkbox" data-column="${c.key}" ${state.visibleColumns.includes(c.key)?"checked":""} ${c.key==="player"?"disabled":""}> ${esc(c.label)}</label>`).join("")}</div>`;
        box.querySelectorAll("input[data-column]").forEach(el=>el.onchange=async()=>{let cols=[...getModeResultsSettings().visibleColumns]; if(el.checked) cols=[...new Set([...cols,el.dataset.column])]; else cols=cols.filter(x=>x!==el.dataset.column); if(!cols.includes("player"))cols.unshift("player"); await saveResultsModeState({visibleColumns:cols}); renderResults();});
    }

    function renderResults() {
        const wrap=document.getElementById("ra-results-body"),meta=document.getElementById("ra-results-meta"); if(!wrap)return;
        const rows=getProcessedResultRows(),state=getModeResultsSettings(),filterCount=ResultsCore.activeFilterCount(currentResultFilters());
        const col=ResultsCore.getColumn(state.sort.key); if(meta)meta.textContent=`${rows.length} candidate(s) · ${col?.label||"Fit"} ${state.sort.direction==="asc"?"↑":"↓"}${filterCount?` · ${filterCount} filters`:""}`;
        const ft=document.getElementById("ra-results-filters-toggle"); if(ft)ft.textContent=filterCount?`Filters · ${filterCount}`:"Filters";
        const clear=document.getElementById("ra-clear-filters"); if(clear)clear.hidden=!filterCount;
        renderResultsFilters(); renderResultsColumns();
        if(!rows.length){wrap.innerHTML='<div class="ra-empty">No matching results.</div>';return;}
        const cols=state.visibleColumns.filter(k=>ResultsCore.getColumn(k));
        if(settings.view==="cards") wrap.innerHTML=`<div class="ra-cards">${rows.map(r=>`<div class="ra-card"><div class="ra-card-head"><label><input type="checkbox" class="ra-select" data-id="${r.userId}" ${selectedIds.has(Number(r.userId))?"checked":""}> ${displayColumn(r,"player")}</label><b class="ra-fit">${displayColumn(r,"fit")}</b></div><div class="ra-kpis">${cols.filter(k=>!["player","fit"].includes(k)).map(k=>`<span>${esc(ResultsCore.getColumn(k).label)}<b>${displayColumn(r,k)}</b></span>`).join("")}</div><div class="ra-row-actions"><button data-scout="${r.userId}">Scout</button>${r.scout||r.profile?`<button data-history="${r.userId}">History</button>`:""}<a href="${messageUrl(r.userId)}" target="_blank">Message</a></div></div>`).join("")}</div>`;
        else wrap.innerHTML=`<table class="ra-table"><thead><tr><th></th>${cols.map(k=>{const c=ResultsCore.getColumn(k),active=state.sort.key===k,aria=active?(state.sort.direction==="asc"?"ascending":"descending"):"none";return `<th aria-sort="${aria}"><button class="ra-sort-head" data-sort-key="${k}">${esc(c.label)}${active?` ${state.sort.direction==="asc"?"↑":"↓"}`:""}</button></th>`;}).join("")}<th>Actions</th></tr></thead><tbody>${rows.map(r=>`<tr><td><input type="checkbox" class="ra-select" data-id="${r.userId}" ${selectedIds.has(Number(r.userId))?"checked":""}></td>${cols.map(k=>`<td>${displayColumn(r,k)}</td>`).join("")}<td><button data-scout="${r.userId}">Scout</button>${r.scout||r.profile?`<button data-history="${r.userId}">History</button>`:""}</td></tr>`).join("")}</tbody></table>`;
        wrap.querySelectorAll("[data-sort-key]").forEach(b=>b.onclick=()=>setResultsSort(b.dataset.sortKey)); bindResultActions();
    }

    function bindResultActions() {
        document.querySelectorAll(".ra-select").forEach(c => c.onchange = () => { const id=Number(c.dataset.id); c.checked ? selectedIds.add(id) : selectedIds.delete(id); });
        document.querySelectorAll("[data-scout]").forEach(b => b.onclick = () => runScoutQueue([Number(b.dataset.scout)], {force: true, source: mode}).catch(e => setStatus(e.message,true)));
        document.querySelectorAll("[data-history]").forEach(b => b.onclick = () => showHistory(Number(b.dataset.history)));
    }

    async function showHistory(userId) {
        const rows = (await idb.getAll("scoutHistory")).filter(x => Number(x.userId) === Number(userId)).sort((a,b)=>b.capturedAt-a.capturedAt);
        const box = document.getElementById("ra-history");
        const body = document.getElementById("ra-history-body");
        if (!box || !body) return;
        const localHtml = rows.length ? `<table class="ra-table"><thead><tr><th>Date</th><th>Original Fit</th><th>Current Fit</th><th>Type</th><th>Trend</th><th>Window</th></tr></thead><tbody>${rows.map(s=>`<tr><td>${new Date(s.capturedAt).toLocaleString()}</td><td>${s.originalFit??"—"}</td><td>${snapshotFit(s)??"—"}</td><td>${esc(s.originalFitType)}</td><td>${trendText(s.trend)}</td><td>${s.official?"30d":`${s.provisionalDays||"?"}d provisional`}</td></tr>`).join("")}</tbody></table>` : '<div class="ra-empty">No local Scout history for this player.</div>';
        body.innerHTML = `<div class="ra-section"><b>LOCAL Scout History</b>${localHtml}</div><div id="ra-global-history-section" class="ra-section"><b>GLOBAL History</b><div class="ra-note">Loading shared history...</div></div>`;
        box.style.display = "flex";
        bringManagedWindowToFront("history");

        const globalBox = document.getElementById("ra-global-history-section");
        const shared = await fetchGlobalPlayerHistory(userId).catch(() => null);
        if (!globalBox) return;
        if (!shared?.latest) {
            globalBox.innerHTML = '<b>GLOBAL History</b><div class="ra-note">No shared history available.</div>';
            return;
        }
        const history = Array.isArray(shared.history) ? shared.history : [];
        const latest = shared.latest || {};
        const previous = history.find(x => Number(x.observedAt || 0) < Number(latest.observedAt || 0)) || history[1] || null;
        const delta = (current, prior, suffix="") => {
            const a=Number(current), b=Number(prior); if(!Number.isFinite(a)||!Number.isFinite(b))return "—"; const d=a-b; return `${d>=0?"+":""}${d.toFixed(1)}${suffix}`;
        };
        globalBox.innerHTML = `<b>GLOBAL History</b><div class="ra-kpis"><span>First seen<b>${shared.firstSeen?new Date(shared.firstSeen).toLocaleString():"—"}</b></span><span>Last seen<b>${shared.lastSeen?new Date(shared.lastSeen).toLocaleString():"—"}</b></span><span>Observations<b>${fmt(shared.observationCount)}</b></span><span>Provenance<b>GLOBAL / HISTORICAL</b></span><span>Shared Fit<b>${latest.fit??"—"}</b></span><span>Δ Fit<b>${delta(latest.fit,previous?.fit)}</b></span><span>Activity 30d<b>${fmt(latest.activity30,1)}</b></span><span>Δ Activity<b>${delta(latest.activity30,previous?.activity30,"h")}</b></span></div><div class="ra-note">Precedence: LIVE &gt; LOCAL &gt; GLOBAL &gt; HISTORICAL &gt; forum parsed. Shared values never overwrite fresher local Scout data.</div>`;
    }

    async function copyCsv() {
        const rows=getProcessedResultRows(),cols=getModeResultsSettings().visibleColumns.filter(k=>ResultsCore.getColumn(k));
        const quote=v=>`"${String(v??"").replaceAll('"','""').replace(/<[^>]+>/g,"")}"`;
        const lines=[cols.map(k=>quote(ResultsCore.getColumn(k).label)).join(",")];
        for(const row of rows) lines.push(cols.map(k=>quote(String(displayColumn(row,k)).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim())).join(","));
        await navigator.clipboard.writeText(lines.join("\n")); setStatus(`Copied ${rows.length} row(s) as CSV.`);
    }

    function applyTheme() {
        document.documentElement.dataset.raTheme = settings.theme === "light" ? "light" : "dark";
        document.documentElement.dataset.raDensity = settings.density;
    }

    function applyComplexityMode() {
        const advanced = settings.complexity === "advanced";
        document.documentElement.dataset.raComplexity = advanced ? "advanced" : "simple";
        document.querySelectorAll(".ra-advanced-only").forEach(el => { el.hidden = !advanced; });
        const simple = document.getElementById("ra-complexity-simple");
        const adv = document.getElementById("ra-complexity-advanced");
        simple?.classList.toggle("ra-active-toggle", !advanced);
        adv?.classList.toggle("ra-active-toggle", advanced);
    }

    async function saveScoutSettingsFromUI() {
        const targets = {};
        const weights = {};
        for (const key of Core.METRICS) {
            targets[key] = n(document.getElementById(`ra-target-${key}`)?.value, Core.DEFAULT_SCORING.targets[key]);
            weights[key] = n(document.getElementById(`ra-weight-${key}`)?.value, Core.DEFAULT_SCORING.weights[key]);
        }
        const filters = {...settings.scout.filters};
        ["minLevel","maxLevel","maxIdleDays","minFit","minNetworth","minActiveStreak","minBestStreak","minStatEnhancers"].forEach(k => filters[k] = n(document.getElementById(`ra-filter-${k}`)?.value));
        filters.faction = document.getElementById("ra-filter-faction")?.value || "any";
        filters.activity = document.getElementById("ra-filter-activity")?.value || "any";
        const scout = {
            ...settings.scout,
            rate: clampScoutRate(document.getElementById("ra-rate")?.value),
            workers: n(document.getElementById("ra-workers")?.value,3),
            budget: n(document.getElementById("ra-budget")?.value,900),
            historyGapMs: n(document.getElementById("ra-history-gap")?.value,0),
            maxCandidates: n(document.getElementById("ra-max-candidates")?.value,60),
            autoScoutNew: !!document.getElementById("ra-auto-scout")?.checked,
            scoring: Core.normalizeScoring({targets,weights}),
            filters
        };
        await saveMetaSettings({scout});
        populateSettingsUI();
        setStatus("Scout settings saved.");
        await refreshResults();
    }

    function populateSettingsUI() {
        if (!settings) return;
        for (const key of Core.METRICS) {
            const t=document.getElementById(`ra-target-${key}`);
            const w=document.getElementById(`ra-weight-${key}`);
            if(t)t.value=settings.scout.scoring.targets[key];
            if(w)w.value=settings.scout.scoring.weights[key];
        }
        const fields={rate:settings.scout.rate,workers:settings.scout.workers,budget:settings.scout.budget,"history-gap":settings.scout.historyGapMs,"max-candidates":settings.scout.maxCandidates};
        Object.entries(fields).forEach(([k,v])=>{const e=document.getElementById(`ra-${k}`);if(e)e.value=v;});
        const auto=document.getElementById("ra-auto-scout");
        if(auto)auto.checked=!!settings.scout.autoScoutNew;
        ["minLevel","maxLevel","maxIdleDays","minFit","minNetworth","minActiveStreak","minBestStreak","minStatEnhancers"].forEach(k=>{const e=document.getElementById(`ra-filter-${k}`);if(e)e.value=settings.scout.filters[k]||"";});
        const ff=document.getElementById("ra-filter-faction");if(ff)ff.value=settings.scout.filters.faction;
        const fa=document.getElementById("ra-filter-activity");if(fa)fa.value=settings.scout.filters.activity;
        const cv=document.getElementById("ra-cache-verdict");if(cv)cv.textContent=`Cache test: ${settings.scout.cacheVerdict}`;
        const ge=document.getElementById("ra-global-endpoint");if(ge)ge.value=settings.global?.endpoint||"";
        const gx=document.getElementById("ra-global-enabled");if(gx)gx.checked=!!settings.global?.enabled;
        renderGlobalStatus().catch(()=>{});
        applyComplexityMode();
    }

    function injectStyles() {
        if (document.getElementById("ra-v4-css")) return;
        const s=document.createElement("style");
        s.id="ra-v4-css";
        s.textContent=`
:root{--ra-bg:#070b08;--ra-bg2:#101710;--ra-line:#245a2b;--ra-text:#39ff14;--ra-muted:#39ff14;--ra-accent:#39ff14;--ra-danger:#ff5757;--ra-pad:12px}
:root[data-ra-theme="light"]{--ra-bg:#f8fafc;--ra-bg2:#ffffff;--ra-line:#cbd5e1;--ra-text:#000000;--ra-muted:#111111;--ra-accent:#15803d;--ra-danger:#b91c1c}
:root[data-ra-density="compact"]{--ra-pad:7px}
#ra-launch,#ra-panel,#ra-results-panel,#ra-history{font:12px/1.35 Arial,sans-serif;color:var(--ra-text);background:var(--ra-bg);border:1px solid var(--ra-line);box-shadow:0 12px 35px #0008;box-sizing:border-box}
#ra-panel input,#ra-panel select,#ra-panel textarea,#ra-panel button,#ra-panel a,#ra-panel label,#ra-panel summary,#ra-results-panel input,#ra-results-panel select,#ra-results-panel textarea,#ra-results-panel button,#ra-results-panel a,#ra-results-panel table,#ra-results-panel th,#ra-results-panel td,#ra-history input,#ra-history button,#ra-history a,#ra-history table,#ra-history th,#ra-history td{color:var(--ra-text)}
#ra-launch{position:fixed;right:12px;bottom:70px;z-index:2147483645;border-radius:999px;width:52px;height:52px;font-weight:900;color:#001900;background:var(--ra-accent);cursor:pointer;display:none}
#ra-panel{position:fixed;left:calc(100vw - 590px);top:70px;width:560px;height:620px;z-index:2147483401;border-radius:12px;display:none;overflow:auto;resize:both;min-width:360px;min-height:300px;max-width:calc(100vw - 8px);max-height:calc(100vh - 8px)}
#ra-results-panel{position:fixed;left:5vw;top:8vh;width:90vw;height:78vh;z-index:2147483402;border-radius:12px;display:none;overflow:hidden;flex-direction:column;resize:both;min-width:520px;min-height:320px;max-width:calc(100vw - 8px);max-height:calc(100vh - 8px)}
#ra-history{position:fixed;left:18vw;top:14vh;width:760px;height:500px;z-index:2147483403;border-radius:12px;display:none;overflow:hidden;flex-direction:column;resize:both;min-width:420px;min-height:260px;max-width:calc(100vw - 8px);max-height:calc(100vh - 8px)}
.ra-head{padding:10px 12px;background:var(--ra-bg2);border-bottom:1px solid var(--ra-line);display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:move;position:sticky;top:0;z-index:4}.ra-head b{font-size:14px}.ra-head-actions{display:flex;gap:5px;align-items:center}.ra-head button,.ra-btn,.ra-row-actions button,.ra-row-actions a,.ra-table button{border:1px solid var(--ra-line);border-radius:7px;padding:6px 8px;background:var(--ra-bg2);color:var(--ra-text);cursor:pointer;text-decoration:none;font-weight:700}.ra-btn-primary{border-color:var(--ra-accent)!important}.ra-btn-danger{border-color:var(--ra-danger)!important}.ra-inner{padding:var(--ra-pad)}#ra-status{font-weight:700;margin:0 0 9px;color:var(--ra-accent)}#ra-status.ra-bad{color:var(--ra-danger)}.ra-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ra-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.ra-field label{display:block;color:var(--ra-muted);font-size:10px;font-weight:900;text-transform:uppercase;margin-bottom:3px}.ra-field input,.ra-field select,.ra-field textarea{width:100%;box-sizing:border-box;padding:7px;border-radius:7px;border:1px solid var(--ra-line);background:var(--ra-bg2);color:var(--ra-text)}.ra-actions{display:flex;gap:6px;flex-wrap:wrap;margin:9px 0}.ra-actions .ra-btn{flex:1}.ra-section{border-top:1px solid var(--ra-line);padding-top:10px;margin-top:10px}.ra-section summary{cursor:pointer;font-weight:900}.ra-mode-only{display:none}.ra-progress{height:7px;background:var(--ra-line);border-radius:9px;overflow:hidden}.ra-progress>div{height:100%;width:0;background:var(--ra-accent)}#ra-progress-text{color:var(--ra-muted);font-size:10px;text-align:center}.ra-results-tools{padding:8px;border-bottom:1px solid var(--ra-line);display:flex;gap:7px;align-items:center;flex-wrap:wrap;background:var(--ra-bg2)}#ra-results-search{min-width:180px;padding:6px;border:1px solid var(--ra-line);background:var(--ra-bg);border-radius:7px}.ra-results-drawer{padding:9px;border-bottom:1px solid var(--ra-line);background:var(--ra-bg2)}.ra-filter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:7px}.ra-filter-grid label{font-size:10px;font-weight:700}.ra-filter-grid input,.ra-filter-grid select{width:100%;box-sizing:border-box;margin-top:3px;padding:6px;background:var(--ra-bg);border:1px solid var(--ra-line);border-radius:6px}.ra-column-grid{display:flex;gap:8px;flex-wrap:wrap}.ra-sort-head{width:100%;border:0!important;background:transparent!important;text-align:left;padding:4px!important;touch-action:manipulation}.ra-invalid{border-color:var(--ra-danger)!important}#ra-results-body,.ra-history-body{overflow:auto;flex:1}.ra-table{border-collapse:collapse;width:100%;min-width:900px;color:var(--ra-text)}.ra-table th,.ra-table td{padding:6px;border-bottom:1px solid var(--ra-line);white-space:nowrap;text-align:left}.ra-table th{position:sticky;top:0;background:var(--ra-bg2);z-index:2}.ra-table td small{display:block;color:var(--ra-muted)}.ra-table a,.ra-card a{color:var(--ra-text)}.ra-fit{color:#fbbf24}.ra-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:8px;padding:8px}.ra-card{border:1px solid var(--ra-line);border-radius:10px;padding:10px;background:var(--ra-bg2)}.ra-card-head{display:flex;justify-content:space-between;gap:8px}.ra-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:8px 0}.ra-kpis span{background:color-mix(in srgb,var(--ra-bg) 80%,transparent);padding:5px;border-radius:5px;color:var(--ra-muted)}.ra-kpis b{display:block;color:var(--ra-text)}.ra-row-actions{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.ra-row-actions small{margin-left:auto;color:var(--ra-muted)}.ra-empty{padding:18px;color:var(--ra-muted)}.ra-score-row{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:6px;align-items:end;margin:5px 0}.ra-score-row span{font-weight:900}.ra-note{color:var(--ra-muted);font-size:10px}.ra-complexity-toggle{display:flex;gap:3px}.ra-complexity-toggle button{padding:4px 7px;font-size:10px}.ra-active-toggle{outline:1px solid var(--ra-accent);box-shadow:0 0 8px color-mix(in srgb,var(--ra-accent) 55%,transparent)}.ra-advanced-only[hidden]{display:none!important}
#ra-sidebar-launcher{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;margin:0 2px;cursor:pointer;border-radius:5px;color:#39ff14}.ra-sidebar-launcher-svg{width:18px;height:18px;display:block}.ra-sidebar-launcher-svg path,.ra-sidebar-launcher-svg circle{stroke:currentColor}
@media(max-width:700px){#ra-panel{left:6px;top:45px;width:calc(100vw - 12px);height:70vh}.ra-grid,.ra-grid3{grid-template-columns:1fr}.ra-kpis{grid-template-columns:repeat(2,1fr)}#ra-results-panel{left:2vw;top:5vh;width:96vw;height:85vh}#ra-history{left:4vw;top:10vh;width:92vw;height:70vh}}
`;
        document.head.appendChild(s);
    }

    function clampGeometry(geometry, defaults = {}) {
        const margin = 4;
        const minW = defaults.minWidth || 320;
        const minH = defaults.minHeight || 220;
        const width = Math.max(minW, Math.min(n(geometry?.width, defaults.width || 560), Math.max(minW, innerWidth - margin * 2)));
        const height = Math.max(minH, Math.min(n(geometry?.height, defaults.height || 500), Math.max(minH, innerHeight - margin * 2)));
        const maxX = Math.max(margin, innerWidth - 48);
        const maxY = Math.max(margin, innerHeight - 48);
        const x = Math.max(margin, Math.min(n(geometry?.x, defaults.x ?? margin), maxX));
        const y = Math.max(margin, Math.min(n(geometry?.y, defaults.y ?? margin), maxY));
        return {x, y, width, height};
    }

    async function restoreWindowGeometry(id, element, defaults) {
        const meta = await getMeta();
        const saved = meta.ui?.windowGeometry?.[id];
        const g = clampGeometry(saved, defaults);
        element.style.left = `${g.x}px`;
        element.style.top = `${g.y}px`;
        element.style.width = `${g.width}px`;
        element.style.height = `${g.height}px`;
        element.style.right = "auto";
        return g;
    }

    async function persistWindowGeometry(id, element) {
        if (!element?.isConnected) return;
        const r = element.getBoundingClientRect();
        const defaults = managedWindows.get(id)?.defaults || {};
        const g = clampGeometry({x:r.left,y:r.top,width:r.width,height:r.height}, defaults);
        await saveWindowGeometry(id, g);
    }

    function bringManagedWindowToFront(id) {
        const item = managedWindows.get(id);
        if (!item) return;
        topZ += 1;
        item.element.style.zIndex = String(topZ);
    }

    function registerManagedWindow(id, element, handle, defaults = {}) {
        if (!element || !handle) return;
        managedWindows.set(id, {element, handle, defaults});
        restoreWindowGeometry(id, element, defaults).catch(console.warn);
        element.style.resize = "both";
        element.addEventListener("pointerdown", () => bringManagedWindowToFront(id));

        let dragging = false;
        let dx = 0;
        let dy = 0;
        handle.addEventListener("pointerdown", e => {
            if (e.target.closest("button,input,select,a,label")) return;
            dragging = true;
            bringManagedWindowToFront(id);
            const r = element.getBoundingClientRect();
            dx = e.clientX - r.left;
            dy = e.clientY - r.top;
            handle.setPointerCapture?.(e.pointerId);
            e.preventDefault();
        });
        handle.addEventListener("pointermove", e => {
            if (!dragging) return;
            const g = clampGeometry({x:e.clientX-dx,y:e.clientY-dy,width:element.offsetWidth,height:element.offsetHeight}, defaults);
            element.style.left = `${g.x}px`;
            element.style.top = `${g.y}px`;
            element.style.right = "auto";
        });
        handle.addEventListener("pointerup", e => {
            if (!dragging) return;
            dragging = false;
            try { handle.releasePointerCapture(e.pointerId); } catch {}
            persistWindowGeometry(id, element).catch(console.warn);
        });

        let resizeTimer = null;
        const ro = new ResizeObserver(() => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => persistWindowGeometry(id, element).catch(console.warn), 250);
        });
        ro.observe(element);
        managedWindows.get(id).resizeObserver = ro;
    }

    async function resetWindowLayout() {
        const meta=await getMeta(); meta.ui=meta.ui||{}; meta.ui.windowGeometry=meta.ui.windowGeometry||{};
        for(const id of ["main","results","history"]) delete meta.ui.windowGeometry[id];
        await idb.put("meta",meta);
        for(const [id,item] of managedWindows){const g=clampGeometry(item.defaults,item.defaults);Object.assign(item.element.style,{left:`${g.x}px`,top:`${g.y}px`,width:`${g.width}px`,height:`${g.height}px`});await persistWindowGeometry(id,item.element);}
        setStatus("Window layout reset.");
    }

    function recoverManagedWindows() {
        for (const [id, item] of managedWindows) {
            const r = item.element.getBoundingClientRect();
            const g = clampGeometry({x:r.left,y:r.top,width:r.width,height:r.height}, item.defaults);
            item.element.style.left = `${g.x}px`;
            item.element.style.top = `${g.y}px`;
            item.element.style.width = `${g.width}px`;
            item.element.style.height = `${g.height}px`;
            persistWindowGeometry(id, item.element).catch(console.warn);
        }
    }

    function scoreRowsHtml() {
        const labels={xanax:"Xanax / 30d",activityHours:"Activity hours / 30d",refills:"Refills / 30d",attacks:"Attacks / 30d",rwHits:"RW hits / 30d"};
        return Core.METRICS.map(k=>`<div class="ra-score-row"><span>${labels[k]}</span><div class="ra-field"><label>Target</label><input id="ra-target-${k}" type="number" min="0"></div><div class="ra-field"><label>Weight</label><input id="ra-weight-${k}" type="number" min="0"></div></div>`).join("");
    }

    function simpleScoutFiltersHtml() {
        return `<div class="ra-grid3"><div class="ra-field"><label>Faction</label><select id="ra-filter-faction"><option value="any">Any</option><option value="none">No faction</option><option value="has">Has faction</option></select></div><div class="ra-field"><label>Activity</label><select id="ra-filter-activity"><option value="any">Any</option><option value="online">Online</option><option value="active">Active ≤1d</option></select></div><div class="ra-field"><label>Min level</label><input id="ra-filter-minLevel" type="number"></div><div class="ra-field"><label>Min Fit</label><input id="ra-filter-minFit" type="number"></div></div>`;
    }

    function advancedScoutFiltersHtml() {
        return `<div class="ra-advanced-only"><div class="ra-grid3"><div class="ra-field"><label>Max level</label><input id="ra-filter-maxLevel" type="number"></div><div class="ra-field"><label>Max idle days</label><input id="ra-filter-maxIdleDays" type="number"></div><div class="ra-field"><label>Min net worth</label><input id="ra-filter-minNetworth" type="number"></div><div class="ra-field"><label>Min active streak</label><input id="ra-filter-minActiveStreak" type="number"></div><div class="ra-field"><label>Min best streak</label><input id="ra-filter-minBestStreak" type="number"></div><div class="ra-field"><label>Min stat enhancers</label><input id="ra-filter-minStatEnhancers" type="number"></div></div></div>`;
    }

    function mountUI() {
        if (uiMounted) return;
        uiMounted=true;
        injectStyles();

        const launch=document.createElement("button");
        launch.id="ra-launch";
        launch.textContent="RA";
        launch.title="Recruitment Agency fallback launcher";
        document.body.appendChild(launch);

        const panel=document.createElement("div");
        panel.id="ra-panel";
        panel.innerHTML=`<div class="ra-head" id="ra-drag"><b>Recruitment Agency <span class="ra-note">v${SCRIPT_VERSION}</span></b><div class="ra-head-actions"><div class="ra-complexity-toggle"><button id="ra-complexity-simple">Simple</button><button id="ra-complexity-advanced">Advanced</button></div><button id="ra-open-results">Results</button><button id="ra-close">×</button></div></div><div class="ra-inner"><div id="ra-status">Ready.</div><div class="ra-grid"><div class="ra-field"><label>Mode</label><select id="ra-mode"><option value="company">Company</option><option value="faction">Faction</option><option value="scout">Scout</option></select></div></div>
<div id="ra-forum-controls" class="ra-mode-only"><div class="ra-grid"><div class="ra-field"><label>Target thread ID / URL</label><input id="ra-target-thread" placeholder="Thread ID or URL"></div><div class="ra-field ra-advanced-only"><label>Scope</label><select id="ra-forum-scope"><option value="thread">Single thread</option><option value="category">Whole category</option></select></div><div class="ra-field ra-advanced-only"><label>Days back (0 = all)</label><input id="ra-forum-days" type="number" min="0"></div><div class="ra-field"><label>Name / ID filter</label><input id="ra-search"></div></div><div class="ra-grid3"><div class="ra-field"><label>MAN ≥</label><input id="ra-min-man" type="number"></div><div class="ra-field"><label>INT ≥</label><input id="ra-min-int" type="number"></div><div class="ra-field"><label>END ≥</label><input id="ra-min-end" type="number"></div></div><div class="ra-field"><label>TOTAL ≥</label><input id="ra-min-total" type="number"></div><div class="ra-actions"><button class="ra-btn ra-btn-primary" id="ra-full-scan">Full Scan</button><button class="ra-btn ra-btn-primary" id="ra-update-scan">Update Scan</button><button class="ra-btn" id="ra-open-thread">Open Thread</button></div></div>
<div id="ra-scout-controls" class="ra-mode-only"><div class="ra-field"><label>Player IDs / profile URLs</label><textarea id="ra-direct-ids" placeholder="3877028, profile URLs, etc."></textarea></div><div class="ra-actions"><button class="ra-btn ra-btn-primary" id="ra-scout-ids">Scout IDs</button><button class="ra-btn ra-btn-primary" id="ra-scout-page">Scout Search Users Page</button><button class="ra-btn ra-advanced-only" id="ra-reread-page">Read Page</button></div><div id="ra-page-count" class="ra-note"></div></div>
<div class="ra-progress"><div id="ra-progress-fill"></div></div><div id="ra-progress-text">Idle</div><div class="ra-actions"><button class="ra-btn ra-advanced-only" id="ra-pause-scout">Pause</button><button class="ra-btn ra-btn-danger ra-advanced-only" id="ra-cancel-scout" disabled>Cancel</button><button class="ra-btn" id="ra-scout-selected">Scout Selected</button><button class="ra-btn" id="ra-scout-all">Scout All</button></div>
<details class="ra-section"><summary>Scout filters</summary>${simpleScoutFiltersHtml()}${advancedScoutFiltersHtml()}<button class="ra-btn" id="ra-apply-filters">Apply filters</button></details>
<details class="ra-section"><summary>Fit Settings</summary>${scoreRowsHtml()}<div class="ra-actions"><button class="ra-btn ra-btn-primary" id="ra-save-scout-settings">Save Fit / Scout Settings</button></div></details>
<details class="ra-section ra-advanced-only"><summary>Advanced Settings</summary><div class="ra-grid3"><div class="ra-field"><label>API calls/min</label><input id="ra-rate" type="number" min="10" max="75" step="1"></div><div class="ra-field"><label>Workers</label><input id="ra-workers" type="number" min="1" max="8"></div><div class="ra-field"><label>Call budget</label><input id="ra-budget" type="number" min="1"></div><div class="ra-field"><label>History gap ms</label><input id="ra-history-gap" type="number" min="0"></div><div class="ra-field"><label>Max candidates</label><input id="ra-max-candidates" type="number" min="1"></div><div class="ra-field"><label>Auto Scout new</label><input id="ra-auto-scout" type="checkbox" style="width:auto"></div></div><div class="ra-actions"><button class="ra-btn" id="ra-cache-test">Run cache test</button><span id="ra-cache-verdict" class="ra-note"></span></div><div class="ra-actions"><button class="ra-btn" id="ra-change-key">Set / Change API Key</button><button class="ra-btn" id="ra-density">Density</button><button class="ra-btn" id="ra-view">Table / Cards</button><button class="ra-btn" id="ra-reset-window-layout">Reset Window Layout</button><label><input id="ra-include-inactive" type="checkbox"> Include inactive forum posts</label></div><div class="ra-section"><b>Global Intelligence</b><div class="ra-field"><label>Apps Script /exec endpoint</label><input id="ra-global-endpoint" type="url" placeholder="https://script.google.com/macros/s/.../exec"></div><div class="ra-actions"><label><input id="ra-global-enabled" type="checkbox" style="width:auto"> Enable global intelligence</label><button class="ra-btn" id="ra-global-test">Test Global Service</button><button class="ra-btn" id="ra-global-retry">Retry Global Sync</button></div><div id="ra-global-status" class="ra-note">Not configured</div><div class="ra-note">Only sanitized Torn player intelligence is shared. API keys, recruiter notes, contact history and private CRM data remain local.</div></div></details><div class="ra-actions"><button class="ra-btn" id="ra-theme">Theme</button></div></div>`;
        document.body.appendChild(panel);

        const results=document.createElement("div");
        results.id="ra-results-panel";
        results.innerHTML=`<div class="ra-head" id="ra-results-drag"><b>Recruitment Results</b><div class="ra-head-actions"><button id="ra-copy">Copy CSV</button><button id="ra-results-close">×</button></div></div><div class="ra-results-tools"><input id="ra-results-search" placeholder="Name / ID"><button class="ra-btn" id="ra-results-filters-toggle">Filters</button><button class="ra-btn" id="ra-results-columns-toggle">Columns</button><button class="ra-btn" id="ra-clear-filters" hidden>Clear Filters</button><span id="ra-results-meta"></span><button class="ra-btn" id="ra-results-refresh">Refresh</button><button class="ra-btn" id="ra-select-all">Select all</button><button class="ra-btn" id="ra-clear-select">Clear selection</button></div><div id="ra-results-filters" class="ra-results-drawer" hidden></div><div id="ra-results-columns" class="ra-results-drawer" hidden></div><div id="ra-results-body"></div>`;
        document.body.appendChild(results);

        const history=document.createElement("div");
        history.id="ra-history";
        history.innerHTML=`<div class="ra-head" id="ra-history-drag"><b>Scout History</b><div class="ra-head-actions"><button id="ra-history-close">×</button></div></div><div class="ra-history-body" id="ra-history-body"></div>`;
        document.body.appendChild(history);

        registerManagedWindow("main", panel, panel.querySelector("#ra-drag"), {x:Math.max(4,innerWidth-590),y:70,width:560,height:620,minWidth:360,minHeight:300});
        registerManagedWindow("results", results, results.querySelector("#ra-results-drag"), {x:Math.max(4,innerWidth*0.05),y:Math.max(4,innerHeight*0.08),width:Math.max(520,innerWidth*0.9),height:Math.max(320,innerHeight*0.78),minWidth:520,minHeight:320});
        registerManagedWindow("history", history, history.querySelector("#ra-history-drag"), {x:Math.max(4,innerWidth*0.18),y:Math.max(4,innerHeight*0.14),width:760,height:500,minWidth:420,minHeight:260});

        bindUI();
        applyTheme();
        populateSettingsUI();
        syncModeUI();
        ensureSidebarLauncher();
        syncFallbackLauncher();
    }

    function syncModeUI() {
        const modeEl = document.getElementById("ra-mode");
        if (modeEl) modeEl.value=mode;
        const forum=document.getElementById("ra-forum-controls");
        const scout=document.getElementById("ra-scout-controls");
        if(forum)forum.style.display=mode==="scout"?"none":"block";
        if(scout)scout.style.display=mode==="scout"?"block":"none";
        const resultSearch=document.getElementById("ra-results-search"); if(resultSearch)resultSearch.value=getModeResultsSettings().filters?.search || "";
        const thread=document.getElementById("ra-target-thread"); if(thread)thread.value=activeThreadId || "";
        const scope=document.getElementById("ra-forum-scope");if(scope)scope.value=settings.forumScope;
        const days=document.getElementById("ra-forum-days");if(days)days.value=settings.forumDays;
        const inc=document.getElementById("ra-include-inactive");if(inc)inc.checked=!!settings.includeInactive;
        refreshPageCount();
        applyComplexityMode();
    }

    function refreshPageCount() {
        const el=document.getElementById("ra-page-count");
        if(!el)return;
        const c=readSearchUsersPage();
        el.textContent=`${c.length} unique player(s) detected on this page.`;
    }

    async function switchMode(newMode) {
        mode=newMode;
        selectedIds.clear();
        const meta=await getMeta();
        activeThreadId=meta.syncHistory?.[mode]?.lastThreadId || (mode==="company"?DEFAULT_COMPANY_THREAD_ID:mode==="faction"?DEFAULT_FACTION_THREAD_ID:"");
        await saveMetaSettings({activeMode:mode});
        syncModeUI();
        await refreshResults();
        setStatus(`${modeLabel(mode)} mode loaded.`);
    }

    function openMainWindow() {
        const panel = document.getElementById("ra-panel");
        if (!panel) return;
        panel.style.display = "block";
        bringManagedWindowToFront("main");
    }

    function findInformationSection() {
        const nodes = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,div,span")].filter(el => /^information$/i.test(String(el.textContent || "").trim()));
        for (const label of nodes) {
            let section = label.parentElement;
            for (let depth = 0; section && depth < 5; depth++, section = section.parentElement) {
                const links = section.querySelectorAll("a,button,[role='button']");
                if (links.length >= 2 && links.length <= 30) return section;
            }
        }
        return null;
    }

    function ensureSidebarLauncher() {
        if (document.getElementById("ra-sidebar-launcher")) return true;
        const section = findInformationSection();
        if (!section) return false;
        const candidates = [...section.querySelectorAll("div,nav,ul")].filter(el => {
            const count = el.querySelectorAll(":scope > a,:scope > button,:scope > [role='button']").length;
            return count >= 2 && count <= 15;
        });
        const row = candidates.sort((a,b) => b.querySelectorAll("a,button,[role='button']").length - a.querySelectorAll("a,button,[role='button']").length)[0] || section;
        const launcher = document.createElement("button");
        launcher.id = "ra-sidebar-launcher";
        launcher.type = "button";
        launcher.title = "Recruitment Agency";
        launcher.setAttribute("aria-label", "Recruitment Agency");
        launcher.style.cssText = "border:0;background:transparent;padding:0;vertical-align:middle;";
        launcher.innerHTML = `<svg class="ra-sidebar-launcher-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="3" stroke-width="2"/><circle cx="16" cy="8" r="3" stroke-width="2"/><path d="M3 19c.6-3.2 2.4-5 5-5s4.4 1.8 5 5M11 19c.5-2.7 2.2-4.5 5-4.5 2.5 0 4.2 1.6 5 4.5" stroke-width="2" stroke-linecap="round"/></svg>`;
        launcher.addEventListener("click", openMainWindow);
        row.appendChild(launcher);
        return true;
    }

    const SIDEBAR_RETRY = {attempts:12,delayMs:250,debounceMs:600};
    let sidebarRecoveryTimer=null;
    function scheduleSidebarRecovery(reason="mutation") {
        clearTimeout(sidebarRecoveryTimer);
        sidebarRecoveryTimer=setTimeout(()=>{ensureSidebarLauncher();syncFallbackLauncher();},SIDEBAR_RETRY.debounceMs);
    }
    function startSidebarRetryBurst() {
        let left=SIDEBAR_RETRY.attempts; const tick=()=>{if(ensureSidebarLauncher()||--left<=0){syncFallbackLauncher();return;}setTimeout(tick,SIDEBAR_RETRY.delayMs);};tick();
    }

    function syncFallbackLauncher() {
        const fallback = document.getElementById("ra-launch");
        if (!fallback) return;
        fallback.style.display = document.getElementById("ra-sidebar-launcher") ? "none" : "block";
    }

    function bindUI() {
        document.getElementById("ra-launch").onclick=openMainWindow;
        document.getElementById("ra-close").onclick=()=>document.getElementById("ra-panel").style.display="none";
        document.getElementById("ra-open-results").onclick=async()=>{const r=document.getElementById("ra-results-panel");r.style.display="flex";bringManagedWindowToFront("results");await refreshResults();};
        document.getElementById("ra-results-close").onclick=()=>document.getElementById("ra-results-panel").style.display="none";
        document.getElementById("ra-history-close").onclick=()=>document.getElementById("ra-history").style.display="none";
        document.getElementById("ra-complexity-simple").onclick=async()=>{await saveMetaSettings({complexity:"simple"});applyComplexityMode();};
        document.getElementById("ra-complexity-advanced").onclick=async()=>{await saveMetaSettings({complexity:"advanced"});applyComplexityMode();};
        document.getElementById("ra-mode").onchange=e=>switchMode(e.target.value);
        document.getElementById("ra-full-scan").onclick=()=>runForumScan(true);
        document.getElementById("ra-update-scan").onclick=()=>runForumScan(false);
        document.getElementById("ra-open-thread").onclick=()=>{const id=parseThreadId(document.getElementById("ra-target-thread").value);if(id)window.open(forumUrl(id),"_blank");};
        document.getElementById("ra-scout-ids").onclick=()=>{const ids=Core.parseIds(document.getElementById("ra-direct-ids").value,settings.scout.maxCandidates);runScoutQueue(ids,{source:"direct"}).catch(e=>setStatus(e.message,true));};
        document.getElementById("ra-scout-page").onclick=()=>{const ids=readSearchUsersPage().map(x=>x.id);runScoutQueue(ids,{source:"search-users"}).catch(e=>setStatus(e.message,true));};
        document.getElementById("ra-reread-page").onclick=refreshPageCount;
        document.getElementById("ra-pause-scout").onclick=()=>scoutRuntime.paused?resumeScout():pauseScout();
        document.getElementById("ra-cancel-scout").onclick=cancelScout;
        document.getElementById("ra-scout-selected").onclick=()=>runScoutQueue([...selectedIds],{force:true,source:mode}).catch(e=>setStatus(e.message,true));
        document.getElementById("ra-scout-all").onclick=()=>runScoutQueue(getProcessedResultRows().map(x=>x.userId),{source:mode}).catch(e=>setStatus(e.message,true));
        document.getElementById("ra-save-scout-settings").onclick=()=>saveScoutSettingsFromUI().catch(e=>setStatus(e.message,true));
        document.getElementById("ra-apply-filters").onclick=()=>saveScoutSettingsFromUI().catch(e=>setStatus(e.message,true));
        document.getElementById("ra-cache-test").onclick=()=>runCacheDiagnostic(0).catch(e=>setStatus(e.message,true));
        document.getElementById("ra-change-key").onclick=()=>ensureApiKey(true).then(()=>setStatus("API key saved.")).catch(e=>setStatus(e.message,true));
        document.getElementById("ra-theme").onclick=async()=>{await saveMetaSettings({theme:settings.theme==="dark"?"light":"dark"});applyTheme();};
        document.getElementById("ra-density").onclick=async()=>{await saveMetaSettings({density:settings.density==="compact"?"comfortable":"compact"});applyTheme();};
        document.getElementById("ra-view").onclick=async()=>{await saveMetaSettings({view:settings.view==="table"?"cards":"table"});renderResults();};
        document.getElementById("ra-include-inactive").onchange=async e=>{await saveMetaSettings({includeInactive:e.target.checked});await refreshResults();};
        document.getElementById("ra-reset-window-layout")?.addEventListener("click",()=>resetWindowLayout().catch(e=>setStatus(e.message,true)));
        document.getElementById("ra-global-endpoint")?.addEventListener("change",async e=>{const global={...settings.global,endpoint:normalizeGlobalEndpoint(e.target.value)};globalRuntime.serviceCompatible=null;await saveMetaSettings({global});populateSettingsUI();});
        document.getElementById("ra-global-enabled")?.addEventListener("change",async e=>{const global={...settings.global,enabled:!!e.target.checked};await saveMetaSettings({global});await renderGlobalStatus();if(global.enabled)void flushGlobalSyncQueue({manual:false});});
        document.getElementById("ra-global-test")?.addEventListener("click",()=>testGlobalService().then(()=>setStatus("Global service connected.")).catch(e=>setStatus(e.message,true)));
        document.getElementById("ra-global-retry")?.addEventListener("click",()=>flushGlobalSyncQueue({manual:true}).then(r=>setStatus(`Global sync processed ${r.processed}; ${r.pending} pending.`)).catch(e=>setStatus(e.message,true)));
        document.getElementById("ra-results-refresh").onclick=refreshResults;
        let resultsSearchSaveTimer=null;
        document.getElementById("ra-results-search").oninput=e=>{renderResults();clearTimeout(resultsSearchSaveTimer);resultsSearchSaveTimer=setTimeout(async()=>{const next={...getModeResultsSettings().filters};const value=String(e.target.value||"").trim();if(value)next.search=value;else delete next.search;await saveResultsModeState({filters:next});},250);};
        document.getElementById("ra-results-filters-toggle").onclick=()=>{const box=document.getElementById("ra-results-filters");box.hidden=!box.hidden;};
        document.getElementById("ra-results-columns-toggle").onclick=()=>{const box=document.getElementById("ra-results-columns");box.hidden=!box.hidden;};
        document.getElementById("ra-clear-filters").onclick=async()=>{await saveResultsModeState({filters:{}});document.getElementById("ra-results-search").value="";renderResults();};
        document.getElementById("ra-copy").onclick=()=>copyCsv().catch(e=>setStatus(e.message,true));
        document.getElementById("ra-select-all").onclick=()=>{getProcessedResultRows().forEach(r=>selectedIds.add(Number(r.userId)));renderResults();};
        document.getElementById("ra-clear-select").onclick=()=>{selectedIds.clear();renderResults();};
        ["ra-search","ra-min-man","ra-min-int","ra-min-end","ra-min-total"].forEach(id=>document.getElementById(id)?.addEventListener("input",()=>refreshResults()));
        window.addEventListener("resize", () => {
            clearTimeout(window.__raResizeTimer);
            window.__raResizeTimer = setTimeout(recoverManagedWindows, 150);
        });
    }

    async function init() {
        try {
            db=await openDB();
            const meta=await getMeta();
            settings=mergeSettings(meta.settings || {});
            mode=settings.activeMode || "company";
            activeThreadId=meta.syncHistory?.[mode]?.lastThreadId || (mode==="company"?DEFAULT_COMPANY_THREAD_ID:mode==="faction"?DEFAULT_FACTION_THREAD_ID:"");
            meta.settings=settings;
            meta.ui = meta.ui || {};
            meta.ui.windowGeometry = meta.ui.windowGeometry || {};
            await idb.put("meta",meta);
            if (document.readyState === "loading") await new Promise(resolve=>document.addEventListener("DOMContentLoaded",resolve,{once:true}));
            mountUI();
            await refreshResults();
            await renderGlobalStatus();
            void flushGlobalSyncQueue({manual:false});
            setStatus("Ready.");
            const observer=new MutationObserver(()=>{
                clearTimeout(observerTimer); observerTimer=setTimeout(()=>{
                    if(!document.getElementById("ra-panel")){uiMounted=false;mountUI();refreshResults();}
                    scheduleSidebarRecovery("mutation");
                },120);
            });
            observer.observe(document.documentElement,{childList:true,subtree:true});
            window.addEventListener("hashchange",()=>scheduleSidebarRecovery("hash"),{passive:true});
            window.addEventListener("popstate",()=>scheduleSidebarRecovery("popstate"),{passive:true});
            startSidebarRetryBurst();
        } catch(e){
            console.error("[RA] init failed",e);
            alert(`Recruitment Agency could not start: ${e.message}`);
        }
    }

    init();
})();