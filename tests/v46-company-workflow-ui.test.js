const test=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {indexedDB}=require('fake-indexeddb');
const WorkflowUI=require('../src/v46-company-workflow-ui');
const Platform=require('../src/v46-company-platform');

const rows=[
  {userId:'101',name:'Alpha',pipelineStage:'Rejected',talentPool:true,talentPoolReason:'Future trainer',archived:true,campaigns:['c1'],companyRecord:{userId:'101',pipelineStage:'Rejected',talentPool:true,talentPoolReason:'Future trainer',archived:true,campaigns:['c1'],cycles:[]}},
  {userId:'202',name:'Beta',pipelineStage:'Shortlisted',talentPool:false,talentPoolReason:'',archived:false,campaigns:[],companyRecord:{userId:'202',pipelineStage:'Shortlisted',talentPool:false,archived:false,campaigns:[],cycles:[]}}
];
const campaigns=[{campaignId:'c1',title:'Trainer Hunt',target:'High EE trainers',vacancyId:'v1',candidateIds:['101'],status:'Active',notes:'August'}];
const sessions=[{sessionId:'s1',title:'Morning review',candidateIds:['101','202'],cursor:0,status:'Active',outcomes:[]}];

function openWorkflowDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(`ra-v46-workflow-${Date.now()}-${Math.random()}`,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      for(const[name,keyPath]of [['meta','key'],['companyRecruitment','userId'],['playerIntelligence','userId'],['companyRecruitmentConfig','key'],['companyVacancies','vacancyId'],['companyCampaigns','campaignId'],['companyRecruitmentSessions','sessionId']])db.createObjectStore(name,{keyPath});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

function put(db,store,value){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete=()=>resolve(true);
    tx.onerror=()=>reject(tx.error);
  });
}

test('Campaigns page creates campaigns and manages many-to-many candidate membership',()=>{
  const html=WorkflowUI.renderCampaignsPage({campaigns,rows,vacancies:[{vacancyId:'v1',name:'Trainer'}]});
  assert.match(html,/id="ra-company-campaign-new"/);
  assert.match(html,/Trainer Hunt/);
  assert.match(html,/data-campaign-add-member="c1"/);
  assert.match(html,/data-campaign-remove-member="c1"/);
  assert.match(html,/Alpha/);
});

test('Talent Pool page shows explicit pool state and supports add remove with reason',()=>{
  const html=WorkflowUI.renderTalentPoolPage(rows);
  assert.match(html,/Future trainer/);
  assert.match(html,/id="ra-company-talent-add"/);
  assert.match(html,/data-talent-remove="101"/);
  assert.match(html,/Beta/);
});

test('Reactivation page preserves same player identity and requires an explicit reason action',()=>{
  const html=WorkflowUI.renderReactivationPage(rows);
  assert.match(html,/data-reactivate-player="101"/);
  assert.match(html,/data-reactivate-reason="101"/);
  assert.match(html,/Alpha/);
  assert.doesNotMatch(html,/data-reactivate-player="202"/,'active non-terminal candidate should not be offered for reactivation');
});

test('Recruitment Sessions page shows exactly the current candidate and explicit actions',()=>{
  const html=WorkflowUI.renderRecruitmentSessionsPage({sessions,rows});
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

test('Task 7 platform renders persisted Campaign and Recruitment Session data',async()=>{
  const dom=new JSDOM('<!doctype html><html><body><div id="ra-app"><h2 id="ra-page-title"></h2><p id="ra-page-desc"></p><div id="ra-nav"><button data-page="company-campaigns">Campaigns</button><button data-page="company-recruitment-sessions">Sessions</button></div><div id="ra-content"></div></div></body></html>',{url:'https://www.torn.com/'});
  global.window=dom.window;global.document=dom.window.document;global.MutationObserver=dom.window.MutationObserver;
  const db=await openWorkflowDb();
  await put(db,'companyRecruitment',{userId:'101',domain:'company',pipelineStage:'Rejected',talentPool:true,talentPoolReason:'Future trainer',archived:true,campaigns:['c1'],cycles:[],waivers:[]});
  await put(db,'companyRecruitment',{userId:'202',domain:'company',pipelineStage:'Shortlisted',talentPool:false,archived:false,campaigns:[],cycles:[],waivers:[]});
  await put(db,'playerIntelligence',{userId:'101',name:'Alpha'});
  await put(db,'playerIntelligence',{userId:'202',name:'Beta'});
  await put(db,'companyRecruitmentConfig',{key:'company',baseline:{criteria:[]},stageThresholds:{},opportunityWeights:{}});
  await put(db,'companyCampaigns',campaigns[0]);
  await put(db,'companyRecruitmentSessions',sessions[0]);
  const app={_test:{state:{db,settings:{activePage:'company-campaigns'},page:'company-campaigns'},companyRepositories:{}}};
  Platform.install(app,{renderInitial:false});
  assert.equal(await Platform.renderPage('company-campaigns',{persist:false}),true);
  assert.match(document.getElementById('ra-content').innerHTML,/Trainer Hunt/);
  assert.equal(await Platform.renderPage('company-recruitment-sessions',{persist:false}),true);
  assert.match(document.getElementById('ra-content').innerHTML,/Morning review/);
  Platform.uninstall();
  db.close();dom.window.close();
});
