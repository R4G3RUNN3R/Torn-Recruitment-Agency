const test = require('node:test');
const assert = require('node:assert/strict');
const ForumCore = require('../src/forum-core');

test('pipeline stages are exactly the approved six', () => {
  assert.deepEqual(ForumCore.PIPELINE_STAGES, [
    'Not Contacted',
    'Shortlisted',
    'Contacted',
    'Replied',
    'Hired',
    'Rejected'
  ]);
});

test('availability values stay explicit and conservative', () => {
  assert.deepEqual(ForumCore.AVAILABILITY_VALUES, ['Available', 'Unavailable', 'Unknown']);
  assert.equal(ForumCore.normalizeAvailability('available now'), 'Available');
  assert.equal(ForumCore.normalizeAvailability('not available'), 'Unavailable');
  assert.equal(ForumCore.normalizeAvailability('maybe next week'), 'Unknown');
});

test('continuation removes credentials and rejects non Torn v2 URLs', () => {
  assert.equal(
    ForumCore.sanitizeContinuation('https://api.torn.com/v2/forum/123/posts?offset=20&key=secret&comment=ra'),
    'https://api.torn.com/v2/forum/123/posts?offset=20'
  );
  assert.equal(ForumCore.sanitizeContinuation('https://evil.example/v2/forum/123/posts?key=secret'), '');
  assert.equal(ForumCore.sanitizeContinuation('https://api.torn.com/v1/forum/123/posts'), '');
  assert.equal(ForumCore.sanitizeContinuation('javascript:alert(1)'), '');
});

test('forum parser recognises explicit company, train range, stat and availability', () => {
  assert.deepEqual(
    ForumCore.parseForumIntent('Looking for a 10* AN, buying 25-50 trains, INT preferred, available now'),
    {
      desiredCompany: 'Adult Novelties',
      desiredCompanyStars: 10,
      desiredRole: '',
      wantsTrains: true,
      trainAmountMin: 25,
      trainAmountMax: 50,
      primaryWorkStat: 'INT',
      availability: 'Available'
    }
  );
});

test('ambiguous forum wording remains unknown rather than being invented', () => {
  assert.deepEqual(
    ForumCore.parseForumIntent('Open to something interesting later. Message me.'),
    {
      desiredCompany: '',
      desiredCompanyStars: null,
      desiredRole: '',
      wantsTrains: false,
      trainAmountMin: null,
      trainAmountMax: null,
      primaryWorkStat: '',
      availability: 'Unknown'
    }
  );
});

test('source IDs are deterministic and include provenance identity', () => {
  const input = {sourceType:'JOB SEEKER', threadId:'15907925', postId:'42', userId:123};
  assert.equal(ForumCore.sourceIdFor(input), 'JOB SEEKER:15907925:42:123');
  assert.equal(ForumCore.sourceIdFor(input), ForumCore.sourceIdFor({...input}));
});

test('source merge preserves recruiter fields and pipeline state', () => {
  const candidate = {
    userId: 123,
    pipelineStage: 'Replied',
    recruiterNote: 'Strong candidate',
    expectedSalary: 5000000,
    desiredCompany: 'Oil Rig',
    desiredRole: 'Sales',
    availability: 'Unavailable',
    manualFields: {
      desiredCompany: 'Oil Rig',
      desiredRole: 'Sales',
      availability: 'Unavailable',
      expectedSalary: 5000000
    }
  };
  const merged = ForumCore.mergeCandidateFromSource(candidate, {
    sourceType: 'JOB SEEKER',
    threadId: '15907925',
    postId: '42',
    userId: 123,
    parsed: {
      desiredCompany: 'Adult Novelties',
      desiredRole: 'Manager',
      availability: 'Available',
      wantsTrains: true,
      trainAmountMin: 25,
      trainAmountMax: 50
    }
  });

  assert.equal(merged.pipelineStage, 'Replied');
  assert.equal(merged.recruiterNote, 'Strong candidate');
  assert.equal(merged.expectedSalary, 5000000);
  assert.equal(merged.desiredCompany, 'Oil Rig');
  assert.equal(merged.desiredRole, 'Sales');
  assert.equal(merged.availability, 'Unavailable');
  assert.ok(merged.discoverySources.includes('JOB SEEKER'));
});

test('message substitution uses only approved placeholders and cleans unknowns', () => {
  assert.equal(
    ForumCore.substituteMessage(
      'Hi {name}, I saw {looking_for}. Current company: {current_company}. {unknown_value}',
      {name:'Alice', looking_for:'10* AN', current_company:''}
    ),
    'Hi Alice, I saw 10* AN. Current company:.'
  );
  assert.equal(
    ForumCore.substituteMessage('Player {name} [{player_id}] - Match {match_score} / Fit {fit_score}', {
      name:'Alice', player_id:123, match_score:92, fit_score:81
    }),
    'Player Alice [123] - Match 92 / Fit 81'
  );
});
