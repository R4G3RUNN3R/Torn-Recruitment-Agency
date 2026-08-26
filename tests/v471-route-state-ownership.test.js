const test=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {indexedDB,IDBKeyRange}=require('fake-indexeddb');

class ResizeObserverStub{observe(){}unobserve(){}disconnect(){}}

function installDom(){
  const dom=new JSDOM('<!doctype html><html><head></head><body><section><h2>Information</h2><div><button>One</button><button>Two</button></div></section></body></html>',{url:'https://www.torn.com/index.php',pretendToBeVisual:true});
  Object.defineProperty(dom.window.document,'readyState',{value:'complete',configurable:true});
  Object.defineProperty(dom.window.navigator,'clipboard',{value:{writeText:async()=>{}},configurable:true});
  global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;global.location=dom.window.location;
  global.MutationObserver=dom.window.MutationObserver;global.HTMLElement=dom.window.HTMLElement;global.Node=dom.window.Node;global.ResizeObserver=ResizeObserverStub;
  global.indexedDB=indexedDB;global.IDBKeyRange=IDBKeyRange;global.innerWidth=1440;global.innerHeight=900;global.confirm=()=>true;global.prompt=()=>'';global.alert=()=>{};global.open=()=>null;
  dom.window.ResizeObserver=ResizeObserverStub;dom.window.confirm=global.confirm;dom.window.prompt=global.prompt;dom.window.alert=global.alert;dom.window.open=global.open;
  return dom;
}

function freshApp(){const modulePath=require.resolve('../src/v45-app');delete require.cache[modulePath];return require('../src/v45-app');}
function deleteDb(){return new Promise((resolve,reject)=>{const req=indexedDB.deleteDatabase('tornWorkerDB');req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);req.onblocked=()=>resolve();});}

async function withApp(run){
  await deleteDb();
  const dom=installDom();
  const App=freshApp();
  try{
    assert.equal(await App.start({indexedDB}),true);
    assert.equal(App._test.state.page,'company-overview');
    await run(App,dom);
  }finally{
    App._test.state.db?.close?.();
    dom.window.close();
    await deleteDb();
  }
}

test('Company sidebar navigation commits canonical route before asynchronous rendering',async()=>{
  await withApp(async App=>{
    document.querySelector('[data-page="company-candidates"]').click();
    assert.equal(document.getElementById('ra-page-title').textContent,'Company Candidates','the click should begin rendering Company Candidates immediately');
    assert.equal(App._test.state.page,'company-candidates','canonical route state must change in the same click turn, before asynchronous page reads can yield');
  });
});

test('Faction sidebar navigation commits canonical route before asynchronous rendering',async()=>{
  await withApp(async App=>{
    document.querySelector('[data-nav-toggle="faction-recruitment"]').click();
    document.querySelector('[data-page="faction-candidates"]').click();
    assert.equal(document.getElementById('ra-page-title').textContent,'Faction Candidates','the click should begin rendering Faction Candidates immediately');
    assert.equal(App._test.state.page,'faction-candidates','canonical route state must change in the same click turn, before asynchronous page reads can yield');
  });
});
