const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const appPath=path.join(ROOT,'src','v45-app.js');
const pkgPath=path.join(ROOT,'package.json');

function fail(message){throw new Error(message);}
function replaceOnce(source,needle,replacement,label){
  const count=source.split(needle).length-1;
  if(count!==1)fail(`Patch anchor ${label} matched ${count} times`);
  return source.replace(needle,replacement);
}
function replaceRegexOnce(source,regex,replacement,label){
  const probe=new RegExp(regex.source,regex.flags.replace('g','')+'g');
  const matches=[...source.matchAll(probe)];
  if(matches.length!==1)fail(`Patch anchor ${label} matched ${matches.length} times`);
  return source.replace(regex,replacement);
}

let app=fs.readFileSync(appPath,'utf8');
if(app.includes('RA_V47FactionPlatform'))fail('v45-app.js already appears integrated.');

app=replaceRegexOnce(app,
  /(\s+V46CompanyPlatform:\s*root\s*&&\s*root\.RA_V46CompanyPlatform)(\r?\n\s*};)/,
  `$1,\n    V47FactionCore: root && root.RA_V47FactionCore,\n    V47FactionStorage: root && root.RA_V47FactionStorage,\n    V47FactionUI: root && root.RA_V47FactionUI,\n    V47FactionOperations: root && root.RA_V47FactionOperations,\n    V47FactionWorkflow: root && root.RA_V47FactionWorkflow,\n    V47FactionWorkflowUI: root && root.RA_V47FactionWorkflowUI,\n    V47FactionOpportunityUI: root && root.RA_V47FactionOpportunityUI,\n    V47FactionPlatform: root && root.RA_V47FactionPlatform$2`,
  'browser dependency map');

app=replaceOnce(app,
  `    deps.V46CompanyPlatform = require('./v46-company-platform');`,
  `    deps.V46CompanyPlatform = require('./v46-company-platform');\n    deps.V47FactionCore = require('./v47-faction-core');\n    deps.V47FactionStorage = require('./v47-faction-storage');\n    deps.V47FactionUI = require('./v47-faction-ui');\n    deps.V47FactionOperations = require('./v47-faction-operations');\n    deps.V47FactionWorkflow = require('./v47-faction-workflow');\n    deps.V47FactionWorkflowUI = require('./v47-faction-workflow-ui');\n    deps.V47FactionOpportunityUI = require('./v47-faction-opportunity-ui');\n    deps.V47FactionPlatform = require('./v47-faction-platform');`,
  'CommonJS dependencies');

app=replaceRegexOnce(app,
  /const \{([^\n}]*),V46CompanyPlatform\} = D;/,
  (match,before)=>`const {${before},V46CompanyPlatform,V47FactionCore,V47FactionStorage,V47FactionUI,V47FactionOperations,V47FactionWorkflow,V47FactionWorkflowUI,V47FactionOpportunityUI,V47FactionPlatform} = D;`,
  'factory destructure');

app=replaceRegexOnce(app,
  /\[([^\n\]]*),V46CompanyPlatform\]\.every\(Boolean\)/,
  (match,before)=>`[${before},V46CompanyPlatform,V47FactionCore,V47FactionStorage,V47FactionUI,V47FactionOperations,V47FactionWorkflow,V47FactionWorkflowUI,V47FactionOpportunityUI,V47FactionPlatform].every(Boolean)`,
  'dependency guard');

app=replaceOnce(app,`  const DB_VERSION = V46CompanyStorage.DB_VERSION;`,`  const DB_VERSION = V47FactionStorage.DB_VERSION;`,'DB15 target');
app=replaceOnce(app,`'companyRecruitmentSessions']);`,`'companyRecruitmentSessions','factionSpecialistProfiles','factionCampaigns','factionRecruitmentConfig','factionRecruitmentSessions']);`,'STORE_NAMES DB15 support stores');
app=replaceOnce(app,`        V46Storage.applyUpgrade(db);\n        V46CompanyStorage.applyUpgrade(db);`,`        V46Storage.applyUpgrade(db);\n        V46CompanyStorage.applyUpgrade(db);\n        V47FactionStorage.applyUpgrade(db);`,'additive DB upgrade order');
app=replaceOnce(app,`  const repositories=V46Storage.createRepositories(idb);\n  const companyRepositories=V46CompanyStorage.createRepositories(idb,V46CompanyCore);\n  const companyPlatformApp={_test:{state,repositories,companyRepositories}};`,`  const repositories=V46Storage.createRepositories(idb);\n  const companyRepositories=V46CompanyStorage.createRepositories(idb,V46CompanyCore);\n  const factionRepositories=V47FactionStorage.createRepositories(idb,V47FactionCore);\n  const companyPlatformApp={_test:{state,repositories,companyRepositories,factionRepositories}};`,'Faction repositories');

