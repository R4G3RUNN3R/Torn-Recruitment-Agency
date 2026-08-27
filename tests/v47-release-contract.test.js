const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');

test('release package version is 4.7.6',()=>{
  assert.equal(pkg.version,'4.7.6');
});

test('README identifies v4.7.6 as the private-chat Recruit release',()=>{
  assert.match(readme,/Recruitment Agency \*\*v4\.7\.6\*\*/);
  assert.match(readme,/v4\.7 Faction Recruitment release/);
  assert.match(readme,/private chat/i);
  assert.match(readme,/Send[\s\S]*manual player action/i);
  assert.match(readme,/DB15/);
});

test('README install and history sections describe the released v4.7.6 runtime identity',()=>{
  assert.match(readme,/public userscript metadata and runtime version are \*\*4\.7\.6\*\*/i);
  assert.match(readme,/9475f00745f81173a114bb87451f654769b3d32a/);
  assert.match(readme,/EXPECTED_APP_VERSION[^\n]*4\.7\.6/i);
  assert.match(readme,/\*\*v4\.7\.6\*\*[^\n]*private-chat Recruit/i);
  assert.doesNotMatch(readme,/public userscript metadata and shell version are \*\*4\.7\.5\*\*/i);
});
