const test=require('node:test');
const assert=require('node:assert/strict');
const Ops=require('../src/v46-company-operations');

function base(){return{userId:'101',pipelineStage:'Contacted',followUps:[],outcomes:[],doNotContact:false,timelineEvents:[],timelineNotes:[],updatedAt:1000};}

test('follow-ups support due time reason note and recurrence without mutating the source record',()=>{
  const original=base();
  const next=Ops.addFollowUp(original,{followUpId:'f1',dueAt:2000,reason:'Check availability',note:'After reset',recurrence:{unit:'days',interval:2}},1100);
  assert.equal(original.followUps.length,0);
  assert.equal(next.followUps.length,1);
  assert.equal(next.followUps[0].reason,'Check availability');
  assert.deepEqual(next.followUps[0].recurrence,{unit:'days',interval:2});
  const completed=Ops.completeFollowUp(next,'f1',2100);
  assert.equal(completed.followUps.find(x=>x.followUpId==='f1').state,'completed');
  const recurring=completed.followUps.find(x=>x.parentFollowUpId==='f1');
  assert.ok(recurring,'recurring completion should create the next occurrence');
  assert.equal(recurring.dueAt,2000+2*86400000);
});

test('contact outcome is independent from pipeline stage and creates a system timeline event',()=>{
  const next=Ops.recordContactOutcome(base(),{outcomeId:'o1',result:'Interested',channel:'Torn message',note:'Asked about salary'},1200);
  assert.equal(next.pipelineStage,'Contacted');
  assert.equal(next.outcomes.length,1);
  assert.equal(next.outcomes[0].result,'Interested');
  assert.ok(next.timelineEvents.some(event=>event.type==='contact-outcome'));
});

test('Do Not Contact blocks normal messaging but explicit override remains deliberate and local',()=>{
  const dnc=Ops.setDoNotContact(base(),true,'Requested no further messages',1300);
  assert.equal(dnc.doNotContact,true);
  assert.equal(Ops.canMessage(dnc,false),false);
  assert.equal(Ops.canMessage(dnc,true),true);
  assert.ok(dnc.timelineEvents.some(event=>event.type==='dnc-changed'));
});

test('stage aging reports warnings without moving the candidate',()=>{
  const row={...base(),pipelineStage:'Contacted',stageChangedAt:0};
  const result=Ops.stageAging(row,{Contacted:3},5*86400000);
  assert.equal(result.stale,true);
  assert.equal(row.pipelineStage,'Contacted');
});

test('system timeline events are immutable while recruiter notes can be edited and deleted',()=>{
  const withSystem=Ops.addSystemEvent(base(),'stage-changed',{from:'Not Contacted',to:'Contacted'},1400,'sys-1');
  const withNote=Ops.addTimelineNote(withSystem,{noteId:'n1',text:'Promising candidate'},1500);
  const edited=Ops.editTimelineNote(withNote,'n1','Very promising candidate',1600);
  assert.equal(edited.timelineNotes[0].text,'Very promising candidate');
  assert.deepEqual(edited.timelineEvents,withSystem.timelineEvents,'editing recruiter notes must not rewrite system events');
  assert.throws(()=>Ops.editTimelineNote(edited,'sys-1','tamper',1700),/system timeline events are immutable/i);
  const removed=Ops.deleteTimelineNote(edited,'n1',1800);
  assert.equal(removed.timelineNotes.length,0);
  assert.deepEqual(removed.timelineEvents,withSystem.timelineEvents);
});

test('combined timeline is newest-first and labels system versus recruiter entries',()=>{
  let row=Ops.addSystemEvent(base(),'created',{},1000,'s1');
  row=Ops.addTimelineNote(row,{noteId:'n1',text:'hello'},2000);
  const items=Ops.combinedTimeline(row);
  assert.deepEqual(items.map(item=>item.entryType),['recruiter-note','system']);
  assert.deepEqual(items.map(item=>item.at),[2000,1000]);
});
