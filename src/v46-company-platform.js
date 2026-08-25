(function(root,factory){
  const deps={
    CompanyCore:root&&root.RA_V46CompanyCore,
    CompanyUI:root&&root.RA_V46CompanyUI
  };
  if(typeof module==='object'&&module.exports){
    deps.CompanyCore=require('./v46-company-core');
    deps.CompanyUI=require('./v46-company-ui');
  }
  const api=factory(deps);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RA_V46CompanyPlatform=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(D){
  'use strict';
  const {CompanyCore,CompanyUI}=D;
  if(!CompanyCore||!CompanyUI)throw new Error('CompanyCore and CompanyUI are required.');

  const COMPANY_ROUTES=Object.freeze([
    'company-overview','company-today','company-discover','company-candidates','company-pipeline',
    'company-vacancies','company-campaigns','company-followups','company-timeline','company-stage-aging',
    'company-contact-outcomes','company-recruitment-sessions','company-talent-pool','company-reactivation',
    'company-opportunity','company-compare'
  ]);
  const IMPLEMENTED_ROUTES=new Set(['company-overview','company-today','company-candidates','company-pipeline']);
  const META=Object.freeze({
    'company-overview':['Company Overview','Company recruitment status and work needing attention.'],
    'company-today':['Company Today','Prioritized Company recruitment work for today.'],
    'company-discover':['Company Discover','Company-only recruitment discovery and enrichment.'],
    'company-candidates':['Company Candidates','Search and manage Company recruitment candidates.'],
    'company-pipeline':['Company Pipeline','Move Company candidates through explicit recruitment stages.'],
    'company-vacancies':['Company Vacancies','Define and manage Company hiring needs.'],
    'company-campaigns':['Company Campaigns','Organize Company recruitment campaigns.'],
    'company-followups':['Company Follow-ups','Track Company candidate follow-ups.'],
    'company-timeline':['Company Timeline','Review Company recruitment history.'],
    'company-stage-aging':['Company Stage Aging','Review candidates aging in their current Company stage.'],
    'company-contact-outcomes':['Company Contact Outcomes','Track Company recruitment contact outcomes independently of stage.'],
    'company-recruitment-sessions':['Company Recruitment Sessions','Work focused Company recruitment queues.'],
    'company-talent-pool':['Company Talent Pool','Maintain reusable Company talent prospects.'],
    'company-reactivation':['Company Reactivation','Restart Company recruitment cycles without duplicating identity.'],
    'company-opportunity':['Company Opportunity Queue','Review explainable Company recruitment opportunities.'],
    'company-compare':['Company Compare','Compare Company candidates side by side.']
  });

  const runtime={app:null,observer:null,originalHandlers:new Map(),installed:false};
  const text=value=>String(value??'').trim();
  const number=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};

  function isCompanyRoute(value){return COMPANY_ROUTES.includes(text(value));}
  function routeMeta(route){const [title,description]=META[text(route)]||META['company-overview'];return{title,description};}

  function dbGetAll(db,store){return new Promise(resolve=>{try{const q=db.transaction(store,'readonly').objectStore(store).getAll();q.onsuccess=()=>resolve(q.result||[]);q.onerror=()=>resolve([]);}catch{resolve([]);}});}
  function dbGet(db,store,key){return new Promise(resolve=>{try{const q=db.transaction(store,'readonly').objectStore(store).get(key);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>resolve(null);}catch{resolve(null);}});}
  function dbPut(db,store,value){return new Promise((resolve,reject)=>{try{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error||new Error(`Failed to save ${store}.`));}catch(error){reject(error);}});}

  async function getConfig(app){
    if(app?._test?.companyRepositories?.config?.get)return app._test.companyRepositories.config.get();
    return (await dbGet(app._test.state.db,'companyRecruitmentConfig','company'))||{key:'company',baseline:{criteria:[]},stageThresholds:{},opportunityWeights:{}};
  }
  async function getVacancies(app){
    if(app?._test?.companyRepositories?.vacancies?.list)return app._test.companyRepositories.vacancies.list();
    return dbGetAll(app._test.state.db,'companyVacancies');
  }
  async function buildRows(app){
    const db=app._test.state.db;
    const [companyRecords,players,config]=await Promise.all([dbGetAll(db,'companyRecruitment'),dbGetAll(db,'playerIntelligence'),getConfig(app)]);
    const baseline=CompanyCore.normalizeBaseline(config.baseline||{});
    return CompanyUI.buildCandidateRows(companyRecords,players,{eligibilityFor:(record,player)=>CompanyCore.evaluateCriteria(baseline.criteria,player,record.waivers||[])});
  }

  async function persistRoute(app,page){
    const state=app?._test?.state;
    if(!state?.db)return false;
    state.page=page;
    state.settings=state.settings||{};
    state.settings.activePage=page;
    const meta=await dbGet(state.db,'meta','global')||{key:'global',settings:{}};
    meta.settings={...(meta.settings||{}),activePage:page};
    await dbPut(state.db,'meta',meta);
    return true;
  }

  function bindContentControls(){
    document.querySelectorAll('#ra-content [data-go-page]').forEach(button=>{
      if(!isCompanyRoute(button.dataset.goPage))return;
      button.onclick=event=>{event?.preventDefault?.();renderPage(button.dataset.goPage).catch(reportError);};
    });
  }
  function syncActiveNav(page){
    document.querySelectorAll('#ra-nav [data-page]').forEach(button=>button.classList.toggle('active',button.dataset.page===page));
  }
  function reportError(error){
    console.error('[RA v4.6 Company]',error);
    try{globalThis.alert?.(`Company Recruitment failed: ${error?.message||error}`);}catch{}
  }

  async function renderPage(page,options={}){
    const app=runtime.app;
    if(!app||!IMPLEMENTED_ROUTES.has(page))return false;
    const title=document.getElementById('ra-page-title');
    const desc=document.getElementById('ra-page-desc');
    const content=document.getElementById('ra-content');
    if(!title||!desc||!content)throw new Error('Recruitment Agency shell is not mounted.');
    const meta=routeMeta(page);
    title.textContent=meta.title;desc.textContent=meta.description;
    const rows=await buildRows(app);
    if(page==='company-overview')content.innerHTML=CompanyUI.renderOverview(CompanyUI.buildOverviewModel(rows,await getVacancies(app)));
    else if(page==='company-today'){
      const config=await getConfig(app);
      content.innerHTML=CompanyUI.renderToday(CompanyUI.buildTodayModel(rows,{now:Date.now(),stageThresholds:config.stageThresholds||{},opportunities:{}}));
    }else if(page==='company-candidates')content.innerHTML=CompanyUI.renderCandidates(rows);
    else if(page==='company-pipeline')content.innerHTML=CompanyUI.renderPipeline(CompanyUI.buildPipelineModel(rows));
    syncActiveNav(page);bindContentControls();
    if(options.persist!==false)await persistRoute(app,page);
    return true;
  }

  function bindNav(){
    if(!runtime.app)return;
    document.querySelectorAll('#ra-nav [data-page]').forEach(button=>{
      const page=text(button.dataset.page);
      if(!IMPLEMENTED_ROUTES.has(page))return;
      if(!runtime.originalHandlers.has(button))runtime.originalHandlers.set(button,button.onclick||null);
      button.onclick=event=>{event?.preventDefault?.();renderPage(page).catch(reportError);};
    });
  }

  function install(app,options={}){
    if(!app?._test?.state?.db)throw new Error('A mounted Recruitment Agency app with DB state is required.');
    uninstall();
    runtime.app=app;runtime.installed=true;
    bindNav();
    const nav=document.getElementById('ra-nav');
    if(nav&&typeof MutationObserver==='function'){
      runtime.observer=new MutationObserver(()=>bindNav());
      runtime.observer.observe(nav,{childList:true,subtree:true});
    }
    const page=text(app._test.state.page||app._test.state.settings?.activePage);
    if(options.renderInitial!==false&&IMPLEMENTED_ROUTES.has(page))renderPage(page,{persist:false}).catch(reportError);
    return true;
  }

  function uninstall(){
    runtime.observer?.disconnect?.();runtime.observer=null;
    for(const[button,handler]of runtime.originalHandlers.entries())if(button?.isConnected)button.onclick=handler;
    runtime.originalHandlers.clear();runtime.app=null;runtime.installed=false;
  }

  return Object.freeze({COMPANY_ROUTES,isCompanyRoute,routeMeta,install,uninstall,renderPage,_test:{buildRows,persistRoute,dbGetAll,dbGet,dbPut,IMPLEMENTED_ROUTES}});
});
