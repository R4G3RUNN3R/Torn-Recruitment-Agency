const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const MODULES = ['scout-core.js','results-core.js','global-core.js','match-core.js','forum-core.js','v45-runtime.js','v45-candidates.js','v45-discovery.js','v45-messaging.js','v46-domain-core.js','v46-storage-core.js','v46-navigation.js','v46-company-core.js','v45-app.js'];

function chromePath(){
  for(const cmd of ['google-chrome-stable','google-chrome','chromium-browser','chromium']){
    try{return execFileSync('which',[cmd],{encoding:'utf8'}).trim();}catch{}
  }
  throw new Error('No Chrome/Chromium executable found.');
}

function serve(){
  const server=http.createServer((req,res)=>{
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
    res.end(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#202020;color:#fff;font-family:Arial}</style></head><body><section><h2>Information</h2><div><button>One</button><button>Two</button></div></section><script>
      window.__blockedClicks=0;
      document.addEventListener('click',event=>{
        if(event.target && event.target.closest && event.target.closest('#ra-app')){
          window.__blockedClicks++;
          event.stopImmediatePropagation();
        }
      },true);
      window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>'';window.open=()=>null;
    </script></body></html>`);
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server)));
}

async function physicalClick(page,selector){
  await page.waitForSelector(selector,{visible:true});
  const point=await page.$eval(selector,el=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const hit=document.elementFromPoint(x,y);return{x,y,ok:hit===el||!!(hit&&el.contains(hit)),hit:hit&&(hit.id||hit.className||hit.tagName)};});
  assert.equal(point.ok,true,`${selector} is covered by ${String(point.hit)}`);
  await page.mouse.click(point.x,point.y);
}

async function appRect(page){return page.$eval('#ra-app',el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};});}

function approx(actual,expected,tolerance=3){assert.ok(Math.abs(actual-expected)<=tolerance,`expected ${actual} ~= ${expected}`);}

test('v4.5.4 shell scrolls, hides duplicate Settings and safely maximizes/restores',{timeout:60000},async()=>{
  const server=await serve();
  const port=server.address().port;
  const browser=await puppeteer.launch({executablePath:chromePath(),headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  try{
    const page=await browser.newPage();
    await page.setViewport({width:1280,height:720});
    await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load'});
    for(const file of MODULES)await page.addScriptTag({content:fs.readFileSync(path.join(ROOT,'src',file),'utf8')});
    await page.addScriptTag({content:fs.readFileSync(path.join(ROOT,'R4G3RUNN3R-Recruitment-Agency.user.js'),'utf8')});
    await page.waitForSelector('#ra-maximize',{visible:true});
    assert.equal(await page.$('[data-page="settings"]'),null,'Settings must not be duplicated in sidebar');
    assert.ok(await page.$('#ra-settings-button'),'titlebar Settings must remain');

    const scroll=await page.$eval('.ra-content',el=>({overflowY:getComputedStyle(el).overflowY,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight}));
    assert.ok(['auto','scroll'].includes(scroll.overflowY));

    const before=await appRect(page);
    await physicalClick(page,'#ra-maximize');
    await page.waitForFunction(()=>document.getElementById('ra-app')?.classList.contains('ra-maximized'));
    const maxed=await appRect(page);
    approx(maxed.x,0);approx(maxed.y,0);approx(maxed.width,1280);approx(maxed.height,720);
    assert.equal(await page.$eval('#ra-maximize',el=>el.textContent),'Restore');
    assert.equal(await page.$eval('#ra-app',el=>getComputedStyle(el).resize),'none');

    await page.setViewport({width:1100,height:650});
    await new Promise(r=>setTimeout(r,100));
    const resized=await appRect(page);
    approx(resized.width,1100);approx(resized.height,650);

    await physicalClick(page,'#ra-maximize');
    await page.waitForFunction(()=>!document.getElementById('ra-app')?.classList.contains('ra-maximized'));
    const restored=await appRect(page);
    approx(restored.width,Math.min(before.width,1100));
    approx(restored.height,Math.min(before.height,650));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
