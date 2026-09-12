const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
const app=fs.readFileSync(path.join(root,'src/v45-app.js'),'utf8');
const boot=fs.readFileSync(path.join(root,'R4G3RUNN3R-Recruitment-Agency.user.js'),'utf8');

test('v4.8 shell release preserves the reviewed v4.7.6 application core',()=>{
  assert.equal(pkg.version,'4.8.0');
  assert.match(app,/SCRIPT_VERSION\s*=\s*'4\.7\.6'/);
  assert.match(boot,/EXPECTED_APP_VERSION\s*=\s*'4\.7\.6'/);
  assert.match(boot,/@version\s+4\.8\.0/);
});

test('README preserves v4.7.6 private-chat Recruit provenance',()=>{
  assert.match(readme,/Recruitment Agency \*\*v4\.7\.6\*\*/);
  assert.match(readme,/v4\.7 Faction Recruitment release/);
  assert.match(readme,/private chat/i);
  assert.match(readme,/Send[\s\S]*manual player action/i);
  assert.match(readme,/DB15/);
});

test('v4.7.6 history keeps immutable reviewed core provenance',()=>{
  assert.match(readme,/9475f00745f81173a114bb87451f654769b3d32a/);
  assert.match(readme,/\*\*v4\.7\.6\*\*[^\n]*private-chat Recruit/i);
  assert.doesNotMatch(readme,/public userscript metadata and shell version are \*\*4\.7\.5\*\*/i);
});
