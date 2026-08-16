'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, content) => {
  const file = path.join(root, p);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const replaceOnce = (source, needle, replacement, label) => {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`finalize-v45: missing ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`finalize-v45: duplicate ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
};
const replaceBetween = (source, start, end, replacement, label) => {
  const a = source.indexOf(start);
  if (a < 0) throw new Error(`finalize-v45: missing start ${label}`);
  const b = source.indexOf(end, a + start.length);
  if (b < 0) throw new Error(`finalize-v45: missing end ${label}`);
  return source.slice(0, a) + replacement + source.slice(b);
};

let app = read('src/v45-app.js');

// Fix the malformed History Gap input before the Settings page becomes the release UI.
app = replaceOnce(
  app,
  'value="${state.settings.scout.historyGapMs}</div></div><div class="ra-actions">',
  'value="${state.settings.scout.historyGapMs}"></div></div><div class="ra-actions">',
  'Scout history-gap input'
);

// Candidates must use the shared ResultsCore for the actual filtering/sorting pass.
const filterStart = '  function applyCandidateFilters(views){';
const filterEnd = '\n\n  async function migrateLegacyUsers';
const filterReplacement = `  function applyCandidateFilters(views){
    const f=state.settings.candidates.filters||{};
    const rows=(views||[]).map(view=>({...candidateSearchRow(view),candidateLocal:view.candidate,__view:view}));
    const filters={
      search:f.search,
      pipelineStage:f.stage,
      sourceType:f.source,
      lookingFor:f.lookingFor,
      currentCompany:f.currentCompany,
      minMatch:f.minMatch,
      minFit:f.minFit,
      minMan:f.minMan,
      minInt:f.minInt,
      minEnd:f.minEnd,
      minActivity30:f.minActivity30,
      activeOnly:!!f.activeOnly,
      activeAgeDays:state.settings.recruitment.candidateActiveAgeDays
    };
    const processed=ResultsCore.processRows(rows,filters,ResultsCore.DEFAULT_SORT,Date.now());
    return processed.map(row=>row.__view);
  };

  async function migrateLegacyUsers`;
app = replaceBetween(app, filterStart, filterEnd, filterReplacement, 'candidate ResultsCore filtering');

// Restore the quick hover intelligence required by the v4.5 design.
app = replaceOnce(
  app,
  '.ra-pipeline{display:grid;',
  '.ra-hover{position:fixed;z-index:2147483646;width:min(390px,calc(100vw - 12px));max-height:calc(100vh - 12px);overflow:auto;background:var(--ra-panel);border:1px solid var(--ra-line);border-radius:9px;box-shadow:0 12px 32px #000a;padding:10px}.ra-hover[hidden]{display:none}.ra-hover-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;margin-top:7px}.ra-hover-grid span{color:var(--ra-muted)}.ra-hover-grid b{display:block;color:var(--ra-text)}\n.ra-pipeline{display:grid;',
  'hover CSS'
);

app = replaceOnce(
  app,
  "document.body.appendChild(app);const context=document.createElement('div');",
  "document.body.appendChild(app);const hover=document.createElement('div');hover.id='ra-hover';hover.className='ra-hover';hover.hidden=true;hover.setAttribute('role','dialog');hover.setAttribute('aria-label','Candidate intelligence');document.body.appendChild(hover);const context=document.createElement('div');",
  'hover mount'
);

