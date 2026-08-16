const test = require('node:test');
const assert = require('node:assert/strict');
const V45 = require('../src/v45-runtime');

test('v4.5 navigation exposes exact routed application pages', () => {
  assert.deepEqual(V45.visiblePages('advanced').map(group => [group.label, group.pages.map(page => page.label)]), [
    ['RECRUITMENT', ['Overview','Discover','Candidates','Pipeline']],
    ['INTELLIGENCE', ['Scout','Smart Match','Global Intelligence']],
    ['APPLICATION', ['Settings','Data','Logs']]
  ]);
  assert.equal(V45.visiblePages('simple')[2].pages.some(page => page.id === 'logs'), false);
  assert.equal(V45.normalizePage('settings', 'simple'), 'settings');
  assert.equal(V45.normalizePage('logs', 'simple'), 'overview');
  assert.equal(V45.normalizePage('logs', 'advanced'), 'logs');
});

test('DB v12 plan is additive and defines forum source/checkpoint stores', () => {
  const plan = V45.dbUpgradePlan();
  assert.equal(plan.version, 12);
  assert.equal(plan.stores.forumSources.keyPath, 'sourceId');
  assert.deepEqual(plan.stores.forumSources.indexes.map(index => index.name), ['userId','postedAt','sourceType','threadId']);
  assert.equal(plan.stores.forumSyncState.keyPath, 'feedId');
});

test('candidate normalization uses exact six stages and explicit availability', () => {
  assert.deepEqual(V45.PIPELINE_STAGES, ['Not Contacted','Shortlisted','Contacted','Replied','Hired','Rejected']);
  assert.deepEqual(V45.AVAILABILITY_VALUES, ['Available','Unavailable','Unknown']);
  const row = V45.normalizeCandidateRecord({userId:123,pipelineStage:'replied',availability:'available now',discoverySources:['company','company','manual']});
  assert.equal(row.userId, '123');
  assert.equal(row.pipelineStage, 'Replied');
  assert.equal(row.availability, 'Available');
  assert.deepEqual(row.discoverySources, ['company','manual']);
});

test('recruitment settings include stage and availability colour defaults plus one global message', () => {
  const settings = V45.normalizeRecruitmentSettings({});
  assert.deepEqual(Object.keys(settings.stageColors), V45.PIPELINE_STAGES);
  assert.deepEqual(Object.keys(settings.availabilityColors), V45.AVAILABILITY_VALUES);
  assert.match(settings.defaultMessage, /\{name\}/);
  assert.match(settings.defaultMessage, /\{looking_for\}/);
});

test('sanitized logs exclude private recruitment and credential-shaped fields', () => {
  const entry = V45.makeLogEntry('sync','page complete',{
    feedId:'company',
    pages:3,
    apiKey:'secret',
    key:'secret',
    recruiterNote:'private',
    forumBody:'private body',
    preparedMessage:'private message',
    safeStatus:'resume available'
  }, 123);
  assert.deepEqual(entry, {
    at:123,
    type:'sync',
    message:'page complete',
    details:{feedId:'company',pages:3,safeStatus:'resume available'}
  });
});

test('overview KPIs count active, high match, shortlisted and replied candidates', () => {
  assert.deepEqual(V45.kpiCounts([
    {status:'active',matchScore:91,pipelineStage:'Shortlisted'},
    {status:'active',matchScore:55,pipelineStage:'Replied'},
    {status:'inactive',matchScore:99,pipelineStage:'Hired'}
  ]), {active:2,highMatch:2,shortlisted:1,replied:1});
});

test('context help covers every required v4.5 major surface', () => {
  for (const key of ['discovery','sync','fillCompanies','pipeline','messagePlayer','defaultMessage','data','logs']) {
    assert.ok(V45.HELP_REGISTRY[key], `missing help registry entry: ${key}`);
  }
});
