const test=require('node:test');
const assert=require('node:assert/strict');
const UI=require('../src/v46-company-ui');
const Platform=require('../src/v46-company-platform');

const rows=[
  {userId:'101',name:'Alpha',pipelineStage:'Rejected',talentPool:true,talentPoolReason:'Future trainer',archived:true,campaigns:['c1'],companyRecord:{userId:'101',pipelineStage:'Rejected',talentPool:true,talentPoolReason:'Future trainer',archived:true,campaigns:['c1'],cycles:[]}},
  {userId:'202',name:'Beta',pipelineStage:'Shortlisted',talentPool:false,talentPoolReason:'',archived:false,campaigns:[],companyRecord:{userId:'202',pipelineStage:'Shortlisted',talentPool:false,archived:false,campaigns:[],cycles:[]}}
];
const campaigns=[{campaignId:'c1',title:'Trainer Hunt',target:'High EE trainers',vacancyId:'v1',candidateIds:['101'],status:'Active',notes:'August'}];
const sessions=[{sessionId:'s1',title:'Morning review',candidateIds:['101','202'],cursor:0,status:'Active',outcomes:[]}];

test('Campaigns page creates campaigns and manages many-to-many candidate membership',()=>{
  const html=UI.renderCampaignsPage({campaigns,rows,vacancies:[{vacancyId:'v1',name:'Trainer'}]});
  assert.match(html,/id="ra-company-campaign-new"/);
  assert.match(html,/Trainer Hunt/);
  assert.match(html,/data-campaign-add-member="c1"/);
  assert.match(html,/data-campaign-remove-member="c1"/);
  assert.match(html,/Alpha/);
});

test('Talent Pool page shows explicit pool state and supports add remove with reason',()=>{
  const html=UI.renderTalentPoolPage(rows);
  assert.match(html,/Future trainer/);
  assert.match(html,/id="ra-company-talent-add"/);
  assert.match(html,/data-talent-remove="101"/);
  assert.match(html,/Beta/);
});

test('Reactivation page preserves same player identity and requires an explicit reason action',()=>{
  const html=UI.renderReactivationPage(rows);
  assert.match(html,/data-reactivate-player="101"/);
  assert.match(html,/data-reactivate-reason="101"/);
  assert.match(html,/Alpha/);
  assert.doesNotMatch(html,/data-reactivate-player="202"/,'active non-terminal candidate should not be offered for reactivation');
});

test('Recruitment Sessions page shows exactly the current candidate and explicit actions',()=>{
  const html=UI.renderRecruitmentSessionsPage({sessions,rows});
  assert.match(html,/Morning review/);
  assert.match(html,/Current candidate/);
  assert.match(html,/Alpha/);
  assert.doesNotMatch(html,/Current candidate[\s\S]*Beta[\s\S]*data-session-action="s1"/,'view must not silently advance to the second candidate');
  assert.match(html,/data-session-action="s1"/);
  assert.match(html,/value="Skip"/);
});

test('Task 7 routed workspaces are owned by the v4.6 Company platform',()=>{
  for(const route of ['company-campaigns','company-talent-pool','company-reactivation','company-recruitment-sessions'])assert.equal(Platform._test.IMPLEMENTED_ROUTES.has(route),true,route);
});
