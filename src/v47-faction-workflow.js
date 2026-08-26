(function(root,factory){
  let FactionCore=root&&root.RA_V47FactionCore;
  let Operations=root&&root.RA_V47FactionOperations;
  if(typeof module==='object'&&module.exports){
    if(!FactionCore)FactionCore=require('./v47-faction-core');
    if(!Operations)Operations=require('./v47-faction-operations');
  }
  const api=factory(FactionCore,Operations);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RA_V47FactionWorkflow=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(FactionCore,Operations){
  'use strict';
  if(!FactionCore)throw new Error('FactionCore is required.');
  if(!Operations)throw new Error('Faction Operations is required.');

  const text=value=>String(value??'').trim();
  const number=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};
  const unique=values=>[...new Set((Array.isArray(values)?values:[]).map(text).filter(Boolean))];
  const cloneValue=value=>Array.isArray(value)?value.map(cloneValue):(value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,nested])=>[key,cloneValue(nested)])):value);
  const clone=record=>({
    ...(record||{}),
    campaigns:unique(record?.campaigns),
    cycles:cloneValue(record?.cycles||[]),
    timelineEvents:cloneValue(record?.timelineEvents||[]),
    timelineNotes:cloneValue(record?.timelineNotes||[]),
    followUps:cloneValue(record?.followUps||[]),
    outcomes:cloneValue(record?.outcomes||[]),
    waivers:cloneValue(record?.waivers||[])
  });
  const sessionClone=session=>({...session,candidateIds:unique(session?.candidateIds),outcomes:cloneValue(session?.outcomes||[]),filters:cloneValue(session?.filters||{})});
  const makeId=(prefix,at)=>`${prefix}-${number(at,Date.now())}-${Math.random().toString(36).slice(2,8)}`;

  function assertStage(stage){
    const normalized=text(stage);
    if(!FactionCore.FACTION_STAGES.includes(normalized))throw new Error(`Invalid Faction stage: ${normalized||'(empty)'}.`);
    return normalized;
  }

  function changeStage(record,stage,options={}){
    const after=assertStage(stage);
    if(after==='Invite Ready'&&options.baselineHardFailed===true)throw new Error('Invite Ready is blocked by an unwaived Faction baseline Hard requirement.');
    const before=text(record?.pipelineStage)||'Prospect';
    if(before===after)return clone(record);
    const when=number(options.now,Date.now());
    let next=clone(record);next.pipelineStage=after;next.stageChangedAt=when;next.updatedAt=when;
    return Operations.addSystemEvent(next,'stage-changed',{from:before,to:after},when);
  }

  function addCampaignMembership(record,campaignId,at=Date.now()){
    const id=text(campaignId);if(!id)throw new Error('Campaign ID is required.');
    let next=clone(record);const when=number(at,Date.now());
    next.campaigns=unique([...next.campaigns,id]);next.updatedAt=when;
    return Operations.addSystemEvent(next,'campaign-membership-added',{campaignId:id},when);
  }

  function removeCampaignMembership(record,campaignId,at=Date.now()){
    const id=text(campaignId);if(!id)throw new Error('Campaign ID is required.');
    let next=clone(record);const when=number(at,Date.now());
    next.campaigns=next.campaigns.filter(value=>value!==id);next.updatedAt=when;
    return Operations.addSystemEvent(next,'campaign-membership-removed',{campaignId:id},when);
  }

  function reactivate(record,reason='',at=Date.now(),cycleId=''){
    let next=clone(record);const when=number(at,Date.now());const previousStage=text(next.pipelineStage)||'Prospect';
    next.cycles.push({cycleId:text(cycleId)||makeId('cycle',when),startedAt:when,reason:text(reason),previousStage});
    next.pipelineStage='Prospect';next.stageChangedAt=when;next.archived=false;next.updatedAt=when;
    return Operations.addSystemEvent(next,'reactivated',{reason:text(reason),previousStage,cycleId:next.cycles.at(-1).cycleId},when);
  }

  function currentSessionCandidate(session={}){
    const ids=unique(session.candidateIds);const cursor=Math.max(0,Math.floor(number(session.cursor,0)));return ids[cursor]||'';
  }

  function recordSessionAction(session,raw={},at=Date.now()){
    const next=sessionClone(session);const when=number(at,Date.now());const current=currentSessionCandidate(next);const userId=text(raw.userId);const action=text(raw.action);
    if(!current)throw new Error('Recruitment session has no current candidate.');
    if(userId!==current)throw new Error('Action must target the current session candidate.');
    if(!action)throw new Error('An explicit session action is required.');
    next.outcomes.push({userId,action,note:text(raw.note),at:when});
    next.cursor=Math.min(next.candidateIds.length,Math.max(0,Math.floor(number(next.cursor,0)))+1);
    next.status=next.cursor>=next.candidateIds.length?'Completed':'Active';
    if(!next.startedAt)next.startedAt=when;
    if(next.status==='Completed')next.completedAt=when;
    next.updatedAt=when;
    return next;
  }

  return Object.freeze({
    changeStage,
    addCampaignMembership,
    removeCampaignMembership,
    reactivate,
    currentSessionCandidate,
    recordSessionAction,
    advanceSession:recordSessionAction
  });
});
