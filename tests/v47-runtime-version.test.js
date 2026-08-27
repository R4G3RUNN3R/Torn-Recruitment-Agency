const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.join(__dirname,'..','src','v45-app.js'),'utf8');

test('v4.7.6 Recruit release uses the v4.7.6 core runtime',()=>{
  assert.match(app,/SCRIPT_VERSION\s*=\s*'4\.7\.6'/);
  assert.match(app,/Recruitment Agency v4\.7 source started/);
});
