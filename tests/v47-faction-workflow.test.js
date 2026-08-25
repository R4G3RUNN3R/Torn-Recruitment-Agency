const test = require('node:test');
const assert = require('node:assert/strict');

let Workflow = null;
try { Workflow = require('../src/v47-faction-workflow.js'); } catch {}

function flow(){
  assert.ok(Workflow, 'Faction workflow module should exist');
  return Workflow;
}

function record(){
  return {
    userId:'123',
    pipelineStage:'Evaluating',
    stageChangedAt:100,
    campaigns:['old'],
    cycles:[{cycleId:'cycle-old',startedAt:10,previousStage:'Prospect'}],
    timelineEvents:[],
    timelineNotes:[],
    followUps:[],
    outcomes:[],
    waivers:[],
    archived:false
  };
}

test('Invite Ready is rejected only when Faction Baseline has an unwaived Hard failure',()=>{
  const W=flow();
  assert.throws(()=>W.changeStage(record(),'Invite Ready',{baselineHardFailed:true,now:1000}),/baseline Hard requirement/i);
  const allowed=W.changeStage(record(),'Invite Ready',{baselineHardFailed:false,now:1000});
  assert.equal(allowed.pipelineStage,'Invite Ready');
});

test('specialist profile ineligibility never blocks Invite Ready',()=>{
  const W=flow();
  const next=W.changeStage(record(),'Invite Ready',{baselineHardFailed:false,specialistEligible:false,now:1000});
  assert.equal(next.pipelineStage,'Invite Ready');
});

test('Faction stage changes reject Company and unknown stages',()=>{
  const W=flow();
  assert.throws(()=>W.changeStage(record(),'Hired',{baselineHardFailed:false,now:1000}),/Faction stage/i);
  assert.throws(()=>W.changeStage(record(),'Shortlisted',{baselineHardFailed:false,now:1000}),/Faction stage/i);
});

test('Faction campaign membership is many-to-many and removal preserves other campaigns',()=>{
  const W=flow();
  const added=W.addCampaignMembership(record(),'new',500);
  assert.deepEqual(added.campaigns,['old','new']);
  const removed=W.removeCampaignMembership(added,'old',600);
  assert.deepEqual(removed.campaigns,['new']);
});

test('reactivation reuses the same Faction record and starts a new Prospect cycle',()=>{
  const W=flow();
  const next=W.reactivate({...record(),pipelineStage:'Rejected',archived:true},'Returned to Torn',2000,'cycle-new');
  assert.equal(next.userId,'123');
  assert.equal(next.pipelineStage,'Prospect');
  assert.equal(next.archived,false);
  assert.equal(next.cycles.length,2);
  assert.deepEqual(next.cycles[1],{cycleId:'cycle-new',startedAt:2000,reason:'Returned to Torn',previousStage:'Rejected'});
});

test('recruitment session advances only after an explicit action on the current candidate',()=>{
  const W=flow();
  const session={sessionId:'s1',candidateIds:['1','2'],cursor:0,status:'Draft',outcomes:[],filters:{}};
  assert.equal(W.currentSessionCandidate(session),'1');
  assert.throws(()=>W.recordSessionAction(session,{userId:'2',action:'Contacted'},500),/current session candidate/i);
  assert.throws(()=>W.recordSessionAction(session,{userId:'1',action:''},500),/explicit session action/i);
  const advanced=W.recordSessionAction(session,{userId:'1',action:'Contacted',note:'Sent message'},500);
  assert.equal(advanced.cursor,1);
  assert.equal(advanced.status,'Active');
  assert.equal(W.currentSessionCandidate(advanced),'2');
  const finished=W.recordSessionAction(advanced,{userId:'2',action:'Deferred'},600);
  assert.equal(finished.status,'Completed');
  assert.equal(finished.cursor,2);
});