const hoverFunctions = `  let hoverOpenTimer=null,hoverCloseTimer=null;
  function closeCandidateHover(){clearTimeout(hoverOpenTimer);clearTimeout(hoverCloseTimer);const box=document.getElementById('ra-hover');if(box)box.hidden=true;}
  function scheduleCandidateHoverClose(){clearTimeout(hoverCloseTimer);hoverCloseTimer=setTimeout(closeCandidateHover,220);}
  async function openCandidateHover(id,anchor){
    clearTimeout(hoverOpenTimer);clearTimeout(hoverCloseTimer);
    const views=await candidateViews();const v=views.find(x=>String(x.userId)===String(id));const box=document.getElementById('ra-hover');
    if(!v||!box||!anchor)return;
    box.innerHTML=\`<div style="display:flex;justify-content:space-between;gap:8px"><div><b>\${esc(v.name)}</b><div class="ra-muted">\${esc(v.userId)}</div></div><b>Match \${scoreText(v.matchScore)}</b></div><div class="ra-hover-grid"><span>Stage<b>\${esc(v.pipelineStage)}</b></span><span>Availability<b>\${esc(v.availability)}</b></span><span>Fit<b>\${scoreText(v.fitScore)}</b></span><span>EE<b>\${formatNumber(v.ee)}</b></span><span>Looking For<b>\${esc(v.lookingFor)}</b></span><span>Current Company<b>\${esc(v.currentCompany||'—')}</b></span><span>MAN / INT / END<b>\${formatNumber(v.man)} / \${formatNumber(v.int)} / \${formatNumber(v.end)}</b></span><span>Source<b>\${esc(v.sourceType||'MANUAL')}</b></span></div><div class="ra-actions" style="margin-top:8px"><button class="ra-btn" data-hover-detail="\${esc(v.userId)}">View Details</button><button class="ra-btn" data-hover-scout="\${esc(v.userId)}">Scout</button></div>\`;
    box.hidden=false;const r=anchor.getBoundingClientRect();const br=box.getBoundingClientRect();let left=r.right+8,top=r.top;if(left+br.width>innerWidth-6)left=r.left-br.width-8;left=Math.max(6,Math.min(left,innerWidth-br.width-6));top=Math.max(6,Math.min(top,innerHeight-br.height-6));box.style.left=\`\${left}px\`;box.style.top=\`\${top}px\`;
    box.onpointerenter=()=>{clearTimeout(hoverCloseTimer);};box.onpointerleave=scheduleCandidateHoverClose;
    box.querySelector('[data-hover-detail]')?.addEventListener('click',()=>{closeCandidateHover();openDrawer(v.userId);});
    box.querySelector('[data-hover-scout]')?.addEventListener('click',()=>runScout([Number(v.userId)],true).catch(e=>toast(e.message,true)));
  }
  function scheduleCandidateHover(id,anchor){clearTimeout(hoverOpenTimer);hoverOpenTimer=setTimeout(()=>openCandidateHover(id,anchor).catch(()=>{}),180);}

`;
app = replaceOnce(app, '  function bindCandidateInteractions(){', hoverFunctions + '  function bindCandidateInteractions(){', 'hover functions');

app = replaceOnce(
  app,
  "document.querySelectorAll('[data-detail]').forEach(el=>el.onclick=e=>{e.preventDefault();openDrawer(el.dataset.detail);});",
  "document.querySelectorAll('[data-detail]').forEach(el=>{el.onclick=e=>{e.preventDefault();closeCandidateHover();openDrawer(el.dataset.detail);};el.onpointerenter=()=>scheduleCandidateHover(el.dataset.detail,el);el.onpointerleave=scheduleCandidateHoverClose;el.onfocus=()=>scheduleCandidateHover(el.dataset.detail,el);el.onblur=scheduleCandidateHoverClose;});",
  'hover interaction binding'
);

// Make the Discover activity console timestamped even when idle, and retain fill failures visibly.
app = replaceOnce(
  app,
  "state.sync.running?`[${new Date().toLocaleTimeString()}] Sync active: ${esc(state.sync.feed)}\\nPages: ${number(c.pagesChecked)} · Posts: ${number(c.postsExamined)} · Created: ${number(c.candidatesCreated)} · Updated: ${number(c.candidatesUpdated)}`:'Ready.'",
  "state.sync.running?`[${new Date().toLocaleTimeString()}] Sync active: ${esc(state.sync.feed)}\\nPages: ${number(c.pagesChecked)} · Posts: ${number(c.postsExamined)} · Created: ${number(c.candidatesCreated)} · Updated: ${number(c.candidatesUpdated)}`:`[${new Date().toLocaleTimeString()}] Ready.${state.fill.errors.length?`\\nLast company fill errors: ${state.fill.errors.map(x=>`${x.userId}: ${x.error}`).join(' | ')}`:''}`",
  'timestamped discovery console'
);

