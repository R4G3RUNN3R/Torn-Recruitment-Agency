'use strict';

const fs = require('node:fs');
const userPath = 'R4G3RUNN3R-Recruitment-Agency.user.js';
let s = fs.readFileSync(userPath, 'utf8');
const settingsMarkup = fs.readFileSync('tools/task4-settings.html', 'utf8').trim();
const helpers = fs.readFileSync('tools/task4-helpers.jsfrag', 'utf8');

function replaceOnce(label, before, after) {
  const first = s.indexOf(before);
  if (first < 0) throw new Error(`Could not find ${label}`);
  if (s.indexOf(before, first + before.length) >= 0) throw new Error(`Found ${label} more than once`);
  s = s.slice(0, first) + after + s.slice(first + before.length);
}

function replaceRegexOnce(label, regex, replacement) {
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const matches = [...s.matchAll(new RegExp(regex.source, flags))];
  if (matches.length !== 1) throw new Error(`Expected one ${label}, found ${matches.length}`);
  s = s.replace(regex, replacement);
}

const cssExtra = '.ra-settings-panel{border-top:1px solid var(--ra-line);margin-top:10px;padding-top:6px}.ra-settings-section{border:1px solid var(--ra-line);border-radius:8px;padding:7px 9px;margin:7px 0;background:color-mix(in srgb,var(--ra-bg2) 86%,transparent)}.ra-settings-section>summary{font-weight:900;cursor:pointer}.ra-settings-section[open]>summary{margin-bottom:8px}.ra-help-button{display:inline-grid;place-items:center;width:20px;height:20px;padding:0!important;margin-left:6px;border-radius:50%!important;font-size:11px;vertical-align:middle}.ra-help-popover{position:fixed;z-index:2147483647;max-width:min(340px,calc(100vw - 16px));padding:10px;border:1px solid var(--ra-accent);border-radius:8px;background:var(--ra-bg2);box-shadow:0 10px 30px rgba(0,0,0,.45);white-space:normal}.ra-help-popover b{display:block;margin-bottom:5px}.ra-help-popover p{margin:4px 0}.ra-match-profile-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.ra-match-profile-toolbar select{flex:1;min-width:160px}.ra-match-criteria{display:grid;gap:5px}.ra-match-criterion{display:grid;grid-template-columns:minmax(105px,1.2fr) 72px minmax(90px,1fr) 70px;gap:5px;align-items:center}.ra-match-criterion input,.ra-match-criterion select{min-width:0}.ra-match-criterion .ra-match-enable{width:auto}.ra-match-criterion-head{font-size:10px;color:var(--ra-muted);font-weight:900}.ra-settings-copy{font-size:10px;color:var(--ra-muted);margin:5px 0}';
replaceOnce('Settings CSS hook', '.ra-advanced-only[hidden]{display:none!important}', '.ra-advanced-only[hidden]{display:none!important}' + cssExtra);

replaceOnce(
  'main header controls',
  '<div class="ra-head" id="ra-drag"><b>Recruitment Agency <span class="ra-note">v${SCRIPT_VERSION}</span></b><div class="ra-head-actions"><div class="ra-complexity-toggle"><button id="ra-complexity-simple">Simple</button><button id="ra-complexity-advanced">Advanced</button></div><button id="ra-open-results">Results</button><button id="ra-close">×</button></div></div>',
  '<div class="ra-head" id="ra-drag"><b>Recruitment Agency <span class="ra-note">v${SCRIPT_VERSION}</span></b><div class="ra-head-actions"><button id="ra-settings-toggle">Settings</button><button id="ra-open-results">Results</button><button id="ra-close">×</button></div></div>'
);

replaceRegexOnce(
  'legacy Advanced Settings block',
  /<details class="ra-section ra-advanced-only"><summary>Advanced Settings<\/summary>[\s\S]*?<div class="ra-actions"><button class="ra-btn" id="ra-theme">Theme<\/button><\/div>/,
  settingsMarkup
);

replaceOnce('Task 4 helper insertion', '    function bindUI() {', helpers + '\n    function bindUI() {');

