'use strict';

const fs = require('node:fs');

const userPath = 'R4G3RUNN3R-Recruitment-Agency.user.js';
let s = fs.readFileSync(userPath, 'utf8');

function replaceOnce(label, before, after) {
  const first = s.indexOf(before);
  if (first < 0) throw new Error(`Could not find ${label}`);
  if (s.indexOf(before, first + before.length) >= 0) throw new Error(`Found ${label} more than once`);
  s = s.slice(0, first) + after + s.slice(first + before.length);
}

function replaceRegexOnce(label, regex, replacement) {
  const matches = [...s.matchAll(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g'))];
  if (matches.length !== 1) throw new Error(`Expected one ${label}, found ${matches.length}`);
  s = s.replace(regex, replacement);
}

replaceOnce(
  'Settings CSS hook',
  '.ra-advanced-only[hidden]{display:none!important}',
  `.ra-advanced-only[hidden]{display:none!important}.ra-settings-panel{border-top:1px solid var(--ra-line);margin-top:10px;padding-top:6px}.ra-settings-section{border:1px solid var(--ra-line);border-radius:8px;padding:7px 9px;margin:7px 0;background:color-mix(in srgb,var(--ra-bg2) 86%,transparent)}.ra-settings-section>summary{font-weight:900;cursor:pointer}.ra-settings-section[open]>summary{margin-bottom:8px}.ra-help-button{display:inline-grid;place-items:center;width:20px;height:20px;padding:0!important;margin-left:6px;border-radius:50%!important;font-size:11px;vertical-align:middle}.ra-help-popover{position:fixed;z-index:2147483647;max-width:min(340px,calc(100vw - 16px));padding:10px;border:1px solid var(--ra-accent);border-radius:8px;background:var(--ra-bg2);box-shadow:0 10px 30px rgba(0,0,0,.45);white-space:normal}.ra-help-popover b{display:block;margin-bottom:5px}.ra-help-popover p{margin:4px 0}.ra-match-profile-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.ra-match-profile-toolbar select{flex:1;min-width:160px}.ra-match-criteria{display:grid;gap:5px}.ra-match-criterion{display:grid;grid-template-columns:minmax(105px,1.2fr) 72px minmax(90px,1fr) 70px;gap:5px;align-items:center}.ra-match-criterion input,.ra-match-criterion select{min-width:0}.ra-match-criterion .ra-match-enable{width:auto}.ra-match-criterion-head{font-size:10px;color:var(--ra-muted);font-weight:900}.ra-settings-copy{font-size:10px;color:var(--ra-muted);margin:5px 0}`
);

replaceOnce(
  'main header controls',
  '<div class="ra-head" id="ra-drag"><b>Recruitment Agency <span class="ra-note">v${SCRIPT_VERSION}</span></b><div class="ra-head-actions"><div class="ra-complexity-toggle"><button id="ra-complexity-simple">Simple</button><button id="ra-complexity-advanced">Advanced</button></div><button id="ra-open-results">Results</button><button id="ra-close">×</button></div></div>',
  '<div class="ra-head" id="ra-drag"><b>Recruitment Agency <span class="ra-note">v${SCRIPT_VERSION}</span></b><div class="ra-head-actions"><button id="ra-settings-toggle">Settings</button><button id="ra-open-results">Results</button><button id="ra-close">×</button></div></div>'
);

replaceRegexOnce(
  'legacy Advanced Settings block',
  /<details class="ra-section ra-advanced-only"><summary>Advanced Settings<\/summary>[\s\S]*?<div class="ra-actions"><button class="ra-btn" id="ra-theme">Theme<\/button><\/div>/,
  `<section id="ra-settings-panel" class="ra-settings-panel" hidden data-help-key="settings">
<details class="ra-settings-section" data-settings-section="general" data-help-key="settings-general"><summary>General</summary><div class="ra-settings-copy">Interface, display and local launcher preferences.</div><div class="ra-actions"><div class="ra-complexity-toggle"><button id="ra-complexity-simple">Simple</button><button id="ra-complexity-advanced">Advanced</button></div><button class="ra-btn" id="ra-theme">Theme</button><button class="ra-btn" id="ra-density">Density</button><label><input id="ra-include-inactive" type="checkbox"> Include inactive forum posts</label></div></details>
<details class="ra-settings-section" data-settings-section="recruitment" data-help-key="settings-recruitment"><summary>Recruitment</summary><div class="ra-settings-copy">Company and faction source defaults. Current thread IDs remain in their normal recruitment controls so they are visible while scanning.</div><div class="ra-note">Company thread: ${DEFAULT_COMPANY_THREAD_ID} · Faction thread: ${DEFAULT_FACTION_THREAD_ID}</div></details>
<details class="ra-settings-section" data-settings-section="scout" data-help-key="settings-scout"><summary>Scout</summary><div class="ra-grid3"><div class="ra-field"><label>API calls/min</label><input id="ra-rate" type="number" min="10" max="75" step="1"></div><div class="ra-field"><label>Workers</label><input id="ra-workers" type="number" min="1" max="8"></div><div class="ra-field"><label>Call budget</label><input id="ra-budget" type="number" min="1"></div><div class="ra-field"><label>History gap ms</label><input id="ra-history-gap" type="number" min="0"></div><div class="ra-field"><label>Max candidates</label><input id="ra-max-candidates" type="number" min="1"></div><div class="ra-field"><label>Auto Scout new</label><input id="ra-auto-scout" type="checkbox" style="width:auto"></div></div><div class="ra-actions"><button class="ra-btn" id="ra-cache-test">Run cache test</button><span id="ra-cache-verdict" class="ra-note"></span><button class="ra-btn" id="ra-change-key">Set / Change API Key</button></div></details>
<details class="ra-settings-section" data-settings-section="results" data-help-key="settings-results"><summary>Results</summary><div class="ra-actions"><button class="ra-btn" id="ra-view">Table / Cards</button><button class="ra-btn" id="ra-reset-window-layout">Reset Window Layout</button></div></details>
<details class="ra-settings-section" data-settings-section="smart-match" data-help-key="match-profiles" open><summary>Smart Match</summary><div class="ra-match-profile-toolbar"><select id="ra-match-profile-select"></select><button class="ra-btn" id="ra-match-profile-new">New Match Profile</button><button class="ra-btn" id="ra-match-profile-duplicate">Duplicate</button><button class="ra-btn ra-btn-danger" id="ra-match-profile-delete">Delete</button></div><div id="ra-match-profile-editor"></div><div class="ra-actions"><button class="ra-btn ra-btn-primary" id="ra-match-profile-save">Save Match Profile</button></div><div class="ra-note">Match Profiles, candidate preferences, notes, salary and availability are local-only.</div></details>
<details class="ra-settings-section" data-settings-section="global" data-help-key="settings-global"><summary>Global Intelligence</summary><div class="ra-field"><label>Apps Script /exec endpoint</label><input id="ra-global-endpoint" type="url" placeholder="https://script.google.com/macros/s/.../exec"></div><div class="ra-actions"><label><input id="ra-global-enabled" type="checkbox" style="width:auto"> Enable global intelligence</label><button class="ra-btn" id="ra-global-test">Test Global Service</button><button class="ra-btn" id="ra-global-retry">Retry Global Sync</button></div><div id="ra-global-status" class="ra-note">Not configured</div><div class="ra-note">Only sanitized Torn player intelligence is shared. API keys, recruiter notes, contact history and private CRM data remain local.</div></details>
<details class="ra-settings-section" data-settings-section="data" data-help-key="settings-data"><summary>Data & Reset</summary><div class="ra-actions"><button class="ra-btn" id="ra-settings-clear-scout-cache">Clear Scout Cache</button><button class="ra-btn" id="ra-settings-clear-candidates">Clear Local Candidate Data</button></div><div class="ra-note">These actions affect browser-local data only.</div></details>
<details class="ra-settings-section" data-settings-section="danger" data-help-key="settings-danger"><summary>Danger Zone</summary><div class="ra-note">Destructive resets require an explicit confirmation. No automatic reset is performed here.</div></details>
</section>`
);

const helpers = `
    const HELP_REGISTRY = Object.freeze({
        company:{title:"Company recruitment",body:"Scans the configured company recruitment source for candidates. Torn API: forum requests are consumed only when you start a scan. Storage: candidate scan results are stored locally."},
        faction:{title:"Faction recruitment",body:"Scans faction recruitment sources using the current forum controls. Torn API: forum requests are consumed only when scanning. Storage: results remain local."},
        scout:{title:"Scout",body:"Collects current player intelligence through the official Torn API. Torn API: yes, through the shared scheduler capped at 75 calls/minute with at least 800 ms between calls."},
        fit:{title:"Fit Settings",body:"Controls the general Fit calculation. Torn API: none when editing or recalculating. Storage: settings are stored locally."},
        filters:{title:"Results filters",body:"Filters already-loaded candidate rows. Torn API: none. Storage: filter preferences are stored locally."},
        columns:{title:"Results columns",body:"Chooses which result columns are visible. Torn API: none. Storage: display preferences are stored locally."},
        settings:{title:"Settings",body:"Groups Recruitment Agency configuration without opening another managed window. Torn API: none merely by opening Settings."},
        "settings-general":{title:"General",body:"Controls theme, density, Simple/Advanced mode and local display behavior. Torn API: none. Storage: stored locally."},
        "settings-recruitment":{title:"Recruitment",body:"Explains recruitment source defaults and scan behavior. Torn API: none until a scan is explicitly started. Storage: recruitment preferences are stored locally."},
        "settings-scout":{title:"Scout",body:"Controls scheduler rate, workers, budget, cache and API-key actions. Torn API: changing settings consumes none; Scout actions do."},
        "settings-results":{title:"Results",body:"Controls result view and layout. Torn API: none. Storage: stored locally."},
        "match-profiles":{title:"Smart Match",body:"Scores candidate suitability against a local vacancy profile. Torn API: none. Storage: Match Profiles and recruiter candidate fields are local-only and never enter Global Intelligence."},
        "settings-global":{title:"Global Intelligence",body:"Shares only the approved sanitized public-player observation fields with the configured Apps Script endpoint. Torn API: none for local UI changes. Privacy: recruiter notes, Match data and CRM fields remain local."},
        "settings-data":{title:"Data & Reset",body:"Clears selected local caches or candidate CRM records after confirmation. Torn API: none. Storage: browser-local IndexedDB."},
        "settings-danger":{title:"Danger Zone",body:"Reserved for destructive local reset operations. Torn API: none. Nothing is deleted without explicit confirmation."}
    });

    let helpPinned = false;
    let helpAnchor = null;
    let helpCloseTimer = null;

    function closeContextHelp(force = false) {
        if (helpPinned && !force) return;
        const pop = document.getElementById("ra-help-popover");
        if (pop) pop.hidden = true;
        helpPinned = false;
        helpAnchor = null;
        if (helpCloseTimer) clearTimeout(helpCloseTimer);
        helpCloseTimer = null;
    }

    function positionContextHelp(anchor) {
        const pop = document.getElementById("ra-help-popover");
        if (!pop || !anchor || pop.hidden) return;
        const rect = anchor.getBoundingClientRect();
        const margin = 8;
        const width = Math.min(340, Math.max(220, pop.offsetWidth || 280));
        const height = Math.max(80, pop.offsetHeight || 120);
        let left = rect.left;
        let top = rect.bottom + 6;
        if (left + width > innerWidth - margin) left = innerWidth - width - margin;
        if (top + height > innerHeight - margin) top = Math.max(margin, rect.top - height - 6);
        pop.style.left = Math.max(margin, left) + "px";
        pop.style.top = Math.max(margin, top) + "px";
    }

    function openContextHelp(key, anchor, pinned = false) {
        const entry = HELP_REGISTRY[key];
        const pop = document.getElementById("ra-help-popover");
        if (!entry || !pop || !anchor) return;
        helpPinned = !!pinned;
        helpAnchor = anchor;
        pop.innerHTML = `<b>${esc(entry.title)}</b><p>${esc(entry.body)}</p>`;
        pop.hidden = false;
        positionContextHelp(anchor);
    }

    function decorateContextHelp() {
        document.querySelectorAll("[data-help-key]").forEach(section => {
            const key = section.dataset.helpKey;
            if (!HELP_REGISTRY[key] || section.querySelector(":scope > .ra-help-button, :scope > summary > .ra-help-button")) return;
            const target = section.matches("details") ? section.querySelector(":scope > summary") : section.querySelector(":scope > summary, :scope > b, :scope > label") || section;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "ra-help-button";
            button.dataset.helpKey = key;
            button.setAttribute("aria-label", `About ${HELP_REGISTRY[key].title}`);
            button.textContent = "i";
            target.appendChild(button);
        });
    }

    function criterionEditorHtml(key, label, criterion) {
        const numeric = !["company","role","salary","availability"].includes(key);
        let valueControl = "";
        if (numeric) valueControl = `<input id="ra-match-${key}-target" type="number" min="0" step="any" value="${esc(criterion.target ?? 0)}">`;
        else if (key === "salary") valueControl = `<input id="ra-match-salary-max" type="number" min="0" step="1" value="${esc(criterion.max ?? 0)}">`;
        else if (key === "availability") valueControl = `<select id="ra-match-availability-value"><option value="">Any</option>${MatchCore.AVAILABILITY_VALUES.map(v=>`<option value="${esc(v)}" ${criterion.value===v?"selected":""}>${esc(v)}</option>`).join("")}</select>`;
        else valueControl = `<input id="ra-match-${key}-value" value="${esc(criterion.value || "")}">`;
        return `<div class="ra-match-criterion"><label><input class="ra-match-enable" id="ra-match-criterion-${key}" type="checkbox" ${criterion.enabled?"checked":""}> ${esc(label)}</label><span>${numeric?"Target":key==="salary"?"Max":"Value"}</span>${valueControl}<input id="ra-match-${key}-weight" type="number" min="0" step="any" value="${esc(criterion.weight ?? 0)}" title="Weight"></div>`;
    }

    function populateMatchProfileEditor(profile) {
        const editor = document.getElementById("ra-match-profile-editor");
        if (!editor || !profile) return;
        const labels = {man:"MAN",int:"INT",end:"END",ee:"EE",fit:"Fit",activity30:"Activity 30d",xanax30:"Xanax 30d",refills30:"Refills 30d",attacks30:"Attacks 30d",rwHits30:"RW Hits 30d",company:"Company",role:"Role",salary:"Salary",availability:"Availability"};
        editor.innerHTML = `<div class="ra-field"><label>Profile name</label><input id="ra-match-profile-name" value="${esc(profile.name)}"></div><div class="ra-match-criteria"><div class="ra-match-criterion ra-match-criterion-head"><span>Criterion</span><span>Rule</span><span>Target / Value</span><span>Weight</span></div>${MatchCore.CRITERIA_KEYS.map(key=>criterionEditorHtml(key,labels[key]||key,profile.criteria[key])).join("")}</div>`;
        editor.dataset.profileId = profile.profileId;
        editor.dataset.createdAt = profile.createdAt || "";
    }

    async function renderMatchProfileManager() {
        const select = document.getElementById("ra-match-profile-select");
        if (!select) return;
        let profiles = await idb.getAll("matchProfiles");
        if (!profiles.length) {
            await ensureDefaultMatchProfile();
            profiles = await idb.getAll("matchProfiles");
        }
        profiles = profiles.map(MatchCore.normalizeProfile).sort((a,b)=>a.name.localeCompare(b.name));
        let active = profiles.find(p=>p.profileId === settings.match.activeProfileId) || profiles[0];
        if (active && active.profileId !== settings.match.activeProfileId) await saveMetaSettings({match:{...settings.match,activeProfileId:active.profileId}});
        select.innerHTML = profiles.map(p=>`<option value="${esc(p.profileId)}" ${p.profileId===active?.profileId?"selected":""}>${esc(p.name)}</option>`).join("");
        if (active) populateMatchProfileEditor(active);
    }

    async function saveMatchProfileFromUI() {
        const editor = document.getElementById("ra-match-profile-editor");
        if (!editor) return;
        const active = await getActiveMatchProfile();
        const criteria = {};
        for (const key of MatchCore.CRITERIA_KEYS) {
            const enabled = !!document.getElementById(`ra-match-criterion-${key}`)?.checked;
            const weight = n(document.getElementById(`ra-match-${key}-weight`)?.value, 0);
            if (["company","role"].includes(key)) criteria[key] = {enabled,weight,value:document.getElementById(`ra-match-${key}-value`)?.value || ""};
            else if (key === "availability") criteria[key] = {enabled,weight,value:document.getElementById("ra-match-availability-value")?.value || ""};
            else if (key === "salary") criteria[key] = {enabled,weight,max:n(document.getElementById("ra-match-salary-max")?.value,0)};
            else criteria[key] = {enabled,weight,target:n(document.getElementById(`ra-match-${key}-target`)?.value,0)};
        }
        const saved = await saveMatchProfile({profileId:active.profileId,name:document.getElementById("ra-match-profile-name")?.value || active.name,criteria,createdAt:active.createdAt});
        await saveMetaSettings({match:{...settings.match,activeProfileId:saved.profileId}});
        await refreshMatchScores();
        renderResults();
        await renderMatchProfileManager();
        setStatus("Match Profile saved.");
    }

    async function duplicateActiveMatchProfile() {
        const active = await getActiveMatchProfile();
        const duplicate = MatchCore.normalizeProfile({...active,profileId:"",name:`${active.name} Copy`,createdAt:"",updatedAt:""});
        const saved = await saveMatchProfile(duplicate);
        await saveMetaSettings({match:{...settings.match,activeProfileId:saved.profileId}});
        await renderMatchProfileManager();
        await refreshMatchScores();
        renderResults();
    }

    async function deleteActiveMatchProfile() {
        const active = await getActiveMatchProfile();
        if (!active || !confirm(`Delete Match Profile "${active.name}"?`)) return;
        await deleteMatchProfile(active.profileId);
        const remaining = await idb.getAll("matchProfiles");
        let next = remaining[0] || null;
        if (!next) next = await saveMatchProfile(MatchCore.createDefaultProfile("Default Recruit"));
        await saveMetaSettings({match:{...settings.match,activeProfileId:next.profileId}});
        await renderMatchProfileManager();
        await refreshMatchScores();
        renderResults();
    }

`;

replaceOnce('bindUI helper insertion', '    function bindUI() {', helpers + '    function bindUI() {');

replaceOnce(
  'bindUI initial handlers',
  '        document.getElementById("ra-launch").onclick=openMainWindow;\n        document.getElementById("ra-close").onclick=()=>document.getElementById("ra-panel").style.display="none";',
  `        document.getElementById("ra-launch").onclick=openMainWindow;
        document.getElementById("ra-close").onclick=()=>document.getElementById("ra-panel").style.display="none";
        document.getElementById("ra-settings-toggle").onclick=async()=>{const panel=document.getElementById("ra-settings-panel");panel.hidden=!panel.hidden;if(!panel.hidden){decorateContextHelp();await renderMatchProfileManager();}};
        document.getElementById("ra-match-profile-select").onchange=async e=>{await saveMetaSettings({match:{...settings.match,activeProfileId:e.target.value}});const p=await getActiveMatchProfile();populateMatchProfileEditor(p);await refreshMatchScores();renderResults();};
        document.getElementById("ra-match-profile-new").onclick=async()=>{const p=await saveMatchProfile(MatchCore.createDefaultProfile("New Match Profile"));await saveMetaSettings({match:{...settings.match,activeProfileId:p.profileId}});await renderMatchProfileManager();};
        document.getElementById("ra-match-profile-duplicate").onclick=duplicateActiveMatchProfile;
        document.getElementById("ra-match-profile-delete").onclick=deleteActiveMatchProfile;
        document.getElementById("ra-match-profile-save").onclick=saveMatchProfileFromUI;
        document.getElementById("ra-settings-clear-scout-cache").onclick=async()=>{if(!confirm("Clear local Scout cache and history?"))return;await idb.clear("scoutLatest");await idb.clear("scoutHistory");setStatus("Scout cache cleared.");};
        document.getElementById("ra-settings-clear-candidates").onclick=async()=>{if(!confirm("Clear all local candidate recruitment fields?"))return;await idb.clear("candidateLocal");await refreshMatchScores();renderResults();setStatus("Local candidate data cleared.");};`
);

replaceOnce(
  'bindUI help delegation anchor',
  '        document.getElementById("ra-history-close").onclick=()=>document.getElementById("ra-history").style.display="none";',
  `        document.getElementById("ra-history-close").onclick=()=>document.getElementById("ra-history").style.display="none";
        document.addEventListener("pointerover",e=>{const b=e.target.closest?.(".ra-help-button");if(b&&!helpPinned)openContextHelp(b.dataset.helpKey,b,false);});
        document.addEventListener("pointerout",e=>{if(e.target.closest?.(".ra-help-button")&&!helpPinned){helpCloseTimer=setTimeout(()=>closeContextHelp(),120);}});
        document.addEventListener("focusin",e=>{const b=e.target.closest?.(".ra-help-button");if(b&&!helpPinned)openContextHelp(b.dataset.helpKey,b,false);});
        document.addEventListener("focusout",e=>{if(e.target.closest?.(".ra-help-button")&&!helpPinned)closeContextHelp();});
        document.addEventListener("click",e=>{const b=e.target.closest?.(".ra-help-button");if(!b)return;e.preventDefault();e.stopPropagation();if(helpPinned&&helpAnchor===b)closeContextHelp(true);else openContextHelp(b.dataset.helpKey,b,true);});
        document.addEventListener("keydown",e=>{if(e.key==="Escape")closeContextHelp(true);});`
);

replaceOnce(
  'startup helpers',
  '        populateSettingsUI();\n        syncModeUI();',
  `        populateSettingsUI();
        decorateContextHelp();
        renderMatchProfileManager().catch(e=>console.warn("[RA] Match Profile manager failed.",e));
        syncModeUI();`
);

replaceOnce(
  'panel append help popover',
  '        document.body.appendChild(panel);\n\n        const results=document.createElement("div");',
  `        document.body.appendChild(panel);
        const helpPopover=document.createElement("div");
        helpPopover.id="ra-help-popover";
        helpPopover.className="ra-help-popover";
        helpPopover.hidden=true;
        helpPopover.setAttribute("role","dialog");
        helpPopover.setAttribute("aria-live","polite");
        document.body.appendChild(helpPopover);

        const results=document.createElement("div");`
);

fs.writeFileSync(userPath, s);
