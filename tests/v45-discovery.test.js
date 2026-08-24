const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/v45-discovery');

test('feed definitions map company faction and training sources without inventing extra feeds', () => {
  const feeds=D.feedDefinitions({companyThreadId:'1',factionThreadId:'2',trainingThreadId:'3'});
  assert.deepEqual(feeds.map(feed=>[feed.feedId,feed.sourceType,feed.threadId]),[
    ['company','COMPANY FORUM','1'],['faction','FACTION FORUM','2'],['training','TRAIN BUYER','3']
  ]);
});

test('forum post converts to normalized source with conservative parsed intent', () => {
  const source=D.postToSource({id:9,author:{id:123,username:'Alice'},created_time:1000,content:'<p>Looking for 10* AN, buying 25-50 trains, available now</p>'},{feedId:'company',sourceType:'COMPANY FORUM',threadId:'77'},2000);
  assert.equal(source.userId,123);
  assert.equal(source.threadId,'77');
  assert.equal(source.parsed.desiredCompany,'Adult Novelties');
  assert.equal(source.parsed.wantsTrains,true);
  assert.equal(source.parsed.availability,'Available');
  assert.equal(source.body.includes('<p>'),false);
});

test('page processing persists source and candidate before counters and sanitized checkpoint last', async () => {
  const events=[];
  const candidates=new Map();
  let persistedSource=null;
  const result=await D.processDiscoveryPage({
    feed:{feedId:'company',sourceType:'COMPANY FORUM',threadId:'77'},
    posts:[{id:9,author:{id:123,username:'Alice'},created_time:1000,content:'Looking for AN, available now'}],
    continuation:'https://api.torn.com/v2/forum/77/posts?offset=20&key=secret&comment=ra',
    observedAt:2000000,
    persistSource:async source=>events.push(['source',source.sourceId]),
    getCandidate:async userId=>candidates.get(String(userId))||null,
    persistCandidate:async (candidate,source)=>{persistedSource=source;events.push(['candidate',candidate.userId]);candidates.set(String(candidate.userId),candidate);},
    persistCounters:async counters=>events.push(['counters',counters.postsExamined]),
    persistCheckpoint:async checkpoint=>events.push(['checkpoint',checkpoint.next])
  });
  assert.equal(persistedSource?.sourceType,'COMPANY FORUM');
  assert.deepEqual(events.map(event=>event[0]),['source','candidate','counters','checkpoint']);
  assert.equal(events[3][1],'https://api.torn.com/v2/forum/77/posts?offset=20');
  assert.equal(result.counters.candidatesCreated,1);
  assert.equal(result.counters.candidatesUpdated,0);
});

test('failed candidate persistence never advances checkpoint', async () => {
  const events=[];
  await assert.rejects(()=>D.processDiscoveryPage({
    feed:{feedId:'company',sourceType:'COMPANY FORUM',threadId:'77'},
    posts:[{id:9,author:{id:123,username:'Alice'},created_time:1000,content:'Looking for AN'}],
    continuation:'https://api.torn.com/v2/forum/77/posts?offset=20',
    persistSource:async()=>events.push('source'),
    getCandidate:async()=>null,
    persistCandidate:async()=>{events.push('candidate');throw new Error('disk full');},
    persistCounters:async()=>events.push('counters'),
    persistCheckpoint:async()=>events.push('checkpoint')
  }),/disk full/);
  assert.deepEqual(events,['source','candidate']);
});

test('manual add defaults stage to Not Contacted and preserves existing recruiter fields', () => {
  const existing={userId:'123',pipelineStage:'Replied',recruiterNote:'Keep',desiredRole:'Sales',manualFields:{desiredRole:'Sales'},discoverySources:['COMPANY FORUM'],createdAt:'old'};
  const row=D.addCandidateRecord({userId:123,availability:'Available'},existing,1000);
  assert.equal(row.pipelineStage,'Replied');
  assert.equal(row.recruiterNote,'Keep');
  assert.equal(row.desiredRole,'Sales');
  assert.equal(row.availability,'Available');
  assert.ok(row.discoverySources.includes('MANUAL'));
  const fresh=D.addCandidateRecord({userId:456},null,1000);
  assert.equal(fresh.pipelineStage,'Not Contacted');
});

test('Fill Companies plan only includes candidates missing current company', () => {
  assert.deepEqual(D.fillCompaniesPlan([{userId:1,currentCompany:''},{userId:2,currentCompany:'Pub'},{userId:3}]),[
    {userId:1,status:'pending',error:''},{userId:3,status:'pending',error:''}
  ]);
});
