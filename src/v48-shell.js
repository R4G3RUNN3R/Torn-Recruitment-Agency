(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RA_V48Shell=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='4.8.0';
  const STORAGE_KEY='r4g3-ra-v48-ui';
  const CORE_ROUTE=Object.freeze({company:'company-candidates',faction:'faction-candidates'});
  const OPTIONAL=Object.freeze([
    {key:'overview',label:'Overview',company:'company-overview',faction:'faction-overview'},
    {key:'today',label:'Today',company:'company-today',faction:'faction-today'},
    {key:'discover',label:'Forum Discovery',company:'company-discover',faction:'faction-discover'},
    {key:'pipeline',label:'Pipeline',company:'company-pipeline',faction:'faction-pipeline'},
    {key:'vacancies',label:'Vacancies',company:'company-vacancies'},
    {key:'campaigns',label:'Campaigns',company:'company-campaigns',faction:'faction-campaigns'},
    {key:'followups',label:'Follow-ups',company:'company-followups',faction:'faction-followups'},
    {key:'timeline',label:'Timeline',company:'company-timeline',faction:'faction-timeline'},
    {key:'stageAging',label:'Stage Aging',company:'company-stage-aging',faction:'faction-stage-aging'},
    {key:'contactOutcomes',label:'Contact Outcomes',company:'company-contact-outcomes',faction:'faction-contact-outcomes'},
    {key:'sessions',label:'Recruitment Sessions',company:'company-recruitment-sessions',faction:'faction-recruitment-sessions'},
    {key:'talentPool',label:'Talent Pool',company:'company-talent-pool'},
    {key:'reactivation',label:'Reactivation',company:'company-reactivation',faction:'faction-reactivation'},
    {key:'opportunity',label:'Opportunity Queue',company:'company-opportunity',faction:'faction-opportunity'},
    {key:'compare',label:'Compare',company:'company-compare',faction:'faction-compare'},
    {key:'factionRequirements',label:'Faction Requirements',faction:'faction-requirements'},
    {key:'scout',label:'Scout',global:'scout'},
    {key:'smartMatch',label:'Smart Match',global:'smart-match'},
    {key:'globalIntelligence',label:'Global Intelligence',global:'global-intelligence'},
    {key:'data',label:'Data & Export',global:'data'},
    {key:'logs',label:'Diagnostics & Logs',global:'logs'}
  ]);
  const DEFAULT_OPTIONAL=Object.freeze(Object.fromEntries(OPTIONAL.map(item=>[item.key,false])));

  function text(value){return String(value??'').trim();}
  function finite(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;}
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function normalizeDomain(value){return String(value||'').toLowerCase()==='faction'?'faction':'company';}
  function normalizePrefs(raw={}){
    const optional={...DEFAULT_OPTIONAL};
    for(const key of Object.keys(optional))optional[key]=raw?.optional?.[key]===true;
    const search=raw?.search||{};
    return {domain:normalizeDomain(raw.domain),optional,search:{text:text(search.text),minEnd:text(search.minEnd),minMan:text(search.minMan),minInt:text(search.minInt)}};
  }
  function coreRoute(domain){return CORE_ROUTE[normalizeDomain(domain)];}
  function visibleOptionalRoutes(prefs,domain){
    const normalized=normalizePrefs(prefs);const kind=normalizeDomain(domain);
    return OPTIONAL.filter(item=>normalized.optional[item.key]).map(item=>({id:item[kind]||item.global||'',label:item.label,key:item.key})).filter(item=>item.id);
  }
  function parseThreshold(value){
    const raw=String(value??'').trim().replace(/,/g,'');if(!raw)return null;
    const match=raw.match(/^([0-9]+(?:\.[0-9]+)?)\s*([kmb])?$/i);if(!match)return NaN;
    const multiplier={k:1e3,m:1e6,b:1e9}[(match[2]||'').toLowerCase()]||1;
    return Number(match[1])*multiplier;
  }
  function matchesCoreSearch(row={},search={}){
    const q=text(search.text).toLowerCase();
    if(q&&!`${text(row.name)} ${text(row.userId)}`.toLowerCase().includes(q))return false;
    for(const [field,key] of [['end','minEnd'],['man','minMan'],['int','minInt']]){
      const threshold=parseThreshold(search[key]);if(threshold===null)continue;if(!Number.isFinite(threshold))return false;
      const actual=finite(row[field]);if(actual===null||actual<threshold)return false;
    }
    return true;
  }
  function formatLastOnline(timestampMs,nowMs=Date.now()){
    const ts=finite(timestampMs);if(ts===null||ts<=0)return 'Unknown';
    const seconds=Math.max(0,Math.floor((Number(nowMs)-ts)/1000));
    if(seconds<60)return `${seconds} second${seconds===1?'':'s'} ago`;
    const minutes=Math.floor(seconds/60);if(minutes<60)return `${minutes} minute${minutes===1?'':'s'} ago`;
    const hours=Math.floor(minutes/60);if(hours<24)return `${hours} hour${hours===1?'':'s'} ago`;
    const days=Math.floor(hours/24);return `${days} day${days===1?'':'s'} ago`;
  }
  function premiumCss(){return `
:root{--ra-bg:#09090b;--ra-panel:#111114;--ra-panel2:#18181d;--ra-line:#34343b;--ra-text:#f4f4f5;--ra-muted:#a1a1aa;--ra-accent:#d84a4a;--ra-accent2:#f0f0f2;--ra-danger:#ff5f65;--ra-warn:#dba44e}
#ra-app{border:1px solid #3d3d45!important;border-radius:14px!important;background:linear-gradient(155deg,#0a0a0d 0%,#0f0f13 100%)!important;box-shadow:0 28px 90px #000c,0 0 0 1px #ffffff08 inset,0 0 34px #d84a4a12!important}
#ra-app .ra-titlebar{height:48px!important;background:linear-gradient(180deg,#1a1a20 0%,#111116 100%)!important;border-bottom:1px solid #3a3a42!important;box-shadow:inset 0 1px 0 #ffffff0b!important}
#ra-app .ra-titlebar b{letter-spacing:.04em!important}
#ra-app .ra-shell{grid-template-columns:minmax(0,1fr)!important}
#ra-app .ra-sidebar{display:none!important}
#ra-app .ra-main{background:linear-gradient(180deg,#0b0b0e,#0e0e12)!important}
#ra-app.ra-v48-core-active .ra-pagehead{display:none!important}
#ra-app .ra-pagehead{padding:9px 14px!important;background:#111116!important;border-bottom:1px solid #2f2f36!important}
#ra-app .ra-panel,#ra-app .ra-kpi{background:linear-gradient(180deg,#15151a,#111115)!important;border:1px solid #34343c!important;border-radius:11px!important;box-shadow:inset 0 1px 0 #ffffff07!important}
#ra-app .ra-btn{border:1px solid #3a3a43!important;border-radius:8px!important;background:linear-gradient(180deg,#202027,#17171d)!important;color:#f4f4f5!important;box-shadow:inset 0 1px 0 #ffffff0a!important}
#ra-app .ra-btn:hover{border-color:#d84a4a!important;box-shadow:0 0 0 1px #d84a4a44,inset 0 1px 0 #ffffff0d!important}
#ra-app .ra-primary{background:linear-gradient(180deg,#d84a4a,#a93238)!important;border-color:#ee6b6b!important;color:white!important}
#ra-launch{background:linear-gradient(145deg,#d84a4a,#8f2930)!important;color:#fff!important;border:1px solid #ef7676!important;box-shadow:0 10px 30px #000a,0 0 24px #d84a4a44!important}
.ra-v48-toolbar{display:flex;align-items:center;gap:8px;padding:9px 12px;background:#0f0f13;border-bottom:1px solid #2f2f36;position:relative;z-index:4;flex-wrap:wrap}
.ra-v48-domain{display:flex;padding:3px;background:#09090c;border:1px solid #303038;border-radius:9px;gap:3px}.ra-v48-domain button{min-width:82px}.ra-v48-domain button.is-active{background:#d84a4a!important;border-color:#ec6b6b!important;color:#fff!important}
.ra-v48-spacer{flex:1}.ra-v48-more{position:relative}.ra-v48-more-menu{position:absolute;right:0;top:calc(100% + 7px);width:min(280px,80vw);padding:7px;background:#121217;border:1px solid #383840;border-radius:10px;box-shadow:0 18px 50px #000c;display:grid;gap:4px;z-index:20}.ra-v48-more-menu[hidden]{display:none}.ra-v48-more-menu button{text-align:left;width:100%}
.ra-v48-core{max-width:1120px;margin:0 auto;padding:2px}.ra-v48-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:4px 0 12px}.ra-v48-hero h2{margin:0;font-size:22px;letter-spacing:-.02em}.ra-v48-hero p{margin:3px 0 0;color:var(--ra-muted)}
.ra-v48-search{padding:14px!important}.ra-v48-search-grid{display:grid;grid-template-columns:minmax(190px,1.7fr) repeat(3,minmax(110px,.7fr));gap:9px;align-items:end}.ra-v48-field label{display:block;color:#b5b5be;font-size:10px;font-weight:800;letter-spacing:.08em;margin:0 0 4px;text-transform:uppercase}.ra-v48-field input{width:100%;padding:9px 10px;border-radius:8px;border:1px solid #383840;background:#0d0d11;color:#f4f4f5;outline:none}.ra-v48-field input:focus{border-color:#d84a4a;box-shadow:0 0 0 3px #d84a4a22}.ra-v48-search-actions{display:flex;gap:7px;margin-top:10px}
.ra-v48-results-head{display:flex;align-items:center;justify-content:space-between;margin:14px 2px 7px}.ra-v48-results-head h3{margin:0}.ra-v48-count{color:var(--ra-muted)}.ra-v48-table-wrap{border:1px solid #34343c;border-radius:11px;overflow:auto;background:#101014}.ra-v48-table{width:100%;border-collapse:collapse;min-width:760px}.ra-v48-table th{background:#17171c;color:#c9c9d0;text-align:left;padding:9px 10px;font-size:10px;letter-spacing:.07em;text-transform:uppercase;position:sticky;top:0}.ra-v48-table td{padding:10px;border-top:1px solid #292930;color:#eee}.ra-v48-table tbody tr:hover{background:#ffffff04}.ra-v48-player{display:flex;flex-direction:column}.ra-v48-player b{color:#fff}.ra-v48-player small{color:#8f8f99}.ra-v48-stat{font-variant-numeric:tabular-nums}.ra-v48-activity{white-space:nowrap;color:#d3d3d9}.ra-v48-actions{display:flex;gap:6px;justify-content:flex-end}.ra-v48-empty{padding:28px;text-align:center;color:var(--ra-muted)}
.ra-v48-options{border-color:#4a3b3e!important}.ra-v48-option-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px}.ra-v48-option{display:flex;align-items:center;gap:8px;padding:7px 8px;border:1px solid #303038;border-radius:8px;background:#101014}.ra-v48-option input{accent-color:#d84a4a}.ra-v48-message-note{margin-top:9px;color:var(--ra-muted);font-size:11px}
@media(max-width:820px){.ra-v48-search-grid{grid-template-columns:1fr 1fr}.ra-v48-option-grid{grid-template-columns:1fr}.ra-v48-toolbar{gap:6px}.ra-v48-spacer{display:none}.ra-v48-more{margin-left:auto}}
@media(max-width:560px){.ra-v48-search-grid{grid-template-columns:1fr}.ra-v48-domain{width:100%}.ra-v48-domain button{flex:1}.ra-v48-table{min-width:640px}}
`}

  function loadPrefs(storage=globalThis.localStorage){try{return normalizePrefs(JSON.parse(storage?.getItem(STORAGE_KEY)||'{}'));}catch{return normalizePrefs({});}}
  function savePrefs(prefs,storage=globalThis.localStorage){const normalized=normalizePrefs(prefs);try{storage?.setItem(STORAGE_KEY,JSON.stringify(normalized));}catch{}return normalized;}
  function getAll(db,storeName){return new Promise(resolve=>{try{const request=db.transaction(storeName,'readonly').objectStore(storeName).getAll();request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>resolve([]);}catch{resolve([]);}});}
  function numberText(value){const n=finite(value);return n===null?'—':Math.round(n).toLocaleString();}
  function rowFrom({id,workflow,candidate,player}){
    const stats=candidate?.stats||{};
    const name=text(player?.name||candidate?.name||workflow?.name)||`User ${id}`;
    return {userId:String(id),name,man:finite(stats.man),int:finite(stats.int),end:finite(stats.end),lastActive:finite(player?.lastActive),workflow,candidate,player};
  }
  async function loadCandidateRows(app,domain){
    const db=app?._test?.state?.db;if(!db)return[];
    const [players,candidates,company,faction]=await Promise.all([getAll(db,'playerIntelligence'),getAll(db,'candidateLocal'),getAll(db,'companyRecruitment'),getAll(db,'factionRecruitment')]);
    const playerMap=new Map(players.map(row=>[String(row.userId),row]));
    const candidateMap=new Map(candidates.map(row=>[String(row.userId),row]));
    const workflowRows=normalizeDomain(domain)==='faction'?faction:(company.length?company:candidates);
    const ids=[...new Set(workflowRows.map(row=>String(row.userId)).filter(id=>/^\d+$/.test(id)))];
    return ids.map(id=>rowFrom({id,workflow:workflowRows.find(row=>String(row.userId)===id),candidate:candidateMap.get(id),player:playerMap.get(id)}));
  }
  function currentPrefsSearch(prefs){return normalizePrefs(prefs).search;}
  function sortRows(rows){return [...rows].sort((a,b)=>{const at=[a.man,a.int,a.end].reduce((s,n)=>s+(finite(n)||0),0);const bt=[b.man,b.int,b.end].reduce((s,n)=>s+(finite(n)||0),0);return bt-at||a.name.localeCompare(b.name);});}

  function install(app,{documentRef=globalThis.document,windowRef=globalThis.window,storage=globalThis.localStorage}={}){
    if(!app?._test?.navigate||!documentRef)return{destroy(){}};
    let prefs=loadPrefs(storage),destroyed=false,applying=false,scheduled=false;
    let observer=null;
    const styleId='ra-v48-premium-css';
    if(!documentRef.getElementById(styleId)){
      const style=documentRef.createElement('style');style.id=styleId;style.textContent=premiumCss();documentRef.head?.appendChild(style);
    }

    const persist=next=>{prefs=savePrefs({...prefs,...next},storage);return prefs;};
    const notifyError=error=>{console.error('[RA 4.8]',error);try{windowRef?.alert?.(error?.message||String(error));}catch{}};
    const navigate=route=>Promise.resolve(app._test.navigate(route)).catch(notifyError);
    const navigateCore=async(domain=prefs.domain,anchor='search')=>{prefs=persist({domain:normalizeDomain(domain)});await navigate(coreRoute(prefs.domain));scheduleApply(anchor);};

    function optionalRouteButtons(){return visibleOptionalRoutes(prefs,prefs.domain).map(item=>`<button type="button" class="ra-btn" data-v48-route="${esc(item.id)}">${esc(item.label)}</button>`).join('');}
    function toolbarHtml(){const optional=optionalRouteButtons();return `<div class="ra-v48-toolbar" data-v48-toolbar><div class="ra-v48-domain"><button type="button" class="ra-btn ${prefs.domain==='company'?'is-active':''}" data-v48-domain="company">Company</button><button type="button" class="ra-btn ${prefs.domain==='faction'?'is-active':''}" data-v48-domain="faction">Faction</button></div><button type="button" class="ra-btn" data-v48-core="search">Search</button><button type="button" class="ra-btn" data-v48-core="results">Results</button><div class="ra-v48-spacer"></div>${optional?`<div class="ra-v48-more"><button type="button" class="ra-btn" data-v48-more>More ▾</button><div class="ra-v48-more-menu" data-v48-more-menu hidden>${optional}</div></div>`:''}</div>`;}

    function ensureToolbar(){
      const main=documentRef.querySelector('#ra-app .ra-main');if(!main)return;
      const signature=JSON.stringify({domain:prefs.domain,routes:visibleOptionalRoutes(prefs,prefs.domain).map(item=>item.id)});
      let toolbar=main.querySelector('[data-v48-toolbar]');
      if(toolbar?.dataset?.v48Signature===signature)return;
      if(!toolbar){main.insertAdjacentHTML('afterbegin',toolbarHtml());toolbar=main.querySelector('[data-v48-toolbar]');}
      else{toolbar.outerHTML=toolbarHtml();toolbar=main.querySelector('[data-v48-toolbar]');}
      if(!toolbar)return;toolbar.dataset.v48Signature=signature;
      toolbar.querySelectorAll('[data-v48-domain]').forEach(button=>button.onclick=()=>navigateCore(button.dataset.v48Domain,'search'));
      toolbar.querySelectorAll('[data-v48-core]').forEach(button=>button.onclick=()=>navigateCore(prefs.domain,button.dataset.v48Core));
      toolbar.querySelector('[data-v48-more]')?.addEventListener('click',()=>{const menu=toolbar.querySelector('[data-v48-more-menu]');if(menu)menu.hidden=!menu.hidden;});
      toolbar.querySelectorAll('[data-v48-route]').forEach(button=>button.onclick=()=>navigate(button.dataset.v48Route));
    }

    async function renderCore(anchor=''){
      const state=app._test.state;if(!state||state.page!==coreRoute(prefs.domain))return false;
      const content=documentRef.getElementById('ra-content');if(!content)return false;
      const all=await loadCandidateRows(app,prefs.domain);const search=currentPrefsSearch(prefs);const rows=sortRows(all.filter(row=>matchesCoreSearch(row,search)));
      const signature=JSON.stringify({domain:prefs.domain,search,rows:rows.map(row=>[row.userId,row.name,row.end,row.man,row.int,row.lastActive])});
      if(content.dataset?.v48CoreSignature===signature){if(anchor){documentRef.getElementById(anchor==='results'?'ra-v48-results':'ra-v48-search')?.scrollIntoView?.({block:'start'});if(anchor==='search')documentRef.getElementById('ra-v48-q')?.focus?.();}return true;}
      const body=rows.map(row=>`<tr><td><div class="ra-v48-player"><b>${esc(row.name)}</b><small>${esc(row.userId)}</small></div></td><td class="ra-v48-stat">${numberText(row.end)}</td><td class="ra-v48-stat">${numberText(row.man)}</td><td class="ra-v48-stat">${numberText(row.int)}</td><td class="ra-v48-activity">${esc(formatLastOnline(row.lastActive))}</td><td><div class="ra-v48-actions"><button type="button" class="ra-btn" data-v48-view="${esc(row.userId)}">View</button><button type="button" class="ra-btn ra-primary" data-v48-message="${esc(row.userId)}" data-v48-name="${esc(row.name)}">Message</button></div></td></tr>`).join('');
      content.innerHTML=`<div class="ra-v48-core"><div class="ra-v48-hero"><div><h2>${prefs.domain==='company'?'Company':'Faction'} Recruitment</h2><p>Search candidates, check when they were last online, and contact them without the dashboard avalanche.</p></div></div><section class="ra-panel ra-v48-search" id="ra-v48-search"><div class="ra-v48-search-grid"><div class="ra-v48-field"><label>Player name or ID</label><input id="ra-v48-q" value="${esc(search.text)}" placeholder="Search candidates"></div><div class="ra-v48-field"><label>END ≥</label><input id="ra-v48-end" value="${esc(search.minEnd)}" placeholder="e.g. 100k"></div><div class="ra-v48-field"><label>MAN ≥</label><input id="ra-v48-man" value="${esc(search.minMan)}" placeholder="e.g. 75k"></div><div class="ra-v48-field"><label>INT ≥</label><input id="ra-v48-int" value="${esc(search.minInt)}" placeholder="e.g. 50k"></div></div><div class="ra-v48-search-actions"><button type="button" class="ra-btn ra-primary" id="ra-v48-run-search">Search</button><button type="button" class="ra-btn" id="ra-v48-clear-search">Clear</button></div></section><div class="ra-v48-results-head" id="ra-v48-results"><h3>Results</h3><span class="ra-v48-count">${rows.length} of ${all.length} candidate${all.length===1?'':'s'}</span></div><div class="ra-v48-table-wrap"><table class="ra-v48-table"><thead><tr><th>Player</th><th>END</th><th>MAN</th><th>INT</th><th>Last online</th><th></th></tr></thead><tbody>${body||`<tr><td colspan="6"><div class="ra-v48-empty">No candidates match this search.</div></td></tr>`}</tbody></table></div></div>`;
      content.dataset.v48CoreSignature=signature;
      const runSearch=()=>{prefs=persist({search:{text:text(documentRef.getElementById('ra-v48-q')?.value),minEnd:text(documentRef.getElementById('ra-v48-end')?.value),minMan:text(documentRef.getElementById('ra-v48-man')?.value),minInt:text(documentRef.getElementById('ra-v48-int')?.value)}});scheduleApply('results');};
      documentRef.getElementById('ra-v48-run-search')?.addEventListener('click',runSearch);
      for(const id of ['ra-v48-q','ra-v48-end','ra-v48-man','ra-v48-int'])documentRef.getElementById(id)?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();runSearch();}});
      documentRef.getElementById('ra-v48-clear-search')?.addEventListener('click',()=>{prefs=persist({search:{text:'',minEnd:'',minMan:'',minInt:''}});scheduleApply('search');});
      content.querySelectorAll('[data-v48-view]').forEach(button=>button.onclick=()=>windowRef?.open?.(`https://www.torn.com/profiles.php?XID=${encodeURIComponent(button.dataset.v48View)}`,'_blank','noopener'));
      content.querySelectorAll('[data-v48-message]').forEach(button=>button.onclick=()=>Promise.resolve(app._test.recruitCandidate(prefs.domain,button.dataset.v48Message,button.dataset.v48Name)).catch(notifyError));
      if(anchor){documentRef.getElementById(anchor==='results'?'ra-v48-results':'ra-v48-search')?.scrollIntoView?.({block:'start'});if(anchor==='search')documentRef.getElementById('ra-v48-q')?.focus?.();}
      return true;
    }

    function renderOptions(){
      if(app._test.state?.page!=='settings')return;
      const content=documentRef.getElementById('ra-content');if(!content||documentRef.getElementById('ra-v48-options'))return;
      const options=OPTIONAL.map(item=>`<label class="ra-v48-option"><input type="checkbox" data-v48-option="${esc(item.key)}" ${prefs.optional[item.key]?'checked':''}><span>${esc(item.label)}</span></label>`).join('');
      const panel=documentRef.createElement('section');panel.className='ra-panel ra-v48-options';panel.id='ra-v48-options';panel.innerHTML=`<div class="ra-panel-head"><div><h3>Interface & Optional Modules</h3><p>The default Recruitment Agency stays deliberately simple. Enable only the extra workspaces you actually use.</p></div></div><div class="ra-v48-option-grid">${options}</div><div class="ra-v48-message-note"><b>Saved recruitment messages:</b> Company and Faction have separate templates under the Recruitment settings below. The core Message button uses the selected domain's saved template and leaves final Send to you.</div>`;
      content.prepend(panel);
      panel.querySelectorAll('[data-v48-option]').forEach(input=>input.onchange=()=>{prefs=persist({optional:{...prefs.optional,[input.dataset.v48Option]:input.checked}});ensureToolbar();});
    }

    async function apply(anchor=''){
      if(destroyed||applying)return;applying=true;
      try{
        ensureToolbar();
        const isCore=app._test.state?.page===coreRoute(prefs.domain);
        documentRef.getElementById('ra-app')?.classList.toggle('ra-v48-core-active',isCore);
        if(!(await renderCore(anchor)))renderOptions();
      }finally{applying=false;}
    }
    function scheduleApply(anchor=''){
      if(destroyed||scheduled)return;scheduled=true;
      Promise.resolve().then(()=>{scheduled=false;void apply(anchor);});
    }

    observer=new MutationObserver(()=>scheduleApply());
    const appNode=documentRef.getElementById('ra-app');if(appNode)observer.observe(appNode,{childList:true,subtree:true});
    const initialPage=app._test.state?.page;
    if(!initialPage||(!initialPage.startsWith('company-')&&!initialPage.startsWith('faction-')&&initialPage!=='settings'))void navigateCore(prefs.domain,'search');
    else if(initialPage==='company-overview'||initialPage==='faction-overview')void navigateCore(prefs.domain,'search');
    else scheduleApply();
    return {destroy(){destroyed=true;observer?.disconnect?.();documentRef.getElementById(styleId)?.remove();},getPrefs:()=>normalizePrefs(prefs),refresh:()=>scheduleApply()};
  }

  return Object.freeze({VERSION,STORAGE_KEY,OPTIONAL,DEFAULT_OPTIONAL,normalizePrefs,visibleOptionalRoutes,parseThreshold,matchesCoreSearch,formatLastOnline,coreRoute,premiumCss,loadCandidateRows,install});
});
