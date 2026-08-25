const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const boot=fs.readFileSync(path.join(root,'R4G3RUNN3R-Recruitment-Agency.user.js'),'utf8');

test('published userscript runtime pin actually matches EXPECTED_APP_VERSION',async()=>{
  const expected=boot.match(/EXPECTED_APP_VERSION\s*=\s*'([^']+)'/)?.[1];
  assert.ok(expected,'EXPECTED_APP_VERSION must be declared');

  const appRequire=boot.match(/^\/\/\s*@require\s+(https:\/\/raw\.githubusercontent\.com\/R4G3RUNN3R\/Torn-Recruitment-Agency\/([0-9a-f]{40})\/src\/v45-app\.js)\s*$/m);
  assert.ok(appRequire,'v45-app.js must be loaded from an immutable 40-character commit pin');

  const response=await fetch(appRequire[1],{headers:{'cache-control':'no-cache'}});
  assert.equal(response.status,200,`pinned v45-app.js must be fetchable from ${appRequire[2]}`);
  const pinnedApp=await response.text();
  const actual=pinnedApp.match(/SCRIPT_VERSION\s*=\s*'([^']+)'/)?.[1];
  assert.ok(actual,'pinned v45-app.js must declare SCRIPT_VERSION');
  assert.equal(actual,expected,`userscript expects runtime ${expected} but immutable pin ${appRequire[2]} serves runtime ${actual}`);
});
