const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.join(__dirname,'..','src','v45-app.js'),'utf8');

test('Faction v4.7.3 hotfix source advertises runtime version 4.7.3 before public release pinning',()=>{
  assert.match(app,/SCRIPT_VERSION\s*=\s*'4\.7\.3'/);
  assert.match(app,/Recruitment Agency v4\.7 source started/);
});
