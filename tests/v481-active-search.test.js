const test=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {indexedDB}=require('fake-indexeddb');
const App=require('../src/v45-app');
const CompanyPlatform=require('../src/v46-company-platform');
const FactionPlatform=require('../src/v47-faction-platform');

const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

function shell(){
  const dom=new JSDOM('<!doctype html><html><body><div id="ra-app"><h2 id="ra-page-title"></h2><p id="ra-page-desc"></p><div id="ra-nav"></div><div id="ra-content"></div></div></body></html>',{url:'https://www.torn.com/'});
  global.window=dom.window;
  global.document=dom.window.document;
  global.MutationObserver=dom.window.MutationObserver;
  return dom;
}

async function appHarness(page,searchCandidates){
  const db=await App.openDB(indexedDB);
  App._test.state.db=db;
  return {
    db,
    app:{
      searchCandidates,
      _test:{
        state:{db,settings:{activePage:page},page},
        repositories:App._test.repositories,
        companyRepositories:App._test.companyRepositories,
        factionRepositories:App._test.factionRepositories
      }
    }
  };
}

test('Company Search actively acquires forum/API candidates before rendering filtered results',async()=>{
  const dom=shell();
  const calls=[];
  const {db,app}=await appHarness('company-candidates',async(domain,filters)=>{calls.push({domain,filters});return{forumCount:2,apiCount:1};});
  CompanyPlatform.install(app,{renderInitial:false});
  await CompanyPlatform.renderPage('company-candidates',{persist:false});
  document.getElementById('ra-company-filter-search').value='Alice';
  document.getElementById('ra-company-filter-end').value='100k';
  document.getElementById('ra-company-search-apply').click();
  await tick();await tick();
  assert.equal(calls.length,1);
  assert.equal(calls[0].domain,'company');
  assert.deepEqual(calls[0].filters,{search:'Alice',minEnd:'100k',minMan:'',minInt:''});
  CompanyPlatform.uninstall();db.close();dom.window.close();
});

test('Faction Search actively acquires forum/API candidates before rendering filtered results',async()=>{
  const dom=shell();
  const calls=[];
  const {db,app}=await appHarness('faction-candidates',async(domain,filters)=>{calls.push({domain,filters});return{forumCount:1,apiCount:2};});
  FactionPlatform.install(app,{renderInitial:false});
  await FactionPlatform.renderPage('faction-candidates',{persist:false});
  document.getElementById('ra-faction-filter-search').value='Bob';
  document.getElementById('ra-faction-filter-man').value='50k';
  document.getElementById('ra-faction-search-apply').click();
  await tick();await tick();
  assert.equal(calls.length,1);
  assert.equal(calls[0].domain,'faction');
  assert.deepEqual(calls[0].filters,{search:'Bob',minEnd:'',minMan:'50k',minInt:''});
  FactionPlatform.uninstall();db.close();dom.window.close();
});

test('active search runs the matching forum discovery feeds and Torn user search',async()=>{
  assert.equal(typeof App._test.searchCandidates,'function','v4.8.1 must expose active search orchestration for regression coverage');
  const events=[];
  const result=await App._test.searchCandidates('company',{search:'Alice',minEnd:'100k',minMan:'',minInt:''},{
    syncDomainForums:async domain=>{events.push(['forum',domain]);return{postsExamined:4,candidatesCreated:2,candidatesUpdated:1};},
    tornRequest:async(path,params)=>{events.push(['api',path,params]);return{search:[{id:123,name:'Alice',level:20,online:'Online',faction_id:0,icons:[]}]};},
    persistApiCandidate:async(domain,candidate)=>{events.push(['persist',domain,candidate.id]);return true;}
  });
  assert.deepEqual(events,[
    ['forum','company'],
    ['api','user/search',{name:'Alice'}],
    ['persist','company',123]
  ]);
  assert.equal(result.apiCount,1);
  assert.equal(result.forum.postsExamined,4);
});

test('numeric Name / ID search resolves the exact Torn profile instead of pretending user/search accepts IDs',async()=>{
  assert.equal(typeof App._test.searchCandidates,'function');
  const calls=[];
  await App._test.searchCandidates('faction',{search:'456'},{
    syncDomainForums:async()=>({postsExamined:0}),
    tornRequest:async(path,params)=>{calls.push([path,params]);return{profile:{id:456,name:'Exact User',level:30,faction_id:0,last_action:{timestamp:1700000000,status:'Offline'}}};},
    persistApiCandidate:async()=>true
  });
  assert.deepEqual(calls,[['user/456/profile',{}]]);
});

test('API search persistence creates only the selected recruitment domain and shared player identity',async()=>{
  assert.equal(typeof App._test.persistApiSearchCandidate,'function');
  const db=await App.openDB(indexedDB);App._test.state.db=db;
  await App._test.clearRecruitmentData();
  await App._test.persistApiSearchCandidate('faction',{id:789,name:'API Candidate',level:44,online:'Idle',faction_id:0});
  const read=(store,key)=>new Promise((resolve,reject)=>{const req=db.transaction(store,'readonly').objectStore(store).get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  const player=await read('playerIntelligence','789');
  const faction=await read('factionRecruitment','789');
  const company=await read('companyRecruitment','789');
  assert.equal(player.name,'API Candidate');
  assert.equal(player.level,44);
  assert.equal(player.onlineStatus,'Idle');
  assert.ok(faction);
  assert.equal(faction.discoverySources.includes('TORN API SEARCH'),true);
  assert.equal(company,undefined);
  db.close();
});

test('Company API candidates reuse known shared work stats instead of depending on legacy candidateLocal rows',async()=>{
  assert.equal(typeof App._test.persistApiSearchCandidate,'function');
  const db=await App.openDB(indexedDB);App._test.state.db=db;
  await App._test.clearRecruitmentData();
  await App._test.persistApiSearchCandidate('company',{id:901,name:'Known Stats',level:50,online:'Offline',faction_id:0});
  await App._test.repositories.players.ensure('901',{man:120000,int:230000,end:340000},'test',Date.now());
  const rows=await CompanyPlatform._test.buildRows({_test:{state:App._test.state,repositories:App._test.repositories,companyRepositories:App._test.companyRepositories}});
  const row=rows.find(item=>item.userId==='901');
  assert.ok(row);
  assert.equal(row.man,120000);
  assert.equal(row.int,230000);
  assert.equal(row.end,340000);
  db.close();
});

test('Search results show Torn online state when an exact last-action timestamp is unavailable',()=>{
  const CompanyUI=require('../src/v46-company-ui');
  const FactionUI=require('../src/v47-faction-ui');
  const row={userId:'902',name:'Live State',man:null,int:null,end:null,lastActive:null,onlineStatus:'Online',doNotContact:false};
  assert.match(CompanyUI.renderCandidates([row],{filters:{},total:1}),/<td>Online<\/td>/);
  assert.match(FactionUI.renderCandidates([row],{filters:{},total:1}),/<td>Online<\/td>/);
});
