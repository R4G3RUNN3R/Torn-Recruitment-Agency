const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');

test('release package version is 4.7.2',()=>{
  assert.equal(pkg.version,'4.7.2');
});

test('README identifies v4.7.2 as the public Faction Recruitment release',()=>{
  assert.match(readme,/Recruitment Agency \*\*v4\.7\.2\*\*/);
  assert.match(readme,/v4\.7 Faction Recruitment release/);
  assert.match(readme,/DB15/);
});
