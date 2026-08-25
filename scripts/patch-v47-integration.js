const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const appPath=path.join(ROOT,'src','v45-app.js');
const pkgPath=path.join(ROOT,'package.json');

function fail(message){throw new Error(message);}
function replaceOnce(source,needle,replacement,label){
  if(!source.includes(needle))fail(`Patch anchor missing: ${label}`);
  return source.replace(needle,replacement);
}
function replaceRegexOnce(source,regex,replacement,label){
  const matches=[...source.matchAll(new RegExp(regex.source,regex.flags.includes('g')?regex.flags:regex.flags+'g'))];
  if(matches.length!==1)fail(`Patch anchor ${label} matched ${matches.length} times`);
  return source.replace(regex,replacement);
}

let app=fs.readFileSync(appPath,'utf8');
if(app.includes('V47FactionPlatform:root&&root.RA_V47FactionPlatform'))fail('v45-app.js already appears integrated.');

app=replaceOnce(app,
`    V46CompanyPlatform:root&&root.RA_V46CompanyPlatform,`,
`    V46CompanyPlatform:root&&root.RA_V46CompanyPlatform,\n    V47FactionCore:root&&root.RA_V47FactionCore,\n    V47FactionStorage:root&&root.RA_V47FactionStorage,\n    V47FactionUI:root&&root.RA_V47FactionUI,\n    V47FactionOperations:root&&root.RA_V47FactionOperations,\n    V47FactionWorkflow:root&&root.RA_V47FactionWorkflow,\n    V47FactionWorkflowUI:root&&root.RA_V47FactionWorkflowUI,\n    V47FactionOpportunityUI:root&&root.RA_V47FactionOpportunityUI,\n    V47FactionPlatform:root&&root.RA_V47FactionPlatform,`,
'browser dependency map');

app=replaceOnce(app,
`    deps.V46CompanyPlatform=require('./v46-company-platform');`,
`    deps.V46CompanyPlatform=require('./v46-company-platform');\n    deps.V47FactionCore=require('./v47-faction-core');\n    deps.V47FactionStorage=require('./v47-faction-storage');\n    deps.V47FactionUI=require('./v47-faction-ui');\n    deps.V47FactionOperations=require('./v47-faction-operations');\n    deps.V47FactionWorkflow=require('./v47-faction-workflow');\n    deps.V47FactionWorkflowUI=require('./v47-faction-workflow-ui');\n    deps.V47FactionOpportunityUI=require('./v47-faction-opportunity-ui');\n    deps.V47FactionPlatform=require('./v47-faction-platform');`,
'CommonJS dependencies');

app=replaceOnce(app,
`  const {ScoutCore,ResultsCore,GlobalCore,MatchCore,ForumCore,Runtime,Candidates,Discovery,Messaging,V46Domain,V46Storage,V46Navigation,V46CompanyCore,V46CompanyStorage,V46CompanyUI,V46CompanyOperations,V46CompanyWorkflow,V46CompanyWorkflowUI,V46CompanyOpportunityUI,V46CompanyPlatform}=D;`,
`  const {ScoutCore,ResultsCore,GlobalCore,MatchCore,ForumCore,Runtime,Candidates,Discovery,Messaging,V46Domain,V46Storage,V46Navigation,V46CompanyCore,V46CompanyStorage,V46CompanyUI,V46CompanyOperations,V46CompanyWorkflow,V46CompanyWorkflowUI,V46CompanyOpportunityUI,V46CompanyPlatform,V47FactionCore,V47FactionStorage,V47FactionUI,V47FactionOperations,V47FactionWorkflow,V47FactionWorkflowUI,V47FactionOpportunityUI,V47FactionPlatform}=D;`,
'factory destructure');

