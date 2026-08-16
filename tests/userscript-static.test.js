const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const boot=fs.readFileSync(path.join(root,'R4G3RUNN3R-Recruitment-Agency.user.js'),'utf8');
const app=fs.readFileSync(path.join(root,'src/v45-app.js'),'utf8');
const PINNED_RUNTIME='9b22dc3478d7d57dba6ff3354681767b35cf0ba6';

test('public userscript is the v4.5.1 modular bootstrap with immutable runtime requires',()=>{
  assert.match(boot,/@version\s+4\.5\.1/);
  for(const file of ['scout-core.js','results-core.js','global-core.js','match-core.js','forum-core.js','v45-runtime.js','v45-candidates.js','v45-discovery.js','v45-messaging.js','v45-app.js']){
    assert.ok(boot.includes(`/${PINNED_RUNTIME}/src/${file}`),`pinned ${file}`);
  }
  assert.doesNotMatch(boot,/@require\s+https:\/\/raw\.githubusercontent\.com\/R4G3RUNN3R\/Torn-Recruitment-Agency\/main\/src\//);
  assert.match(boot,/EXPECTED_APP_VERSION\s*=\s*'4\.5\.0'/);
  assert.match(boot,/app\.SCRIPT_VERSION/);
  assert.match(boot,/app\.start\(\)/);
});

test('v4.5 app targets additive DB12 and shared scheduler',()=>{assert.match(app,/DB_VERSION\s*=\s*12/);assert.doesNotMatch(app,/deleteObjectStore\s*\(/);assert.match(app,/HARD_API_RATE\s*=\s*75/);assert.match(app,/MIN_API_GAP_MS\s*=\s*800/);assert.match(app,/Math\.max\(MIN_API_GAP_MS,60000\/clampRate/);});

test('v4.5 keeps Smart Match local and messaging manual',()=>{assert.match(app,/Smart Match.*zero Torn API calls/i);assert.match(app,/you still click Send/);assert.doesNotMatch(app,/autoSubmit\s*:\s*true/);assert.doesNotMatch(app,/pipelineStage\s*=\s*['"]Contacted['"]s*;.*message/s);});

test('Settings is a real routed page and Danger Zone uses inline biohazard SVG',()=>{assert.match(app,/id=\"ra-settings-button\"/);assert.match(app,/document\.getElementById\('ra-settings-button'\)\.onclick=\(\)=>route\('settings'\)/);for(const section of ['General','Recruitment','Scout','Candidates','Smart Match','Global Intelligence','Data & Reset','Danger Zone'])assert.ok(app.includes(section));assert.match(app,/function biohazardSvg/);assert.match(app,/NUKE IT ALL!/);assert.match(app,/Type NUKE to confirm/);});

test('candidate workspace, drawer, context menu, hover and pipeline are operational',()=>{for(const token of ['renderCandidates','renderPipeline','openDrawer','openContextMenu','openCandidateHover','ra-inline-stage','data-drop-stage','shiftKey'])assert.ok(app.includes(token),token);assert.deepEqual(require('../src/v45-runtime').PIPELINE_STAGES,['Not Contacted','Shortlisted','Contacted','Replied','Hired','Rejected']);});
