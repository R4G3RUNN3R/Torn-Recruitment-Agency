const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const puppeteer=require('puppeteer-core');

const ROOT=path.join(__dirname,'..');
const MODULES=['scout-core.js','results-core.js','global-core.js','match-core.js','forum-core.js','v45-runtime.js','v45-candidates.js','v45-discovery.js','v45-messaging.js','v46-domain-core.js','v46-storage-core.js','v46-navigation.js','v46-company-core.js','v45-app.js'];
function chromePath(){for(const cmd of ['google-chrome-stable','google-chrome','chromium-browser','chromium']){try{return execFileSync('which',[cmd],{encoding:'utf8'}).trim();}catch{}}throw new Error('No Chrome/Chromium executable found.');}
function serve(){const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/'){const scripts=MODULES.map(f=>`<script src="/src/${f}"></script>`).join('');res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#202020;color:#fff;font-family:Arial}.content{padding:20px}</style></head><body><div class="content"><section><h2>Information</h2><div><button>One</button><button>Two</button></div></section></div>${scripts}<script>
window.__blocked=0;window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>'';window.open=()=>null;
document.addEventListener('click',e=>{if(e.target?.closest?.('#ra-app')){window.__blocked++;e.stopImmediatePropagation();}},true);
(async()=>{try{await RA_V45App.start();window.__started=true}catch(e){window.__error=String(e&&e.stack||e);window.__started=false}})();
</script></body></html>`);return;}if(url.pathname.startsWith('/src/')){const file=path.basename(url.pathname);if(!MODULES.includes(file)){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':'application/javascript'});res.end(fs.readFileSync(path.join(ROOT,'src',file)));return;}res.writeHead(404);res.end();});return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server)));}
async function physicalClick(page,selector){await page.waitForSelector(selector,{visible:true});const p=await page.$eval(selector,el=>{const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return{x,y,ok:hit===el||!!(hit&&el.contains(hit)),hit:hit&&(hit.id||hit.className||hit.tagName)}});assert.equal(p.ok,true,`${selector} is covered by ${p.hit}`);await page.mouse.click(p.x,p.y);}

test('all six Company Recruitment routes remain physically clickable under hostile capture',{timeout:60000},async()=>{const server=await serve();const port=server.address().port;const browser=await puppeteer.launch({executablePath:chromePath(),headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});try{const page=await browser.newPage();await page.setViewport({width:1440,height:900});await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__started===true||window.__started===false);assert.equal(await page.evaluate(()=>window.__error||''),'');assert.equal(await page.evaluate(()=>window.__started),true);
 const launcher=await page.evaluate(()=>['#ra-sidebar-launcher','#ra-launch'].find(s=>{const e=document.querySelector(s);return e&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'})||'');assert.ok(launcher);await physicalClick(page,launcher);
 assert.equal(await page.$eval('[data-nav-toggle="company-recruitment"]',e=>e.getAttribute('aria-expanded')),'true');
 for(const [route,title] of [
  ['company-overview','Company Overview'],
  ['company-today','Company Today'],
  ['company-discover','Company Discover'],
  ['company-candidates','Company Candidates'],
  ['company-pipeline','Company Pipeline'],
  ['company-vacancies','Company Vacancies']
 ]){await physicalClick(page,`[data-page="${route}"]`);await page.waitForFunction(t=>document.getElementById('ra-page-title')?.textContent===t,{timeout:5000},title);}
 assert.equal(await page.evaluate(()=>window.__blocked),0,'window-level RA click shield must beat hostile document capture');
}finally{await browser.close();await new Promise(r=>server.close(r));}});
