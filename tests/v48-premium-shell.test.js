const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(ROOT, 'src', 'v45-app.js'), 'utf8');

test('v4.8 shell provides an explicit Company/Faction mode switch', () => {
  assert.match(appSource, /class=\\?"ra-domain-switch/);
  assert.match(appSource, /data-domain=\\?"company/);
  assert.match(appSource, /data-domain=\\?"faction/);
});

test('v4.8 settings exposes optional feature toggles instead of forcing every workspace into navigation', () => {
  assert.match(appSource, /Optional Features/);
  assert.match(appSource, /data-optional-module/);
  assert.match(appSource, /optionalModules/);
});

test('v4.8 premium shell uses Voidsmith graphite and restrained red accent tokens', () => {
  assert.match(appSource, /--ra-bg:#0b0b0d/);
  assert.match(appSource, /--ra-accent:#b94a4a/);
  assert.match(appSource, /VOIDSMITH INDUSTRIES/);
});
