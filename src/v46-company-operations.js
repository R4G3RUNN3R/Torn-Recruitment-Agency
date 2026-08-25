(function(root,factory){
  let CompanyCore=root&&root.RA_V46CompanyCore;
  if(!CompanyCore&&typeof module==='object'&&module.exports)CompanyCore=require('./v46-company-core');
  const api=factory(CompanyCore);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RA_V46CompanyOperations=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(CompanyCore){
  'use strict';
  if(!CompanyCore)throw new Error('CompanyCore is required.');

  const UNIT_MS=Object.freeze({hours:3600000,days:86400000,weeks:604800000});
  const text=value=>String(value??'').trim();
  const number=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};
  const cloneRecord=record=>({...record,followUps:(record.followUps||[]).map(x=>({...x,recurrence:x.recurrence?{...x.recurrence}:null})),outcomes:(record.outcomes||[]).map(x=>({...x})),timelineEvents:(record.timelineEvents||[]).map(x=>({...x,payload:x.payload?{...x.payload}:x.payload})),timelineNotes:(record.timelineNotes||[]).map(x=>({...x}))});
  const makeId=(prefix,at)=>`${prefix}-${number(at,Date.now())}-${Math.random().toString(36).slice(2,8)}`;

  function normalizeRecurrence(raw){
    if(!raw)return null;
    const unit=Object.hasOwn(UNIT_MS,text(raw.unit).toLowerCase())?text(raw.unit).toLowerCase():'days';
    const interval=Math.max(1,Math.floor(number(raw.interval,1)));
    return{unit,interval};
  }

  function addSystemEvent(record,type,payload={},at=Date.now(),eventId=''){
    const next=cloneRecord(record||{});const when=number(at,Date.now());
    next.timelineEvents.push({eventId:text(eventId)||makeId('event',when),type:text(type)||'event',at:when,payload:{...(payload||{})}});
    next.updatedAt=when;return next;
  }

  function addFollowUp(record,raw={},at=Date.now()){
    const next=cloneRecord(record||{});const when=number(at,Date.now());
    const followUp={followUpId:text(raw.followUpId)||makeId('followup',when),dueAt:number(raw.dueAt,when),reason:text(raw.reason),note:text(raw.note),state:text(raw.state)||'open',recurrence:normalizeRecurrence(raw.recurrence),createdAt:raw.createdAt??when,updatedAt:when};
    next.followUps.push(followUp);next.updatedAt=when;
    return addSystemEvent(next,'follow-up-added',{followUpId:followUp.followUpId,dueAt:followUp.dueAt,reason:followUp.reason},when);
  }

  function completeFollowUp(record,followUpId,at=Date.now()){
    const next=cloneRecord(record||{});const id=text(followUpId);const when=number(at,Date.now());const index=next.followUps.findIndex(x=>text(x.followUpId)===id);if(index<0)throw new Error('Follow-up not found.');
    const current={...next.followUps[index],state:'completed',completedAt:when,updatedAt:when};next.followUps[index]=current;
    if(current.recurrence){const step=UNIT_MS[current.recurrence.unit]*current.recurrence.interval;next.followUps.push({...current,followUpId:makeId('followup',when),parentFollowUpId:id,dueAt:number(current.dueAt,when)+step,state:'open',completedAt:null,createdAt:when,updatedAt:when});}
    next.updatedAt=when;return addSystemEvent(next,'follow-up-completed',{followUpId:id},when);
  }

  function recordContactOutcome(record,raw={},at=Date.now()){
    const next=cloneRecord(record||{});const when=number(at,Date.now());const outcome={outcomeId:text(raw.outcomeId)||makeId('outcome',when),result:text(raw.result)||'Other',channel:text(raw.channel)||'Other',note:text(raw.note),at:raw.at??when};next.outcomes.push(outcome);next.updatedAt=when;
    return addSystemEvent(next,'contact-outcome',{outcomeId:outcome.outcomeId,result:outcome.result,channel:outcome.channel},when);
  }

  function setDoNotContact(record,enabled,reason='',at=Date.now()){
    const next=cloneRecord(record||{});const when=number(at,Date.now());next.doNotContact=enabled===true;next.doNotContactReason=next.doNotContact?text(reason):'';next.doNotContactChangedAt=when;next.updatedAt=when;
    return addSystemEvent(next,'dnc-changed',{enabled:next.doNotContact,reason:next.doNotContactReason},when);
  }

  function canMessage(record,override=false){return !(record?.doNotContact===true&&override!==true);}
  function stageAging(record,thresholds={},now=Date.now()){return CompanyCore.stageAgeStatus(record,thresholds,now);}

  function addTimelineNote(record,raw={},at=Date.now()){
    const next=cloneRecord(record||{});const when=number(at,Date.now());next.timelineNotes.push({noteId:text(raw.noteId)||makeId('note',when),text:text(raw.text),at:raw.at??when,updatedAt:when});next.updatedAt=when;return next;
  }
  function editTimelineNote(record,noteId,value,at=Date.now()){
    const next=cloneRecord(record||{});const id=text(noteId);if(next.timelineEvents.some(event=>text(event.eventId)===id))throw new Error('System timeline events are immutable.');const index=next.timelineNotes.findIndex(note=>text(note.noteId)===id);if(index<0)throw new Error('Timeline note not found.');const when=number(at,Date.now());next.timelineNotes[index]={...next.timelineNotes[index],text:text(value),updatedAt:when};next.updatedAt=when;return next;
  }
  function deleteTimelineNote(record,noteId,at=Date.now()){
    const next=cloneRecord(record||{});const id=text(noteId);if(next.timelineEvents.some(event=>text(event.eventId)===id))throw new Error('System timeline events are immutable.');const before=next.timelineNotes.length;next.timelineNotes=next.timelineNotes.filter(note=>text(note.noteId)!==id);if(next.timelineNotes.length===before)throw new Error('Timeline note not found.');next.updatedAt=number(at,Date.now());return next;
  }

  function combinedTimeline(record={}){
    const system=(record.timelineEvents||[]).map(event=>({...event,entryType:'system',at:number(event.at,0)}));const notes=(record.timelineNotes||[]).map(note=>({...note,entryType:'recruiter-note',at:number(note.at,0)}));return[...system,...notes].sort((a,b)=>b.at-a.at||text(a.eventId||a.noteId).localeCompare(text(b.eventId||b.noteId)));
  }

  function changeStage(record,stage,at=Date.now()){
    const before=text(record?.pipelineStage)||'Not Contacted';const after=text(stage)||before;if(before===after)return cloneRecord(record||{});const when=number(at,Date.now());let next=cloneRecord(record||{});next.pipelineStage=after;next.stageChangedAt=when;next.updatedAt=when;next=addSystemEvent(next,'stage-changed',{from:before,to:after},when);return next;
  }

  return Object.freeze({normalizeRecurrence,addSystemEvent,addFollowUp,completeFollowUp,recordContactOutcome,setDoNotContact,canMessage,stageAging,addTimelineNote,editTimelineNote,deleteTimelineNote,combinedTimeline,changeStage});
});
