const test=require('node:test');
const assert=require('node:assert/strict');
const {indexedDB}=require('fake-indexeddb');
const Storage=require('../src/v46-storage-core');
const Domain=require('../src/v46-domain-core');

function openDb(name,version,onUpgrade){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(name,version);
    req.onupgradeneeded=e=>onUpgrade?.(e.target.result,e.oldVersion,e.newVersion,e.target.transaction);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

function legacyStores(db){
  if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
  if(!db.objectStoreNames.contains('candidateLocal'))db.createObjectStore('candidateLocal',{keyPath:'userId'});
  if(!db.objectStoreNames.contains('forumSources'))db.createObjectStore('forumSources',{keyPath:'sourceId'});
  if(!db.objectStoreNames.contains('scoutLatest'))db.createObjectStore('scoutLatest',{keyPath:'userId'});
  if(!db.objectStoreNames.contains('globalLatest'))db.createObjectStore('globalLatest',{keyPath:'userId'});
  if(!db.objectStoreNames.contains('users'))db.createObjectStore('users',{keyPath:'recordId'});
}

function put(db,store,value){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
  });
}

function get(db,store,key){
  return new Promise((resolve,reject)=>{
    const q=db.transaction(store,'readonly').objectStore(store).get(key);
    q.onsuccess=()=>resolve(q.result||null);
    q.onerror=()=>reject(q.error);
  });
}

test('DB14 adds only Company baseline and vacancy stores to the Foundation definitions',()=>{
  assert.equal(Storage.DB_VERSION,14);
  assert.deepEqual(Object.keys(Storage.STORE_DEFINITIONS),[
    'playerIntelligence','companyRecruitment','factionRecruitment','companyBaselines','companyVacancies'
  ]);
  assert.deepEqual(Storage.STORE_DEFINITIONS.companyBaselines,{keyPath:'baselineId',indexes:[{name:'updatedAt',keyPath:'updatedAt'}]});
  assert.deepEqual(Storage.STORE_DEFINITIONS.companyVacancies,{keyPath:'vacancyId',indexes:[
    {name:'status',keyPath:'status'},
    {name:'roleLower',keyPath:'roleLower'},
    {name:'updatedAt',keyPath:'updatedAt'}
  ]});
});

test('DB13 upgrades additively to DB14 without changing existing player/company/faction records',async()=>{
  const name=`ra-company-db14-${Date.now()}-${Math.random()}`;
  let db=await openDb(name,13,d=>{legacyStores(d);Storage.applyUpgrade(d);});
  await put(db,'playerIntelligence',{userId:'111',name:'Shared Alice',nameLower:'shared alice',updatedAt:100});
  await put(db,'companyRecruitment',{userId:'111',domain:'company',pipelineStage:'Replied',recruiterNote:'private company',updatedAt:101});
  await put(db,'factionRecruitment',{userId:'111',domain:'faction',pipelineStage:'Invite Ready',recruiterNote:'private faction',updatedAt:102});
  db.close();

  db=await openDb(name,14,d=>Storage.applyUpgrade(d));
  assert.ok(db.objectStoreNames.contains('companyBaselines'));
  assert.ok(db.objectStoreNames.contains('companyVacancies'));
  assert.deepEqual(await get(db,'playerIntelligence','111'),{userId:'111',name:'Shared Alice',nameLower:'shared alice',updatedAt:100});
  assert.equal((await get(db,'companyRecruitment','111')).pipelineStage,'Replied');
  assert.equal((await get(db,'companyRecruitment','111')).recruiterNote,'private company');
  assert.equal((await get(db,'factionRecruitment','111')).pipelineStage,'Invite Ready');
  assert.equal((await get(db,'factionRecruitment','111')).recruiterNote,'private faction');

  const baselineStore=db.transaction('companyBaselines','readonly').objectStore('companyBaselines');
  assert.deepEqual([...baselineStore.indexNames],['updatedAt']);
  const vacancyStore=db.transaction('companyVacancies','readonly').objectStore('companyVacancies');
  assert.deepEqual([...vacancyStore.indexNames],['roleLower','status','updatedAt']);
  db.close();
});

test('Company recruitment normalization preserves Company-only waiver, vacancy pin and evaluation state',()=>{
  const record=Domain.normalizeCompanyRecruitment({
    userId:'111',pipelineStage:'Replied',
    waivers:[{requirementId:'man-hard',state:'Active',reason:'training hire'}],
    pinnedVacancyId:'vac-ops',suggestedVacancyId:'vac-sales',
    evaluationSummary:{baselineEligibility:'ELIGIBLE BY WAIVER',evaluatedAt:12345}
  },12345);
  assert.deepEqual(record.waivers,[{requirementId:'man-hard',state:'Active',reason:'training hire'}]);
  assert.equal(record.pinnedVacancyId,'vac-ops');
  assert.equal(record.suggestedVacancyId,'vac-sales');
  assert.deepEqual(record.evaluationSummary,{baselineEligibility:'ELIGIBLE BY WAIVER',evaluatedAt:12345});
});
