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
  const IMPLEMENTED_ROUTES=new Set(['company-overview','company-today','company-candidates','company-pipeline','company-vacancies']);
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
  const makeId=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

  function isCompanyRoute(value){return COMPANY_ROUTES.includes(text(value));}
  function routeMeta(route){const [title,description]=META[text(route)]||META['company-overview'];return{title,description};}

  function dbGetAll(db,store){return new Promise(resolve=>{try{const q=db.transaction(store,'readonly').objectStore(store).getAll();q.onsuccess=()=>resolve(q.result||[]);q.onerror=()=>resolve([]);}catch{resolve([]);}});}
  function dbGet(db,store,key){return new Promise(resolve=>{try{const q=db.transaction(store,'readonly').objectStore(store).get(key);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>resolve(null);}catch{resolve(null);}});}
  function dbPut(db,store,value){return new Promise((resolve,reject)=>{try{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error||new Error(`Failed to save ${store}.`));}catch(error){reject(error);}});}
  function dbDelete(db,store,key){return new Promise((resolve,reject)=>{try{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error||new Error(`Failed to delete from ${store}.`));}catch(error){reject(error);}});}

  async function getConfig(app){
    if(app?._test?.companyRepositories?.config?.get)return app._test.companyRepositories.config.get();
    return (await dbGet(app._test.state.db,'companyRecruitmentConfig','company'))||{key:'company',baseline:{criteria:[]},stageThresholds:{},opportunityWeights:{}};
  }
  async function saveConfig(app,patch){
    if(app?._test?.companyRepositories?.config?.save)return app._test.companyRepositories.config.save(patch);
    const existing=await getConfig(app);const next={...existing,...patch,key:'company',updatedAt:Date.now()};await dbPut(app._test.state.db,'companyRecruitmentConfig',next);return next;
  }
  async function getVacancies(app){
    if(app?._test?.companyRepositories?.vacancies?.list)return app._test.companyRepositories.vacancies.list();
    return dbGetAll(app._test.state.db,'companyVacancies');
  }
  async function saveVacancy(app,vacancy){
    if(app?._test?.companyRepositories?.vacancies?.save)return app._test.companyRepositories.vacancies.save(vacancy);
    const next=CompanyCore.normalizeVacancy({...vacancy,updatedAt:Date.now()});await dbPut(app._test.state.db,'companyVacancies',next);return next;
  }
  async function removeVacancy(app,vacancyId){
    if(app?._test?.companyRepositories?.vacancies?.remove)return app._test.companyRepositories.vacancies.remove(vacancyId);
    return dbDelete(app._test.state.db,'companyVacancies',text(vacancyId));
  }
  async function saveCompanyPatch(app,userId,patch){
    const id=text(userId);
    if(app?._test?.repositories?.company?.ensure)return app._test.repositories.company.ensure(id,patch,{source:'company-platform',observedAt:Date.now()});
    const existing=await dbGet(app._test.state.db,'companyRecruitment',id);if(!existing)throw new Error('Company candidate was not found.');
    const next={...existing,...patch,userId:id,domain:'company',updatedAt:Date.now()};await dbPut(app._test.state.db,'companyRecruitment',next);return next;
  }

  function evaluateCandidateVacancies(row,vacancies=[]){
    const open=(Array.isArray(vacancies)?vacancies:[]).filter(v=>text(v?.status)==='Open');
    const facts={level:row.level,ee:row.ee,fit:row.fit,activity30:row.activity30,xanax30:row.xanax30,refills30:row.refills30,attacks30:row.attacks30,rwHits30:row.rwHits30,networth:row.networth,availability:row.availability,desiredRole:row.desiredRole};
    const waivers=row.companyRecord?.waivers||[];
    const evaluations=open.map(vacancy=>CompanyCore.evaluateVacancy(vacancy,facts,waivers));
    const selection=CompanyCore.suggestVacancy(open,evaluations,row.companyRecord?.pinnedVacancyId||'');
    return{evaluations,selection};
  }

  function canMoveToStage(row,stage){return !(text(stage)==='Hired'&&row?.hardFailed===true);}

  async function buildRows(app){
    const db=app._test.state.db;
    const [companyRecords,players,config,vacancies]=await Promise.all([dbGetAll(db,'companyRecruitment'),dbGetAll(db,'playerIntelligence'),getConfig(app),getVacancies(app)]);
    const baseline=CompanyCore.normalizeBaseline(config.baseline||{});
    const rows=CompanyUI.buildCandidateRows(companyRecords,players,{eligibilityFor:(record,player)=>CompanyCore.evaluateCriteria(baseline.criteria,player,record.waivers||[])});
    const vacancyMap=new Map(vacancies.map(v=>[text(v.vacancyId),v]));
    return rows.map(row=>{
      const result=evaluateCandidateVacancies(row,vacancies);
      const evaluationMap=new Map(result.evaluations.map(e=>[text(e.vacancyId),e]));
      const options=vacancies.filter(v=>text(v.status)==='Open').map(v=>({vacancyId:text(v.vacancyId),name:text(v.name)||text(v.role)||text(v.vacancyId),matchScore:evaluationMap.get(text(v.vacancyId))?.matchScore??null,eligible:evaluationMap.get(text(v.vacancyId))?.eligible===true}));
      return{...row,vacancyEvaluations:result.evaluations,pinnedVacancyId:text(result.selection.pinnedVacancyId),suggestedVacancyId:text(result.selection.suggestedVacancyId),suggestedVacancyName:text(vacancyMap.get(text(result.selection.suggestedVacancyId))?.name),vacancyOptions:options};
    });
  }

  async function persistRoute(app,page){
    const state=app?._test?.state;if(!state?.db)return false;
    state.page=page;state.settings=state.settings||{};state.settings.activePage=page;
    const meta=await dbGet(state.db,'meta','global')||{key:'global',settings:{}};meta.settings={...(meta.settings||{}),activePage:page};await dbPut(state.db,'meta',meta);return true;
  }

  function readCriteria(host){
    if(!host)return[];
    return[...host.querySelectorAll('[data-criterion-row]')].map((row,index)=>{
      const get=key=>row.querySelector(`[data-criterion-field="${key}"]`)?.value??'';
      const rawValue=get('value');const numericValue=rawValue!==''&&Number.isFinite(Number(rawValue))?Number(rawValue):rawValue;
      return{id:text(row.dataset.criterionId)||makeId(`criterion-${index+1}`),label:text(get('label')),field:text(get('field')),operator:text(get('operator'))||'gte',kind:text(get('kind'))==='Hard'?'Hard':'Preferred',value:numericValue,weight:Math.max(0,number(get('weight'),1))};
    });
  }

  async function changeCompanyStage(userId,stage){
    const rows=await buildRows(runtime.app);const row=rows.find(item=>text(item.userId)===text(userId));if(!row)throw new Error('Company candidate was not found.');
    if(!canMoveToStage(row,stage))throw new Error('This candidate cannot be moved to Hired while an unwaived Company baseline Hard requirement is failing.');
    await saveCompanyPatch(runtime.app,userId,{pipelineStage:text(stage),updatedAt:Date.now()});
    return row;
  }

  async function setVacancyPin(userId,vacancyId){await saveCompanyPatch(runtime.app,userId,{pinnedVacancyId:text(vacancyId),updatedAt:Date.now()});return true;}

  function bindContentControls(){
    document.querySelectorAll('#ra-content [data-go-page]').forEach(button=>{if(!isCompanyRoute(button.dataset.goPage))return;button.onclick=event=>{event?.preventDefault?.();renderPage(button.dataset.goPage).catch(reportError);};});
    document.querySelectorAll('#ra-content [data-company-stage-select]').forEach(select=>{select.onchange=()=>changeCompanyStage(select.dataset.companyStageSelect,select.value).then(()=>renderPage(runtime.app._test.state.page,{persist:false})).catch(error=>{reportError(error);renderPage(runtime.app._test.state.page,{persist:false}).catch(reportError);});});
    document.querySelectorAll('#ra-content [data-company-vacancy-pin]').forEach(select=>{select.onchange=()=>setVacancyPin(select.dataset.companyVacancyPin,select.value).then(()=>renderPage('company-candidates',{persist:false})).catch(reportError);});
    document.querySelectorAll('#ra-content [data-remove-criterion]').forEach(button=>{button.onclick=()=>button.closest('[data-criterion-row]')?.remove();});
    document.getElementById('ra-company-baseline-add')?.addEventListener('click',()=>document.getElementById('ra-company-baseline-criteria')?.insertAdjacentHTML('beforeend',CompanyUI.renderCriterionRow({id:makeId('baseline')},'baseline')));
    document.getElementById('ra-company-baseline-save')?.addEventListener('click',()=>saveConfig(runtime.app,{baseline:{criteria:readCriteria(document.getElementById('ra-company-baseline-criteria'))}}).then(()=>renderPage('company-vacancies',{persist:false})).catch(reportError));
    document.getElementById('ra-company-vacancy-new')?.addEventListener('click',()=>{
      const vacancy={vacancyId:makeId('vacancy'),name:text(document.getElementById('ra-company-new-vacancy-name')?.value)||'Untitled Vacancy',role:text(document.getElementById('ra-company-new-vacancy-role')?.value),openings:Math.max(1,Math.floor(number(document.getElementById('ra-company-new-vacancy-openings')?.value,1))),status:text(document.getElementById('ra-company-new-vacancy-status')?.value)||'Draft',criteria:[]};
      saveVacancy(runtime.app,vacancy).then(()=>renderPage('company-vacancies',{persist:false})).catch(reportError);
    });
    document.querySelectorAll('#ra-content [data-vacancy-add-criterion]').forEach(button=>{button.onclick=()=>button.closest('[data-vacancy-card]')?.querySelector('[data-criteria-host]')?.insertAdjacentHTML('beforeend',CompanyUI.renderCriterionRow({id:makeId('vacancy-criterion')},`vacancy:${button.dataset.vacancyAddCriterion}`));});
    document.querySelectorAll('#ra-content [data-vacancy-save]').forEach(button=>{button.onclick=()=>{
      const card=button.closest('[data-vacancy-card]');if(!card)return;
      const field=key=>card.querySelector(`[data-vacancy-field="${key}"]`)?.value??'';
      const vacancy={vacancyId:button.dataset.vacancySave,name:text(field('name')),role:text(field('role')),openings:Math.max(1,Math.floor(number(field('openings'),1))),status:text(field('status'))||'Draft',salaryBudget:field('salaryBudget')===''?null:number(field('salaryBudget')),availability:text(field('availability'))||'Unknown',notes:text(field('notes')),criteria:readCriteria(card.querySelector('[data-criteria-host]'))};
      saveVacancy(runtime.app,vacancy).then(()=>renderPage('company-vacancies',{persist:false})).catch(reportError);
    };});
    document.querySelectorAll('#ra-content [data-vacancy-delete]').forEach(button=>{button.onclick=()=>{if(typeof globalThis.confirm==='function'&&!globalThis.confirm('Delete this Company vacancy?'))return;removeVacancy(runtime.app,button.dataset.vacancyDelete).then(()=>renderPage('company-vacancies',{persist:false})).catch(reportError);};});
  }
  function syncActiveNav(page){document.querySelectorAll('#ra-nav [data-page]').forEach(button=>button.classList.toggle('active',button.dataset.page===page));}
  function reportError(error){console.error('[RA v4.6 Company]',error);try{globalThis.alert?.(`Company Recruitment failed: ${error?.message||error}`);}catch{}}

  async function renderPage(page,options={}){
    const app=runtime.app;if(!app||!IMPLEMENTED_ROUTES.has(page))return false;
    const title=document.getElementById('ra-page-title'),desc=document.getElementById('ra-page-desc'),content=document.getElementById('ra-content');if(!title||!desc||!content)throw new Error('Recruitment Agency shell is not mounted.');
    const meta=routeMeta(page);title.textContent=meta.title;desc.textContent=meta.description;
    const rows=await buildRows(app);
    if(page==='company-overview')content.innerHTML=CompanyUI.renderOverview(CompanyUI.buildOverviewModel(rows,await getVacancies(app)));
    else if(page==='company-today'){const config=await getConfig(app);content.innerHTML=CompanyUI.renderToday(CompanyUI.buildTodayModel(rows,{now:Date.now(),stageThresholds:config.stageThresholds||{},opportunities:{}}));}
    else if(page==='company-candidates')content.innerHTML=CompanyUI.renderCandidates(rows);
    else if(page==='company-pipeline')content.innerHTML=CompanyUI.renderPipeline(CompanyUI.buildPipelineModel(rows));
    else if(page==='company-vacancies')content.innerHTML=CompanyUI.renderVacanciesPage({config:await getConfig(app),vacancies:await getVacancies(app),rows});
    syncActiveNav(page);bindContentControls();if(options.persist!==false)await persistRoute(app,page);return true;
  }

  function bindNav(){if(!runtime.app)return;document.querySelectorAll('#ra-nav [data-page]').forEach(button=>{const page=text(button.dataset.page);if(!IMPLEMENTED_ROUTES.has(page))return;if(!runtime.originalHandlers.has(button))runtime.originalHandlers.set(button,button.onclick||null);button.onclick=event=>{event?.preventDefault?.();renderPage(page).catch(reportError);};});}

  function install(app,options={}){
    if(!app?._test?.state?.db)throw new Error('A mounted Recruitment Agency app with DB state is required.');uninstall();runtime.app=app;runtime.installed=true;bindNav();
    const nav=document.getElementById('ra-nav');if(nav&&typeof MutationObserver==='function'){runtime.observer=new MutationObserver(()=>bindNav());runtime.observer.observe(nav,{childList:true,subtree:true});}
    const page=text(app._test.state.page||app._test.state.settings?.activePage);if(options.renderInitial!==false&&IMPLEMENTED_ROUTES.has(page))renderPage(page,{persist:false}).catch(reportError);return true;
  }

  function uninstall(){runtime.observer?.disconnect?.();runtime.observer=null;for(const[button,handler]of runtime.originalHandlers.entries())if(button?.isConnected)button.onclick=handler;runtime.originalHandlers.clear();runtime.app=null;runtime.installed=false;}

  return Object.freeze({COMPANY_ROUTES,isCompanyRoute,routeMeta,install,uninstall,renderPage,_test:{buildRows,persistRoute,dbGetAll,dbGet,dbPut,dbDelete,evaluateCandidateVacancies,canMoveToStage,readCriteria,IMPLEMENTED_ROUTES}});
});
