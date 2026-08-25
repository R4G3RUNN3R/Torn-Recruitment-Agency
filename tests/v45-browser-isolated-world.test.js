const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const MODULES = ['scout-core.js','results-core.js','global-core.js','match-core.js','forum-core.js','v45-runtime.js','v45-candidates.js','v45-discovery.js','v45-messaging.js','v46-domain-core.js','v46-storage-core.js','v46-navigation.js','v46-company-core.js','v46-company-storage.js','v46-company-ui.js','v46-company-operations.js','v46-company-workflow.js','v46-company-workflow-ui.js','v46-company-opportunity-ui.js','v46-company-platform.js','v45-app.js'];
function chromePath(){for(const cmd of ['google-chrome-stable','google-chrome','chromium-browser','chromium']){try{return execFileSync('which',[cmd],{encoding:'utf8'}).trim();}catch{}}throw new Error('No Chrome/Chromium executable found.');}
function serve(){const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#202020;color:#fff;font-family:Arial}.content{padding:20px}</style></head><body><div class="content"><section><h2>Information</h2><div><button>One</button><button>Two</button></div></section></div></body></html>`)});return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server)));}
async function physicalClick(page,selector){await page.waitForSelector(selector,{visible:true});const p=await page.$eval(selector,el=>{el.scrollIntoView({block:'center',inline:'nearest'});const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return{x,y,ok:hit===el||!!(hit&&el.contains(hit)),hit:hit&&(hit.id||hit.tagName)}});assert.equal(p.ok,true,`${selector} is covered by ${p.hit}`);await page.mouse.click(p.x,p.y);}
async function isolatedEval(client,contextId,expression,awaitPromise=false){const out=await client.send('Runtime.evaluate',{contextId,expression,awaitPromise,returnByValue:true});if(out.exceptionDetails)throw new Error(out.exceptionDetails.exception?.description||out.exceptionDetails.text);return out.result.value;}

test('Chrome isolated userscript world can mount DOM and receive physical page mouse clicks',{timeout:60000},async()=>{const server=await serve();const port=server.address().port;const browser=await puppeteer.launch({executablePath:chromePath(),headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});try{const page=await browser.newPage();await page.setViewport({width:1440,height:900});await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load'});
 const client=await page.target().createCDPSession();await client.send('Page.enable');await client.send('Runtime.enable');const tree=await client.send('Page.getFrameTree');const frameId=tree.frameTree.frame.id;const world=await client.send('Page.createIsolatedWorld',{frameId,worldName:'tampermonkey-userscript-test',grantUniveralAccess:true});const contextId=world.executionContextId;
 await isolatedEval(client,contextId,`globalThis.alert=()=>{};globalThis.confirm=()=>true;globalThis.prompt=()=>'';globalThis.open=()=>null;globalThis.__errors=[];globalThis.addEventListener('error',e=>__errors.push(String(e.error||e.message)));globalThis.addEventListener('unhandledrejection',e=>__errors.push(String(e.reason||'rejection')));`);
 for(const file of MODULES){const src=fs.readFileSync(path.join(ROOT,'src',file),'utf8');await isolatedEval(client,contextId,src);}
 assert.equal(await isolatedEval(client,contextId,`typeof RA_V45App`),'object');
 assert.equal(await isolatedEval(client,contextId,`RA_V45App.start().then(()=>true)`,true),true);
 assert.deepEqual(await isolatedEval(client,contextId,`__errors`),[]);
 const launcher=await page.evaluate(()=>['#ra-sidebar-launcher','#ra-launch'].find(s=>{const e=document.querySelector(s);return e&&getComputedStyle(e).display!=='none'})||'');assert.ok(launcher);await physicalClick(page,launcher);assert.equal(await page.$eval('#ra-app',e=>getComputedStyle(e).display),'block');
 await physicalClick(page,'[data-nav-toggle="intelligence"]');await page.waitForFunction(()=>document.querySelector('[data-nav-toggle="intelligence"]')?.getAttribute('aria-expanded')==='true');
 for(const [route,title] of [['company-discover','Company Discover'],['company-candidates','Company Candidates'],['company-pipeline','Company Pipeline'],['scout','Scout'],['smart-match','Smart Match'],['global-intelligence','Global Intelligence']]){await physicalClick(page,`[data-page="${route}"]`);await page.waitForFunction(t=>document.getElementById('ra-page-title')?.textContent===t,{},title);}
 await physicalClick(page,'#ra-settings-button');await page.waitForFunction(()=>document.getElementById('ra-page-title')?.textContent==='Settings');await physicalClick(page,'#ra-close');assert.equal(await page.$eval('#ra-app',e=>getComputedStyle(e).display),'none');assert.deepEqual(await isolatedEval(client,contextId,`__errors`),[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}});
