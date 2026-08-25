const fs=require('node:fs');
const path=require('node:path');
const file=path.join(__dirname,'..','src','v45-app.js');
let src=fs.readFileSync(file,'utf8');

function replaceOnce(search,replacement,label){
  if(!src.includes(search))throw new Error(`Patch guard failed: ${label}`);
  src=src.replace(search,replacement);
}

replaceOnce(
"    V46CompanyStorage: root && root.RA_V46CompanyStorage\n  };",
"    V46CompanyStorage: root && root.RA_V46CompanyStorage,\n    V46CompanyPlatform: root && root.RA_V46CompanyPlatform\n  };",
'browser CompanyPlatform dependency'
);
replaceOnce(
"    deps.V46CompanyStorage = require('./v46-company-storage');\n  }",
"    deps.V46CompanyStorage = require('./v46-company-storage');\n    deps.V46CompanyPlatform = require('./v46-company-platform');\n  }",
'CommonJS CompanyPlatform dependency'
);
replaceOnce(
"  const {ScoutCore,ResultsCore,GlobalCore,MatchCore,ForumCore,Runtime,Candidates,Discovery,Messaging,V46Domain,V46Storage,V46Navigation,V46CompanyCore,V46CompanyStorage} = D;\n  if (![ScoutCore,ResultsCore,GlobalCore,MatchCore,ForumCore,Runtime,Candidates,Discovery,Messaging,V46Domain,V46Storage,V46Navigation,V46CompanyCore,V46CompanyStorage].every(Boolean)) {",
"  const {ScoutCore,ResultsCore,GlobalCore,MatchCore,ForumCore,Runtime,Candidates,Discovery,Messaging,V46Domain,V46Storage,V46Navigation,V46CompanyCore,V46CompanyStorage,V46CompanyPlatform} = D;\n  if (![ScoutCore,ResultsCore,GlobalCore,MatchCore,ForumCore,Runtime,Candidates,Discovery,Messaging,V46Domain,V46Storage,V46Navigation,V46CompanyCore,V46CompanyStorage,V46CompanyPlatform].every(Boolean)) {",
'factory CompanyPlatform dependency'
);
replaceOnce(
"  const companyRepositories=V46CompanyStorage.createRepositories(idb,V46CompanyCore);",
"  const companyRepositories=V46CompanyStorage.createRepositories(idb,V46CompanyCore);\n  const companyPlatformApp={_test:{state,repositories,companyRepositories}};",
'Company platform facade'
);

const routePattern=/  async function route\(page,persist=true\)\{[^\n]*\}\n\n  async function saveCandidate/;
if(!routePattern.test(src))throw new Error('Patch guard failed: route function');
src=src.replace(routePattern,`  async function route(page,persist=true){
    state.page=V46Navigation.normalizeRoute(page,state.settings.complexity);
    if(persist)await saveSettings({activePage:state.page});
    if(V46CompanyPlatform._test.IMPLEMENTED_ROUTES.has(state.page)){
      await V46CompanyPlatform.renderPage(state.page,{persist:false});
      rebuildNav();
      bindHelp();
      document.querySelector('.ra-shell')?.classList.remove('sidebar-open');
      stopLogRefresh();
      return;
    }
    const [title,description]=pageMeta(state.page);
    document.getElementById('ra-page-title').textContent=title;
    document.getElementById('ra-page-desc').textContent=description;
    const content=document.getElementById('ra-content');
    content.innerHTML=await (renderers[state.page]||renderOverview)();
    rebuildNav();bindPageControls();bindHelp();bindCandidateInteractions();
    document.querySelector('.ra-shell')?.classList.remove('sidebar-open');
    if(state.page==='logs')startLogRefresh();else stopLogRefresh();
  }

  async function saveCandidate`);

const startPattern=/  async function start\(options=\{\}\)\{[^\n]*\}\n\n  return Object\.freeze/;
if(!startPattern.test(src))throw new Error('Patch guard failed: start function');
src=src.replace(startPattern,`  async function start(options={}){
    if(state.mounted)return;
    state.db=options.db||await openDB(options.indexedDB);
    state.settings=mergeSettings((await getMeta()).settings||{});
    state.page=V46Navigation.normalizeRoute(state.settings.activePage,state.settings.complexity);
    const meta=await getMeta();meta.settings=state.settings;meta.ui=meta.ui||{windowGeometry:{}};await idb.put('meta',meta);
    await migrateLegacyUsers();await repositories.backfillLegacy(Date.now());await ensureDefaultMatchProfile();
    if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
    applyTheme();mount();state.mounted=true;
    V46CompanyPlatform.install(companyPlatformApp,{renderInitial:false});
    await route(state.page,false);
    ensureTornLauncher();syncLauncherVisibility();
    const observer=new MutationObserver(()=>{if(!document.getElementById('ra-sidebar-launcher'))ensureTornLauncher();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    await logEvent('startup','Recruitment Agency v4.6 source started',{version:SCRIPT_VERSION,dbVersion:DB_VERSION});
    if(state.settings.global.enabled&&globalEndpoint())void flushGlobalQueue(false);
    return true;
  }

  return Object.freeze`);

fs.writeFileSync(file,src);
console.log('Patched src/v45-app.js with v4.6 Company platform delegation.');
