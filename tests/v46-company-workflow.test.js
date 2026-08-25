const test=require('node:test');
const assert=require('node:assert/strict');
const Workflow=require('../src/v46-company-workflow');

const candidate=()=>({userId:'101',pipelineStage:'Rejected',campaigns:['c1'],talentPool:false,cycles:[],timelineEvents:[],timelineNotes:[],followUps:[],outcomes:[],doNotContact:false});

test('campaign membership is many-to-many and adding another campaign preserves existing membership',()=>{
  const a=Workflow.addCampaignMembership(candidate(),'c2',1000);
  assert.deepEqual(a.campaigns,['c1','c2']);
  const b=Workflow.removeCampaignMembership(a,'c1',1100);
  assert.deepEqual(b.campaigns,['c2']);
});

test('Talent Pool is explicit Company workflow state with a recruiter reason',()=>{
  const pooled=Workflow.setTalentPool(candidate(),true,'Strong future trainer',1200);
  assert.equal(pooled.talentPool,true);
  assert.equal(pooled.talentPoolReason,'Strong future trainer');
  const removed=Workflow.setTalentPool(pooled,false,'',1300);
  assert.equal(removed.talentPool,false);
});

test('reactivation keeps one player identity, starts a new Company cycle and resets only Company recruitment stage',()=>{
  const source={...candidate(),userId:'101',pipelineStage:'Rejected',archived:true};
  const next=Workflow.reactivate(source,'New vacancy opened',2000,'cycle-2');
  assert.equal(next.userId,'101');
  assert.equal(next.pipelineStage,'Not Contacted');
  assert.equal(next.archived,false);
  assert.equal(next.cycles.length,1);
  assert.equal(next.cycles[0].cycleId,'cycle-2');
  assert.equal(next.cycles[0].previousStage,'Rejected');
  assert.ok(next.timelineEvents.some(event=>event.type==='reactivated'));
});

test('recruitment session current candidate is read-only until an explicit action advances it',()=>{
  const session={sessionId:'s1',candidateIds:['101','202'],cursor:0,status:'Active',outcomes:[]};
  assert.equal(Workflow.currentSessionCandidate(session),'101');
  assert.equal(session.cursor,0);
  const next=Workflow.recordSessionAction(session,{userId:'101',action:'Contacted',note:'Messaged'},3000);
  assert.equal(next.cursor,1);
  assert.equal(Workflow.currentSessionCandidate(next),'202');
  assert.equal(next.outcomes.length,1);
  const done=Workflow.recordSessionAction(next,{userId:'202',action:'Skip'},3100);
  assert.equal(done.status,'Completed');
  assert.equal(done.cursor,2);
});

test('session action cannot skip ahead or advance without an explicit action label',()=>{
  const session={sessionId:'s1',candidateIds:['101','202'],cursor:0,status:'Active',outcomes:[]};
  assert.throws(()=>Workflow.recordSessionAction(session,{userId:'202',action:'Skip'},3000),/current session candidate/i);
  assert.throws(()=>Workflow.recordSessionAction(session,{userId:'101',action:''},3000),/explicit session action/i);
});
