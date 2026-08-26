const test=require('node:test');
const assert=require('node:assert/strict');
const UI=require('../src/v46-company-ui');
const Ops=require('../src/v46-company-operations');
const Platform=require('../src/v46-company-platform');

const row={userId:'101',name:'Alpha',pipelineStage:'Contacted',availability:'Available',fit:91,eligibility:'Eligible',hardFailed:false,doNotContact:false,companyRecord:{userId:'101',pipelineStage:'Contacted',followUps:[{followUpId:'f1',dueAt:1000,reason:'Check back',note:'Soon',state:'open'}],outcomes:[{outcomeId:'o1',result:'Interested',channel:'Torn message',note:'Salary question',at:900}],timelineEvents:[{eventId:'e1',type:'stage-changed',at:800,payload:{from:'Not Contacted',to:'Contacted'}}],timelineNotes:[{noteId:'n1',text:'Strong prospect',at:850}],doNotContact:false,stageChangedAt:0}};

test('Follow-ups page exposes add complete and recurrence controls',()=>{
  const html=UI.renderFollowUpsPage([row],{now:2000});
  assert.match(html,/id="ra-company-followup-add"/);
  assert.match(html,/data-followup-complete="f1"/);
  assert.match(html,/id="ra-company-followup-recurrence-unit"/);
  assert.match(html,/Check back/);
});

test('Contact Outcomes page manages outcomes and explicit Do Not Contact separately from stage',()=>{
  const html=UI.renderContactOutcomesPage([row]);
  assert.match(html,/id="ra-company-outcome-add"/);
  assert.match(html,/data-company-dnc="101"/);
  assert.match(html,/Interested/);
  assert.match(html,/Contacted/);
});

test('DNC candidate rendering suppresses ordinary Recruit and exposes a deliberate override',()=>{
  const html=UI.renderCandidates([{...row,doNotContact:true,companyRecord:{...row.companyRecord,doNotContact:true}}]);
  assert.doesNotMatch(html,/data-company-recruit="101"/);
  assert.match(html,/data-company-recruit-override="101"/);
  assert.match(html,/Override &amp; Recruit/);
});

test('Stage Aging page is warning-only and does not expose automatic stage movement',()=>{
  const aging=Ops.stageAging(row.companyRecord,{Contacted:3},5*86400000);
  const html=UI.renderStageAgingPage([{...row,aging}]);
  assert.match(html,/Stale/);
  assert.doesNotMatch(html,/data-company-stage-select/);
  assert.match(html,/Contacted/);
});

test('Timeline page visually separates immutable system events from editable recruiter notes',()=>{
  const html=UI.renderTimelinePage([row]);
  assert.match(html,/System event/);
  assert.match(html,/Immutable/);
  assert.match(html,/data-timeline-note-edit="n1"/);
  assert.match(html,/data-timeline-note-delete="n1"/);
  assert.doesNotMatch(html,/data-timeline-note-edit="e1"/);
});

test('Task 6 Company operational routes are owned by the v4.6 platform',()=>{
  for(const route of ['company-followups','company-contact-outcomes','company-stage-aging','company-timeline'])assert.equal(Platform._test.IMPLEMENTED_ROUTES.has(route),true,route);
});