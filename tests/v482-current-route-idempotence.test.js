const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.join(__dirname,'..','src','v45-app.js'),'utf8');

test('user navigation to the already-active route is a no-op, while explicit non-persist refresh remains allowed',()=>{
  const start=app.indexOf('async function route(page,persist=true)');
  const end=app.indexOf('async function saveCandidate',start);
  assert.ok(start>=0&&end>start,'route function should be present');
  const route=app.slice(start,end);
  const guard="if(requested===state.page&&persist){document.querySelector('.ra-shell')?.classList.remove('sidebar-open');return true;}";
  const guardIndex=route.indexOf(guard);
  const assignmentIndex=route.indexOf('state.page=requested;');
  const persistenceIndex=route.indexOf("if(persist)await saveSettings({activePage:state.page});");
  assert.ok(guardIndex>=0,'active-route guard should be present');
  assert.ok(guardIndex<assignmentIndex,'active-route guard must run before route state mutation');
  assert.ok(guardIndex<persistenceIndex,'active-route guard must run before async persistence can replace live controls');
  assert.match(guard,/classList\.remove\('sidebar-open'\)/,'active-route mobile navigation should close the open sidebar');
  assert.doesNotMatch(guard,/persist===false/,'non-persist refreshes must not be suppressed');
});
