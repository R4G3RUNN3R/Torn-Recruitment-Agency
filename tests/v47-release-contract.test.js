const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');

test('release package version is 4.7.5',()=>{
  assert.equal(pkg.version,'4.7.5');
});

test('README identifies v4.7.5 as the public shell release over the v4.7.4 immutable core',()=>{
  assert.match(readme,/Recruitment Agency \*\*v4\.7\.5\*\*/);
  assert.match(readme,/v4\.7 Faction Recruitment release/);
  assert.match(readme,/999a2f9eafd28891dc5de461f08b1d29bbd41eea/);
  assert.match(readme,/core runtime remains \*\*v4\.7\.4\*\*/i);
  assert.match(readme,/DB15/);
});
