const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'..','src','v45-app.js'),'utf8');
const forum=fs.readFileSync(path.join(__dirname,'..','src','forum-core.js'),'utf8');
const candidates=fs.readFileSync(path.join(__dirname,'..','src','v45-candidates.js'),'utf8');

test('forum sources preserve body/name/url aliases while sanitized continuation remains credential-free',()=>{assert.match(forum,/postUrl: text\(source\.postUrl \|\| source\.url \|\| source\.forumUrl\)/);assert.match(forum,/authorName:/);assert.match(forum,/source\.text \?\? source\.body/);assert.match(candidates,/source\.postUrl \|\| source\.url/);});

test('Candidates delegates filtering and sorting to ResultsCore',()=>{assert.match(app,/ResultsCore\.processRows\(rows,filters,ResultsCore\.DEFAULT_SORT/);assert.match(app,/activeAgeDays:state\.settings\.recruitment\.candidateActiveAgeDays/);});

test('safe discovery exposes resume state without raw cursor UI',()=>{assert.match(app,/Resume available/);assert.match(app,/Discovery\.processDiscoveryPage/);assert.doesNotMatch(app,/next cursor|continuation URL/i);});

test('Message Player prepares locally, leaves clipboard fallback visible, and never advances stage',()=>{assert.match(app,/Clipboard failed\. Message remains selected/);assert.match(app,/Messaging\.composeUrl/);const a=app.indexOf('async function openMessageModal');const b=app.indexOf('function showModal',a);const block=app.slice(a,b);assert.equal(block.includes('changeCandidateStage'),false);});

test('hard reset is scoped to known Recruitment Agency stores',()=>{assert.match(app,/const STORE_NAMES = Object\.freeze/);assert.match(app,/for\(const store of STORE_NAMES\)await idb\.clear/);assert.doesNotMatch(app,/localStorage\.clear|sessionStorage\.clear|indexedDB\.deleteDatabase/);});
