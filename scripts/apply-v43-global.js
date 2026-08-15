const fs = require('node:fs');

const file = 'R4G3RUNN3R-Recruitment-Agency.user.js';
let s = fs.readFileSync(file, 'utf8');

function mustReplace(oldText, newText, label) {
  if (!s.includes(oldText)) throw new Error(`Missing replacement target: ${label}`);
  s = s.replace(oldText, newText);
}

function insertBefore(marker, text, label) {
  const i = s.indexOf(marker);
  if (i < 0) throw new Error(`Missing insertion marker: ${label}`);
  s = s.slice(0, i) + text + s.slice(i);
}

mustReplace('// @version      4.2.0', '// @version      4.3.0', 'metadata version');
mustReplace(
  '// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/results-core.js\n',
  '// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/results-core.js\n// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/global-core.js\n',
  'global core require'
);
mustReplace(
`    const Core = window.RA_ScoutCore;
    const ResultsCore = window.RA_ResultsCore;
    if (!Core || !ResultsCore) {
        console.error("[RA] Required core module did not load.");
        return;
    }

    const SCRIPT_VERSION = "4.2.0";
    const DB_NAME = "tornWorkerDB";
    const REQUIRED_DB_VERSION = 9;`,
`    const Core = window.RA_ScoutCore;
    const ResultsCore = window.RA_ResultsCore;
    const GlobalCore = window.RA_GlobalCore;
    if (!Core || !ResultsCore || !GlobalCore) {
        console.error("[RA] Required core module did not load.");
        return;
    }

    const SCRIPT_VERSION = "4.3.0";
    const DB_NAME = "tornWorkerDB";
    const REQUIRED_DB_VERSION = 10;`,
  'core bootstrap and DB version'
);

mustReplace(
`        resultsPanels: {filtersOpen:false,columnsOpen:false},
        scout: DEFAULT_SCOUT
    };`,
`        resultsPanels: {filtersOpen:false,columnsOpen:false},
        global: {
            enabled: true,
            endpoint: "",
            lookupCacheMs: 30 * 60 * 1000,
            maxRetryAttempts: 5
        },
        scout: DEFAULT_SCOUT
    };`,
  'global defaults'
);

mustReplace(
`    const scoutRuntime = {
        running: false,
        paused: false,
        cancelled: false,
        calls: 0,
        done: 0,
        total: 0,
        ids: []
    };`,
`    const scoutRuntime = {
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
    };`,
  'global runtime'
);

mustReplace(
`        const scout = raw.scout || {};
        const scoring = Core.normalizeScoring({`,
`        const scout = raw.scout || {};
        const global = raw.global || {};
        const scoring = Core.normalizeScoring({`,
  'merge global local'
);
mustReplace(
`            resultsPanels: {...DEFAULT_SETTINGS.resultsPanels,...(raw.resultsPanels || {})},
            scout: {`,
`            resultsPanels: {...DEFAULT_SETTINGS.resultsPanels,...(raw.resultsPanels || {})},
            global: {...DEFAULT_SETTINGS.global, ...global},
            scout: {`,
  'merge global settings'
);

mustReplace(
`                if (!d.objectStoreNames.contains("scoutHistory")) {
                    const h = d.createObjectStore("scoutHistory", {keyPath: "snapshotId"});
                    h.createIndex("userId", "userId", {unique: false});
                    h.createIndex("capturedAt", "capturedAt", {unique: false});
                }
            };`,
`                if (!d.objectStoreNames.contains("scoutHistory")) {
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
            };`,
  'global IDB stores'
);

