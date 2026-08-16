const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ResultsCore = require('../src/results-core');

const userscript = fs.readFileSync(path.join(__dirname, '..', 'R4G3RUNN3R-Recruitment-Agency.user.js'), 'utf8');

test('v4.4 keeps the Torn API hard limit and minimum scheduler gap', () => {
  assert.match(userscript, /MIN_API_GAP_MS\s*=\s*800/);
  assert.match(userscript, /Math\.min\(75,\s*n\(value,\s*75\)\)/);
  assert.match(userscript, /Math\.max\(MIN_API_GAP_MS,\s*rateGap\)/);
});

test('v4.4 contains no protected Recruit Scout backend or destructive DB upgrade hooks', () => {
  assert.doesNotMatch(userscript, /rs\.dnonetwork\.com/i);
  assert.doesNotMatch(userscript, /\/api\/grade/i);
  assert.doesNotMatch(userscript, /script-session/i);
  assert.doesNotMatch(userscript, /deleteObjectStore\s*\(/);
});

test('v4.4 keeps Match optional in default Results columns', () => {
  assert.ok(ResultsCore.COLUMN_DEFS.some(column => column.key === 'match'));
  assert.equal(ResultsCore.DEFAULT_VISIBLE_COLUMNS.includes('match'), false);
});

test('Smart Match recalculation paths do not call Torn API helpers', () => {
  for (const name of ['refreshMatchScores', 'evaluateRowMatch', 'saveCandidateEdit']) {
    const start = userscript.indexOf(`function ${name}`);
    assert.notEqual(start, -1, `missing ${name}`);
    const nextFunction = userscript.indexOf('\n    function ', start + 1);
    const nextAsyncFunction = userscript.indexOf('\n    async function ', start + 1);
    const candidates = [nextFunction, nextAsyncFunction].filter(x => x > start);
    const end = candidates.length ? Math.min(...candidates) : start + 5000;
    const block = userscript.slice(start, end);
    assert.doesNotMatch(block, /tornTorn\s*\(|scoutTorn\s*\(|rawTorn\s*\(/, `${name} must remain local-only`);
  }
});
