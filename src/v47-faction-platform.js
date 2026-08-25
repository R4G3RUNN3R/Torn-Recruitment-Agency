(function(root,factory){
  const deps={
    FactionCore:root&&root.RA_V47FactionCore,
    FactionUI:root&&root.RA_V47FactionUI,
    Operations:root&&root.RA_V47FactionOperations,
    Workflow:root&&root.RA_V47FactionWorkflow,
    WorkflowUI:root&&root.RA_V47FactionWorkflowUI,
    OpportunityUI:root&&root.RA_V47FactionOpportunityUI,
    Messaging:root&&root.RA_V45Messaging
  };
  if(typeof module==='object'&&module.exports){
    deps.FactionCore=require('./v47-faction-core');
    deps.FactionUI=require('./v47-faction-ui');
    deps.Operations=require('./v47-faction-operations');
    deps.Workflow=require('./v47-faction-workflow');
    deps.WorkflowUI=require('./v47-faction-workflow-ui');
    deps.OpportunityUI=require('./v47-faction-opportunity-ui');
    deps.Messaging=require('./v45-messaging');
  }
  const api=factory(deps);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RA_V47FactionPlatform=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(D){
  'use strict';

  const {FactionCore,FactionUI,Operations,Workflow,WorkflowUI,OpportunityUI,Messaging}=D;
  if(!FactionCore||!FactionUI||!Operations||!Workflow||!WorkflowUI||!OpportunityUI||!Messaging)throw new Error('Faction platform dependencies are required.');

  const FACTION_ROUTES=Object.freeze([
    'faction-overview','faction-today','faction-discover','faction-candidates','faction-pipeline',
    'faction-requirements','faction-campaigns','faction-followups','faction-timeline','faction-stage-aging',
    'faction-contact-outcomes','faction-recruitment-sessions','faction-reactivation','faction-opportunity','faction-compare'
  ]);
  const IMPLEMENTED_ROUTES=new Set(FACTION_ROUTES);
  const META=Object.freeze({
    'faction-overview':['Faction Overview','Faction recruitment status and work needing attention.'],
    'faction-today':['Faction Today','Prioritized Faction recruitment work for today.'],
    'faction-discover':['Faction Discover','Add and review Faction recruitment prospects without creating Company workflow state.'],
    'faction-candidates':['Faction Candidates','Search and manage Faction recruitment candidates.'],
    'faction-pipeline':['Faction Pipeline','Move Faction candidates through explicit recruitment stages.'],
    'faction-requirements':['Faction Requirements','Manage Faction Baseline requirements and specialist profiles.'],
    'faction-campaigns':['Faction Campaigns','Organize Faction recruitment campaigns.'],
    'faction-followups':['Faction Follow-ups','Track Faction candidate follow-ups.'],
    'faction-timeline':['Faction Timeline','Review immutable Faction history and recruiter notes.'],
    'faction-stage-aging':['Faction Stage Aging','Review candidates aging in their current Faction stage.'],
    'faction-contact-outcomes':['Faction Contact Outcomes','Track contact outcomes and Do Not Contact independently of stage.'],
    'faction-recruitment-sessions':['Faction Recruitment Sessions','Work focused Faction recruitment queues one explicit action at a time.'],
    'faction-reactivation':['Faction Reactivation','Restart Faction recruitment cycles without duplicating identity.'],
    'faction-opportunity':['Faction Opportunity Queue','Review explainable Faction recruitment opportunities.'],
    'faction-compare':['Faction Compare','Compare Faction candidates side by side.']
  });
  const DEFAULT_OPPORTUNITY_WEIGHTS=Object.freeze({match:30,fit:20,availability:15,activity:15,freshness:10,followUp:10,contactPenalty:10});
  const runtime={app:null,observer:null,originalHandlers:new Map(),installed:false,compareSelection:new Set()};

  const text=value=>String(value??'').trim();
  const number=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const makeId=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const unique=values=>[...new Set((Array.isArray(values)?values:[]).map(text).filter(Boolean))];
  const terminalStage=stage=>['Joined','Rejected'].includes(text(stage));

  function isFactionRoute(value){return FACTION_ROUTES.includes(text(value));}
  function routeMeta(route){const [title,description]=META[text(route)]||META['faction-overview'];return{title,description};}
  function opportunityWeights(config={}){return{...DEFAULT_OPPORTUNITY_WEIGHTS,...(config.opportunityWeights||{})};}

  function dbGetAll(db,store){return new Promise(resolve=>{try{const q=db.transaction(store,'readonly').objectStore(store).getAll();q.onsuccess=()=>resolve(q.result||[]);q.onerror=()=>resolve([]);}catch{resolve([]);}});}
  function dbGet(db,store,key){return new Promise(resolve=>{try{const q=db.transaction(store,'readonly').objectStore(store).get(key);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>resolve(null);}catch{resolve(null);}});}
  function dbPut(db,store,value){return new Promise((resolve,reject)=>{try{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error||new Error(`Failed to save ${store}.`));}catch(error){reject(error);}});}
  function dbDelete(db,store,key){return new Promise((resolve,reject)=>{try{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error||new Error(`Failed to delete from ${store}.`));}catch(error){reject(error);}});}

  async function getConfig(app){if(app?._test?.factionRepositories?.config?.get)return app._test.factionRepositories.config.get();return(await dbGet(app._test.state.db,'factionRecruitmentConfig','faction'))||{key:'faction',baseline:{criteria:[]},stageThresholds:{},opportunityWeights:{}};}
  async function saveConfig(app,patch){if(app?._test?.factionRepositories?.config?.save)return app._test.factionRepositories.config.save(patch);const existing=await getConfig(app);const next={...existing,...patch,key:'faction',updatedAt:Date.now()};await dbPut(app._test.state.db,'factionRecruitmentConfig',next);return next;}
  async function getProfiles(app){if(app?._test?.factionRepositories?.profiles?.list)return app._test.factionRepositories.profiles.list();return dbGetAll(app._test.state.db,'factionSpecialistProfiles');}
  async function saveProfile(app,profile){if(app?._test?.factionRepositories?.profiles?.save)return app._test.factionRepositories.profiles.save(profile);const next=FactionCore.normalizeSpecialistProfile({...profile,profileId:text(profile.profileId)||makeId('profile'),updatedAt:Date.now()});await dbPut(app._test.state.db,'factionSpecialistProfiles',next);return next;}
  async function removeProfile(app,profileId){if(app?._test?.factionRepositories?.profiles?.remove)return app._test.factionRepositories.profiles.remove(profileId);return dbDelete(app._test.state.db,'factionSpecialistProfiles',text(profileId));}
  async function getCampaigns(app){if(app?._test?.factionRepositories?.campaigns?.list)return app._test.factionRepositories.campaigns.list();return dbGetAll(app._test.state.db,'factionCampaigns');}
  async function getCampaign(app,campaignId){if(app?._test?.factionRepositories?.campaigns?.get)return app._test.factionRepositories.campaigns.get(campaignId);return dbGet(app._test.state.db,'factionCampaigns',text(campaignId));}
  async function saveCampaign(app,campaign){if(app?._test?.factionRepositories?.campaigns?.save)return app._test.factionRepositories.campaigns.save(campaign);const next={...campaign,campaignId:text(campaign.campaignId)||makeId('faction-campaign'),candidateIds:unique(campaign.candidateIds),updatedAt:Date.now()};await dbPut(app._test.state.db,'factionCampaigns',next);return next;}
  async function removeCampaign(app,campaignId){if(app?._test?.factionRepositories?.campaigns?.remove)return app._test.factionRepositories.campaigns.remove(campaignId);return dbDelete(app._test.state.db,'factionCampaigns',text(campaignId));}
  async function getSessions(app){if(app?._test?.factionRepositories?.sessions?.list)return app._test.factionRepositories.sessions.list();return dbGetAll(app._test.state.db,'factionRecruitmentSessions');}
  async function getSession(app,sessionId){if(app?._test?.factionRepositories?.sessions?.get)return app._test.factionRepositories.sessions.get(sessionId);return dbGet(app._test.state.db,'factionRecruitmentSessions',text(sessionId));}
  async function saveSession(app,session){if(app?._test?.factionRepositories?.sessions?.save)return app._test.factionRepositories.sessions.save(session);const next={...session,sessionId:text(session.sessionId)||makeId('faction-session'),candidateIds:unique(session.candidateIds),updatedAt:Date.now()};await dbPut(app._test.state.db,'factionRecruitmentSessions',next);return next;}

  async function saveFactionPatch(app,userId,patch){
    const id=text(userId);
    if(!/^\d+$/.test(id))throw new Error('A valid Torn player ID is required.');
    if(app?._test?.repositories?.faction?.ensure)return app._test.repositories.faction.ensure(id,patch,{source:'faction-platform',observedAt:Date.now()});
    const existing=await dbGet(app._test.state.db,'factionRecruitment',id);
    if(!existing)throw new Error('Faction candidate was not found.');
    const next={...existing,...patch,userId:id,domain:'faction',updatedAt:Date.now()};
    await dbPut(app._test.state.db,'factionRecruitment',next);
    return next;
  }

  async function ensureFactionCandidate(app,userId){
    const id=text(userId);
    if(!/^\d+$/.test(id)||Number(id)<=0)throw new Error('Enter a valid Torn player ID.');
    const existing=await dbGet(app._test.state.db,'factionRecruitment',id);
    const sources=unique([...(existing?.discoverySources||[]),'FACTION MANUAL']);
    if(app?._test?.repositories?.faction?.ensure)return app._test.repositories.faction.ensure(id,{pipelineStage:existing?.pipelineStage||'Prospect',discoverySources:sources,newlyDiscoveredAt:existing?.newlyDiscoveredAt||Date.now()},{source:'faction-manual',observedAt:Date.now()});
    const next={...(existing||{}),userId:id,domain:'faction',pipelineStage:existing?.pipelineStage||'Prospect',availability:existing?.availability||'Unknown',discoverySources:sources,newlyDiscoveredAt:existing?.newlyDiscoveredAt||Date.now(),createdAt:existing?.createdAt||Date.now(),updatedAt:Date.now()};
    await dbPut(app._test.state.db,'factionRecruitment',next);
    return next;
  }

  async function buildRows(app){
    const db=app._test.state.db;
    const[factionRecords,players,config,profiles]=await Promise.all([dbGetAll(db,'factionRecruitment'),dbGetAll(db,'playerIntelligence'),getConfig(app),getProfiles(app)]);
    return FactionUI.buildCandidateRows(factionRecords,players,{baseline:config.baseline||{},profiles});
  }

  async function buildOpportunityRows(app,rows,now=Date.now()){
    const config=await getConfig(app);
    return OpportunityUI.buildOpportunityRows(rows,{weights:opportunityWeights(config),now});
  }

  async function persistRoute(app,page){
    const state=app?._test?.state;if(!state?.db)return false;
    state.page=page;state.settings=state.settings||{};state.settings.activePage=page;
    const meta=await dbGet(state.db,'meta','global')||{key:'global',settings:{}};
    meta.settings={...(meta.settings||{}),activePage:page};
    await dbPut(state.db,'meta',meta);
    return true;
  }

  function readCriteria(host){
    if(!host)return[];
    return[...host.querySelectorAll('[data-faction-criterion-row]')].map((row,index)=>{
      const get=key=>row.querySelector(`[data-faction-criterion-field="${key}"]`)?.value??'';
      const rawValue=get('value');const numericValue=rawValue!==''&&Number.isFinite(Number(rawValue))?Number(rawValue):rawValue;
      return{id:text(row.dataset.factionCriterionId)||makeId(`criterion-${index+1}`),label:text(get('label')),field:text(get('field')),operator:text(get('operator'))||'gte',kind:text(get('kind'))==='Hard'?'Hard':'Preferred',value:numericValue,weight:Math.max(0,number(get('weight'),1))};
    });
  }

  async function rowFor(userId){const rows=await buildRows(runtime.app);const row=rows.find(item=>text(item.userId)===text(userId));if(!row)throw new Error('Faction candidate was not found.');return row;}
  async function saveOperationalRecord(userId,next){await saveFactionPatch(runtime.app,userId,next);return next;}

  async function changeFactionStage(userId,stage){
    const row=await rowFor(userId);
    const next=Workflow.changeStage(row.factionRecord,text(stage),{baselineHardFailed:row.hardFailed===true,now:Date.now()});
    return saveOperationalRecord(userId,next);
  }
  async function setProfilePin(userId,profileId){await saveFactionPatch(runtime.app,userId,{pinnedSpecialistProfileId:text(profileId),updatedAt:Date.now()});return true;}

  async function addFollowUpFromUi(){
    const userId=text(document.getElementById('ra-faction-followup-player')?.value);const row=await rowFor(userId);
    const dueAt=Date.parse(text(document.getElementById('ra-faction-followup-due')?.value));if(!Number.isFinite(dueAt))throw new Error('Choose a valid follow-up date and time.');
    const unit=text(document.getElementById('ra-faction-followup-recurrence-unit')?.value);const recurrence=unit?{unit,interval:Math.max(1,number(document.getElementById('ra-faction-followup-recurrence-interval')?.value,1))}:null;
    return saveOperationalRecord(userId,Operations.addFollowUp(row.factionRecord,{dueAt,reason:text(document.getElementById('ra-faction-followup-reason')?.value),note:text(document.getElementById('ra-faction-followup-note')?.value),recurrence},Date.now()));
  }
  async function completeFollowUp(userId,followUpId){const row=await rowFor(userId);return saveOperationalRecord(userId,Operations.completeFollowUp(row.factionRecord,followUpId,Date.now()));}
  async function recordOutcomeFromUi(){const userId=text(document.getElementById('ra-faction-outcome-player')?.value);const row=await rowFor(userId);return saveOperationalRecord(userId,Operations.recordContactOutcome(row.factionRecord,{result:text(document.getElementById('ra-faction-outcome-result')?.value),channel:text(document.getElementById('ra-faction-outcome-channel')?.value),note:text(document.getElementById('ra-faction-outcome-note')?.value)},Date.now()));}
  async function toggleDnc(userId,enabled){const row=await rowFor(userId);const reason=text(document.querySelector(`[data-faction-dnc-reason="${userId}"]`)?.value);return saveOperationalRecord(userId,Operations.setDoNotContact(row.factionRecord,enabled,reason,Date.now()));}
  async function addTimelineNoteFromUi(){const userId=text(document.getElementById('ra-faction-timeline-player')?.value);const row=await rowFor(userId);const value=text(document.getElementById('ra-faction-timeline-note')?.value);if(!value)throw new Error('Timeline note cannot be empty.');return saveOperationalRecord(userId,Operations.addTimelineNote(row.factionRecord,{text:value},Date.now()));}
  async function editTimelineNote(userId,noteId){const row=await rowFor(userId);const current=(row.factionRecord.timelineNotes||[]).find(note=>text(note.noteId)===text(noteId));if(!current)throw new Error('Timeline note not found.');const value=globalThis.prompt?.('Edit recruiter note',text(current.text));if(value==null)return false;return saveOperationalRecord(userId,Operations.editTimelineNote(row.factionRecord,noteId,value,Date.now()));}
  async function deleteTimelineNote(userId,noteId){const row=await rowFor(userId);if(globalThis.confirm&&!globalThis.confirm('Delete this recruiter note?'))return false;return saveOperationalRecord(userId,Operations.deleteTimelineNote(row.factionRecord,noteId,Date.now()));}
  async function reactivatePlayer(userId){const row=await rowFor(userId);const reason=text(document.querySelector(`[data-faction-reactivate-reason="${userId}"]`)?.value);return saveOperationalRecord(userId,Workflow.reactivate(row.factionRecord,reason,Date.now()));}

  async function createCampaignFromUi(){return saveCampaign(runtime.app,{campaignId:makeId('faction-campaign'),title:text(document.getElementById('ra-faction-campaign-title')?.value)||'Untitled Campaign',target:text(document.getElementById('ra-faction-campaign-target')?.value),profileId:text(document.getElementById('ra-faction-campaign-profile')?.value),status:text(document.getElementById('ra-faction-campaign-status')?.value)||'Draft',notes:text(document.getElementById('ra-faction-campaign-notes')?.value),candidateIds:[]});}
  async function saveCampaignFromCard(campaignId){const card=document.querySelector(`[data-faction-campaign-card="${campaignId}"]`);const existing=await getCampaign(runtime.app,campaignId);if(!existing||!card)throw new Error('Faction campaign was not found.');const get=field=>card.querySelector(`[data-faction-campaign-field="${field}"]`)?.value??'';return saveCampaign(runtime.app,{...existing,title:text(get('title')),target:text(get('target')),profileId:text(get('profileId')),status:text(get('status'))||'Draft',notes:text(get('notes'))});}
  async function addCampaignMember(campaignId){const campaign=await getCampaign(runtime.app,campaignId);if(!campaign)throw new Error('Faction campaign was not found.');const userId=text(document.querySelector(`[data-faction-campaign-member-select="${campaignId}"]`)?.value);if(!userId)throw new Error('Choose a candidate first.');await saveCampaign(runtime.app,{...campaign,candidateIds:unique([...(campaign.candidateIds||[]),userId])});const row=await rowFor(userId);await saveOperationalRecord(userId,Workflow.addCampaignMembership(row.factionRecord,campaignId,Date.now()));}
  async function removeCampaignMember(campaignId,userId){const campaign=await getCampaign(runtime.app,campaignId);if(!campaign)throw new Error('Faction campaign was not found.');await saveCampaign(runtime.app,{...campaign,candidateIds:(campaign.candidateIds||[]).filter(id=>text(id)!==text(userId))});const row=await rowFor(userId);await saveOperationalRecord(userId,Workflow.removeCampaignMembership(row.factionRecord,campaignId,Date.now()));}

  async function createSessionFromUi(){const rows=await buildRows(runtime.app);const candidateIds=rows.filter(row=>!row.archived&&!terminalStage(row.pipelineStage)).map(row=>row.userId);return saveSession(runtime.app,{sessionId:makeId('faction-session'),title:text(document.getElementById('ra-faction-session-title')?.value)||'Recruitment Session',candidateIds,cursor:0,status:candidateIds.length?'Draft':'Completed',outcomes:[],filters:{source:'active'}});}
  async function runSessionAction(sessionId,userId,action){const session=await getSession(runtime.app,sessionId);if(!session)throw new Error('Faction recruitment session was not found.');const note=text(document.querySelector(`[data-faction-session-note="${sessionId}"]`)?.value);if(action!=='Skip'&&FactionCore.FACTION_STAGES.includes(action))await changeFactionStage(userId,action);const next=Workflow.recordSessionAction(session,{userId,action,note},Date.now());return saveSession(runtime.app,next);}

  async function saveBaselineFromUi(){const host=document.getElementById('ra-faction-baseline-criteria');return saveConfig(runtime.app,{baseline:{criteria:readCriteria(host)}});}
  async function createProfile(){return saveProfile(runtime.app,{profileId:makeId('profile'),name:'New Specialist Profile',status:'Draft',criteria:[],notes:''});}
  async function saveProfileFromCard(profileId){const card=document.querySelector(`[data-faction-profile-card="${profileId}"]`);if(!card)throw new Error('Specialist profile was not found.');const profiles=await getProfiles(runtime.app);const existing=profiles.find(profile=>text(profile.profileId)===text(profileId));if(!existing)throw new Error('Specialist profile was not found.');const criteriaHost=card.querySelector('[data-faction-profile-criteria]');return saveProfile(runtime.app,{...existing,name:text(card.querySelector('[data-faction-profile-field="name"]')?.value),status:text(card.querySelector('[data-faction-profile-field="status"]')?.value)||'Draft',notes:text(card.querySelector('[data-faction-profile-field="notes"]')?.value),criteria:readCriteria(criteriaHost)});}

  function openManualMessage(row,override=false){
    if(row.doNotContact&&!override)throw new Error('This player is marked Do Not Contact. Use the deliberate override control if contact is still required.');
    const url=Messaging.composeUrl(row.userId);if(!url)throw new Error('Could not prepare Torn messaging for this player.');
    globalThis.open?.(url,'_blank','noopener');return true;
  }

  function renderDiscover(rows=[]){
    const manual=rows.filter(row=>(row.factionRecord?.discoverySources||[]).some(source=>text(source).toUpperCase().includes('FACTION')));
    return `<section class="ra-panel"><div class="ra-panel-head"><div><h3>Faction Discover</h3><p>Add a Torn player ID directly to the Faction workflow. This does not create or change a Company recruitment record.</p></div></div><div class="ra-actions"><input id="ra-faction-discover-id" inputmode="numeric" placeholder="Torn player ID"><button class="ra-btn ra-primary" id="ra-faction-discover-add">Add Faction Prospect</button></div></section><section class="ra-panel"><h3>Faction discovery provenance</h3>${manual.map(row=>`<div>${esc(row.name)} <span class="ra-muted">[${esc(row.userId)}] · ${esc((row.factionRecord.discoverySources||[]).join(', '))}</span></div>`).join('')||'<div class="ra-muted">No Faction discovery records yet.</div>'}</section>`;
  }

  function syncActiveNav(page){document.querySelectorAll('#ra-nav [data-page]').forEach(button=>button.classList.toggle('active',button.dataset.page===page));}
  function reportError(error){console.error('[RA v4.7 Faction]',error);try{globalThis.alert?.(`Faction Recruitment failed: ${error?.message||error}`);}catch{}}

  function addCriterionRow(host,scope){if(!host)return;host.insertAdjacentHTML('beforeend',FactionUI.renderCriterionRow({id:makeId('criterion'),field:'level',operator:'gte',kind:'Preferred',weight:1},scope));bindContentControls();}

  function bindContentControls(){
    const page=text(runtime.app?._test?.state?.page);
    document.querySelectorAll('[data-go-page]').forEach(button=>{const route=text(button.dataset.goPage);if(isFactionRoute(route))button.onclick=()=>renderPage(route).catch(reportError);});
    document.querySelectorAll('[data-faction-stage-select]').forEach(select=>select.onchange=async()=>{try{await changeFactionStage(select.dataset.factionStageSelect,select.value);await renderPage(page,{persist:false});}catch(error){reportError(error);await renderPage(page,{persist:false});}});
    document.querySelectorAll('[data-faction-profile-pin]').forEach(select=>select.onchange=async()=>{try{await setProfilePin(select.dataset.factionProfilePin,select.value);await renderPage(page,{persist:false});}catch(error){reportError(error);}});
    document.querySelectorAll('[data-faction-message]').forEach(button=>button.onclick=()=>rowFor(button.dataset.factionMessage).then(row=>openManualMessage(row,false)).catch(reportError));
    document.querySelectorAll('[data-faction-message-override]').forEach(button=>button.onclick=()=>rowFor(button.dataset.factionMessageOverride).then(row=>openManualMessage(row,true)).catch(reportError));

    const discover=document.getElementById('ra-faction-discover-add');if(discover)discover.onclick=async()=>{try{await ensureFactionCandidate(runtime.app,document.getElementById('ra-faction-discover-id')?.value);await renderPage('faction-discover',{persist:false});}catch(error){reportError(error);}};

    const baselineAdd=document.getElementById('ra-faction-baseline-add');if(baselineAdd)baselineAdd.onclick=()=>addCriterionRow(document.getElementById('ra-faction-baseline-criteria'),'baseline');
    const baselineSave=document.getElementById('ra-faction-baseline-save');if(baselineSave)baselineSave.onclick=async()=>{try{await saveBaselineFromUi();await renderPage('faction-requirements',{persist:false});}catch(error){reportError(error);}};
    const profileNew=document.getElementById('ra-faction-profile-new');if(profileNew)profileNew.onclick=async()=>{try{await createProfile();await renderPage('faction-requirements',{persist:false});}catch(error){reportError(error);}};
    document.querySelectorAll('[data-faction-profile-save]').forEach(button=>button.onclick=async()=>{try{await saveProfileFromCard(button.dataset.factionProfileSave);await renderPage('faction-requirements',{persist:false});}catch(error){reportError(error);}});
    document.querySelectorAll('[data-faction-profile-delete]').forEach(button=>button.onclick=async()=>{try{if(globalThis.confirm&&!globalThis.confirm('Delete this specialist profile?'))return;await removeProfile(runtime.app,button.dataset.factionProfileDelete);await renderPage('faction-requirements',{persist:false});}catch(error){reportError(error);}});
    document.querySelectorAll('[data-faction-profile-add-criterion]').forEach(button=>button.onclick=()=>{const card=document.querySelector(`[data-faction-profile-card="${button.dataset.factionProfileAddCriterion}"]`);addCriterionRow(card?.querySelector('[data-faction-profile-criteria]'),`profile:${button.dataset.factionProfileAddCriterion}`);});
    document.querySelectorAll('[data-faction-remove-criterion]').forEach(button=>button.onclick=()=>button.closest('[data-faction-criterion-row]')?.remove());

    const campaignNew=document.getElementById('ra-faction-campaign-new');if(campaignNew)campaignNew.onclick=async()=>{try{await createCampaignFromUi();await renderPage('faction-campaigns',{persist:false});}catch(error){reportError(error);}};
    document.querySelectorAll('[data-faction-campaign-save]').forEach(button=>button.onclick=async()=>{try{await saveCampaignFromCard(button.dataset.factionCampaignSave);await renderPage('faction-campaigns',{persist:false});}catch(error){reportError(error);}});
    document.querySelectorAll('[data-faction-campaign-delete]').forEach(button=>button.onclick=async()=>{try{if(globalThis.confirm&&!globalThis.confirm('Delete this Faction campaign?'))return;await removeCampaign(runtime.app,button.dataset.factionCampaignDelete);await renderPage('faction-campaigns',{persist:false});}catch(error){reportError(error);}});
    document.querySelectorAll('[data-faction-campaign-add-member]').forEach(button=>button.onclick=async()=>{try{await addCampaignMember(button.dataset.factionCampaignAddMember);await renderPage('faction-campaigns',{persist:false});}catch(error){reportError(error);}});
    document.querySelectorAll('[data-faction-campaign-remove-member]').forEach(button=>button.onclick=async()=>{try{await removeCampaignMember(button.dataset.factionCampaignRemoveMember,button.dataset.factionCampaignUser);await renderPage('faction-campaigns',{persist:false});}catch(error){reportError(error);}});

    const followupAdd=document.getElementById('ra-faction-followup-add');if(followupAdd)followupAdd.onclick=async()=>{try{await addFollowUpFromUi();await renderPage('faction-followups',{persist:false});}catch(error){reportError(error);}};
    document.querySelectorAll('[data-faction-followup-complete]').forEach(button=>button.onclick=async()=>{try{await completeFollowUp(button.dataset.factionFollowupUser,button.dataset.factionFollowupComplete);await renderPage('faction-followups',{persist:false});}catch(error){reportError(error);}});

    const noteAdd=document.getElementById('ra-faction-timeline-add');if(noteAdd)noteAdd.onclick=async()=>{try{await addTimelineNoteFromUi();await renderPage('faction-timeline',{persist:false});}catch(error){reportError(error);}};
    document.querySelectorAll('[data-faction-note-edit]').forEach(button=>button.onclick=async()=>{try{await editTimelineNote(button.dataset.factionNoteUser,button.dataset.factionNoteEdit);await renderPage('faction-timeline',{persist:false});}catch(error){reportError(error);}});
    document.querySelectorAll('[data-faction-note-delete]').forEach(button=>button.onclick=async()=>{try{await deleteTimelineNote(button.dataset.factionNoteUser,button.dataset.factionNoteDelete);await renderPage('faction-timeline',{persist:false});}catch(error){reportError(error);}});

    const outcomeAdd=document.getElementById('ra-faction-outcome-add');if(outcomeAdd)outcomeAdd.onclick=async()=>{try{await recordOutcomeFromUi();await renderPage('faction-contact-outcomes',{persist:false});}catch(error){reportError(error);}};
    document.querySelectorAll('[data-faction-dnc-toggle]').forEach(button=>button.onclick=async()=>{try{await toggleDnc(button.dataset.factionDncToggle,button.dataset.factionDncEnabled==='true');await renderPage('faction-contact-outcomes',{persist:false});}catch(error){reportError(error);}});

    const sessionNew=document.getElementById('ra-faction-session-new');if(sessionNew)sessionNew.onclick=async()=>{try{await createSessionFromUi();await renderPage('faction-recruitment-sessions',{persist:false});}catch(error){reportError(error);}};
    document.querySelectorAll('[data-faction-session-action]').forEach(button=>button.onclick=async()=>{try{await runSessionAction(button.dataset.factionSessionAction,button.dataset.factionSessionUser,button.value);await renderPage('faction-recruitment-sessions',{persist:false});}catch(error){reportError(error);}});

    document.querySelectorAll('[data-faction-reactivate-player]').forEach(button=>button.onclick=async()=>{try{await reactivatePlayer(button.dataset.factionReactivatePlayer);await renderPage('faction-reactivation',{persist:false});}catch(error){reportError(error);}});
    document.querySelectorAll('[data-faction-compare-select]').forEach(input=>input.onchange=async()=>{const id=text(input.dataset.factionCompareSelect);if(input.checked){if(runtime.compareSelection.size>=4){input.checked=false;globalThis.alert?.('Faction Compare supports up to four players.');return;}runtime.compareSelection.add(id);}else runtime.compareSelection.delete(id);await renderPage('faction-compare',{persist:false});});
  }

  async function renderPage(page,options={}){
    const app=runtime.app;
    if(!app||!IMPLEMENTED_ROUTES.has(page))return false;
    const title=document.getElementById('ra-page-title'),desc=document.getElementById('ra-page-desc'),content=document.getElementById('ra-content');
    if(!title||!desc||!content)throw new Error('Recruitment Agency shell is not mounted.');
    const meta=routeMeta(page);title.textContent=meta.title;desc.textContent=meta.description;
    const rows=await buildRows(app);
    const[config,profiles,campaigns,sessions]=await Promise.all([getConfig(app),getProfiles(app),getCampaigns(app),getSessions(app)]);

    if(page==='faction-overview')content.innerHTML=FactionUI.renderOverview(FactionUI.buildOverviewModel(rows,profiles));
    else if(page==='faction-today'){
      const opportunities=await buildOpportunityRows(app,rows,Date.now());
      content.innerHTML=FactionUI.renderToday(FactionUI.buildTodayModel(rows,{now:Date.now(),stageThresholds:config.stageThresholds||{},opportunities:Object.fromEntries(opportunities.map(item=>[item.userId,item.opportunity.score]))}));
    }
    else if(page==='faction-discover')content.innerHTML=renderDiscover(rows);
    else if(page==='faction-candidates')content.innerHTML=FactionUI.renderCandidates(rows);
    else if(page==='faction-pipeline')content.innerHTML=FactionUI.renderPipeline(FactionUI.buildPipelineModel(rows));
    else if(page==='faction-requirements')content.innerHTML=FactionUI.renderRequirementsPage({config,profiles});
    else if(page==='faction-campaigns')content.innerHTML=WorkflowUI.renderCampaignsPage({campaigns,rows,profiles});
    else if(page==='faction-followups')content.innerHTML=WorkflowUI.renderFollowUpsPage(rows);
    else if(page==='faction-timeline')content.innerHTML=WorkflowUI.renderTimelinePage(rows);
    else if(page==='faction-stage-aging')content.innerHTML=WorkflowUI.renderStageAgingPage(rows.map(row=>({...row,stageAging:Operations.stageAging(row.factionRecord,config.stageThresholds||{},Date.now())})));
    else if(page==='faction-contact-outcomes')content.innerHTML=WorkflowUI.renderContactOutcomesPage(rows);
    else if(page==='faction-recruitment-sessions')content.innerHTML=WorkflowUI.renderRecruitmentSessionsPage({sessions,rows});
    else if(page==='faction-reactivation')content.innerHTML=WorkflowUI.renderReactivationPage(rows);
    else if(page==='faction-opportunity')content.innerHTML=OpportunityUI.renderOpportunityPage(await buildOpportunityRows(app,rows,Date.now()));
    else if(page==='faction-compare')content.innerHTML=OpportunityUI.renderComparePage(rows,[...runtime.compareSelection]);
    syncActiveNav(page);bindContentControls();if(options.persist!==false)await persistRoute(app,page);return true;
  }

  function bindNav(){
    if(!runtime.app)return;
    document.querySelectorAll('#ra-nav [data-page]').forEach(button=>{
      const page=text(button.dataset.page);if(!IMPLEMENTED_ROUTES.has(page))return;
      if(!runtime.originalHandlers.has(button))runtime.originalHandlers.set(button,button.onclick||null);
      button.onclick=event=>{event?.preventDefault?.();renderPage(page).catch(reportError);};
    });
  }
  function syncNavigation(){bindNav();return true;}
  function install(app,options={}){
    if(!app?._test?.state?.db)throw new Error('A mounted Recruitment Agency app with DB state is required.');
    uninstall();runtime.app=app;runtime.installed=true;bindNav();
    const nav=document.getElementById('ra-nav');if(nav&&typeof MutationObserver==='function'){runtime.observer=new MutationObserver(()=>bindNav());runtime.observer.observe(nav,{childList:true,subtree:true});}
    const page=text(app._test.state.page||app._test.state.settings?.activePage);if(options.renderInitial!==false&&IMPLEMENTED_ROUTES.has(page))renderPage(page,{persist:false}).catch(reportError);
    return true;
  }
  function uninstall(){runtime.observer?.disconnect?.();runtime.observer=null;for(const[button,handler]of runtime.originalHandlers.entries())if(button?.isConnected)button.onclick=handler;runtime.originalHandlers.clear();runtime.compareSelection.clear();runtime.app=null;runtime.installed=false;}

  return Object.freeze({
    FACTION_ROUTES,
    isFactionRoute,
    routeMeta,
    install,
    uninstall,
    renderPage,
    syncNavigation,
    _test:{IMPLEMENTED_ROUTES,buildRows,buildOpportunityRows,persistRoute,dbGetAll,dbGet,dbPut,dbDelete,getConfig,getProfiles,getCampaigns,getSessions,readCriteria,ensureFactionCandidate,changeFactionStage,setProfilePin,opportunityWeights}
  });
});
