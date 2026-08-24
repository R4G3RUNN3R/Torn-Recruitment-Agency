const test=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {indexedDB,IDBKeyRange}=require('fake-indexeddb');

function tick(ms=20){return new Promise(resolve=>setTimeout(resolve,ms));}
class ResizeObserverStub{observe(){} unobserve(){} disconnect(){}}

function installDom(){
  const dom=new JSDOM('<!doctype html><html><head></head><body><section><h2>Information</h2><div><button>One</button><button>Two</button></div></section></body></html>',{
    url:'https://www.torn.com/index.php',pretendToBeVisual:true
  });
  Object.defineProperty(dom.window.document,'readyState',{value:'complete',configurable:true});
  Object.defineProperty(dom.window.navigator,'clipboard',{value:{writeText:async()=>{}},configurable:true});
  global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;global.location=dom.window.location;
  global.MutationObserver=dom.window.MutationObserver;global.HTMLElement=dom.window.HTMLElement;global.Node=dom.window.Node;
  global.ResizeObserver=ResizeObserverStub;global.indexedDB=indexedDB;global.IDBKeyRange=IDBKeyRange;global.innerWidth=1440;global.innerHeight=900;
  global.confirm=()=>true;global.prompt=()=>'';global.alert=()=>{};
  dom.window.ResizeObserver=ResizeObserverStub;dom.window.open=()=>null;dom.window.confirm=global.confirm;dom.window.prompt=global.prompt;dom.window.alert=global.alert;
  return dom;
}

async function readMeta(db){return new Promise((resolve,reject)=>{const q=db.transaction('meta','readonly').objectStore('meta').get('global');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}

function freshApp(){
  const appPath=require.resolve('../src/v45-app');
  delete require.cache[appPath];
  return require('../src/v45-app');
}

test('navigation groups independently collapse, persist empty/all states and restore last route',async()=>{
  const dom1=installDom();
  const App1=freshApp();
  assert.equal(await App1.start({indexedDB}),true);

  assert.ok(document.querySelector('[data-nav-group="recruitment"]'));
  assert.ok(document.querySelector('[data-nav-toggle="recruitment"]'));
  assert.equal(document.querySelector('[data-page="settings"]'),null);
  assert.ok(document.getElementById('ra-settings-button'));

  const recruitment=document.querySelector('[data-nav-toggle="recruitment"]');
  const intelligence=document.querySelector('[data-nav-toggle="intelligence"]');
  assert.equal(recruitment.getAttribute('aria-expanded'),'true');
  assert.equal(intelligence.getAttribute('aria-expanded'),'false');

  intelligence.click();
  await tick();
  let meta=await readMeta(App1._test.state.db);
  assert.deepEqual(meta.settings.navigation.expandedGroups,['recruitment','intelligence']);
  assert.equal(document.querySelector('[data-nav-group="intelligence"]').hidden,false);

  document.querySelector('[data-nav-toggle="recruitment"]').click();
  await tick();
  document.querySelector('[data-nav-toggle="intelligence"]').click();
  await tick();
  meta=await readMeta(App1._test.state.db);
  assert.deepEqual(meta.settings.navigation.expandedGroups,[]);
  assert.equal(document.querySelector('[data-nav-group="recruitment"]').hidden,true);
  assert.equal(document.querySelector('[data-nav-group="intelligence"]').hidden,true);

  document.querySelector('[data-nav-toggle="recruitment"]').click();
  await tick();
  document.querySelector('[data-page="candidates"]').click();
  await tick();
  meta=await readMeta(App1._test.state.db);
  assert.equal(meta.settings.activePage,'candidates');
  App1._test.state.db.close();
  dom1.window.close();

  const dom2=installDom();
  const App2=freshApp();
  assert.equal(await App2.start({indexedDB}),true);
  assert.equal(document.getElementById('ra-page-title').textContent,'Candidates');
  assert.deepEqual((await readMeta(App2._test.state.db)).settings.navigation.expandedGroups,['recruitment']);
  assert.equal(document.querySelector('[data-nav-toggle="recruitment"]').getAttribute('aria-expanded'),'true');
  assert.equal(document.querySelector('[data-nav-group="intelligence"]').hidden,true);
  App2._test.state.db.close();
  dom2.window.close();
});