// Restore the real cache diagnostic behind the Settings diagnostics control.
const diagnosticFunction = `  async function runCacheDiagnostic(){
    if(state.scout.running)throw new Error('Finish the current Scout run first.');
    const id=ScoutCore.parseIds(prompt('Active player ID for Scout cache diagnostic:','')||'',1)[0];
    if(!id)throw new Error('A player ID is required for the diagnostic.');
    const now=Math.floor(Date.now()/1000);const params={selections:'personalstats',stat:SCOUT_STAT_LIST};
    const a=ScoutCore.signature(extractStats(await tornRequest(\`user/\${id}\`,{...params,timestamp:now-7*86400})));const b=ScoutCore.signature(extractStats(await tornRequest(\`user/\${id}\`,{...params,timestamp:now-30*86400})));await sleep(32000);const c=ScoutCore.signature(extractStats(await tornRequest(\`user/\${id}\`,{...params,timestamp:now-30*86400})));
    const verdict=a===b&&b===c?'flat':a===b&&b!==c?'cached':a!==b&&b===c?'clear':'odd';
    if(verdict==='cached')await saveSettings({scout:{...state.settings.scout,historyGapMs:32000}});
    await logEvent('scout','Scout cache diagnostic completed',{playerId:id,verdict});toast(verdict==='cached'?'Cached historical responses detected. History gap set to 32s.':\`Cache diagnostic: \${verdict}.\`,verdict==='odd');
    return verdict;
  }

`;
app = replaceOnce(app, '  async function saveSettingsPage(){', diagnosticFunction + '  async function saveSettingsPage(){', 'cache diagnostic function');
app = replaceOnce(
  app,
  "document.getElementById('ra-set-key')?.addEventListener('click',()=>ensureApiKey(true).then(()=>toast('API key saved.')).catch(e=>toast(e.message,true)));",
  "document.getElementById('ra-set-key')?.addEventListener('click',()=>ensureApiKey(true).then(()=>toast('API key saved.')).catch(e=>toast(e.message,true)));document.getElementById('ra-cache-diagnostic')?.addEventListener('click',()=>runCacheDiagnostic().catch(e=>toast(e.message,true)));",
  'cache diagnostic binding'
);

// Ensure Escape also closes the hover card.
app = replaceOnce(app, "if(e.key==='Escape'){closeContextMenu();closeHelp(true);closeModal();", "if(e.key==='Escape'){closeContextMenu();closeCandidateHover();closeHelp(true);closeModal();", 'Escape hover close');

write('src/v45-app.js', app);

// Normalize forum source identity/body/URL fields once, instead of carrying aliases between modules.
let forum = read('src/forum-core.js');
forum = replaceOnce(forum, "      postUrl: text(source.postUrl),\n      text: String(source.text == null ? '' : source.text),", "      postUrl: text(source.postUrl || source.url || source.forumUrl),\n      authorName: text(source.authorName || source.name),\n      text: String(source.text ?? source.body ?? ''),", 'forum source aliases');
write('src/forum-core.js', forum);

let candidates = read('src/v45-candidates.js');
candidates = replaceOnce(candidates, "forumUrl:text(source.url || source.forumUrl),", "forumUrl:text(source.postUrl || source.url || source.forumUrl),", 'candidate forum URL');
write('src/v45-candidates.js', candidates);

// Replace the public install file with a tiny v4.5 bootstrap. All implementation remains in focused modules.
const bootstrap = `// ==UserScript==
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
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/v45-candidates.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/v45-discovery.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/v45-messaging.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/v45-app.js
// @downloadURL  https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/R4G3RUNN3R-Recruitment-Agency.user.js
// @updateURL    https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/R4G3RUNN3R-Recruitment-Agency.user.js
// ==/UserScript==

(() => {
  'use strict';
  if (window.__R4G3_RECRUITMENT_AGENCY_V45__) return;
  window.__R4G3_RECRUITMENT_AGENCY_V45__ = true;
  const app = window.RA_V45App;
  if (!app || typeof app.start !== 'function') {
    console.error('[RA] v4.5 application module did not load.');
    return;
  }
  app.start().catch(error => {
    console.error('[RA] v4.5 failed to start.', error);
    alert(\`Recruitment Agency could not start: \${error?.message || error}\`);
  });
})();
`;
write('R4G3RUNN3R-Recruitment-Agency.user.js', bootstrap);

// Remove scaffolds/placeholders that should not be mistaken for release code.
for (const p of ['next/R4G3RUNN3R-Recruitment-Agency-v4.5.user.js','legacy/R4G3RUNN3R-Recruitment-Agency-v4.4.user.js']) {
  try { fs.rmSync(path.join(root,p)); } catch {}
}

