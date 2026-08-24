const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const MODULES = [
  'scout-core.js', 'results-core.js', 'global-core.js', 'match-core.js', 'forum-core.js',
  'v45-runtime.js', 'v45-candidates.js', 'v45-discovery.js', 'v45-messaging.js','v46-domain-core.js','v46-storage-core.js','v46-navigation.js','v45-app.js'
];

function chromePath() {
  for (const cmd of ['google-chrome-stable', 'google-chrome', 'chromium-browser', 'chromium']) {
    try {
      return execFileSync('which', [cmd], { encoding: 'utf8' }).trim();
    } catch {}
  }
  throw new Error('No Chrome/Chromium executable found on CI runner.');
}

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/') {
      const scripts = MODULES.map(file => `<script src="/src/${file}"></script>`).join('');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><html><head><meta charset="utf-8"><style>
        body{margin:0;font-family:Arial,sans-serif;background:#202020;color:#fff}
        #torn-shell{position:relative;min-height:100vh}
        .torn-header{height:52px;background:#111;position:relative;z-index:20}
        .torn-content{position:relative;z-index:1;padding:20px}
      </style></head><body><div id="torn-shell"><div class="torn-header"></div><div class="torn-content"><section><h2>Information</h2><div><button>One</button><button>Two</button></div></section></div></div>${scripts}<script>
        window.alert=()=>{}; window.confirm=()=>true; window.prompt=()=>''; window.open=()=>null;
        window.__startupError='';
        window.addEventListener('error',e=>{window.__startupError += String(e.error||e.message)+'\\n';});
        window.addEventListener('unhandledrejection',e=>{window.__startupError += String(e.reason||'unhandled rejection')+'\\n';});
        (async()=>{try{await window.RA_V45App.start();window.__raStarted=true;}catch(e){window.__startupError += String(e&&e.stack||e);window.__raStarted=false;}})();
      </script></body></html>`);
      return;
    }
    if (url.pathname.startsWith('/src/')) {
      const file = path.basename(url.pathname);
      if (!MODULES.includes(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' });
      res.end(fs.readFileSync(path.join(ROOT, 'src', file)));
      return;
    }
    res.writeHead(404); res.end();
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function physicalClick(page, selector) {
  await page.waitForSelector(selector, { visible: true });
  const info = await page.$eval(selector, el => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      x, y,
      hitTag: hit && hit.tagName,
      hitId: hit && hit.id,
      hitClass: hit && hit.className,
      isTarget: hit === el || !!(hit && el.contains(hit)),
      pointerEvents: getComputedStyle(el).pointerEvents,
      visibility: getComputedStyle(el).visibility,
      display: getComputedStyle(el).display,
      zIndex: getComputedStyle(el).zIndex
    };
  });
  assert.equal(info.isTarget, true, `${selector} is covered at its centre: ${JSON.stringify(info)}`);
  await page.mouse.click(info.x, info.y);
}

test('real Chrome hit-testing and physical clicks can navigate the v4.5 UI', { timeout: 60000 }, async () => {
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.__raStarted === true || window.__raStarted === false);
    const startupError = await page.evaluate(() => window.__startupError);
    assert.equal(startupError, '', `startup errors: ${startupError}`);
    assert.equal(await page.evaluate(() => window.__raStarted), true);

    const launcher = await page.evaluate(() => {
      for (const selector of ['#ra-sidebar-launcher', '#ra-launch']) {
        const el = document.querySelector(selector);
        if (el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden') return selector;
      }
      return '';
    });
    assert.ok(launcher, 'a visible Recruitment Agency launcher should exist');
    await physicalClick(page, launcher);
    assert.equal(await page.$eval('#ra-app', el => getComputedStyle(el).display), 'block');

    const routes = [
      ['discover', 'Discover'],
      ['candidates', 'Candidates'],
      ['pipeline', 'Pipeline'],
      ['scout', 'Scout'],
      ['smart-match', 'Smart Match'],
      ['global-intelligence', 'Global Intelligence']
    ];
    for (const [route, title] of routes) {
      await physicalClick(page, `[data-page="${route}"]`);
      await page.waitForFunction(expected => document.getElementById('ra-page-title')?.textContent === expected, {}, title);
    }

    await physicalClick(page, '#ra-settings-button');
    await page.waitForFunction(() => document.getElementById('ra-page-title')?.textContent === 'Settings');

    await physicalClick(page, '#ra-mobile-menu');
    assert.equal(await page.$eval('.ra-shell', el => el.classList.contains('sidebar-open')), true);

    await physicalClick(page, '#ra-close');
    assert.equal(await page.$eval('#ra-app', el => getComputedStyle(el).display), 'none');

    const runtimeErrors = await page.evaluate(() => window.__startupError);
    assert.equal(runtimeErrors, '', `runtime errors: ${runtimeErrors}`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
