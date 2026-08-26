const test = require('node:test');
const assert = require('node:assert/strict');

let Operations = null;
try { Operations = require('../src/v47-faction-operations.js'); } catch {}

function ops(){
  assert.ok(Operations, 'Faction operations module should exist');
  return Operations;
}

function record(){
  return {
    userId:'123',
    pipelineStage:'Evaluating',
    stageChangedAt:100,
    followUps:[],
    outcomes:[],
    timelineEvents:[],
    timelineNotes:[],
    waivers:[],
    campaigns:[],
    cycles:[],
    doNotContact:false
  };
}

test('Faction follow-ups support recurrence without mutating the source record',()=>{
  const O=ops();
  const source=record();
  const added=O.addFollowUp(source,{followUpId:'f1',dueAt:1000,reason:'Check reply',recurrence:{unit:'days',interval:2}},500);
  assert.equal(source.followUps.length,0);
  assert.equal(added.followUps.length,1);
  assert.equal(added.timelineEvents.at(-1).type,'follow-up-added');
  const completed=O.completeFollowUp(added,'f1',600);
  assert.equal(completed.followUps.find(item=>item.followUpId==='f1').state,'completed');
  assert.equal(completed.followUps.length,2);
  assert.equal(completed.followUps[1].dueAt,1000+2*86400000);
});

test('Faction contact outcomes and DNC remain independent from pipeline stage',()=>{
  const O=ops();
  const source=record();
  const withOutcome=O.recordContactOutcome(source,{outcomeId:'o1',result:'Interested',channel:'Mail'},500);
  assert.equal(withOutcome.pipelineStage,'Evaluating');
  assert.equal(withOutcome.outcomes[0].result,'Interested');
  const dnc=O.setDoNotContact(withOutcome,true,'Asked not to be contacted',600);
  assert.equal(dnc.pipelineStage,'Evaluating');
  assert.equal(dnc.doNotContact,true);
  assert.equal(dnc.doNotContactReason,'Asked not to be contacted');
  assert.equal(O.canMessage(dnc),false);
  assert.equal(O.canMessage(dnc,true),true);
});

test('Faction system timeline events are immutable while recruiter notes are editable',()=>{
  const O=ops();
  let source=O.addSystemEvent(record(),'stage-changed',{from:'Prospect',to:'Evaluating'},500,'event-1');
  source=O.addTimelineNote(source,{noteId:'note-1',text:'Promising candidate'},600);
  assert.throws(()=>O.editTimelineNote(source,'event-1','tamper',700),/immutable/i);
  const edited=O.editTimelineNote(source,'note-1','Very promising candidate',700);
  assert.equal(edited.timelineNotes[0].text,'Very promising candidate');
  const removed=O.deleteTimelineNote(edited,'note-1',800);
  assert.equal(removed.timelineNotes.length,0);
  assert.equal(removed.timelineEvents.length,1);
});

test('Faction waivers retain baseline or specialist scope and can be resolved without falsifying history',()=>{
  const O=ops();
  const baseline=O.grantWaiver(record(),{waiverId:'w1',requirementId:'rw',context:'baseline',reason:'Trusted veteran'},500);
  assert.deepEqual(baseline.waivers[0],{
    waiverId:'w1',requirementId:'rw',profileId:'',context:'baseline',reason:'Trusted veteran',state:'Active',grantedAt:500,reviewAt:null,resolvedAt:null,resolvedReason:''
  });
  const specialist=O.grantWaiver(baseline,{waiverId:'w2',requirementId:'attacks',profileId:'chain',context:'specialist',reason:'Manual review',reviewAt:900},600);
  assert.equal(specialist.waivers[1].profileId,'chain');
  assert.equal(specialist.waivers[1].context,'specialist');
  const resolved=O.resolveWaiver(specialist,'w2','Profile changed',1000);
  assert.equal(resolved.waivers[1].state,'Resolved');
  assert.equal(resolved.waivers[1].resolvedAt,1000);
  assert.equal(resolved.waivers[1].resolvedReason,'Profile changed');
  assert.equal(resolved.waivers[0].state,'Active');
});

test('Faction stage aging warns without mutating the source stage',()=>{
  const O=ops();
  const source={...record(),stageChangedAt:0};
  const aging=O.stageAging(source,{Evaluating:3},4*86400000);
  assert.equal(aging.stale,true);
  assert.equal(source.pipelineStage,'Evaluating');
});
