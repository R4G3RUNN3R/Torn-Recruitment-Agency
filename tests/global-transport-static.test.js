const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const boot=fs.readFileSync(path.join(root,'R4G3RUNN3R-Recruitment-Agency.user.js'),'utf8');
const app=fs.readFileSync(path.join(root,'src','v45-app.js'),'utf8');

test('global transport grant remains limited to Google Apps Script hosts',()=>{assert.match(boot,/@connect\s+script\.google\.com/);assert.match(boot,/@connect\s+script\.googleusercontent\.com/);assert.doesNotMatch(boot,/@connect\s+\*/);});

test('global JSON transport prefers GM_xmlhttpRequest and retains fetch fallback',()=>{assert.match(app,/typeof globalThis\.GM_xmlhttpRequest===['"]function['"]/);assert.match(app,/globalThis\.GM_xmlhttpRequest/);assert.match(app,/await fetch\(url/);});
