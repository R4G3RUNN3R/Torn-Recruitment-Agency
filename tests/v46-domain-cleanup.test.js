const test=require('node:test');
const assert=require('node:assert/strict');
const {indexedDB}=require('fake-indexeddb');
const App=require('../src/v45-app');

function get(db,store,key){return new Promise((resolve,reject)=>{const q=db.transaction(store,'readonly').objectStore(store).get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
function getAll(db,store){return new Promise((resolve,reject)=>{const q=db.transaction(store,'readonly').objectStore(store).getAll();q.onsuccess=()=>resolve(q.result||[]);q.onerror=()=>reject(q.error);});}
function put(db,store,value){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}

async function clear(db,stores){for(const store of stores){await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}}

const CLEAN_STORES=['users','candidateLocal','forumSources','forumSyncState','playerIntelligence','companyRecruitment','factionRecruitment','scoutLatest'];

test('deleting a Company candidate preserves Faction state and shared intelligence',async()=>{
  const db=await App.openDB(indexedDB);
  App._test.state.db=db;
  await clear(db,CLEAN_STORES);

  await App._test.repositories.company.ensure('555',{pipelineStage:'Replied',recruiterNote:'company note',discoverySources:['COMPANY FORUM']},{sharedPatch:{name:'Dual Recruit'},source:'test-company',observedAt:1000});
  await App._test.repositories.faction.ensure('555',{pipelineStage:'Invite Ready',recruiterNote:'faction note',discoverySources:['FACTION FORUM']},{sharedPatch:{name:'Dual Recruit'},source:'test-faction',observedAt:1100});
  await put(db,'candidateLocal',{userId:'555',name:'Dual Recruit',pipelineStage:'Replied',discoverySources:['COMPANY FORUM']});
  await put(db,'forumSources',{sourceId:'COMPANY FORUM:t:1:555',userId:555,sourceType:'COMPANY FORUM',threadId:'t',postId:'1'});
  await put(db,'forumSources',{sourceId:'FACTION FORUM:t:2:555',userId:555,sourceType:'FACTION FORUM',threadId:'t',postId:'2'});
  await put(db,'users',{recordId:'company:555',userId:555,sourceMode:'company'});
  await put(db,'users',{recordId:'faction:555',userId:555,sourceMode:'faction'});

  await App._test.deleteCompanyCandidateData('555');

  assert.equal(await get(db,'candidateLocal','555'),undefined);
  assert.equal(await get(db,'companyRecruitment','555'),undefined);
  assert.ok(await get(db,'factionRecruitment','555'));
  assert.ok(await get(db,'playerIntelligence','555'));
  assert.deepEqual((await getAll(db,'forumSources')).map(x=>x.sourceType),['FACTION FORUM']);
  assert.deepEqual((await getAll(db,'users')).map(x=>x.sourceMode),['faction']);
  db.close();
});

test('clear recruitment removes both recruitment domains but preserves shared/scout intelligence',async()=>{
  const db=await App.openDB(indexedDB);
  App._test.state.db=db;
  await clear(db,CLEAN_STORES);

  await App._test.repositories.company.ensure('611',{pipelineStage:'Contacted'},{sharedPatch:{name:'Company Only'},source:'test',observedAt:1000});
  await App._test.repositories.faction.ensure('622',{pipelineStage:'Evaluating'},{sharedPatch:{name:'Faction Only'},source:'test',observedAt:1000});
  await put(db,'candidateLocal',{userId:'611',name:'Company Only',pipelineStage:'Contacted'});
  await put(db,'forumSources',{sourceId:'COMPANY FORUM:t:1:611',userId:611,sourceType:'COMPANY FORUM',threadId:'t',postId:'1'});
  await put(db,'forumSources',{sourceId:'FACTION FORUM:t:2:622',userId:622,sourceType:'FACTION FORUM',threadId:'t',postId:'2'});
  await put(db,'forumSyncState',{feedId:'company',updatedAt:1});
  await put(db,'users',{recordId:'company:611',userId:611,sourceMode:'company'});
  await put(db,'scoutLatest',{userId:611,capturedAt:1000});

  await App._test.clearRecruitmentData();

  for(const store of ['users','candidateLocal','forumSources','forumSyncState','companyRecruitment','factionRecruitment']) {
    assert.equal((await getAll(db,store)).length,0,`${store} should be cleared`);
  }
  assert.ok(await get(db,'playerIntelligence','611'));
  assert.ok(await get(db,'playerIntelligence','622'));
  assert.ok(await get(db,'scoutLatest',611));
  db.close();
});
