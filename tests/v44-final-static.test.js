const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'..','src','v45-app.js'),'utf8');
const Global=require('../src/global-core');

test('release keeps exact Global Intelligence whitelist',()=>{assert.deepEqual([...Global.GLOBAL_FIELDS],['playerId','name','observedAt','level','ee','activity30','xanax30','refills30','attacks30','rwHits30','networth','fit','fitType','lastActive','scoutStatus','sourceVersion']);});

test('release contains no protected Recruit Scout backend or destructive migration hook',()=>{assert.doesNotMatch(app,/rs\.dnonetwork\.com|\/api\/grade|script-session/i);assert.doesNotMatch(app,/deleteObjectStore\s*\(/);});

test('all Torn calls use the shared request scheduler',()=>{assert.match(app,/async function tornRequest/);assert.match(app,/await reserveApiCall/);assert.match(app,/fetchForumPage/);assert.match(app,/fillCompanies/);assert.match(app,/scoutPlayer/);});

test('private recruitment fields never enter the Global observation construction',()=>{const a=app.indexOf('function globalObservation');const b=app.indexOf('async function enqueueGlobalObservation',a);const block=app.slice(a,b);for(const field of ['recruiterNote','expectedSalary','pipelineStage','defaultMessage','latestForumSourceId'])assert.equal(block.includes(field),false,field);assert.match(block,/GlobalCore\.sanitizeObservation/);});