const pkg = JSON.parse(read('package.json'));
pkg.version = '4.5.0';
pkg.scripts.syntax = [
  'src/scout-core.js','src/results-core.js','src/global-core.js','src/match-core.js','src/forum-core.js',
  'src/v45-runtime.js','src/v45-candidates.js','src/v45-discovery.js','src/v45-messaging.js','src/v45-app.js',
  'R4G3RUNN3R-Recruitment-Agency.user.js'
].map(file => `node --check ${file}`).join(' && ');
write('package.json', JSON.stringify(pkg,null,2)+'\n');

// Replace obsolete v4.4 root-userscript assertions with release-facing v4.5 checks.
write('tests/userscript-static.test.js', `const test=require('node:test');\nconst assert=require('node:assert/strict');\nconst fs=require('node:fs');\nconst path=require('node:path');\nconst root=path.join(__dirname,'..');\nconst boot=fs.readFileSync(path.join(root,'R4G3RUNN3R-Recruitment-Agency.user.js'),'utf8');\nconst app=fs.readFileSync(path.join(root,'src/v45-app.js'),'utf8');\n\ntest('public userscript is the v4.5 modular bootstrap',()=>{assert.match(boot,/@version\\s+4\\.5\\.0/);for(const file of ['forum-core.js','v45-runtime.js','v45-candidates.js','v45-discovery.js','v45-messaging.js','v45-app.js'])assert.ok(boot.includes('/src/'+file));assert.match(boot,/RA_V45App/);assert.match(boot,/app\\.start\\(\\)/);});\n\ntest('v4.5 app targets additive DB12 and shared scheduler',()=>{assert.match(app,/DB_VERSION\\s*=\\s*12/);assert.doesNotMatch(app,/deleteObjectStore\\s*\\(/);assert.match(app,/HARD_API_RATE\\s*=\\s*75/);assert.match(app,/MIN_API_GAP_MS\\s*=\\s*800/);assert.match(app,/Math\\.max\\(MIN_API_GAP_MS,60000\\/clampRate/);});\n\ntest('v4.5 keeps Smart Match local and messaging manual',()=>{assert.match(app,/Smart Match.*zero Torn API calls/i);assert.match(app,/you still click Send/);assert.doesNotMatch(app,/autoSubmit\\s*:\\s*true/);assert.doesNotMatch(app,/pipelineStage\\s*=\\s*['\"]Contacted['\"]\s*;.*message/s);});\n\ntest('Settings is a real routed page and Danger Zone uses inline biohazard SVG',()=>{assert.match(app,/id=\\\"ra-settings-button\\\"/);assert.match(app,/document\\.getElementById\\('ra-settings-button'\\)\\.onclick=\\(\\)=>route\\('settings'\\)/);for(const section of ['General','Recruitment','Scout','Candidates','Smart Match','Global Intelligence','Data & Reset','Danger Zone'])assert.ok(app.includes(section));assert.match(app,/function biohazardSvg/);assert.match(app,/NUKE IT ALL!/);assert.match(app,/Type NUKE to confirm/);});\n\ntest('candidate workspace, drawer, context menu, hover and pipeline are operational',()=>{for(const token of ['renderCandidates','renderPipeline','openDrawer','openContextMenu','openCandidateHover','ra-inline-stage','data-drop-stage','Shift'])assert.ok(app.includes(token),token);assert.deepEqual(require('../src/v45-runtime').PIPELINE_STAGES,['Not Contacted','Shortlisted','Contacted','Replied','Hired','Rejected']);});\n`);

write('tests/v44-final-static.test.js', `const test=require('node:test');\nconst assert=require('node:assert/strict');\nconst fs=require('node:fs');\nconst path=require('node:path');\nconst app=fs.readFileSync(path.join(__dirname,'..','src','v45-app.js'),'utf8');\nconst Global=require('../src/global-core');\n\ntest('release keeps exact Global Intelligence whitelist',()=>{assert.deepEqual([...Global.GLOBAL_FIELDS],['playerId','name','observedAt','level','ee','activity30','xanax30','refills30','attacks30','rwHits30','networth','fit','fitType','lastActive','scoutStatus','sourceVersion']);});\n\ntest('release contains no protected Recruit Scout backend or destructive migration hook',()=>{assert.doesNotMatch(app,/rs\\.dnonetwork\\.com|\\/api\\/grade|script-session/i);assert.doesNotMatch(app,/deleteObjectStore\\s*\\(/);});\n\ntest('all Torn calls use the shared request scheduler',()=>{assert.match(app,/async function tornRequest/);assert.match(app,/await reserveApiCall/);assert.match(app,/fetchForumPage/);assert.match(app,/fillCompanies/);assert.match(app,/scoutPlayer/);});\n\ntest('private recruitment fields never enter the Global observation construction',()=>{const a=app.indexOf('function globalObservation');const b=app.indexOf('async function enqueueGlobalObservation',a);const block=app.slice(a,b);for(const field of ['recruiterNote','expectedSalary','pipelineStage','defaultMessage','latestForumSourceId'])assert.equal(block.includes(field),false,field);assert.match(block,/GlobalCore\\.sanitizeObservation/);});\n`);

