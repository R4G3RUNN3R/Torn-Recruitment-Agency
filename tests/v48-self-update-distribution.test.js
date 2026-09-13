const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const userscript = fs.readFileSync(path.join(ROOT, 'R4G3RUNN3R-Recruitment-Agency.user.js'), 'utf8');
const STABLE_URL = 'https://voidsmithindustries.com/torn/recruitment-agency/recruitment-agency.user.js';

test('v4.8 migration release points future userscript updates at the Voidsmith VPS', () => {
  assert.match(userscript, new RegExp(`@downloadURL\\s+${STABLE_URL.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`));
  assert.match(userscript, new RegExp(`@updateURL\\s+${STABLE_URL.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`));
});

test('v4.8 release metadata keeps a single stable update authority', () => {
  const updateLines = userscript.match(/^\/\/ @(?:downloadURL|updateURL)\s+.+$/gm) || [];
  assert.equal(updateLines.length, 2);
  for (const line of updateLines) assert.ok(line.endsWith(STABLE_URL), line);
});
