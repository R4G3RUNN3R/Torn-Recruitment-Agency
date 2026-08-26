const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.join(__dirname,'..','src','v45-app.js'),'utf8');

test('v4.7.5 public shell keeps the reviewed core runtime at 4.7.4',()=>{
  assert.match(app,/SCRIPT_VERSION\s*=\s*'4\.7\.4'/);
  assert.match(app,/Recruitment Agency v4\.7 source started/);
});
