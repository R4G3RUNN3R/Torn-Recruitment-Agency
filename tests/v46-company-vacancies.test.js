const test=require('node:test');
const assert=require('node:assert/strict');
const {indexedDB}=require('fake-indexeddb');
const App=require('../src/v45-app');

function put(db,store,value){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
function get(db,store,key){return new Promise((resolve,reject)=>{const q=db.transaction(store,'readonly').objectStore(store).get(key);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error);});}
function all(db,store){return new Promise((resolve,reject)=>{const q=db.transaction(store,'readonly').objectStore(store).getAll();q.onsuccess=()=>resolve(q.result||[]);q.onerror=()=>reject(q.error);});}
function init(db){App._test.state.db=db;App._test.state.settings=App.mergeSettings({});}

test('Company baseline saves versioned snapshots instead of overwriting history',async()=>{
  const db=await App.openDB(indexedDB);init(db);
  const first=await App._test.saveCompanyBaseline({name:'Bad Decisions baseline',requirements:[{requirementId:'man',field:'man',operator:'gte',value:5000,level:'Hard',weight:100}]},1000);
  assert.equal(first.baselineId,'company-default');assert.equal(first.version,1);assert.equal(first.versionHistory.length,0);
  const second=await App._test.saveCompanyBaseline({...first,requirements:[{requirementId:'man',field:'man',operator:'gte',value:7000,level:'Hard',weight:100}]},2000);
  assert.equal(second.version,2);assert.equal(second.versionHistory.length,1);
  assert.equal(second.versionHistory[0].version,1);assert.equal(second.versionHistory[0].snapshot.requirements[0].value,5000);
  assert.equal((await get(db,'companyBaselines','company-default')).requirements[0].value,7000);
  db.close();
});

test('vacancy create edit duplicate and archive are versioned and non-destructive',async()=>{
  const db=await App.openDB(indexedDB);init(db);
  const created=await App._test.saveCompanyVacancy({vacancyId:'vac-sales',name:'Sales',role:'Sales',openings:2,status:'Open',requirements:[]},1000);
  assert.equal(created.version,1);assert.equal(created.openings,2);assert.equal(created.status,'Open');
  const edited=await App._test.saveCompanyVacancy({...created,openings:3,notes:'Updated'},2000);
  assert.equal(edited.version,2);assert.equal(edited.versionHistory.length,1);assert.equal(edited.versionHistory[0].snapshot.openings,2);
  const duplicate=await App._test.duplicateCompanyVacancy('vac-sales',3000);
  assert.notEqual(duplicate.vacancyId,'vac-sales');assert.equal(duplicate.status,'Draft');assert.equal(duplicate.version,1);assert.equal(duplicate.versionHistory.length,0);assert.match(duplicate.name,/Copy$/);
  const archived=await App._test.archiveCompanyVacancy('vac-sales',4000);
  assert.equal(archived.status,'Archived');assert.equal(archived.version,3);
  assert.ok(await get(db,'companyVacancies','vac-sales'),'archive must not delete the vacancy');
  assert.equal((await all(db,'companyVacancies')).length,2);
  db.close();
});

test('local Company evaluation persists best suggestion and raw Match while preserving manual pin',async()=>{
  const db=await App.openDB(indexedDB);init(db);
  await App._test.saveCompanyBaseline({requirements:[{requirementId:'level',field:'level',operator:'gte',value:10,level:'Hard',weight:100}]},1000);
  await App._test.saveCompanyVacancy({vacancyId:'vac-a',name:'A',role:'A',status:'Open',requirements:[{requirementId:'fit-a',field:'fit',operator:'gte',value:80,level:'Preferred',weight:100}]},1000);
  await App._test.saveCompanyVacancy({vacancyId:'vac-b',name:'B',role:'B',status:'Open',requirements:[{requirementId:'fit-b',field:'fit',operator:'gte',value:60,level:'Preferred',weight:100}]},1000);
  await put(db,'playerIntelligence',{userId:'111',name:'Alice',nameLower:'alice',level:20,fit:70,updatedAt:1000});
  await put(db,'companyRecruitment',{userId:'111',domain:'company',pipelineStage:'Replied',availability:'Available',waivers:[],pinnedVacancyId:'vac-a',suggestedVacancyId:'',evaluationSummary:null,discoverySources:[],tags:[],followUps:[],campaigns:[],outcomes:[],doNotContact:false,archived:false,cycles:[],createdAt:1,updatedAt:1});

  const result=await App._test.recalculateCompanyCandidate('111',5000);
  assert.equal(result.baseline.eligibility,'ELIGIBLE');
  assert.equal(result.suggestedVacancyId,'vac-b');
  assert.equal(result.effectiveVacancyId,'vac-a','manual pin must remain effective');
  assert.equal(result.suggestionChanged,true);
  const saved=await get(db,'companyRecruitment','111');
  assert.equal(saved.pinnedVacancyId,'vac-a');
  assert.equal(saved.suggestedVacancyId,'vac-b');
  assert.equal(saved.evaluationSummary.effectiveVacancyId,'vac-a');
  assert.equal(saved.evaluationSummary.vacancies.find(v=>v.vacancyId==='vac-a').rawMatch,87.5);
  db.close();
});

test('ineligible vacancy retains raw Match and baseline recalculation makes zero Torn API requests',async()=>{
  const db=await App.openDB(indexedDB);init(db);
  await App._test.saveCompanyBaseline({requirements:[]},1000);
  await App._test.saveCompanyVacancy({vacancyId:'vac-hard',name:'Hard',role:'Hard',status:'Open',requirements:[
    {requirementId:'man-hard',field:'man',operator:'gte',value:10000,level:'Hard',weight:50},
    {requirementId:'fit-pref',field:'fit',operator:'gte',value:80,level:'Preferred',weight:50}
  ]},1000);
  await put(db,'playerIntelligence',{userId:'222',name:'Bob',nameLower:'bob',fit:80,updatedAt:1000});
  await put(db,'candidateLocal',{userId:'222',name:'Bob',stats:{man:8000},pipelineStage:'Not Contacted',availability:'Unknown',discoverySources:['MANUAL']});
  await put(db,'companyRecruitment',{userId:'222',domain:'company',pipelineStage:'Not Contacted',availability:'Unknown',waivers:[],pinnedVacancyId:'',suggestedVacancyId:'',evaluationSummary:null,discoverySources:['MANUAL'],tags:[],followUps:[],campaigns:[],outcomes:[],doNotContact:false,archived:false,cycles:[],createdAt:1,updatedAt:1});
  let calls=0;const oldFetch=global.fetch;global.fetch=async()=>{calls++;throw new Error('unexpected network request');};
  try{
    const result=await App._test.recalculateCompanyCandidate('222',5000);
    const vacancy=result.vacancies[0];
    assert.equal(vacancy.eligibility,'NOT ELIGIBLE');assert.equal(vacancy.rawMatch,90);assert.equal(calls,0);
  }finally{global.fetch=oldFetch;db.close();}
});
