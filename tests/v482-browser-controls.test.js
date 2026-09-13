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

async function harness(page,searchCandidates){
  const db=await App.openDB(indexedDB);
  App._test.state.db=db;
  await App._test.clearRecruitmentData();
  const app={
    searchCandidates,
    _test:{
      state:{db,settings:{activePage:page},page},
      repositories:App._test.repositories,
      companyRepositories:App._test.companyRepositories,
      factionRepositories:App._test.factionRepositories
    }
  };
  return{db,app};
}

test('Company v4.8.2 Search forwards status and company filters, while sort stays local-only',async()=>{
  const dom=shell();
  const calls=[];
  const {db,app}=await harness('company-candidates',async(domain,filters)=>{calls.push({domain,filters});return{forumCount:0,apiCount:0};});
  CompanyPlatform.install(app,{renderInitial:false});
  await CompanyPlatform.renderPage('company-candidates',{persist:false});

  document.getElementById('ra-company-filter-search').value='Alice';
  document.getElementById('ra-company-filter-status').value='Online';
  document.getElementById('ra-company-filter-organization').value='Bad Dec';
  document.getElementById('ra-company-filter-organization-presence').value='has';
  document.getElementById('ra-company-filter-end').value='100k';
  document.getElementById('ra-company-search-apply').click();
  await tick();await tick();

  assert.equal(calls.length,1);
  assert.deepEqual(calls[0],{
    domain:'company',
    filters:{search:'Alice',minEnd:'100k',minMan:'',minInt:'',onlineStatus:'Online',organization:'Bad Dec',organizationPresence:'has'}
  });

  document.querySelector('[data-company-sort="man"]').click();
  await tick();await tick();
  assert.equal(calls.length,1,'sorting must not trigger forum/API acquisition');
  assert.match(document.querySelector('[data-company-sort="man"]').textContent,/MAN\s+▼/);

  CompanyPlatform.uninstall();db.close();dom.window.close();
});

test('Faction v4.8.2 Search forwards status and faction filters, while sort stays local-only',async()=>{
  const dom=shell();
  const calls=[];
  const {db,app}=await harness('faction-candidates',async(domain,filters)=>{calls.push({domain,filters});return{forumCount:0,apiCount:0};});
  FactionPlatform.install(app,{renderInitial:false});
  await FactionPlatform.renderPage('faction-candidates',{persist:false});

  document.getElementById('ra-faction-filter-search').value='Bob';
  document.getElementById('ra-faction-filter-status').value='Idle';
  document.getElementById('ra-faction-filter-organization').value='Night';
  document.getElementById('ra-faction-filter-organization-presence').value='none';
  document.getElementById('ra-faction-filter-man').value='50k';
  document.getElementById('ra-faction-search-apply').click();
  await tick();await tick();

  assert.equal(calls.length,1);
  assert.deepEqual(calls[0],{
    domain:'faction',
    filters:{search:'Bob',minEnd:'',minMan:'50k',minInt:'',onlineStatus:'Idle',organization:'Night',organizationPresence:'none'}
  });

  document.querySelector('[data-faction-sort="lastActive"]').click();
  await tick();await tick();
  assert.equal(calls.length,1,'sorting must not trigger forum/API acquisition');
  assert.match(document.querySelector('[data-faction-sort="lastActive"]').textContent,/Last Online\s+▼/);

  FactionPlatform.uninstall();db.close();dom.window.close();
});
