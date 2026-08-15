const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'R4G3RUNN3R-Recruitment-Agency.user.js');
const source = () => fs.readFileSync(file, 'utf8');

test('global transport grants cross-origin requests only to Google Apps Script hosts', () => {
  const s = source();
  assert.match(s, /@grant\s+GM_xmlhttpRequest/);
  assert.match(s, /@connect\s+script\.google\.com/);
  assert.match(s, /@connect\s+script\.googleusercontent\.com/);
  assert.doesNotMatch(s, /@connect\s+\*/);
});

test('global JSON transport prefers GM_xmlhttpRequest and retains fetch fallback', () => {
  const s = source();
  assert.match(s, /typeof\s+GM_xmlhttpRequest\s*===\s*["']function["']/);
  assert.match(s, /GM_xmlhttpRequest\s*\(/);
  assert.match(s, /fetch\s*\(url/);
});
