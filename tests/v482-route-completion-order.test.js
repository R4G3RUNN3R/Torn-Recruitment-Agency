const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.join(__dirname,'..','src','v45-app.js'),'utf8');

test('Company and Faction route completion cannot publish the final page title before sidebar replacement',()=>{
  const start=app.indexOf('async function route(page,persist=true)');
  const end=app.indexOf('async function saveCandidate',start);
  assert.ok(start>=0&&end>start,'route function should be present');
  const route=app.slice(start,end);

  const companyBranch=route.slice(route.indexOf("if(V46CompanyPlatform._test.IMPLEMENTED_ROUTES.has(state.page))"),route.indexOf("if(V47FactionPlatform._test.IMPLEMENTED_ROUTES.has(state.page))"));
  assert.ok(companyBranch.indexOf('rebuildNav();')>=0,'Company route should rebuild sidebar');
  assert.ok(companyBranch.indexOf('rebuildNav();')<companyBranch.indexOf('await V46CompanyPlatform.renderPage'),'Company sidebar replacement must complete before Company render publishes its final title');

  const factionStart=route.indexOf("if(V47FactionPlatform._test.IMPLEMENTED_ROUTES.has(state.page))");
  const factionBranch=route.slice(factionStart,route.indexOf('const [title,description]=pageMeta',factionStart));
  assert.ok(factionBranch.indexOf('rebuildNav();')>=0,'Faction route should rebuild sidebar');
  assert.ok(factionBranch.indexOf('rebuildNav();')<factionBranch.indexOf('await V47FactionPlatform.renderPage'),'Faction sidebar replacement must complete before Faction render publishes its final title');
});
