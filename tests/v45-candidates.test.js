const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/v45-candidates');

test('candidate view composes local recruiter fields ahead of parsed/source values', () => {
  const view = C.composeCandidateView({
    candidate:{userId:123,name:'Alice',pipelineStage:'Replied',availability:'Unavailable',desiredCompany:'Oil Rig',desiredRole:'Sales',expectedSalary:5000000,recruiterNote:'Strong'},
    source:{sourceId:'JOB:1',sourceType:'JOB SEEKER',forumUrl:'https://www.torn.com/forums.php?t=1',parsed:{desiredCompany:'Adult Novelties',desiredRole:'Manager',availability:'Available'}},
    result:{matchScore:91,fit:82,currentCompany:'Pub',stats:{man:10,int:20,end:30},ee:9}
  });
  assert.equal(view.pipelineStage,'Replied');
  assert.equal(view.availability,'Unavailable');
  assert.equal(view.desiredCompany,'Oil Rig');
  assert.equal(view.desiredRole,'Sales');
  assert.equal(view.expectedSalary,5000000);
  assert.equal(view.recruiterNote,'Strong');
  assert.equal(view.matchScore,91);
  assert.equal(view.fitScore,82);
});

test('context menu has the exact approved top-level actions and six stage choices', () => {
  const menu = C.contextMenuModel({pipelineStage:'Shortlisted',availability:'Available',forumUrl:'https://www.torn.com/forums.php?t=1'});
  assert.deepEqual(menu.map(item => item.separator ? '---' : item.label), [
    'Message Player','View Details','Open Torn Profile','Open Latest Forum Post','---','Move to Stage','Availability','---','Scout Player','Edit Candidate','Delete Candidate'
  ]);
  const stage = menu.find(item => item.id === 'stage');
  assert.deepEqual(stage.children.map(item => item.label), ['Not Contacted','Shortlisted','Contacted','Replied','Hired','Rejected']);
  assert.equal(stage.children.find(item => item.label === 'Shortlisted').checked,true);
});

test('pipeline buckets use the exact six stages with no hidden seventh bucket', () => {
  const buckets = C.pipelineBuckets([
    {userId:1,pipelineStage:'Not Contacted'},
    {userId:2,pipelineStage:'Hired'},
    {userId:3,pipelineStage:'something weird'}
  ]);
  assert.deepEqual(Object.keys(buckets), ['Not Contacted','Shortlisted','Contacted','Replied','Hired','Rejected']);
  assert.deepEqual(buckets['Not Contacted'].map(x=>x.userId),[1,3]);
  assert.deepEqual(buckets.Hired.map(x=>x.userId),[2]);
});

test('stage and availability changes are explicit local transformations', () => {
  const original={userId:1,pipelineStage:'Not Contacted',availability:'Unknown'};
  const stage=C.changeStage(original,'Contacted');
  const availability=C.changeAvailability(original,'Available');
  assert.equal(original.pipelineStage,'Not Contacted');
  assert.equal(stage.pipelineStage,'Contacted');
  assert.equal(availability.availability,'Available');
});

test('message values expose only approved initial placeholders', () => {
  const values=C.messageValues({name:'Alice',userId:'123',lookingFor:'10* AN',currentCompany:'Pub',matchScore:92,fitScore:81},'Bad Decisions');
  assert.deepEqual(values,{
    name:'Alice',player_id:'123',looking_for:'10* AN',company_name:'Bad Decisions',current_company:'Pub',match_score:'92',fit_score:'81'
  });
});

test('Torn profile and compose URLs are pre-addressed without sending anything', () => {
  assert.equal(C.tornProfileUrl(123),'https://www.torn.com/profiles.php?XID=123');
  assert.equal(C.tornMessageUrl(123),'https://www.torn.com/messages.php#/p=compose&XID=123');
  assert.equal(C.tornMessageUrl('nope'),'');
});
