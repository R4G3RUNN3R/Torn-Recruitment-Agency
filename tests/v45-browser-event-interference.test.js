const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const MODULES = ['scout-core.js','results-core.js','global-core.js','match-core.js','forum-core.js','v45-runtime.js','v45-candidates.js','v45-discovery.js','v45-messaging.js','v45-app.js'];

function chromePath(){
  for(const cmd of ['google-chrome-stable','google-chrome','chromium-browser','chromium']){
    try{return execFileSync('which',[cmd],{encoding:'utf8'}).trim();}catch{}
  }
  throw new Error('No Chrome/Chromium executable found.');
}

function serve(){
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/'){
      res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
      res.end(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#202020;color:#fff;font-family:Arial}.content{padding:20px}</style></head><body><div class="content"><section><h2>Information</h2><div><button>One</button><button>Two</button></div></section></div><script>
        window.__blockedClicks=0;
        document.addEventListener('click',event=>{
          if(event.target && event.target.closest && event.target.closest('#ra-app')){
            window.__blockedClicks++;
            event.stopImmediatePropagation();
          }
        },true);
        window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>'';window.open=()=>null;
      </script></body></html>`);
      return;
    }
    res.writeHead(404);res.end();
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server)));
}

async function physicalClick(page,selector){
  await page.waitForSelector(selector,{visible:true});
  const point=await page.$eval(selector,el=>{const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};});
  await page.mouse.click(point.x,point.y);
}

test('primary navigation and in-page controls survive a hostile document-capture click blocker',{timeout:60000},async()=>{
  const server=await serve();
  const port=server.address().port;
  const browser=await puppeteer.launch({executablePath:chromePath(),headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  try{
    const page=await browser.newPage();
    await page.setViewport({width:1440,height:900});
    await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load'});

    for(const file of MODULES){
      await page.addScriptTag({content:fs.readFileSync(path.join(ROOT,'src',file),'utf8')});
    }
    await page.addScriptTag({content:fs.readFileSync(path.join(ROOT,'R4G3RUNN3R-Recruitment-Agency.user.js'),'utf8')});
    await page.waitForFunction(()=>{
      if(!document.getElementById('ra-app')) return false;
      return ['#ra-sidebar-launcher','#ra-launch'].some(s=>{
        const e=document.querySelector(s);
        return e&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
      });
    },{timeout:5000});

    const launcher=await page.evaluate(()=>['#ra-sidebar-launcher','#ra-launch'].find(s=>{const e=document.querySelector(s);return e&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'})||'');
    assert.ok(launcher,'visible launcher should exist');
    await physicalClick(page,launcher);
    assert.equal(await page.$eval('#ra-app',e=>getComputedStyle(e).display),'block');

    await physicalClick(page,'[data-page="discover"]');
    await page.waitForFunction(()=>document.getElementById('ra-page-title')?.textContent==='Discover',{timeout:5000});
    assert.equal(await page.$eval('#ra-discover-more',e=>e.hidden),true,'Discover More starts closed');
    await physicalClick(page,'#ra-discover-menu');
    await page.waitForFunction(()=>document.getElementById('ra-discover-more')?.hidden===false,{timeout:5000});
    assert.equal(await page.$eval('#ra-page-title',e=>e.textContent),'Discover','in-page Discover control must not change route');

    await physicalClick(page,'[data-page="candidates"]');
    await page.waitForFunction(()=>document.getElementById('ra-page-title')?.textContent==='Candidates',{timeout:5000});
    assert.equal(await page.$eval('#ra-more-filter-box',e=>e.hidden),true,'Candidate extra filters start closed');
    await physicalClick(page,'#ra-more-filters');
    await page.waitForFunction(()=>document.getElementById('ra-more-filter-box')?.hidden===false,{timeout:5000});
    assert.equal(await page.$eval('#ra-page-title',e=>e.textContent),'Candidates','in-page Candidate control must not change route');

    for(const [route,title] of [['pipeline','Pipeline'],['scout','Scout'],['smart-match','Smart Match'],['global-intelligence','Global Intelligence']]){
      await physicalClick(page,`[data-page="${route}"]`);
      await page.waitForFunction(t=>document.getElementById('ra-page-title')?.textContent===t,{timeout:5000},title);
    }

    await physicalClick(page,'#ra-settings-button');
    await page.waitForFunction(()=>document.getElementById('ra-page-title')?.textContent==='Settings',{timeout:5000});
    await physicalClick(page,'#ra-close');
    assert.equal(await page.$eval('#ra-app',e=>getComputedStyle(e).display),'none');

    assert.equal(await page.evaluate(()=>window.__blockedClicks),0,'window capture shield should handle RA actions before document capture blocker');
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
});
