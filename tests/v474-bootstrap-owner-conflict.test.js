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

test('new public bootstrap does not silently yield to an older Recruitment Agency owner', async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'https://www.torn.com/index.php',
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  const {window} = dom;
  window.ResizeObserver = ResizeObserverStub;
  window.alert = () => {};
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
  window.eval(BOOT);
  await settle(20);

  assert.equal(starts, 1, 'the current bootstrap must start instead of silently returning behind an older owner marker');
  assert.equal(window.document.documentElement.getAttribute('data-r4g3-ra-v45-owner'), '4.7.3');
  dom.window.close();
});
