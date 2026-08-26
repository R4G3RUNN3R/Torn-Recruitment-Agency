const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

module.exports=function sourceCompatibleBoot(root){
  const boot=fs.readFileSync(path.join(root,'R4G3RUNN3R-Recruitment-Agency.user.js'),'utf8');
  const app=fs.readFileSync(path.join(root,'src','v45-app.js'),'utf8');
  const sourceVersion=app.match(/SCRIPT_VERSION\s*=\s*'([^']+)'/)?.[1];
  assert.ok(sourceVersion,'local source runtime must declare SCRIPT_VERSION');
  assert.match(boot,/const EXPECTED_APP_VERSION\s*=\s*'[^']+';/,'bootstrap must declare EXPECTED_APP_VERSION');
  return boot.replace(/const EXPECTED_APP_VERSION\s*=\s*'[^']+';/,`const EXPECTED_APP_VERSION = '${sourceVersion}';`);
};