mustReplace(
`    async function persistScout(snapshot) {
        await idb.put("scoutLatest", snapshot);
        await idb.put("scoutHistory", snapshot);
    }
`,
`    async function persistScout(snapshot) {
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
        return String(value || "").trim().replace(/\\/+$/, "");
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
            name: context.name || profile.name || `User ${userId}`,
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
        const response = await fetch(url, {redirect:"follow", cache:"no-store", ...options});
        if (!response.ok) throw new Error(`Global service HTTP ${response.status}`);
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
            await idb.put("globalHistory", {snapshotId:`${userId}:${observedAt}`, userId, observedAt, observation});
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
            const raw = await globalJson(`${endpoint}${join}action=player&id=${encodeURIComponent(id)}`);
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
        const raw = await globalJson(`${endpoint}${join}action=meta`);
        const normalized = GlobalCore.normalizeServiceResponse(raw);
        if (!normalized.ok) throw new Error(`Global service error: ${normalized.code || "unknown"}`);
        if (Number(normalized.schemaVersion) !== Number(GlobalCore.GLOBAL_SCHEMA_VERSION)) {
            globalRuntime.serviceCompatible = false;
            await renderGlobalStatus(`Schema mismatch: service ${normalized.schemaVersion}, client ${GlobalCore.GLOBAL_SCHEMA_VERSION}`, true);
            throw new Error("Global service schema is incompatible.");
        }
        globalRuntime.serviceCompatible = true;
        await renderGlobalStatus(`Connected · service ${normalized.serviceVersion || "unknown"}`);
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
            else text = `Enabled · ${pending} queued`;
        } else if (pending) text += ` · ${pending} queued`;
        el.textContent = text;
        el.classList.toggle("ra-bad", bad);
    }
`,
  'persistScout and global client helpers'
);

const oldShowStart = s.indexOf('    async function showHistory(userId) {');
const oldShowEnd = s.indexOf('    async function copyCsv()', oldShowStart);
if (oldShowStart < 0 || oldShowEnd < 0) throw new Error('Missing showHistory block');
const newShow = `    async function showHistory(userId) {
        const rows = (await idb.getAll("scoutHistory")).filter(x => Number(x.userId) === Number(userId)).sort((a,b)=>b.capturedAt-a.capturedAt);
        const box = document.getElementById("ra-history");
        const body = document.getElementById("ra-history-body");
        if (!box || !body) return;
        const localHtml = rows.length ? \`<table class="ra-table"><thead><tr><th>Date</th><th>Original Fit</th><th>Current Fit</th><th>Type</th><th>Trend</th><th>Window</th></tr></thead><tbody>\${rows.map(s=>\`<tr><td>\${new Date(s.capturedAt).toLocaleString()}</td><td>\${s.originalFit??"—"}</td><td>\${snapshotFit(s)??"—"}</td><td>\${esc(s.originalFitType)}</td><td>\${trendText(s.trend)}</td><td>\${s.official?"30d":\`\${s.provisionalDays||"?"}d provisional\`}</td></tr>\`).join("")}</tbody></table>\` : '<div class="ra-empty">No local Scout history for this player.</div>';
        body.innerHTML = \`<div class="ra-section"><b>LOCAL Scout History</b>\${localHtml}</div><div id="ra-global-history-section" class="ra-section"><b>GLOBAL History</b><div class="ra-note">Loading shared history...</div></div>\`;
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
            const a=Number(current), b=Number(prior); if(!Number.isFinite(a)||!Number.isFinite(b))return "—"; const d=a-b; return \`\${d>=0?"+":""}\${d.toFixed(1)}\${suffix}\`;
        };
        globalBox.innerHTML = \`<b>GLOBAL History</b><div class="ra-kpis"><span>First seen<b>\${shared.firstSeen?new Date(shared.firstSeen).toLocaleString():"—"}</b></span><span>Last seen<b>\${shared.lastSeen?new Date(shared.lastSeen).toLocaleString():"—"}</b></span><span>Observations<b>\${fmt(shared.observationCount)}</b></span><span>Provenance<b>GLOBAL / HISTORICAL</b></span><span>Shared Fit<b>\${latest.fit??"—"}</b></span><span>Δ Fit<b>\${delta(latest.fit,previous?.fit)}</b></span><span>Activity 30d<b>\${fmt(latest.activity30,1)}</b></span><span>Δ Activity<b>\${delta(latest.activity30,previous?.activity30,"h")}</b></span></div><div class="ra-note">Precedence: LIVE &gt; LOCAL &gt; GLOBAL &gt; HISTORICAL &gt; forum parsed. Shared values never overwrite fresher local Scout data.</div>\`;
    }

`;
s = s.slice(0, oldShowStart) + newShow + s.slice(oldShowEnd);