write('tests/v45-shell-static.test.js', `const test=require('node:test');\nconst assert=require('node:assert/strict');\nconst fs=require('node:fs');\nconst path=require('node:path');\nconst app=fs.readFileSync(path.join(__dirname,'..','src','v45-app.js'),'utf8');\n\ntest('v4.5 shell is movable, resizable, routed and responsive',()=>{assert.match(app,/resize:both/);assert.match(app,/bindWindow/);assert.match(app,/saveGeometry/);assert.match(app,/restoreGeometry/);assert.match(app,/@media\\(max-width:640px\\)/);assert.match(app,/Runtime\\.visiblePages/);});\n\ntest('Simple mode hides Logs through the runtime navigation contract',()=>{const R=require('../src/v45-runtime');assert.equal(R.visiblePages('simple').flatMap(g=>g.pages).some(p=>p.id==='logs'),false);assert.equal(R.visiblePages('advanced').flatMap(g=>g.pages).some(p=>p.id==='logs'),true);});\n\ntest('contextual help is header-anchored and viewport clamped',()=>{assert.match(app,/function helpButton/);assert.match(app,/function positionHelp/);assert.match(app,/getBoundingClientRect/);assert.match(app,/innerWidth-width-margin/);assert.match(app,/innerHeight-height-margin/);});\n\ntest('dark theme is readable and light theme keeps black text',()=>{assert.match(app,/--ra-text:#edf4ef/);assert.match(app,/:root\\[data-ra-theme=\\\"light\\\"\\][^}]*--ra-text:#000/);});\n`);

write('tests/v45-release-static.test.js', `const test=require('node:test');\nconst assert=require('node:assert/strict');\nconst fs=require('node:fs');\nconst path=require('node:path');\nconst app=fs.readFileSync(path.join(__dirname,'..','src','v45-app.js'),'utf8');\nconst forum=fs.readFileSync(path.join(__dirname,'..','src','forum-core.js'),'utf8');\nconst candidates=fs.readFileSync(path.join(__dirname,'..','src','v45-candidates.js'),'utf8');\n\ntest('forum sources preserve body/name/url aliases while sanitized continuation remains credential-free',()=>{assert.match(forum,/postUrl: text\\(source\\.postUrl \\|\\| source\\.url \\|\\| source\\.forumUrl\\)/);assert.match(forum,/authorName:/);assert.match(forum,/source\\.text \\?\\? source\\.body/);assert.match(candidates,/source\\.postUrl \\|\\| source\\.url/);});\n\ntest('Candidates delegates filtering and sorting to ResultsCore',()=>{assert.match(app,/ResultsCore\\.processRows\\(rows,filters,ResultsCore\\.DEFAULT_SORT/);assert.match(app,/activeAgeDays:state\\.settings\\.recruitment\\.candidateActiveAgeDays/);});\n\ntest('safe discovery exposes resume state without raw cursor UI',()=>{assert.match(app,/Resume available/);assert.match(app,/Discovery\\.processDiscoveryPage/);assert.doesNotMatch(app,/next cursor|continuation URL/i);});\n\ntest('Message Player prepares locally, leaves clipboard fallback visible, and never advances stage',()=>{assert.match(app,/Clipboard failed\\. Message remains selected/);assert.match(app,/Messaging\\.composeUrl/);const a=app.indexOf('async function openMessageModal');const b=app.indexOf('function showModal',a);const block=app.slice(a,b);assert.equal(block.includes('changeCandidateStage'),false);});\n\ntest('hard reset is scoped to known Recruitment Agency stores',()=>{assert.match(app,/const STORE_NAMES = Object\\.freeze/);assert.match(app,/for\\(const store of STORE_NAMES\\)await idb\\.clear/);assert.doesNotMatch(app,/localStorage\\.clear|sessionStorage\\.clear|indexedDB\\.deleteDatabase/);});\n`);

console.log('v4.5 finalizer completed');
