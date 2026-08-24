const test=require('node:test');
const assert=require('node:assert/strict');
const {indexedDB}=require('fake-indexeddb');
const App=require('../src/v45-app');

function put(db,store,value){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
function get(db,store,key){return new Promise((resolve,reject)=>{const q=db.transaction(store,'readonly').objectStore(store).get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
function installAppState(db){App._test.state.db=db;App._test.state.settings=App.mergeSettings({});}

test('Company candidate views are keyed by companyRecruitment and its workflow state wins over candidateLocal',async()=>{
  const db=await App.openDB(indexedDB);installAppState(db);
  await put(db,'candidateLocal',{userId:'111',name:'Legacy Name',pipelineStage:'Rejected',availability:'Unavailable',desiredCompany:'Old Company',recruiterNote:'legacy note',discoverySources:['COMPANY FORUM']});
  await put(db,'playerIntelligence',{userId:'111',name:'Shared Alice',nameLower:'shared alice',level:50,currentCompany:'Current Co',updatedAt:10});
  await put(db,'companyRecruitment',{userId:'111',domain:'company',pipelineStage:'Replied',availability:'Available',desiredCompany:'Bad Decisions',desiredRole:'Sales',expectedSalary:5000000,recruiterNote:'authoritative note',manualFields:{},discoverySources:['COMPANY FORUM'],latestForumSourceId:'',tags:[],followUps:[],campaigns:[],outcomes:[],waivers:[],pinnedVacancyId:'',suggestedVacancyId:'',evaluationSummary:null,doNotContact:false,archived:false,cycles:[],createdAt:1,updatedAt:20});
  await put(db,'playerIntelligence',{userId:'222',name:'Faction Only',nameLower:'faction only',updatedAt:11});
  await put(db,'factionRecruitment',{userId:'222',domain:'faction',pipelineStage:'Invite Ready',availability:'Available',recruiterNote:'faction only',discoverySources:['FACTION FORUM'],createdAt:1,updatedAt:20});

  const views=await App._test.companyCandidateViews();
  assert.equal(views.length,1);
  assert.equal(String(views[0].userId),'111');
  assert.equal(views[0].name,'Shared Alice');
  assert.equal(views[0].pipelineStage,'Replied');
  assert.equal(views[0].availability,'Available');
  assert.equal(views[0].desiredCompany,'Bad Decisions');
  assert.equal(views[0].candidate.recruiterNote,'authoritative note');
  assert.equal(views[0].currentCompany,'Current Co');
  db.close();
});

test('Company workflow writes update companyRecruitment and compatibility candidateLocal without mutating Faction state',async()=>{
  const db=await App.openDB(indexedDB);installAppState(db);
  await put(db,'candidateLocal',{userId:'333',name:'Dual Player',pipelineStage:'Not Contacted',availability:'Unknown',discoverySources:['COMPANY FORUM']});
  await App._test.repositories.company.ensure('333',{pipelineStage:'Not Contacted',availability:'Unknown',recruiterNote:'company'},{sharedPatch:{name:'Dual Player'},source:'test',observedAt:10});
  await App._test.repositories.faction.ensure('333',{pipelineStage:'Invite Ready',recruiterNote:'faction'},{sharedPatch:{name:'Dual Player'},source:'test',observedAt:10});

  await App._test.saveCompanyRecruitmentPatch('333',{pipelineStage:'Contacted',availability:'Available',recruiterNote:'company updated'});
  assert.equal((await get(db,'companyRecruitment','333')).pipelineStage,'Contacted');
  assert.equal((await get(db,'companyRecruitment','333')).recruiterNote,'company updated');
  assert.equal((await get(db,'candidateLocal','333')).pipelineStage,'Contacted');
  assert.equal((await get(db,'candidateLocal','333')).availability,'Available');
  assert.equal((await get(db,'factionRecruitment','333')).pipelineStage,'Invite Ready');
  assert.equal((await get(db,'factionRecruitment','333')).recruiterNote,'faction');
  db.close();
});
