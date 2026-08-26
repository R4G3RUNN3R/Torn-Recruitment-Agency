const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const boot=fs.readFileSync(path.join(root,'R4G3RUNN3R-Recruitment-Agency.user.js'),'utf8');

function extractFunction(name){
  const match=boot.match(new RegExp(`function ${name}\\(([^)]*)\\) \\{([\\s\\S]*?)\\n  \\}\\n`));
  assert.ok(match,`${name} must be declared in the userscript`);
  return Function(...match[1].split(',').map(value=>value.trim()).filter(Boolean),match[2]);
}

test('Tampermonkey update metadata and GitHub transport are explicitly granted',()=>{
  assert.match(boot,/^\/\/\s*@grant\s+GM_info\s*$/m);
  assert.match(boot,/^\/\/\s*@grant\s+GM_xmlhttpRequest\s*$/m);
  assert.match(boot,/^\/\/\s*@connect\s+raw\.githubusercontent\.com\s*$/m);
  assert.match(boot,/^\/\/\s*@updateURL\s+https:\/\/raw\.githubusercontent\.com\/R4G3RUNN3R\/Torn-Recruitment-Agency\/main\/R4G3RUNN3R-Recruitment-Agency\.user\.js\s*$/m);
  assert.match(boot,/^\/\/\s*@downloadURL\s+https:\/\/raw\.githubusercontent\.com\/R4G3RUNN3R\/Torn-Recruitment-Agency\/main\/R4G3RUNN3R-Recruitment-Agency\.user\.js\s*$/m);
});

test('version comparison handles ordinary semantic release numbers',()=>{
  const compareVersions=extractFunction('compareVersions');
  assert.equal(compareVersions('4.6.1','4.6.0'),1);
  assert.equal(compareVersions('4.7.0','4.6.99'),1);
  assert.equal(compareVersions('4.6.0','4.6.0'),0);
  assert.equal(compareVersions('4.5.9','4.6.0'),-1);
});

test('automatic update checks are throttled to no more than once every six hours',()=>{
  assert.match(boot,/UPDATE_CHECK_INTERVAL_MS\s*=\s*6\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  const shouldCheckForUpdate=extractFunction('shouldCheckForUpdate');
  const now=1_800_000_000_000;
  assert.equal(shouldCheckForUpdate(0,now),true);
  assert.equal(shouldCheckForUpdate(now-(6*60*60*1000)+1,now),false);
  assert.equal(shouldCheckForUpdate(now-(6*60*60*1000),now),true);
});

test('update checker uses the installed Tampermonkey version and canonical public userscript',()=>{
  assert.match(boot,/GM_info\?\.script\?\.version/);
  assert.match(boot,/function checkForUpdates\(/);
  assert.match(boot,/GM_xmlhttpRequest\s*\(/);
  assert.match(boot,/LATEST_USERSCRIPT_URL/);
  assert.match(boot,/@version\\s\+\(\\d\+\\\.\\d\+\\\.\\d\+\)/);
  assert.match(boot,/compareVersions\(latestVersion, installedVersion\)\s*>\s*0/);
});

test('newer releases and runtime mismatches expose a visible one-click update path',()=>{
  assert.match(boot,/function showUpdateNotice\(/);
  assert.match(boot,/id\s*=\s*'ra-update-banner'/);
  assert.match(boot,/id\s*=\s*'ra-update-now'/);
  assert.match(boot,/Update Recruitment Agency/);
  assert.match(boot,/window\.open\(CANONICAL_INSTALL_URL/);
  assert.match(boot,/installation is out of sync/i);
  assert.match(boot,/showUpdateNotice\([\s\S]*runtimeVersion/);
});
