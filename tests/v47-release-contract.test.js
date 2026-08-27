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
  assert.match(readme,/manual.*Send/i);
  assert.match(readme,/DB15/);
});