replaceOnce(
  'Settings/profile bind handlers',
  '        document.getElementById("ra-launch").onclick=openMainWindow;\n        document.getElementById("ra-close").onclick=()=>document.getElementById("ra-panel").style.display="none";',
  '        document.getElementById("ra-launch").onclick=openMainWindow;\n' +
  '        document.getElementById("ra-close").onclick=()=>document.getElementById("ra-panel").style.display="none";\n' +
  '        document.getElementById("ra-settings-toggle").onclick=async()=>{const p=document.getElementById("ra-settings-panel");p.hidden=!p.hidden;if(!p.hidden){decorateContextHelp();await renderMatchProfileManager();}};\n' +
  '        document.getElementById("ra-match-profile-select").onchange=async e=>{await saveMetaSettings({match:{...settings.match,activeProfileId:e.target.value}});populateMatchProfileEditor(await getActiveMatchProfile());await refreshMatchScores();renderResults();};\n' +
  '        document.getElementById("ra-match-profile-new").onclick=async()=>{const p=await saveMatchProfile(MatchCore.createDefaultProfile("New Match Profile"));await saveMetaSettings({match:{...settings.match,activeProfileId:p.profileId}});await renderMatchProfileManager();};\n' +
  '        document.getElementById("ra-match-profile-duplicate").onclick=duplicateActiveMatchProfile;\n' +
  '        document.getElementById("ra-match-profile-delete").onclick=deleteActiveMatchProfile;\n' +
  '        document.getElementById("ra-match-profile-save").onclick=saveMatchProfileFromUI;\n' +
  '        document.getElementById("ra-settings-clear-scout-cache").onclick=async()=>{if(!confirm("Clear local Scout cache and history?"))return;await idb.clear("scoutLatest");await idb.clear("scoutHistory");setStatus("Scout cache cleared.");};\n' +
  '        document.getElementById("ra-settings-clear-candidates").onclick=async()=>{if(!confirm("Clear all local candidate recruitment fields?"))return;await idb.clear("candidateLocal");await refreshMatchScores();renderResults();setStatus("Local candidate data cleared.");};'
);

replaceOnce(
  'help event delegation',
  '        document.getElementById("ra-history-close").onclick=()=>document.getElementById("ra-history").style.display="none";',
  '        document.getElementById("ra-history-close").onclick=()=>document.getElementById("ra-history").style.display="none";\n' +
  '        document.addEventListener("pointerover",e=>{const b=e.target.closest?.(".ra-help-button");if(b&&!helpPinned)openContextHelp(b.dataset.helpKey,b,false);});\n' +
  '        document.addEventListener("pointerout",e=>{if(e.target.closest?.(".ra-help-button")&&!helpPinned)helpCloseTimer=setTimeout(()=>closeContextHelp(),120);});\n' +
  '        document.addEventListener("focusin",e=>{const b=e.target.closest?.(".ra-help-button");if(b&&!helpPinned)openContextHelp(b.dataset.helpKey,b,false);});\n' +
  '        document.addEventListener("focusout",e=>{if(e.target.closest?.(".ra-help-button")&&!helpPinned)closeContextHelp();});\n' +
  '        document.addEventListener("click",e=>{const b=e.target.closest?.(".ra-help-button");if(!b)return;e.preventDefault();e.stopPropagation();if(helpPinned&&helpAnchor===b)closeContextHelp(true);else openContextHelp(b.dataset.helpKey,b,true);});\n' +
  '        document.addEventListener("keydown",e=>{if(e.key==="Escape")closeContextHelp(true);});'
);

replaceOnce(
  'startup helpers',
  '        populateSettingsUI();\n        syncModeUI();',
  '        populateSettingsUI();\n        decorateContextHelp();\n        renderMatchProfileManager().catch(e=>console.warn("[RA] Match Profile manager failed.",e));\n        syncModeUI();'
);

replaceOnce(
  'help popover mount',
  '        document.body.appendChild(panel);\n\n        const results=document.createElement("div");',
  '        document.body.appendChild(panel);\n        const helpPopover=document.createElement("div");\n        helpPopover.id="ra-help-popover";\n        helpPopover.className="ra-help-popover";\n        helpPopover.hidden=true;\n        helpPopover.setAttribute("role","dialog");\n        helpPopover.setAttribute("aria-live","polite");\n        document.body.appendChild(helpPopover);\n\n        const results=document.createElement("div");'
);

fs.writeFileSync(userPath, s);
