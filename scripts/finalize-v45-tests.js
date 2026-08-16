'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const write=(p,c)=>fs.writeFileSync(path.join(root,p),c);

// The former scaffold-only suite is superseded by v45-shell-static + v45-release-static.
try{fs.rmSync(path.join(root,'tests','v45-static.test.js'));}catch{}

write('tests/global-transport-static.test.js',`const test=require('node:test');\nconst assert=require('node:assert/strict');\nconst fs=require('node:fs');\nconst path=require('node:path');\nconst root=path.join(__dirname,'..');\nconst boot=fs.readFileSync(path.join(root,'R4G3RUNN3R-Recruitment-Agency.user.js'),'utf8');\nconst app=fs.readFileSync(path.join(root,'src','v45-app.js'),'utf8');\n\ntest('global transport grant remains limited to Google Apps Script hosts',()=>{assert.match(boot,/@connect\\s+script\\.google\\.com/);assert.match(boot,/@connect\\s+script\\.googleusercontent\\.com/);assert.doesNotMatch(boot,/@connect\\s+\\*/);});\n\ntest('global JSON transport prefers GM_xmlhttpRequest and retains fetch fallback',()=>{assert.match(app,/typeof globalThis\\.GM_xmlhttpRequest===['\"]function['\"]/);assert.match(app,/globalThis\\.GM_xmlhttpRequest/);assert.match(app,/await fetch\\(url/);});\n`);

let userTests=fs.readFileSync(path.join(root,'tests','userscript-static.test.js'),'utf8');
userTests=userTests.replace("'Shift'","'shiftKey'");
write('tests/userscript-static.test.js',userTests);
console.log('v4.5 legacy test alignment completed');
