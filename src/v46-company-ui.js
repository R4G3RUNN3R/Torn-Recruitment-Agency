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
  const VACANCY_STATES=Object.freeze(['Draft','Open','Paused','Filled','Archived']);
  const CRITERION_FIELDS=Object.freeze(['level','ee','fit','activity30','xanax30','refills30','attacks30','rwHits30','networth']);
  const CRITERION_OPERATORS=Object.freeze(['gte','gt','lte','lt','between','equals']);

  function text(value){return String(value??'').trim();}
  function number(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));}
  function normalizeStage(value){const raw=text(value).toLowerCase();return COMPANY_STAGES.find(stage=>stage.toLowerCase()===raw)||'Not Contacted';}

  function buildCandidateRows(companyRecords=[],playerRecords=[],options={}){
    const players=new Map((Array.isArray(playerRecords)?playerRecords:[]).map(player=>[text(player?.userId),player]));
    const eligibilityFor=typeof options.eligibilityFor==='function'?options.eligibilityFor:()=>null;
    const rows=[];
    for(const record of Array.isArray(companyRecords)?companyRecords:[]){
      if(!record||text(record.domain).toLowerCase()==='faction')continue;
      const userId=text(record.userId);if(!userId)continue;
      const player=players.get(userId)||{userId};
      const evaluation=eligibilityFor(record,player)||{};
      rows.push({
        userId,name:text(player.name)||`User ${userId}`,level:player.level??null,ee:player.ee??null,fit:player.fit??null,fitType:text(player.fitType),
        lastActive:player.lastActive??null,activity30:player.activity30??null,xanax30:player.xanax30??null,refills30:player.refills30??null,
        attacks30:player.attacks30??null,rwHits30:player.rwHits30??null,networth:player.networth??null,currentCompany:text(player.currentCompany),
        pipelineStage:normalizeStage(record.pipelineStage),availability:text(record.availability)||'Unknown',desiredCompany:text(record.desiredCompany),desiredRole:text(record.desiredRole),
        expectedSalary:record.expectedSalary??null,recruiterNote:text(record.recruiterNote),followUps:Array.isArray(record.followUps)?record.followUps.map(item=>({...item})):[],
        campaigns:Array.isArray(record.campaigns)?[...record.campaigns]:[],outcomes:Array.isArray(record.outcomes)?record.outcomes.map(item=>({...item})):[],tags:Array.isArray(record.tags)?[...record.tags]:[],
        doNotContact:record.doNotContact===true,archived:record.archived===true,createdAt:record.createdAt??null,updatedAt:record.updatedAt??null,
        stageChangedAt:record.stageChangedAt??record.updatedAt??null,newlyDiscoveredAt:record.newlyDiscoveredAt??null,newlyEligibleAt:record.newlyEligibleAt??null,
        eligibility:text(evaluation.eligibility)||'Unknown',eligibilityScore:Number.isFinite(Number(evaluation.score))?Number(evaluation.score):null,hardFailed:evaluation.hardFailed===true,
        companyRecord:record,playerRecord:player
      });
    }
    return rows.sort((a,b)=>a.name.localeCompare(b.name)||a.userId.localeCompare(b.userId,undefined,{numeric:true}));
  }

  function buildOverviewModel(rows=[],vacancies=[]){
    const stageCounts=Object.fromEntries(COMPANY_STAGES.map(stage=>[stage,0]));
    let activeCandidates=0,eligible=0,notCurrentlyEligible=0;
    for(const row of Array.isArray(rows)?rows:[]){const stage=normalizeStage(row.pipelineStage);stageCounts[stage]++;if(!row.archived&&!TERMINAL_STAGES.has(stage))activeCandidates++;if(['Eligible','Eligible by Waiver'].includes(text(row.eligibility)))eligible++;if(text(row.eligibility)==='NOT CURRENTLY ELIGIBLE')notCurrentlyEligible++;}
    const open=(Array.isArray(vacancies)?vacancies:[]).filter(v=>text(v?.status)==='Open');
    return {totalCandidates:(Array.isArray(rows)?rows:[]).length,activeCandidates,stageCounts,eligible,notCurrentlyEligible,openVacancies:open.length,openings:open.reduce((sum,v)=>sum+Math.max(0,number(v?.openings,0)),0)};
  }

  function buildTodayModel(rows=[],context={}){
    const queue=CompanyCore.buildTodayQueue(rows,context);const byId=new Map((Array.isArray(rows)?rows:[]).map(row=>[text(row.userId),row]));
    return queue.map(item=>{const row=byId.get(text(item.userId))||{};return{...item,name:text(row.name)||`User ${item.userId}`,availability:text(row.availability)||'Unknown',eligibility:text(row.eligibility)||'Unknown',fit:row.fit??null,desiredRole:text(row.desiredRole)};});
  }

  function buildPipelineModel(rows=[]){const buckets=Object.fromEntries(COMPANY_STAGES.map(stage=>[stage,[]]));for(const row of Array.isArray(rows)?rows:[]){if(!row||text(row.companyRecord?.domain).toLowerCase()==='faction')continue;buckets[normalizeStage(row.pipelineStage)].push(row);}return buckets;}

  function kpi(label,value){return `<div class="ra-kpi"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;}
  function score(value){return Number.isFinite(Number(value))?Number(value).toFixed(1):'—';}
  function money(value){return Number.isFinite(Number(value))?`$${Math.round(Number(value)).toLocaleString()}`:'—';}
  function stageOptions(selected){return COMPANY_STAGES.map(stage=>`<option value="${esc(stage)}" ${stage===selected?'selected':''}>${esc(stage)}</option>`).join('');}
  function vacancyStateOptions(selected){return VACANCY_STATES.map(state=>`<option value="${state}" ${state===selected?'selected':''}>${state}</option>`).join('');}

  function renderOverview(model={}){const counts=model.stageCounts||{};return `<div class="ra-kpis">${kpi('Active Candidates',number(model.activeCandidates))}${kpi('Eligible',number(model.eligible))}${kpi('Open Vacancies',number(model.openVacancies))}${kpi('Openings',number(model.openings))}</div><section class="ra-panel"><div class="ra-panel-head"><div><h3>Company Recruitment</h3><p>Company-only workflow state over shared Player Intelligence.</p></div></div><div class="ra-detail-grid"><span>Not Currently Eligible<b>${number(model.notCurrentlyEligible)}</b></span><span>Replied<b>${number(counts.Replied)}</b></span><span>Shortlisted<b>${number(counts.Shortlisted)}</b></span><span>Hired<b>${number(counts.Hired)}</b></span></div><div class="ra-actions" style="margin-top:10px"><button class="ra-btn ra-primary" data-go-page="company-today">Open Today</button><button class="ra-btn" data-go-page="company-vacancies">Manage Vacancies</button><button class="ra-btn" data-go-page="company-candidates">Company Candidates</button></div></section>`;}

  function renderToday(items=[]){const rows=(Array.isArray(items)?items:[]).map(item=>`<tr><td>${esc(item.name)}</td><td>${esc(item.pipelineStage)}</td><td>${esc((item.reasons||[]).join(' · '))}</td><td>${esc(item.eligibility)}</td><td>${score(item.fit)}</td></tr>`).join('');return `<section class="ra-panel"><div class="ra-panel-head"><div><h3>Company Today</h3><p>Priority work only. Viewing this queue never changes pipeline state.</p></div></div><div class="ra-table-wrap"><table class="ra-table"><thead><tr><th>Player</th><th>Stage</th><th>Why now</th><th>Eligibility</th><th>Fit</th></tr></thead><tbody>${rows||'<tr><td colspan="5">Nothing requires attention.</td></tr>'}</tbody></table></div></section>`;}

  function renderCandidates(rows=[]){
    const body=(Array.isArray(rows)?rows:[]).map(row=>{
      const vacancyOptions=(row.vacancyOptions||[]).map(v=>`<option value="${esc(v.vacancyId)}" ${text(row.pinnedVacancyId)===text(v.vacancyId)?'selected':''}>${esc(v.name)}${Number.isFinite(Number(v.matchScore))?` · ${Math.round(v.matchScore)}%`:''}</option>`).join('');
      return `<tr data-context-id="${esc(row.userId)}"><td>${esc(row.name)}<small class="ra-muted"> ${esc(row.userId)}</small></td><td><select class="ra-btn" data-company-stage-select="${esc(row.userId)}">${stageOptions(row.pipelineStage)}</select></td><td>${esc(row.eligibility)}</td><td>${esc(row.availability)}</td><td>${score(row.fit)}</td><td>${Number.isFinite(Number(row.ee))?Number(row.ee).toLocaleString():'—'}</td><td>${esc(row.desiredRole||'—')}</td><td>${money(row.expectedSalary)}</td><td><select class="ra-btn" data-company-vacancy-pin="${esc(row.userId)}"><option value="">Auto${row.suggestedVacancyName?` · ${esc(row.suggestedVacancyName)}`:''}</option>${vacancyOptions}</select></td></tr>`;
    }).join('');
    return `<section class="ra-panel"><div class="ra-panel-head"><div><h3>Company Candidates</h3><p>${(Array.isArray(rows)?rows:[]).length} Company recruitment record(s). Shared intelligence is not duplicated here.</p></div></div><div class="ra-table-wrap"><table class="ra-table"><thead><tr><th>Player</th><th>Stage</th><th>Eligibility</th><th>Availability</th><th>Fit</th><th>EE</th><th>Role</th><th>Salary</th><th>Vacancy</th></tr></thead><tbody>${body||'<tr><td colspan="9">No Company candidates.</td></tr>'}</tbody></table></div></section>`;
  }

  function renderPipeline(model={}){return `<div class="ra-pipeline">${COMPANY_STAGES.map(stage=>`<section class="ra-stage" data-company-stage="${esc(stage)}"><div class="ra-stage-head"><b>${esc(stage)}</b><span>${(model[stage]||[]).length}</span></div><div class="ra-stage-drop">${(model[stage]||[]).map(row=>`<article class="ra-stage-card" data-context-id="${esc(row.userId)}"><b>${esc(row.name)}</b><div>${esc(row.eligibility)} · Fit ${score(row.fit)}</div><div>${esc(row.desiredRole||'No role specified')}</div><select class="ra-btn" data-company-stage-select="${esc(row.userId)}">${stageOptions(row.pipelineStage)}</select></article>`).join('')}</div></section>`).join('')}</div>`;}

  function renderCriterionRow(raw={},scope='baseline'){
    const req={id:text(raw.id),label:text(raw.label),field:text(raw.field)||'ee',operator:text(raw.operator)||'gte',kind:text(raw.kind)||'Preferred',value:raw.value??'',weight:Number.isFinite(Number(raw.weight))?Number(raw.weight):1};
    return `<div class="ra-formgrid" data-criterion-row data-criterion-id="${esc(req.id)}" style="grid-template-columns:1.2fr 1fr .8fr .8fr 1fr .7fr auto;align-items:end;margin:6px 0"><div class="ra-field"><label>Label</label><input data-criterion-field="label" value="${esc(req.label)}"></div><div class="ra-field"><label>Field</label><select data-criterion-field="field">${CRITERION_FIELDS.map(field=>`<option value="${field}" ${field===req.field?'selected':''}>${field}</option>`).join('')}</select></div><div class="ra-field"><label>Operator</label><select data-criterion-field="operator">${CRITERION_OPERATORS.map(op=>`<option value="${op}" ${op===req.operator?'selected':''}>${op}</option>`).join('')}</select></div><div class="ra-field"><label>Type</label><select data-criterion-field="kind"><option value="Hard" ${req.kind==='Hard'?'selected':''}>Hard</option><option value="Preferred" ${req.kind!=='Hard'?'selected':''}>Preferred</option></select></div><div class="ra-field"><label>Value</label><input data-criterion-field="value" value="${esc(req.value)}"></div><div class="ra-field"><label>Weight</label><input data-criterion-field="weight" type="number" min="0" step="0.1" value="${esc(req.weight)}"></div><button type="button" class="ra-btn ra-danger" data-remove-criterion="${esc(scope)}">×</button></div>`;
  }

  function renderVacanciesPage({config={},vacancies=[],rows=[]}={}){
    const baseline=config.baseline?.criteria||[];
    const vacancyCards=(Array.isArray(vacancies)?vacancies:[]).map(v=>`<section class="ra-panel" data-vacancy-card="${esc(v.vacancyId)}"><div class="ra-panel-head"><div><h3>${esc(v.name||'Untitled Vacancy')}</h3><p>${esc(v.vacancyId)} · ${number(v.openings,1)} opening${number(v.openings,1)===1?'':'s'}</p></div></div><div class="ra-formgrid"><div class="ra-field"><label>Name</label><input data-vacancy-field="name" value="${esc(v.name)}"></div><div class="ra-field"><label>Role</label><input data-vacancy-field="role" value="${esc(v.role)}"></div><div class="ra-field"><label>Openings</label><input data-vacancy-field="openings" type="number" min="1" value="${number(v.openings,1)}"></div><div class="ra-field"><label>Status</label><select data-vacancy-field="status">${vacancyStateOptions(v.status)}</select></div><div class="ra-field"><label>Salary budget</label><input data-vacancy-field="salaryBudget" type="number" value="${esc(v.salaryBudget??'')}"></div><div class="ra-field"><label>Availability</label><select data-vacancy-field="availability"><option ${v.availability==='Unknown'?'selected':''}>Unknown</option><option ${v.availability==='Available'?'selected':''}>Available</option><option ${v.availability==='Unavailable'?'selected':''}>Unavailable</option></select></div><div class="ra-field" style="grid-column:1/-1"><label>Notes</label><textarea data-vacancy-field="notes">${esc(v.notes)}</textarea></div></div><h4>Vacancy criteria</h4><div data-criteria-host>${(v.criteria||[]).map(req=>renderCriterionRow(req,`vacancy:${v.vacancyId}`)).join('')}</div><div class="ra-actions"><button type="button" class="ra-btn" data-vacancy-add-criterion="${esc(v.vacancyId)}">Add criterion</button><button type="button" class="ra-btn ra-primary" data-vacancy-save="${esc(v.vacancyId)}">Save Vacancy</button><button type="button" class="ra-btn ra-danger" data-vacancy-delete="${esc(v.vacancyId)}">Delete</button></div></section>`).join('');
    return `<section class="ra-panel"><div class="ra-panel-head"><div><h3>Company Baseline</h3><p>Hard requirements block Hired unless explicitly waived. Preferred requirements influence quality only.</p></div></div><div id="ra-company-baseline-criteria" data-criteria-host>${baseline.map(req=>renderCriterionRow(req,'baseline')).join('')}</div><div class="ra-actions"><button type="button" class="ra-btn" id="ra-company-baseline-add">Add criterion</button><button type="button" class="ra-btn ra-primary" id="ra-company-baseline-save">Save Baseline</button></div></section><section class="ra-panel"><div class="ra-panel-head"><div><h3>New Vacancy</h3><p>One vacancy can represent multiple openings.</p></div></div><div class="ra-formgrid"><div class="ra-field"><label>Name</label><input id="ra-company-new-vacancy-name"></div><div class="ra-field"><label>Role</label><input id="ra-company-new-vacancy-role"></div><div class="ra-field"><label>Openings</label><input id="ra-company-new-vacancy-openings" type="number" min="1" value="1"></div><div class="ra-field"><label>Status</label><select id="ra-company-new-vacancy-status">${vacancyStateOptions('Draft')}</select></div></div><div class="ra-actions" style="margin-top:8px"><button type="button" class="ra-btn ra-primary" id="ra-company-vacancy-new">Create Vacancy</button></div></section><div class="ra-note" style="margin-bottom:8px">${rows.length} Company candidate(s) are evaluated locally against every Open vacancy. No Torn API calls are made by vacancy edits or rescoring.</div>${vacancyCards||'<section class="ra-panel"><div class="ra-muted">No vacancies yet.</div></section>'}`;
  }

  return Object.freeze({COMPANY_STAGES,VACANCY_STATES,buildCandidateRows,buildOverviewModel,buildTodayModel,buildPipelineModel,renderOverview,renderToday,renderCandidates,renderPipeline,renderCriterionRow,renderVacanciesPage});
});
