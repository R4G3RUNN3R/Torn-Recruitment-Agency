(function(root,factory){
  const deps={CompanyCore:root&&root.RA_V46CompanyCore};
  if(typeof module==='object'&&module.exports)deps.CompanyCore=require('./v46-company-core');
  const api=factory(deps);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RA_V46CompanyUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(D){
  'use strict';

  const {CompanyCore}=D;
  if(!CompanyCore)throw new Error('CompanyCore is required.');
  const COMPANY_STAGES=Object.freeze(['Not Contacted','Shortlisted','Contacted','Replied','Hired','Rejected']);
  const TERMINAL_STAGES=new Set(['Hired','Rejected']);

  function text(value){return String(value??'').trim();}
  function number(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function sameId(a,b){return text(a)===text(b);}
  function normalizeStage(value){const raw=text(value).toLowerCase();return COMPANY_STAGES.find(stage=>stage.toLowerCase()===raw)||'Not Contacted';}

  function buildCandidateRows(companyRecords=[],playerRecords=[],options={}){
    const players=new Map((Array.isArray(playerRecords)?playerRecords:[]).map(player=>[text(player?.userId),player]));
    const eligibilityFor=typeof options.eligibilityFor==='function'?options.eligibilityFor:()=>null;
    const rows=[];
    for(const record of Array.isArray(companyRecords)?companyRecords:[]){
      if(!record||text(record.domain).toLowerCase()==='faction')continue;
      const userId=text(record.userId);
      if(!userId)continue;
      const player=players.get(userId)||{userId};
      const evaluation=eligibilityFor(record,player)||{};
      rows.push({
        userId,
        name:text(player.name)||`User ${userId}`,
        level:player.level??null,
        ee:player.ee??null,
        fit:player.fit??null,
        fitType:text(player.fitType),
        lastActive:player.lastActive??null,
        activity30:player.activity30??null,
        xanax30:player.xanax30??null,
        refills30:player.refills30??null,
        attacks30:player.attacks30??null,
        rwHits30:player.rwHits30??null,
        networth:player.networth??null,
        currentCompany:text(player.currentCompany),
        pipelineStage:normalizeStage(record.pipelineStage),
        availability:text(record.availability)||'Unknown',
        desiredCompany:text(record.desiredCompany),
        desiredRole:text(record.desiredRole),
        expectedSalary:record.expectedSalary??null,
        recruiterNote:text(record.recruiterNote),
        followUps:Array.isArray(record.followUps)?record.followUps.map(item=>({...item})):[],
        campaigns:Array.isArray(record.campaigns)?[...record.campaigns]:[],
        outcomes:Array.isArray(record.outcomes)?record.outcomes.map(item=>({...item})):[],
        tags:Array.isArray(record.tags)?[...record.tags]:[],
        doNotContact:record.doNotContact===true,
        archived:record.archived===true,
        createdAt:record.createdAt??null,
        updatedAt:record.updatedAt??null,
        stageChangedAt:record.stageChangedAt??record.updatedAt??null,
        newlyDiscoveredAt:record.newlyDiscoveredAt??null,
        newlyEligibleAt:record.newlyEligibleAt??null,
        eligibility:text(evaluation.eligibility)||'Unknown',
        eligibilityScore:Number.isFinite(Number(evaluation.score))?Number(evaluation.score):null,
        hardFailed:evaluation.hardFailed===true,
        companyRecord:record,
        playerRecord:player
      });
    }
    return rows.sort((a,b)=>a.name.localeCompare(b.name)||a.userId.localeCompare(b.userId,undefined,{numeric:true}));
  }

  function buildOverviewModel(rows=[],vacancies=[]){
    const stageCounts=Object.fromEntries(COMPANY_STAGES.map(stage=>[stage,0]));
    let activeCandidates=0,eligible=0,notCurrentlyEligible=0;
    for(const row of Array.isArray(rows)?rows:[]){
      const stage=normalizeStage(row.pipelineStage);
      stageCounts[stage]++;
      if(!row.archived&&!TERMINAL_STAGES.has(stage))activeCandidates++;
      if(['Eligible','Eligible by Waiver'].includes(text(row.eligibility)))eligible++;
      if(text(row.eligibility)==='NOT CURRENTLY ELIGIBLE')notCurrentlyEligible++;
    }
    const open=(Array.isArray(vacancies)?vacancies:[]).filter(v=>text(v?.status)==='Open');
    return {
      totalCandidates:(Array.isArray(rows)?rows:[]).length,
      activeCandidates,
      stageCounts,
      eligible,
      notCurrentlyEligible,
      openVacancies:open.length,
      openings:open.reduce((sum,v)=>sum+Math.max(0,number(v?.openings,0)),0)
    };
  }

  function buildTodayModel(rows=[],context={}){
    const queue=CompanyCore.buildTodayQueue(rows,context);
    const byId=new Map((Array.isArray(rows)?rows:[]).map(row=>[text(row.userId),row]));
    return queue.map(item=>{
      const row=byId.get(text(item.userId))||{};
      return {...item,name:text(row.name)||`User ${item.userId}`,availability:text(row.availability)||'Unknown',eligibility:text(row.eligibility)||'Unknown',fit:row.fit??null,desiredRole:text(row.desiredRole)};
    });
  }

  function buildPipelineModel(rows=[]){
    const buckets=Object.fromEntries(COMPANY_STAGES.map(stage=>[stage,[]]));
    for(const row of Array.isArray(rows)?rows:[]){
      if(!row||text(row.companyRecord?.domain).toLowerCase()==='faction')continue;
      buckets[normalizeStage(row.pipelineStage)].push(row);
    }
    return buckets;
  }

  function kpi(label,value){return `<div class="ra-kpi"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;}
  function score(value){return Number.isFinite(Number(value))?Number(value).toFixed(1):'—';}
  function money(value){return Number.isFinite(Number(value))?`$${Math.round(Number(value)).toLocaleString()}`:'—';}

  function renderOverview(model={}){
    const counts=model.stageCounts||{};
    return `<div class="ra-kpis">${kpi('Active Candidates',number(model.activeCandidates))}${kpi('Eligible',number(model.eligible))}${kpi('Open Vacancies',number(model.openVacancies))}${kpi('Openings',number(model.openings))}</div><section class="ra-panel"><div class="ra-panel-head"><div><h3>Company Recruitment</h3><p>Company-only workflow state over shared Player Intelligence.</p></div></div><div class="ra-detail-grid"><span>Not Currently Eligible<b>${number(model.notCurrentlyEligible)}</b></span><span>Replied<b>${number(counts.Replied)}</b></span><span>Shortlisted<b>${number(counts.Shortlisted)}</b></span><span>Hired<b>${number(counts.Hired)}</b></span></div><div class="ra-actions" style="margin-top:10px"><button class="ra-btn ra-primary" data-go-page="company-today">Open Today</button><button class="ra-btn" data-go-page="company-vacancies">Manage Vacancies</button><button class="ra-btn" data-go-page="company-candidates">Company Candidates</button></div></section>`;
  }

  function renderToday(items=[]){
    const rows=(Array.isArray(items)?items:[]).map(item=>`<tr><td><a href="#" class="ra-link" data-detail="${esc(item.userId)}">${esc(item.name)}</a></td><td>${esc(item.pipelineStage)}</td><td>${esc((item.reasons||[]).join(' · '))}</td><td>${esc(item.eligibility)}</td><td>${score(item.fit)}</td></tr>`).join('');
    return `<section class="ra-panel"><div class="ra-panel-head"><div><h3>Company Today</h3><p>Priority work only. Viewing this queue never changes pipeline state.</p></div></div><div class="ra-table-wrap"><table class="ra-table"><thead><tr><th>Player</th><th>Stage</th><th>Why now</th><th>Eligibility</th><th>Fit</th></tr></thead><tbody>${rows||'<tr><td colspan="5">Nothing requires attention.</td></tr>'}</tbody></table></div></section>`;
  }

  function renderCandidates(rows=[]){
    const body=(Array.isArray(rows)?rows:[]).map(row=>`<tr data-context-id="${esc(row.userId)}"><td><a href="#" class="ra-link" data-detail="${esc(row.userId)}">${esc(row.name)}</a><small class="ra-muted"> ${esc(row.userId)}</small></td><td>${esc(row.pipelineStage)}</td><td>${esc(row.eligibility)}</td><td>${esc(row.availability)}</td><td>${score(row.fit)}</td><td>${Number.isFinite(Number(row.ee))?Number(row.ee).toLocaleString():'—'}</td><td>${esc(row.desiredRole||'—')}</td><td>${money(row.expectedSalary)}</td></tr>`).join('');
    return `<section class="ra-panel"><div class="ra-panel-head"><div><h3>Company Candidates</h3><p>${(Array.isArray(rows)?rows:[]).length} Company recruitment record(s). Shared intelligence is not duplicated here.</p></div></div><div class="ra-table-wrap"><table class="ra-table"><thead><tr><th>Player</th><th>Stage</th><th>Eligibility</th><th>Availability</th><th>Fit</th><th>EE</th><th>Role</th><th>Salary</th></tr></thead><tbody>${body||'<tr><td colspan="8">No Company candidates.</td></tr>'}</tbody></table></div></section>`;
  }

  function renderPipeline(model={}){
    return `<div class="ra-pipeline">${COMPANY_STAGES.map(stage=>`<section class="ra-stage" data-company-stage="${esc(stage)}"><div class="ra-stage-head"><b>${esc(stage)}</b><span>${(model[stage]||[]).length}</span></div><div class="ra-stage-drop">${(model[stage]||[]).map(row=>`<article class="ra-stage-card" data-context-id="${esc(row.userId)}"><a href="#" class="ra-link" data-detail="${esc(row.userId)}"><b>${esc(row.name)}</b></a><div>${esc(row.eligibility)} · Fit ${score(row.fit)}</div><div>${esc(row.desiredRole||'No role specified')}</div></article>`).join('')}</div></section>`).join('')}</div>`;
  }

  return Object.freeze({COMPANY_STAGES,buildCandidateRows,buildOverviewModel,buildTodayModel,buildPipelineModel,renderOverview,renderToday,renderCandidates,renderPipeline});
});