mustReplace(
`        const cv=document.getElementById("ra-cache-verdict");if(cv)cv.textContent=\`Cache test: \${settings.scout.cacheVerdict}\`;
        applyComplexityMode();`,
`        const cv=document.getElementById("ra-cache-verdict");if(cv)cv.textContent=\`Cache test: \${settings.scout.cacheVerdict}\`;
        const ge=document.getElementById("ra-global-endpoint");if(ge)ge.value=settings.global?.endpoint||"";
        const gx=document.getElementById("ra-global-enabled");if(gx)gx.checked=!!settings.global?.enabled;
        renderGlobalStatus().catch(()=>{});
        applyComplexityMode();`,
  'populate global settings'
);

const advancedNeedle = `<div class="ra-actions"><button class="ra-btn" id="ra-change-key">Set / Change API Key</button><button class="ra-btn" id="ra-density">Density</button><button class="ra-btn" id="ra-view">Table / Cards</button><button class="ra-btn" id="ra-reset-window-layout">Reset Window Layout</button><label><input id="ra-include-inactive" type="checkbox"> Include inactive forum posts</label></div></details>`;
const advancedReplacement = `<div class="ra-actions"><button class="ra-btn" id="ra-change-key">Set / Change API Key</button><button class="ra-btn" id="ra-density">Density</button><button class="ra-btn" id="ra-view">Table / Cards</button><button class="ra-btn" id="ra-reset-window-layout">Reset Window Layout</button><label><input id="ra-include-inactive" type="checkbox"> Include inactive forum posts</label></div><div class="ra-section"><b>Global Intelligence</b><div class="ra-field"><label>Apps Script /exec endpoint</label><input id="ra-global-endpoint" type="url" placeholder="https://script.google.com/macros/s/.../exec"></div><div class="ra-actions"><label><input id="ra-global-enabled" type="checkbox" style="width:auto"> Enable global intelligence</label><button class="ra-btn" id="ra-global-test">Test Global Service</button><button class="ra-btn" id="ra-global-retry">Retry Global Sync</button></div><div id="ra-global-status" class="ra-note">Not configured</div><div class="ra-note">Only sanitized Torn player intelligence is shared. API keys, recruiter notes, contact history and private CRM data remain local.</div></div></details>`;
mustReplace(advancedNeedle, advancedReplacement, 'Advanced Global Intelligence UI');

mustReplace(
`        document.getElementById("ra-reset-window-layout")?.addEventListener("click",()=>resetWindowLayout().catch(e=>setStatus(e.message,true)));
        document.getElementById("ra-results-refresh").onclick=refreshResults;`,
`        document.getElementById("ra-reset-window-layout")?.addEventListener("click",()=>resetWindowLayout().catch(e=>setStatus(e.message,true)));
        document.getElementById("ra-global-endpoint")?.addEventListener("change",async e=>{const global={...settings.global,endpoint:normalizeGlobalEndpoint(e.target.value)};globalRuntime.serviceCompatible=null;await saveMetaSettings({global});populateSettingsUI();});
        document.getElementById("ra-global-enabled")?.addEventListener("change",async e=>{const global={...settings.global,enabled:!!e.target.checked};await saveMetaSettings({global});await renderGlobalStatus();if(global.enabled)void flushGlobalSyncQueue({manual:false});});
        document.getElementById("ra-global-test")?.addEventListener("click",()=>testGlobalService().then(()=>setStatus("Global service connected.")).catch(e=>setStatus(e.message,true)));
        document.getElementById("ra-global-retry")?.addEventListener("click",()=>flushGlobalSyncQueue({manual:true}).then(r=>setStatus(\`Global sync processed \${r.processed}; \${r.pending} pending.\`)).catch(e=>setStatus(e.message,true)));
        document.getElementById("ra-results-refresh").onclick=refreshResults;`,
  'global event bindings'
);

mustReplace(
`            mountUI();
            await refreshResults();
            setStatus("Ready.");`,
`            mountUI();
            await refreshResults();
            await renderGlobalStatus();
            void flushGlobalSyncQueue({manual:false});
            setStatus("Ready.");`,
  'init global queue'
);

fs.writeFileSync(file, s);
console.log('Applied v4.3 Global Intelligence userscript migration.');