app=replaceOnce(app,
`  if(!ScoutCore||!ResultsCore||!GlobalCore||!MatchCore||!ForumCore||!Runtime||!Candidates||!Discovery||!Messaging||!V46Domain||!V46Storage||!V46Navigation||!V46CompanyCore||!V46CompanyStorage||!V46CompanyUI||!V46CompanyOperations||!V46CompanyWorkflow||!V46CompanyWorkflowUI||!V46CompanyOpportunityUI||!V46CompanyPlatform) throw new Error('Recruitment Agency dependencies are required.');`,
`  if(!ScoutCore||!ResultsCore||!GlobalCore||!MatchCore||!ForumCore||!Runtime||!Candidates||!Discovery||!Messaging||!V46Domain||!V46Storage||!V46Navigation||!V46CompanyCore||!V46CompanyStorage||!V46CompanyUI||!V46CompanyOperations||!V46CompanyWorkflow||!V46CompanyWorkflowUI||!V46CompanyOpportunityUI||!V46CompanyPlatform||!V47FactionCore||!V47FactionStorage||!V47FactionUI||!V47FactionOperations||!V47FactionWorkflow||!V47FactionWorkflowUI||!V47FactionOpportunityUI||!V47FactionPlatform) throw new Error('Recruitment Agency dependencies are required.');`,
'dependency guard');

app=replaceOnce(app,`  const DB_VERSION=V46CompanyStorage.DB_VERSION;`,`  const DB_VERSION=V47FactionStorage.DB_VERSION;`,'DB15 target');
app=replaceOnce(app,
`'companyVacancies','companyCampaigns','companyRecruitmentConfig','companyRecruitmentSessions','meta'`,
`'companyVacancies','companyCampaigns','companyRecruitmentConfig','companyRecruitmentSessions','factionSpecialistProfiles','factionCampaigns','factionRecruitmentConfig','factionRecruitmentSessions','meta'`,
'hard reset support stores');
app=replaceOnce(app,
`      V46Storage.applyUpgrade(db);\n      V46CompanyStorage.applyUpgrade(db);`,
`      V46Storage.applyUpgrade(db);\n      V46CompanyStorage.applyUpgrade(db);\n      V47FactionStorage.applyUpgrade(db);`,
'additive DB upgrade order');
app=replaceOnce(app,
`  const repositories=V46Storage.createRepositories(idb);\n  const companyRepositories=V46CompanyStorage.createRepositories(idb,V46CompanyCore);\n  const companyPlatformApp={_test:{state,repositories,companyRepositories}};`,
`  const repositories=V46Storage.createRepositories(idb);\n  const companyRepositories=V46CompanyStorage.createRepositories(idb,V46CompanyCore);\n  const factionRepositories=V47FactionStorage.createRepositories(idb,V47FactionCore);\n  const companyPlatformApp={_test:{state,repositories,companyRepositories,factionRepositories}};`,
'Faction repositories');

const companyRoute=/if\(companyRepositories&&V46CompanyPlatform\._test\.IMPLEMENTED_ROUTES\.has\(state\.page\)\)\{await V46CompanyPlatform\.renderPage\(state\.page\);const meta=await getMeta\(\);meta\.settings=state\.settings;await setMeta\(meta\);return;\}/;
app=replaceRegexOnce(app,companyRoute,match=>`${match}\n    if(factionRepositories&&V47FactionPlatform._test.IMPLEMENTED_ROUTES.has(state.page)){await V47FactionPlatform.renderPage(state.page);const meta=await getMeta();meta.settings=state.settings;await setMeta(meta);return;}`,'Faction route delegation');