const companyRouteBlock=`    if(V46CompanyPlatform._test.IMPLEMENTED_ROUTES.has(state.page)){\n      await V46CompanyPlatform.renderPage(state.page,{persist:false});\n      rebuildNav();\n      bindHelp();\n      document.querySelector('.ra-shell')?.classList.remove('sidebar-open');\n      stopLogRefresh();\n      return;\n    }`;
app=replaceOnce(app,companyRouteBlock,`${companyRouteBlock}\n    if(V47FactionPlatform._test.IMPLEMENTED_ROUTES.has(state.page)){\n      await V47FactionPlatform.renderPage(state.page,{persist:false});\n      rebuildNav();\n      bindHelp();\n      document.querySelector('.ra-shell')?.classList.remove('sidebar-open');\n      stopLogRefresh();\n      return;\n    }`,'Faction route delegation');

app=replaceOnce(app,`V46CompanyPlatform.syncNavigation?.();document.querySelector`,`V46CompanyPlatform.syncNavigation?.();V47FactionPlatform.syncNavigation?.();document.querySelector`,'synchronous Faction navigation rebinding');
app=replaceOnce(app,`    V46CompanyPlatform.install(companyPlatformApp,{renderInitial:false});\n    await route(state.page,false);`,`    V46CompanyPlatform.install(companyPlatformApp,{renderInitial:false});\n    V47FactionPlatform.install(companyPlatformApp,{renderInitial:false});\n    await route(state.page,false);`,'Faction platform install');
app=replaceOnce(app,`  async function clearRecruitmentData(){for(const store of ['users','candidateLocal','companyRecruitment','factionRecruitment','forumSources','forumSyncState'])await idb.clear(store);return true;}`,`  async function clearRecruitmentData(){for(const store of ['users','candidateLocal','companyRecruitment','factionRecruitment','companyVacancies','companyCampaigns','companyRecruitmentConfig','companyRecruitmentSessions','factionSpecialistProfiles','factionCampaigns','factionRecruitmentConfig','factionRecruitmentSessions','forumSources','forumSyncState'])await idb.clear(store);return true;}`,'clear Recruitment DB15 support stores');
app=replaceOnce(app,`_test:{state,repositories,companyRepositories,recruitmentDomainForFeed`,`_test:{state,repositories,companyRepositories,factionRepositories,recruitmentDomainForFeed`,'_test Faction repository exposure');

fs.writeFileSync(appPath,app);

const factionFiles=['v47-faction-core.js','v47-faction-storage.js','v47-faction-ui.js','v47-faction-operations.js','v47-faction-workflow.js','v47-faction-workflow-ui.js','v47-faction-opportunity-ui.js','v47-faction-platform.js'];
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
const syntaxAnchor='node --check src/v46-company-platform.js && node --check src/v45-app.js';
if(!pkg.scripts?.syntax?.includes(syntaxAnchor))fail('package.json syntax anchor missing');
const factionSyntax=factionFiles.map(file=>`node --check src/${file}`).join(' && ');
pkg.scripts.syntax=pkg.scripts.syntax.replace(syntaxAnchor,`node --check src/v46-company-platform.js && ${factionSyntax} && node --check src/v45-app.js`);
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');

const testsDir=path.join(ROOT,'tests');
let harnessCount=0;
for(const name of fs.readdirSync(testsDir)){
  if(!name.endsWith('.js'))continue;
  const file=path.join(testsDir,name);
  let source=fs.readFileSync(file,'utf8');
  if(!source.includes('v45-app.js')||!source.includes('v46-company-platform.js')||source.includes('v47-faction-core.js'))continue;
  const pattern=/(['"]v46-company-platform\.js['"])(\s*,\s*)(['"]v45-app\.js['"])/;
  if(!pattern.test(source))continue;
  source=source.replace(pattern,(full,company,separator,appFile)=>{const quote=company[0];return `${company},${factionFiles.map(item=>`${quote}${item}${quote}`).join(',')},${appFile}`;});
  fs.writeFileSync(file,source);
  harnessCount++;
}
if(harnessCount<4)fail(`Expected to patch at least 4 browser harnesses, patched ${harnessCount}`);
console.log(`v4.7 app integration patched; browser harnesses updated: ${harnessCount}`);
