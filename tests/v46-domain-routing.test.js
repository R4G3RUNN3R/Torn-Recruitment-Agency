const test=require('node:test');
const assert=require('node:assert/strict');
const {indexedDB}=require('fake-indexeddb');
const App=require('../src/v45-app');

function get(db,store,key){return new Promise((resolve,reject)=>{const q=db.transaction(store,'readonly').objectStore(store).get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}

function source(sourceType,userId,observedAt){return{sourceId:`${sourceType}:thread:post:${userId}`,sourceType,userId:Number(userId),observedAt,postedAt:observedAt,parsed:{availability:'Unknown'}};}

function candidate(userId,name,sourceType){return{userId:String(userId),name,pipelineStage:'Not Contacted',availability:'Unknown',recruiterNote:'',expectedSalary:null,discoverySources:[sourceType],latestForumSourceId:`${sourceType}:thread:post:${userId}`,updatedAt:new Date(1000).toISOString()};}

test('feed domain classification keeps faction explicit and treats company/training as company',()=>{
  assert.equal(App._test.recruitmentDomainForFeed({feedId:'company',sourceType:'COMPANY FORUM'}),'company');
  assert.equal(App._test.recruitmentDomainForFeed({feedId:'training',sourceType:'TRAIN BUYER'}),'company');
  assert.equal(App._test.recruitmentDomainForFeed({feedId:'faction',sourceType:'FACTION FORUM'}),'faction');
});

test('discovery persistence creates only the matching recruitment domain',async()=>{
  const db=await App.openDB(indexedDB);
  App._test.state.db=db;

  const companyFeed={feedId:'company',sourceType:'COMPANY FORUM'};
  const factionFeed={feedId:'faction',sourceType:'FACTION FORUM'};
  await App._test.persistDiscoveredCandidate(companyFeed,candidate('111','Company Alice','COMPANY FORUM'),source('COMPANY FORUM','111',1000));
  await App._test.persistDiscoveredCandidate(factionFeed,candidate('222','Faction Bob','FACTION FORUM'),source('FACTION FORUM','222',2000));

  assert.ok(await get(db,'companyRecruitment','111'));
  assert.equal(await get(db,'factionRecruitment','111'),undefined);
  assert.ok(await get(db,'candidateLocal','111'));

  assert.ok(await get(db,'factionRecruitment','222'));
  assert.equal(await get(db,'companyRecruitment','222'),undefined);
  assert.equal(await get(db,'candidateLocal','222'),undefined);

  assert.equal((await get(db,'playerIntelligence','111')).name,'Company Alice');
  assert.equal((await get(db,'playerIntelligence','222')).name,'Faction Bob');
  db.close();
});

test('new faction observations preserve an existing advanced faction stage',async()=>{
  const db=await App.openDB(indexedDB);
  App._test.state.db=db;
  await App._test.repositories.faction.ensure('333',{pipelineStage:'Invite Ready',recruiterNote:'approved',discoverySources:['FACTION FORUM']},{sharedPatch:{name:'Ready Recruit'},source:'test',observedAt:1000});

  const factionFeed={feedId:'faction',sourceType:'FACTION FORUM'};
  const incoming=candidate('333','Ready Recruit','FACTION FORUM');
  incoming.pipelineStage='Not Contacted';
  await App._test.persistDiscoveredCandidate(factionFeed,incoming,source('FACTION FORUM','333',2000));

  const record=await get(db,'factionRecruitment','333');
  assert.equal(record.pipelineStage,'Invite Ready');
  assert.equal(record.recruiterNote,'approved');
  assert.equal(await get(db,'candidateLocal','333'),undefined);
  db.close();
});
