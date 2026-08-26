const test = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const path = require('node:path');
const sourceCompatibleBoot = require('./source-compatible-boot');

const ROOT = path.join(__dirname, '..');
const BOOT = sourceCompatibleBoot(ROOT);

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}

const settle = ms => new Promise(resolve => setTimeout(resolve, ms));

function makeDom() {
  return new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'https://www.torn.com/index.php',
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
}

test('public bootstrap contains a one-reload stale-owner recovery path', () => {
  assert.match(BOOT, /r4g3-ra-owner-conflict-reload/, 'bootstrap must track one stale-owner recovery reload');
  assert.match(BOOT, /location\.reload\(\)/, 'bootstrap must hard reload once when an older owner is detected');
});

test('persistent older owner is reported explicitly instead of silently winning forever', async () => {
  const dom = makeDom();
  const {window} = dom;
  window.ResizeObserver = ResizeObserverStub;
  const alerts = [];
  window.alert = message => alerts.push(String(message));
  window.confirm = () => true;
  window.prompt = () => '';
  window.open = () => null;

  let starts = 0;
  window.RA_V45App = {
    SCRIPT_VERSION: '4.7.3',
    start: async () => { starts += 1; return true; },
    _test: { state: { settings: {}, page: 'company-overview' } }
  };

  window.document.documentElement.setAttribute('data-r4g3-ra-v45-owner', '4.7.1');
  window.sessionStorage.setItem('r4g3-ra-owner-conflict-reload', '4.7.1->4.7.3');
  window.eval(BOOT);
  await settle(20);

  assert.equal(starts, 0, 'two active versions must never be force-run together');
  assert.equal(window.document.documentElement.getAttribute('data-r4g3-ra-v45-owner'), '4.7.1');
  assert.equal(alerts.length, 1, 'persistent duplicate ownership must be visible to the user');
  assert.match(alerts[0], /4\.7\.1/);
  assert.match(alerts[0], /duplicate|another active/i);
  dom.window.close();
});
