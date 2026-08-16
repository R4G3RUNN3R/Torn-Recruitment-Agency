const test = require('node:test');
const assert = require('node:assert/strict');
const MatchCore = require('../src/match-core');

test('positive numeric criteria scale linearly and cap at full weight', () => {
  assert.deepEqual(MatchCore.scoreNumeric(50, 100, 20), {known:true, earned:10, available:20, ratio:0.5});
  assert.deepEqual(MatchCore.scoreNumeric(150, 100, 20), {known:true, earned:20, available:20, ratio:1});
  assert.deepEqual(MatchCore.scoreNumeric(null, 100, 20), {known:false, earned:0, available:0, ratio:null});
});

test('salary rewards values at or below budget and degrades proportionally above it', () => {
  assert.equal(MatchCore.scoreSalary(2_000_000, 2_000_000, 15).earned, 15);
  assert.equal(MatchCore.scoreSalary(1_500_000, 2_000_000, 15).earned, 15);
  assert.equal(MatchCore.scoreSalary(4_000_000, 2_000_000, 20).earned, 10);
  assert.equal(MatchCore.scoreSalary(null, 2_000_000, 20).known, false);
});

test('categorical matching normalizes role/company/availability and excludes unknowns', () => {
  assert.equal(MatchCore.normalizeRole('  Sales   Assistant '), 'sales assistant');
  assert.equal(MatchCore.normalizeCompany('Adult Novelties'), 'adult_novelties');
  assert.equal(MatchCore.normalizeAvailability('Immediate'), 'immediate');

  assert.deepEqual(
    MatchCore.scoreCategorical(' Sales Assistant ', 'sales assistant', 10, MatchCore.normalizeRole),
    {known:true, earned:10, available:10, ratio:1}
  );
  assert.deepEqual(
    MatchCore.scoreCategorical('', 'sales assistant', 10, MatchCore.normalizeRole),
    {known:false, earned:0, available:0, ratio:null}
  );
});
