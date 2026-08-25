const test=require('node:test');
const assert=require('node:assert/strict');

let WorkflowUI=null;
try{WorkflowUI=require('../src/v47-faction-workflow-ui');}catch{}
function ui(){assert.ok(WorkflowUI,'Faction workflow UI module should exist');return WorkflowUI;}

const rows=[
  {userId:'101',name:'Alpha',pipelineStage:'Rejected',archived:true,campaigns:['c1'],followUps:[{followUpId:'f1',dueAt:1000,state:'open',reason:'Check back'}],outcomes:[{outcomeId:'o1',result:'Interested',channel:'Mail',at:500}],doNotContact:false,factionRecord:{userId:'101',pipelineStage:'Rejected',archived:true,campaigns:['c1'],cycles:[],timelineEvents:[{eventId:'e1',type:'stage-changed',at:500,payload:{from:'Evaluating',to:'Rejected'}}],timelineNotes:[{noteId:'n1',text:'Strong RW candidate',at:600}],followUps:[{followUpId:'f1',dueAt:1000,state:'open',reason:'Check back'}],outcomes:[{outcomeId:'o1',result:'Interested',channel:'Mail',at:500}]}},
  {userId:'202',name:'Beta',pipelineStage:'Evaluating',archived:false,campaigns:[],followUps:[],outcomes:[],doNotContact:true,factionRecord:{userId:'202',pipelineStage:'Evaluating',archived:false,campaigns:[],cycles:[],timelineEvents:[],timelineNotes:[],followUps:[],outcomes:[],doNotContact:true,doNotContactReason:'Asked us to stop'}}
];
const campaigns=[{campaignId:'c1',title:'RW Push',target:'RW fighters',profileId:'rw',candidateIds:['101'],status:'Active',notes:'August'}];
const sessions=[{sessionId:'s1',title:'Evening review',candidateIds:['101','202'],cursor:0,status:'Active',outcomes:[]}];
const profiles=[{profileId:'rw',name:'RW Fighter',status:'Active'}];

test('Faction Campaigns page uses specialist profiles and supports many-to-many membership',()=>{
  const html=ui().renderCampaignsPage({campaigns,rows,profiles});
  assert.match(html,/id="ra-faction-campaign-new"/);
  assert.match(html,/RW Push/);
  assert.match(html,/RW Fighter/);
  assert.match(html,/data-faction-campaign-add-member="c1"/);
  assert.match(html,/data-faction-campaign-remove-member="c1"/);
  assert.doesNotMatch(html,/Vacancy/);
});

test('Faction Follow-ups page exposes add complete reason note and recurrence controls',()=>{
  const html=ui().renderFollowUpsPage(rows);
  assert.match(html,/id="ra-faction-followup-player"/);
  assert.match(html,/id="ra-faction-followup-due"/);
  assert.match(html,/id="ra-faction-followup-reason"/);
  assert.match(html,/id="ra-faction-followup-note"/);
  assert.match(html,/id="ra-faction-followup-recurrence-unit"/);
  assert.match(html,/data-faction-followup-complete="f1"/);
  assert.match(html,/Check back/);
});

test('Faction Timeline separates immutable system history from editable recruiter notes',()=>{
  const html=ui().renderTimelinePage(rows);
  assert.match(html,/System event/);
  assert.match(html,/stage-changed/);
  assert.match(html,/Recruiter note/);
  assert.match(html,/Strong RW candidate/);
  assert.match(html,/data-faction-note-edit="n1"/);
  assert.match(html,/data-faction-note-delete="n1"/);
  assert.doesNotMatch(html,/data-faction-note-edit="e1"/);
});

test('Faction Contact Outcomes keeps DNC separate from stage and exposes deliberate override wording',()=>{
  const html=ui().renderContactOutcomesPage(rows);
  assert.match(html,/Contact Outcomes/);
  assert.match(html,/Interested/);
  assert.match(html,/Do Not Contact/);
  assert.match(html,/Asked us to stop/);
  assert.match(html,/data-faction-dnc-toggle="202"/);
  assert.match(html,/Override/);
});

test('Faction Stage Aging is warning-only with no automatic stage-change controls',()=>{
  const html=ui().renderStageAgingPage([{...rows[1],stageAging:{daysInStage:9,thresholdDays:7,stale:true}}]);
  assert.match(html,/9 days/);
  assert.match(html,/stale/i);
  assert.doesNotMatch(html,/data-faction-stage-select/);
  assert.doesNotMatch(html,/auto.*move/i);
});

test('Faction Reactivation offers terminal or archived candidates and preserves identity',()=>{
  const html=ui().renderReactivationPage(rows);
  assert.match(html,/data-faction-reactivate-player="101"/);
  assert.match(html,/data-faction-reactivate-reason="101"/);
  assert.doesNotMatch(html,/data-faction-reactivate-player="202"/);
});

test('Faction Recruitment Sessions shows exactly the current candidate and explicit Faction actions',()=>{
  const html=ui().renderRecruitmentSessionsPage({sessions,rows});
  assert.match(html,/Evening review/);
  assert.match(html,/Current candidate/);
  assert.match(html,/Alpha/);
  assert.match(html,/data-faction-session-action="s1"/);
  assert.match(html,/value="Contacted"/);
  assert.match(html,/value="Evaluating"/);
  assert.match(html,/value="Deferred"/);
  assert.match(html,/value="Skip"/);
  assert.doesNotMatch(html,/value="Hired"/);
  assert.doesNotMatch(html,/value="Shortlisted"/);
});
