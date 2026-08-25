(function(root,factory){
  let Operations=root&&root.RA_V46CompanyOperations;
  if(!Operations&&typeof module==='object'&&module.exports)Operations=require('./v46-company-operations');
  const api=factory(Operations);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RA_V46CompanyWorkflow=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Operations){
  'use strict';
  if(!Operations)throw new Error('Company Operations is required.');

  const text=value=>String(value??'').trim();
  const number=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};
  const unique=values=>[...new Set((Array.isArray(values)?values:[]).map(text).filter(Boolean))];
  const clone=record=>({...record,campaigns:unique(record?.campaigns),cycles:(record?.cycles||[]).map(item=>({...item})),timelineEvents:(record?.timelineEvents||[]).map(item=>({...item,payload:item?.payload?{...item.payload}:item?.payload})),timelineNotes:(record?.timelineNotes||[]).map(item=>({...item})),followUps:(record?.followUps||[]).map(item=>({...item})),outcomes:(record?.outcomes||[]).map(item=>({...item}))});
  const sessionClone=session=>({...session,candidateIds:unique(session?.candidateIds),outcomes:(session?.outcomes||[]).map(item=>({...item})),filters:{...(session?.filters||{})}});
  const makeId=(prefix,at)=>`${prefix}-${number(at,Date.now())}-${Math.random().toString(36).slice(2,8)}`;

  function addCampaignMembership(record,campaignId,at=Date.now()){
    const id=text(campaignId);if(!id)throw new Error('Campaign ID is required.');
    let next=clone(record||{});next.campaigns=unique([...next.campaigns,id]);next.updatedAt=number(at,Date.now());
    return Operations.addSystemEvent(next,'campaign-membership-added',{campaignId:id},next.updatedAt);
  }

  function removeCampaignMembership(record,campaignId,at=Date.now()){
    const id=text(campaignId);if(!id)throw new Error('Campaign ID is required.');
    let next=clone(record||{});next.campaigns=next.campaigns.filter(value=>value!==id);next.updatedAt=number(at,Date.now());
    return Operations.addSystemEvent(next,'campaign-membership-removed',{campaignId:id},next.updatedAt);
  }

  function setTalentPool(record,enabled,reason='',at=Date.now()){
    let next=clone(record||{});const when=number(at,Date.now());next.talentPool=enabled===true;next.talentPoolReason=next.talentPool?text(reason):'';next.talentPoolChangedAt=when;next.updatedAt=when;
    return Operations.addSystemEvent(next,'talent-pool-changed',{enabled:next.talentPool,reason:next.talentPoolReason},when);
  }

  function reactivate(record,reason='',at=Date.now(),cycleId=''){
    let next=clone(record||{});const when=number(at,Date.now());const previousStage=text(next.pipelineStage)||'Not Contacted';
    next.cycles.push({cycleId:text(cycleId)||makeId('cycle',when),startedAt:when,reason:text(reason),previousStage});
    next.pipelineStage='Not Contacted';next.stageChangedAt=when;next.archived=false;next.updatedAt=when;
    return Operations.addSystemEvent(next,'reactivated',{reason:text(reason),previousStage,cycleId:next.cycles.at(-1).cycleId},when);
  }

  function currentSessionCandidate(session={}){
    const ids=unique(session.candidateIds);const cursor=Math.max(0,Math.floor(number(session.cursor,0)));return ids[cursor]||'';
  }

  function recordSessionAction(session,raw={},at=Date.now()){
    const next=sessionClone(session||{});const when=number(at,Date.now());const current=currentSessionCandidate(next);const userId=text(raw.userId);const action=text(raw.action);
    if(!current)throw new Error('Recruitment session has no current candidate.');
    if(userId!==current)throw new Error('Action must target the current session candidate.');
    if(!action)throw new Error('An explicit session action is required.');
    next.outcomes.push({userId,action,note:text(raw.note),at:when});
    next.cursor=Math.min(next.candidateIds.length,Math.max(0,Math.floor(number(next.cursor,0)))+1);
    next.status=next.cursor>=next.candidateIds.length?'Completed':'Active';
    if(next.status==='Completed')next.completedAt=when;
    if(!next.startedAt)next.startedAt=when;
    next.updatedAt=when;
    return next;
  }

  return Object.freeze({addCampaignMembership,removeCampaignMembership,setTalentPool,reactivate,currentSessionCandidate,recordSessionAction});
});
