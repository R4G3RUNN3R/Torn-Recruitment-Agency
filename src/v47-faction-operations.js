(function(root,factory){
  let FactionCore=root&&root.RA_V47FactionCore;
  if(!FactionCore&&typeof module==='object'&&module.exports)FactionCore=require('./v47-faction-core');
  const api=factory(FactionCore);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RA_V47FactionOperations=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(FactionCore){
  'use strict';
  if(!FactionCore)throw new Error('FactionCore is required.');

  const UNIT_MS=Object.freeze({hours:3600000,days:86400000,weeks:604800000});
  const text=value=>String(value??'').trim();
  const number=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};
  const makeId=(prefix,at)=>`${prefix}-${number(at,Date.now())}-${Math.random().toString(36).slice(2,8)}`;
  const cloneValue=value=>Array.isArray(value)?value.map(cloneValue):(value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,nested])=>[key,cloneValue(nested)])):value);
  const cloneRecord=record=>({
    ...(record||{}),
    followUps:cloneValue(record?.followUps||[]),
    outcomes:cloneValue(record?.outcomes||[]),
    timelineEvents:cloneValue(record?.timelineEvents||[]),
    timelineNotes:cloneValue(record?.timelineNotes||[]),
    waivers:cloneValue(record?.waivers||[]),
    campaigns:[...(record?.campaigns||[])],
    cycles:cloneValue(record?.cycles||[])
  });

  function normalizeRecurrence(raw){
    if(!raw)return null;
    const requested=text(raw.unit).toLowerCase();
    const unit=Object.hasOwn(UNIT_MS,requested)?requested:'days';
    return {unit,interval:Math.max(1,Math.floor(number(raw.interval,1)))};
  }

  function addSystemEvent(record,type,payload={},at=Date.now(),eventId=''){
    const next=cloneRecord(record);const when=number(at,Date.now());
    next.timelineEvents.push({eventId:text(eventId)||makeId('event',when),type:text(type)||'event',at:when,payload:cloneValue(payload||{})});
    next.updatedAt=when;
    return next;
  }

  function addFollowUp(record,raw={},at=Date.now()){
    const next=cloneRecord(record);const when=number(at,Date.now());
    const followUp={
      followUpId:text(raw.followUpId)||makeId('followup',when),
      dueAt:number(raw.dueAt,when),
      reason:text(raw.reason),
      note:text(raw.note),
      state:text(raw.state)||'open',
      recurrence:normalizeRecurrence(raw.recurrence),
      createdAt:raw.createdAt??when,
      completedAt:raw.completedAt??null,
      updatedAt:when
    };
    next.followUps.push(followUp);next.updatedAt=when;
    return addSystemEvent(next,'follow-up-added',{followUpId:followUp.followUpId,dueAt:followUp.dueAt,reason:followUp.reason},when);
  }

  function completeFollowUp(record,followUpId,at=Date.now()){
    const next=cloneRecord(record);const id=text(followUpId);const when=number(at,Date.now());
    const index=next.followUps.findIndex(item=>text(item.followUpId)===id);
    if(index<0)throw new Error('Follow-up not found.');
    const current={...next.followUps[index],state:'completed',completedAt:when,updatedAt:when};
    next.followUps[index]=current;
    if(current.recurrence){
      const recurrence=normalizeRecurrence(current.recurrence);
      const step=UNIT_MS[recurrence.unit]*recurrence.interval;
      next.followUps.push({
        ...current,
        recurrence,
        followUpId:makeId('followup',when),
        parentFollowUpId:id,
        dueAt:number(current.dueAt,when)+step,
        state:'open',
        completedAt:null,
        createdAt:when,
        updatedAt:when
      });
    }
    next.updatedAt=when;
    return addSystemEvent(next,'follow-up-completed',{followUpId:id},when);
  }

  function recordContactOutcome(record,raw={},at=Date.now()){
    const next=cloneRecord(record);const when=number(at,Date.now());
    const outcome={outcomeId:text(raw.outcomeId)||makeId('outcome',when),result:text(raw.result)||'Other',channel:text(raw.channel)||'Other',note:text(raw.note),at:raw.at??when};
    next.outcomes.push(outcome);next.updatedAt=when;
    return addSystemEvent(next,'contact-outcome',{outcomeId:outcome.outcomeId,result:outcome.result,channel:outcome.channel},when);
  }

  function setDoNotContact(record,enabled,reason='',at=Date.now()){
    const next=cloneRecord(record);const when=number(at,Date.now());
    next.doNotContact=enabled===true;
    next.doNotContactReason=next.doNotContact?text(reason):'';
    next.doNotContactChangedAt=when;
    next.updatedAt=when;
    return addSystemEvent(next,'dnc-changed',{enabled:next.doNotContact,reason:next.doNotContactReason},when);
  }

  function canMessage(record,explicitOverride=false){return !(record?.doNotContact===true&&explicitOverride!==true);}
  function stageAging(record,thresholds={},now=Date.now()){return FactionCore.stageAgeStatus(record,thresholds,now);}

  function addTimelineNote(record,raw={},at=Date.now()){
    const next=cloneRecord(record);const when=number(at,Date.now());
    next.timelineNotes.push({noteId:text(raw.noteId)||makeId('note',when),text:text(raw.text),at:raw.at??when,updatedAt:when});
    next.updatedAt=when;
    return next;
  }

  function editTimelineNote(record,noteId,value,at=Date.now()){
    const next=cloneRecord(record);const id=text(noteId);
    if(next.timelineEvents.some(event=>text(event.eventId)===id))throw new Error('System timeline events are immutable.');
    const index=next.timelineNotes.findIndex(note=>text(note.noteId)===id);
    if(index<0)throw new Error('Timeline note not found.');
    const when=number(at,Date.now());
    next.timelineNotes[index]={...next.timelineNotes[index],text:text(value),updatedAt:when};next.updatedAt=when;
    return next;
  }

  function deleteTimelineNote(record,noteId,at=Date.now()){
    const next=cloneRecord(record);const id=text(noteId);
    if(next.timelineEvents.some(event=>text(event.eventId)===id))throw new Error('System timeline events are immutable.');
    const before=next.timelineNotes.length;
    next.timelineNotes=next.timelineNotes.filter(note=>text(note.noteId)!==id);
    if(next.timelineNotes.length===before)throw new Error('Timeline note not found.');
    next.updatedAt=number(at,Date.now());
    return next;
  }

  function combinedTimeline(record={}){
    const system=(record.timelineEvents||[]).map(event=>({...cloneValue(event),entryType:'system',at:number(event.at,0)}));
    const notes=(record.timelineNotes||[]).map(note=>({...cloneValue(note),entryType:'recruiter-note',at:number(note.at,0)}));
    return [...system,...notes].sort((a,b)=>b.at-a.at||text(a.eventId||a.noteId).localeCompare(text(b.eventId||b.noteId)));
  }

  function grantWaiver(record,raw={},at=Date.now()){
    const next=cloneRecord(record);const when=number(at,Date.now());
    const requirementId=text(raw.requirementId);
    if(!requirementId)throw new Error('Requirement ID is required.');
    const context=text(raw.context).toLowerCase()==='specialist'?'specialist':'baseline';
    const profileId=context==='specialist'?text(raw.profileId):'';
    if(context==='specialist'&&!profileId)throw new Error('Specialist waiver requires a profile ID.');
    const waiver={
      waiverId:text(raw.waiverId)||makeId('waiver',when),
      requirementId,
      profileId,
      context,
      reason:text(raw.reason),
      state:'Active',
      grantedAt:when,
      reviewAt:raw.reviewAt==null?null:number(raw.reviewAt,null),
      resolvedAt:null,
      resolvedReason:''
    };
    next.waivers.push(waiver);next.updatedAt=when;
    return addSystemEvent(next,'waiver-granted',{waiverId:waiver.waiverId,requirementId,profileId,context},when);
  }

  function resolveWaiver(record,waiverId,reason='',at=Date.now()){
    const next=cloneRecord(record);const id=text(waiverId);const when=number(at,Date.now());
    const index=next.waivers.findIndex(waiver=>text(waiver.waiverId)===id);
    if(index<0)throw new Error('Waiver not found.');
    next.waivers[index]={...next.waivers[index],state:'Resolved',resolvedAt:when,resolvedReason:text(reason)};
    next.updatedAt=when;
    return addSystemEvent(next,'waiver-resolved',{waiverId:id,reason:text(reason)},when);
  }

  return Object.freeze({
    normalizeRecurrence,
    addSystemEvent,
    addFollowUp,
    completeFollowUp,
    recordContactOutcome,
    setDoNotContact,
    canMessage,
    stageAging,
    addTimelineNote,
    editTimelineNote,
    deleteTimelineNote,
    combinedTimeline,
    grantWaiver,
    resolveWaiver
  });
});
