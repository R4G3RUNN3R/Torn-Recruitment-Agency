const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(ROOT, 'src', 'v45-app.js'), 'utf8');
const wrapperSource = fs.readFileSync(path.join(ROOT, 'R4G3RUNN3R-Recruitment-Agency.user.js'), 'utf8');

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

test('v4.8 public shell hardens the light theme against dark-only source surfaces', () => {
  assert.match(wrapperSource, /:root\[data-ra-theme="light"\] #ra-app \.ra-titlebar/);
  assert.match(wrapperSource, /:root\[data-ra-theme="light"\] #ra-app \.ra-sidebar/);
  assert.match(wrapperSource, /:root\[data-ra-theme="light"\] #ra-app \.ra-panel/);
  assert.match(wrapperSource, /:root\[data-ra-theme="light"\] #ra-app \.ra-domain-switch/);
  assert.match(wrapperSource, /:root\[data-ra-theme="light"\] #ra-app \.ra-field input/);
  assert.match(wrapperSource, /:root\[data-ra-theme="light"\] #ra-app \.ra-log/);
  assert.match(wrapperSource, /background:linear-gradient\(180deg,var\(--ra-panel2\),var\(--ra-panel\)\)!important/);
  assert.match(wrapperSource, /background:var\(--ra-bg\)!important/);
});