app=replaceOnce(app,
`    V46CompanyPlatform.syncNavigation?.();\n    bindUi();`,
`    V46CompanyPlatform.syncNavigation?.();\n    V47FactionPlatform.syncNavigation?.();\n    bindUi();`,
'synchronous navigation rebinding');
app=replaceOnce(app,
`    V46CompanyPlatform.install(companyPlatformApp,{renderInitial:false});\n    await route(state.page,false);`,
`    V46CompanyPlatform.install(companyPlatformApp,{renderInitial:false});\n    V47FactionPlatform.install(companyPlatformApp,{renderInitial:false});\n    await route(state.page,false);`,
'platform install');
app=replaceOnce(app,
`return Object.freeze({SCRIPT_VERSION,DB_VERSION,HARD_API_RATE,MIN_API_GAP_MS,DEFAULT_VISIBLE_COLUMNS,OPTIONAL_COLUMNS,openDB,mergeSettings,start,_test:{state,repositories,companyRepositories,recruitmentDomainForFeed,persistDiscoveredCandidate,deleteCompanyCandidateData,clearRecruitmentData,applyCandidateFilters,candidateCsvRow,matchAvailability,forumThreadUrl}});`,
`return Object.freeze({SCRIPT_VERSION,DB_VERSION,HARD_API_RATE,MIN_API_GAP_MS,DEFAULT_VISIBLE_COLUMNS,OPTIONAL_COLUMNS,openDB,mergeSettings,start,_test:{state,repositories,companyRepositories,factionRepositories,recruitmentDomainForFeed,persistDiscoveredCandidate,deleteCompanyCandidateData,clearRecruitmentData,applyCandidateFilters,candidateCsvRow,matchAvailability,forumThreadUrl}});`,
'_test Faction repository exposure');
app=replaceOnce(app,
`for(const store of ['users','candidateLocal','companyRecruitment','factionRecruitment','forumSources','forumSyncState'])await idb.clear(store);`,
`for(const store of ['users','candidateLocal','companyRecruitment','factionRecruitment','companyVacancies','companyCampaigns','companyRecruitmentConfig','companyRecruitmentSessions','factionSpecialistProfiles','factionCampaigns','factionRecruitmentConfig','factionRecruitmentSessions','forumSources','forumSyncState'])await idb.clear(store);`,
'clear recruitment support stores');

fs.writeFileSync(appPath,app);

const factionSyntax=[
  'src/v47-faction-core.js','src/v47-faction-storage.js','src/v47-faction-ui.js','src/v47-faction-operations.js',
  'src/v47-faction-workflow.js','src/v47-faction-workflow-ui.js','src/v47-faction-opportunity-ui.js','src/v47-faction-platform.js'
].map(file=>`node -c ${file}`).join(' && ');
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
const syntaxAnchor='node -c src/v46-company-platform.js && node -c src/v45-app.js';
if(!pkg.scripts?.syntax?.includes(syntaxAnchor))fail('package.json syntax anchor missing');
pkg.scripts.syntax=pkg.scripts.syntax.replace(syntaxAnchor,`node -c src/v46-company-platform.js && ${factionSyntax} && node -c src/v45-app.js`);
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');

const factionFiles=[
  'v47-faction-core.js','v47-faction-storage.js','v47-faction-ui.js','v47-faction-operations.js',
  'v47-faction-workflow.js','v47-faction-workflow-ui.js','v47-faction-opportunity-ui.js','v47-faction-platform.js'
];
const testsDir=path.join(ROOT,'tests');
let harnessCount=0;
for(const name of fs.readdirSync(testsDir)){
  if(!name.endsWith('.js'))continue;
  const file=path.join(testsDir,name);
  let source=fs.readFileSync(file,'utf8');
  if(!source.includes('v45-app.js')||!source.includes('v46-company-platform.js')||source.includes('v47-faction-core.js'))continue;
  const pattern=/(^[ \t]*)(['\"]v46-company-platform\.js['\"])(\s*,\s*)(['\"]v45-app\.js['\"])/m;
  if(!pattern.test(source))continue;
  source=source.replace(pattern,(full,indent,company,separator,appFile)=>{
    const quote=company[0];
    const middle=factionFiles.map(file=>`${quote}${file}${quote}`).join(',');
    return `${indent}${company},${middle},${appFile}`;
  });
  fs.writeFileSync(file,source);
  harnessCount++;
}
if(harnessCount<4)fail(`Expected to patch at least 4 browser harnesses, patched ${harnessCount}`);

console.log(`v4.7 app integration patched; browser harnesses updated: ${harnessCount}`);
