const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const MODULES = ['scout-core.js','results-core.js','global-core.js','match-core.js','forum-core.js','v45-runtime.js','v45-candidates.js','v45-discovery.js','v45-messaging.js','v46-domain-core.js','v46-storage-core.js','v46-navigation.js','v46-company-core.js','v46-company-storage.js','v46-company-ui.js','v46-company-operations.js','v46-company-workflow.js','v46-company-workflow-ui.js','v46-company-opportunity-ui.js','v46-company-platform.js','v45-app.js'];
function chromePath(){for(const cmd of ['google-chrome-stable','google-chrome','chromium-browser','chromium']){try{return execFileSync('which',[cmd],{encoding:'utf8'}).trim();}catch{}}throw new Error('No Chrome/Chromium executable found.');}
async function physicalClick(page,selector){await page.waitForSelector(selector,{visible:true});const p=await page.$eval(selector,el=>{const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return{x,y,ok:hit===el||!!(hit&&el.contains(hit)),hit:hit&&(hit.id||hit.className||hit.tagName)}});assert.equal(p.ok,true,`${selector} is covered by ${String(p.hit)}`);await page.mouse.click(p.x,p.y);}

test('exact v4.5 runtime remains physically clickable on the real Torn host page',{timeout:90000},async()=>{const browser=await puppeteer.launch({executablePath:chromePath(),headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});try{const page=await browser.newPage();await page.setViewport({width:1440,height:900});const browserErrors=[];page.on('pageerror',e=>browserErrors.push(String(e)));const response=await page.goto('https://www.torn.com/',{waitUntil:'domcontentloaded',timeout:45000});assert.ok(response,'Torn should return a response');assert.ok(response.status()<500,`Torn returned HTTP ${response.status()}`);
 await page.evaluate(()=>{window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>'';window.open=()=>null;});
 for(const file of MODULES){await page.addScriptTag({content:fs.readFileSync(path.join(ROOT,'src',file),'utf8')});}
 const started=await page.evaluate(async()=>{try{await window.RA_V45App.start();return{ok:true,error:''}}catch(e){return{ok:false,error:String(e&&e.stack||e)}}});assert.equal(started.ok,true,started.error);
 const launcher=await page.evaluate(()=>['#ra-sidebar-launcher','#ra-launch'].find(s=>{const e=document.querySelector(s);return e&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'})||'');assert.ok(launcher,'visible Recruitment Agency launcher should exist on Torn');await physicalClick(page,launcher);assert.equal(await page.$eval('#ra-app',e=>getComputedStyle(e).display),'block');
 await physicalClick(page,'[data-nav-toggle="intelligence"]');await page.waitForFunction(()=>document.querySelector('[data-nav-toggle="intelligence"]')?.getAttribute('aria-expanded')==='true',{timeout:10000});
 for(const [route,title] of [['company-discover','Company Discover'],['company-candidates','Company Candidates'],['company-pipeline','Company Pipeline'],['scout','Scout'],['smart-match','Smart Match'],['global-intelligence','Global Intelligence']]){await physicalClick(page,`[data-page="${route}"]`);await page.waitForFunction(t=>document.getElementById('ra-page-title')?.textContent===t,{timeout:10000},title);}
 await physicalClick(page,'#ra-settings-button');await page.waitForFunction(()=>document.getElementById('ra-page-title')?.textContent==='Settings',{timeout:10000});await physicalClick(page,'#ra-close');assert.equal(await page.$eval('#ra-app',e=>getComputedStyle(e).display),'none');
 const ownErrors=browserErrors.filter(x=>/Recruitment Agency|RA_V45|v45-app/i.test(x));assert.deepEqual(ownErrors,[]);
}finally{await browser.close();}});
