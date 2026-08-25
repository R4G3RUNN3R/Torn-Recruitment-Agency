(function(root,factory){
  let FactionCore=root&&root.RA_V47FactionCore;
  if(!FactionCore&&typeof module==='object'&&module.exports)FactionCore=require('./v47-faction-core');
  const api=factory(FactionCore);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RA_V47FactionUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(FactionCore){
  'use strict';
  if(!FactionCore)throw new Error('FactionCore is required.');

  const FACTION_STAGES=FactionCore.FACTION_STAGES;
  const TERMINAL_STAGES=new Set(['Joined','Rejected']);
  const CRITERION_FIELDS=Object.freeze(['level','ee','fit','activity30','xanax30','refills30','attacks30','rwHits30','networth']);
  const CRITERION_OPERATORS=Object.freeze(['gte','gt','lte','lt','between','equals']);
  const PROFILE_STATES=FactionCore.PROFILE_STATES;

  const text=value=>String(value??'').trim();
  const number=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const score=value=>Number.isFinite(Number(value))?Number(value).toFixed(0):'—';
  const dateText=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?new Date(n).toLocaleString():'—';};

  function normalizeStage(value){const raw=text(value).toLowerCase();return FACTION_STAGES.find(stage=>stage.toLowerCase()===raw)||'Prospect';}

  function buildCandidateRows(factionRecords=[],playerRecords=[],options={}){
    const players=new Map((Array.isArray(playerRecords)?playerRecords:[]).map(player=>[text(player?.userId),player]));
    const baseline=FactionCore.normalizeBaseline(options.baseline||{});
    const profiles=(Array.isArray(options.profiles)?options.profiles:[]).map(FactionCore.normalizeSpecialistProfile);
    const rows=[];
    for(const record of Array.isArray(factionRecords)?factionRecords:[]){
      if(!record||text(record.domain).toLowerCase()==='company')continue;
      const userId=text(record.userId);if(!userId)continue;
      const player=players.get(userId)||{userId};
      const waivers=Array.isArray(record.waivers)?record.waivers:[];
      const baselineEvaluation=FactionCore.evaluateCriteria(baseline.criteria,player,waivers,{context:'baseline'});
      const profileEvaluations=profiles.map(profile=>FactionCore.evaluateSpecialistProfile(profile,player,waivers));
      const suggestion=FactionCore.suggestSpecialistProfile(profiles,profileEvaluations,record.pinnedSpecialistProfileId||'');
      const evaluationMap=new Map(profileEvaluations.map(evaluation=>[text(evaluation.profileId),evaluation]));
      rows.push({
        userId,
        name:text(player.name)||`User ${userId}`,
        level:player.level??null,
        ee:player.ee??null,
        fit:player.fit??null,
        fitType:text(player.fitType),
        activity30:player.activity30??null,
        xanax30:player.xanax30??null,
        refills30:player.refills30??null,
        attacks30:player.attacks30??null,
        rwHits30:player.rwHits30??null,
        networth:player.networth??null,
        lastActive:player.lastActive??null,
        pipelineStage:normalizeStage(record.pipelineStage),
        availability:text(record.availability)||'Unknown',
        baselineEligibility:baselineEvaluation.eligibility,
        baselineScore:baselineEvaluation.score,
        hardFailed:baselineEvaluation.hardFailed===true,
        baselineEvaluation,
        pinnedSpecialistProfileId:text(record.pinnedSpecialistProfileId),
        specialistProfileId:text(record.specialistProfileId),
        suggestedProfileId:text(suggestion.suggestedProfileId),
        bestProfileChanged:suggestion.bestChanged===true,
        profileEvaluations,
        profileOptions:profiles.map(profile=>({
          profileId:profile.profileId,
          name:profile.name||profile.profileId,
          status:profile.status,
          matchScore:evaluationMap.get(profile.profileId)?.matchScore??null,
          eligible:evaluationMap.get(profile.profileId)?.eligible===true
        })),
        doNotContact:record.doNotContact===true,
        doNotContactReason:text(record.doNotContactReason),
        followUps:Array.isArray(record.followUps)?record.followUps.map(item=>({...item})):[],
        campaigns:Array.isArray(record.campaigns)?[...record.campaigns]:[],
        outcomes:Array.isArray(record.outcomes)?record.outcomes.map(item=>({...item})):[],
        waivers:Array.isArray(record.waivers)?record.waivers.map(item=>({...item})):[],
        tags:Array.isArray(record.tags)?[...record.tags]:[],
        archived:record.archived===true,
        stageChangedAt:record.stageChangedAt??record.updatedAt??null,
        newlyDiscoveredAt:record.newlyDiscoveredAt??null,
        newlyEligibleAt:record.newlyEligibleAt??null,
        createdAt:record.createdAt??null,
        updatedAt:record.updatedAt??null,
        factionRecord:record,
        player
      });
    }
    return rows.sort((a,b)=>a.name.localeCompare(b.name)||a.userId.localeCompare(b.userId,undefined,{numeric:true}));
  }

  function buildOverviewModel(rows=[],profiles=[]){
    const stageCounts=Object.fromEntries(FACTION_STAGES.map(stage=>[stage,0]));
    let activeCandidates=0,eligible=0,notCurrentlyEligible=0;
    for(const row of Array.isArray(rows)?rows:[]){
      const stage=normalizeStage(row.pipelineStage);stageCounts[stage]++;
      if(!row.archived&&!TERMINAL_STAGES.has(stage))activeCandidates++;
      if(['Eligible','Eligible by Waiver'].includes(text(row.baselineEligibility)))eligible++;
      if(text(row.baselineEligibility)==='NOT CURRENTLY ELIGIBLE')notCurrentlyEligible++;
    }
    return {
      totalCandidates:(Array.isArray(rows)?rows:[]).length,
      activeCandidates,
      eligible,
      notCurrentlyEligible,
      activeProfiles:(Array.isArray(profiles)?profiles:[]).map(FactionCore.normalizeSpecialistProfile).filter(profile=>profile.status==='Active').length,
      stageCounts
    };
  }

  function buildTodayModel(rows=[],context={}){
    const queue=FactionCore.buildTodayQueue(rows,context);
    const byId=new Map((Array.isArray(rows)?rows:[]).map(row=>[text(row.userId),row]));
    return queue.map(item=>{
      const row=byId.get(text(item.userId))||{};
      return {...item,name:text(row.name)||`User ${item.userId}`,baselineEligibility:text(row.baselineEligibility)||'Unknown',fit:row.fit??null,suggestedProfileId:text(row.suggestedProfileId),pinnedSpecialistProfileId:text(row.pinnedSpecialistProfileId)};
    });
  }

  function buildPipelineModel(rows=[]){
    const buckets=Object.fromEntries(FACTION_STAGES.map(stage=>[stage,[]]));
    for(const row of Array.isArray(rows)?rows:[]){if(!row||text(row.factionRecord?.domain).toLowerCase()==='company')continue;buckets[normalizeStage(row.pipelineStage)].push(row);}
    return buckets;
  }

  function kpi(label,value){return `<div class="ra-kpi"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;}
  function stageOptions(selected){return FACTION_STAGES.map(stage=>`<option value="${esc(stage)}" ${stage===selected?'selected':''}>${esc(stage)}</option>`).join('');}

  function renderOverview(model={}){
    const counts=model.stageCounts||{};
    return `<div class="ra-kpis">${kpi('Active Candidates',number(model.activeCandidates))}${kpi('Baseline Eligible',number(model.eligible))}${kpi('Active Profiles',number(model.activeProfiles))}${kpi('Invite Ready',number(counts['Invite Ready']))}</div><section class="ra-panel"><div class="ra-panel-head"><div><h3>Faction Recruitment</h3><p>Faction-only workflow state over shared Player Intelligence.</p></div></div><div class="ra-detail-grid"><span>Not Currently Eligible<b>${number(model.notCurrentlyEligible)}</b></span><span>Replied<b>${number(counts.Replied)}</b></span><span>Evaluating<b>${number(counts.Evaluating)}</b></span><span>Joined<b>${number(counts.Joined)}</b></span></div><div class="ra-actions" style="margin-top:10px"><button class="ra-btn ra-primary" data-go-page="faction-today">Open Today</button><button class="ra-btn" data-go-page="faction-requirements">Requirements &amp; Profiles</button><button class="ra-btn" data-go-page="faction-candidates">Faction Candidates</button></div></section>`;
  }

  function renderToday(items=[]){
    const body=(Array.isArray(items)?items:[]).map(item=>`<tr><td>${esc(item.name)}</td><td>${esc(item.pipelineStage)}</td><td>${esc((item.reasons||[]).join(' · '))}</td><td>${esc(item.baselineEligibility)}</td><td>${score(item.fit)}</td></tr>`).join('');
    return `<section class="ra-panel"><div class="ra-panel-head"><div><h3>Faction Today</h3><p>Priority Faction recruitment work. Viewing never changes stage.</p></div></div><div class="ra-table-wrap"><table class="ra-table"><thead><tr><th>Player</th><th>Stage</th><th>Why now</th><th>Baseline</th><th>Fit</th></tr></thead><tbody>${body||'<tr><td colspan="5">Nothing requires attention.</td></tr>'}</tbody></table></div></section>`;
  }

  function renderCandidates(rows=[]){
    const body=(Array.isArray(rows)?rows:[]).map(row=>{
      const profileOptions=(row.profileOptions||[]).map(profile=>`<option value="${esc(profile.profileId)}" ${text(row.pinnedSpecialistProfileId)===text(profile.profileId)?'selected':''}>${esc(profile.name)} · ${score(profile.matchScore)}%${profile.eligible?'':' · ineligible'}</option>`).join('');
      const message=row.doNotContact?`<button type="button" class="ra-btn ra-danger" data-faction-message-override="${esc(row.userId)}">Override &amp; Message</button>`:`<button type="button" class="ra-btn" data-faction-message="${esc(row.userId)}">Message</button>`;
      return `<tr data-context-id="${esc(row.userId)}"><td>${esc(row.name)} <small class="ra-muted">${esc(row.userId)}</small></td><td><select class="ra-btn" data-faction-stage-select="${esc(row.userId)}">${stageOptions(row.pipelineStage)}</select></td><td>${esc(row.baselineEligibility)}</td><td>${score(row.baselineScore)}%</td><td>${score(row.fit)}</td><td><select class="ra-btn" data-faction-profile-pin="${esc(row.userId)}"><option value="">Auto${row.suggestedProfileId?` · ${esc(row.suggestedProfileId)}`:''}</option>${profileOptions}</select>${row.bestProfileChanged?'<small class="ra-muted"> Best match changed</small>':''}</td><td>${message}</td></tr>`;
    }).join('');
    return `<section class="ra-panel"><div class="ra-panel-head"><div><h3>Faction Candidates</h3><p>${(Array.isArray(rows)?rows:[]).length} Faction recruitment record(s). Shared facts stay shared; workflow stays local.</p></div></div><div class="ra-table-wrap"><table class="ra-table"><thead><tr><th>Player</th><th>Stage</th><th>Baseline</th><th>Baseline Score</th><th>Fit</th><th>Specialist Profile</th><th>Action</th></tr></thead><tbody>${body||'<tr><td colspan="7">No Faction candidates.</td></tr>'}</tbody></table></div></section>`;
  }

  function renderPipeline(model={}){
    return `<div class="ra-pipeline">${FACTION_STAGES.map(stage=>`<section class="ra-stage" data-faction-stage="${esc(stage)}"><div class="ra-stage-head"><b>${esc(stage)}</b><span>${(model[stage]||[]).length}</span></div><div class="ra-stage-drop">${(model[stage]||[]).map(row=>`<article class="ra-stage-card" data-context-id="${esc(row.userId)}"><b>${esc(row.name)}</b><div>${esc(row.baselineEligibility)} · Fit ${score(row.fit)}</div><div>${esc(row.pinnedSpecialistProfileId||row.suggestedProfileId||'No specialist profile')}</div><select class="ra-btn" data-faction-stage-select="${esc(row.userId)}">${stageOptions(row.pipelineStage)}</select></article>`).join('')}</div></section>`).join('')}</div>`;
  }

  function renderCriterionRow(raw={},scope='baseline'){
    const req={id:text(raw.id),label:text(raw.label),field:text(raw.field)||'level',operator:text(raw.operator)||'gte',kind:text(raw.kind)==='Hard'?'Hard':'Preferred',value:raw.value??'',weight:Number.isFinite(Number(raw.weight))?Number(raw.weight):1};
    return `<div class="ra-formgrid" data-faction-criterion-row data-faction-criterion-id="${esc(req.id)}" data-faction-criterion-scope="${esc(scope)}" style="grid-template-columns:1.2fr 1fr .8fr .8fr 1fr .7fr auto;align-items:end;margin:6px 0"><div class="ra-field"><label>Label</label><input data-faction-criterion-field="label" value="${esc(req.label)}"></div><div class="ra-field"><label>Field</label><select data-faction-criterion-field="field">${CRITERION_FIELDS.map(field=>`<option value="${field}" ${field===req.field?'selected':''}>${field}</option>`).join('')}</select></div><div class="ra-field"><label>Operator</label><select data-faction-criterion-field="operator">${CRITERION_OPERATORS.map(op=>`<option value="${op}" ${op===req.operator?'selected':''}>${op}</option>`).join('')}</select></div><div class="ra-field"><label>Type</label><select data-faction-criterion-field="kind"><option value="Hard" ${req.kind==='Hard'?'selected':''}>Hard</option><option value="Preferred" ${req.kind==='Preferred'?'selected':''}>Preferred</option></select></div><div class="ra-field"><label>Value</label><input data-faction-criterion-field="value" value="${esc(req.value)}"></div><div class="ra-field"><label>Weight</label><input data-faction-criterion-field="weight" type="number" min="0" step="0.1" value="${esc(req.weight)}"></div><button type="button" class="ra-btn ra-danger" data-faction-remove-criterion="${esc(scope)}">×</button></div>`;
  }

  function renderRequirementsPage({config={},profiles=[]}={}){
    const baseline=FactionCore.normalizeBaseline(config.baseline||{});
    const profileCards=(Array.isArray(profiles)?profiles:[]).map(FactionCore.normalizeSpecialistProfile).map(profile=>`<section class="ra-panel" data-faction-profile-card="${esc(profile.profileId)}"><div class="ra-panel-head"><div><h3>${esc(profile.name||profile.profileId||'Specialist Profile')}</h3><p>Specialist matching context. Hard failures affect this profile only.</p></div></div><div class="ra-formgrid"><div class="ra-field"><label>Name</label><input data-faction-profile-field="name" value="${esc(profile.name)}"></div><div class="ra-field"><label>Status</label><select data-faction-profile-field="status">${PROFILE_STATES.map(state=>`<option value="${state}" ${state===profile.status?'selected':''}>${state}</option>`).join('')}</select></div><div class="ra-field" style="grid-column:1/-1"><label>Notes</label><textarea data-faction-profile-field="notes">${esc(profile.notes)}</textarea></div></div><div data-faction-profile-criteria>${profile.criteria.map(req=>renderCriterionRow(req,`profile:${profile.profileId}`)).join('')}</div><div class="ra-actions"><button class="ra-btn" data-faction-profile-add-criterion="${esc(profile.profileId)}">Add criterion</button><button class="ra-btn ra-primary" data-faction-profile-save="${esc(profile.profileId)}">Save Profile</button><button class="ra-btn ra-danger" data-faction-profile-delete="${esc(profile.profileId)}">Delete</button></div></section>`).join('');
    return `<section class="ra-panel"><div class="ra-panel-head"><div><h3>Faction Baseline</h3><p>Hard requirements gate Invite Ready unless individually waived. Preferred requirements affect score only.</p></div></div><div id="ra-faction-baseline-criteria">${baseline.criteria.map(req=>renderCriterionRow(req,'baseline')).join('')}</div><div class="ra-actions"><button class="ra-btn" id="ra-faction-baseline-add">Add Requirement</button><button class="ra-btn ra-primary" id="ra-faction-baseline-save">Save Faction Baseline</button></div></section><section class="ra-panel"><div class="ra-panel-head"><div><h3>Specialist Profiles</h3><p>Draft, Active, Paused and Archived profiles are separate from Faction Baseline eligibility.</p></div></div><div class="ra-actions"><button class="ra-btn ra-primary" id="ra-faction-profile-new">Create Specialist Profile</button></div></section>${profileCards||'<section class="ra-panel"><div class="ra-muted">No specialist profiles yet.</div></section>'}`;
  }

  return Object.freeze({
    FACTION_STAGES,
    PROFILE_STATES,
    CRITERION_FIELDS,
    CRITERION_OPERATORS,
    buildCandidateRows,
    buildOverviewModel,
    buildTodayModel,
    buildPipelineModel,
    renderOverview,
    renderToday,
    renderCandidates,
    renderPipeline,
    renderCriterionRow,
    renderRequirementsPage,
    dateText
  });
});
