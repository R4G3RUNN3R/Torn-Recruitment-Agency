const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.join(__dirname,'..');

function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8');}
function write(rel,text){fs.writeFileSync(path.join(ROOT,rel),text);}
function replaceOnce(text,oldText,newText,label){
  const first=text.indexOf(oldText);
  if(first<0)throw new Error(`Missing expected source for ${label}`);
  if(text.indexOf(oldText,first+oldText.length)>=0)throw new Error(`Expected unique source for ${label}`);
  return text.slice(0,first)+newText+text.slice(first+oldText.length);
}

let app=read('src/v45-app.js');
app=replaceOnce(app,
`    V46Storage: root && root.RA_V46StorageCore,\n    V46Navigation: root && root.RA_V46Navigation\n`,
`    V46Storage: root && root.RA_V46StorageCore,\n    V46Navigation: root && root.RA_V46Navigation,\n    V46CompanyCore: root && root.RA_V46CompanyCore,\n    V46CompanyStorage: root && root.RA_V46CompanyStorage\n`,
'browser Company dependencies');
app=replaceOnce(app,
`    deps.V46Storage = require('./v46-storage-core');\n    deps.V46Navigation = require('./v46-navigation');\n`,
`    deps.V46Storage = require('./v46-storage-core');\n    deps.V46Navigation = require('./v46-navigation');\n    deps.V46CompanyCore = require('./v46-company-core');\n    deps.V46CompanyStorage = require('./v46-company-storage');\n`,
'CommonJS Company dependencies');
app=replaceOnce(app,
`  const {ScoutCore,ResultsCore,GlobalCore,MatchCore,ForumCore,Runtime,Candidates,Discovery,Messaging,V46Domain,V46Storage,V46Navigation} = D;\n  if (![ScoutCore,ResultsCore,GlobalCore,MatchCore,ForumCore,Runtime,Candidates,Discovery,Messaging,V46Domain,V46Storage,V46Navigation].every(Boolean)) {\n`,
`  const {ScoutCore,ResultsCore,GlobalCore,MatchCore,ForumCore,Runtime,Candidates,Discovery,Messaging,V46Domain,V46Storage,V46Navigation,V46CompanyCore,V46CompanyStorage} = D;\n  if (![ScoutCore,ResultsCore,GlobalCore,MatchCore,ForumCore,Runtime,Candidates,Discovery,Messaging,V46Domain,V46Storage,V46Navigation,V46CompanyCore,V46CompanyStorage].every(Boolean)) {\n`,
'factory Company dependencies');
app=replaceOnce(app,
`  const DB_VERSION = V46Storage.DB_VERSION;\n`,
`  const DB_VERSION = V46CompanyStorage.DB_VERSION;\n`,
'DB14 version');
app=replaceOnce(app,
`  const STORE_NAMES = Object.freeze(['users','meta','scoutLatest','scoutHistory','globalLatest','globalHistory','globalSyncQueue','candidateLocal','matchProfiles','forumSources','forumSyncState','appLogs','playerIntelligence','companyRecruitment','factionRecruitment']);\n`,
`  const STORE_NAMES = Object.freeze(['users','meta','scoutLatest','scoutHistory','globalLatest','globalHistory','globalSyncQueue','candidateLocal','matchProfiles','forumSources','forumSyncState','appLogs','playerIntelligence','companyRecruitment','factionRecruitment','companyVacancies','companyCampaigns','companyRecruitmentConfig','companyRecruitmentSessions']);\n`,
'DB14 reset ownership');
app=replaceOnce(app,
`        V46Storage.applyUpgrade(db);\n`,
`        V46Storage.applyUpgrade(db);\n        V46CompanyStorage.applyUpgrade(db);\n`,
'DB14 upgrade ordering');
app=replaceOnce(app,
`  const repositories=V46Storage.createRepositories(idb);\n`,
`  const repositories=V46Storage.createRepositories(idb);\n  const companyRepositories=V46CompanyStorage.createRepositories(idb,V46CompanyCore);\n`,
'Company repositories');
app=replaceOnce(app,
`_test:{state,repositories,recruitmentDomainForFeed,persistDiscoveredCandidate,deleteCompanyCandidateData,clearRecruitmentData,applyCandidateFilters,candidateCsvRow,matchAvailability,forumThreadUrl}});`,
`_test:{state,repositories,companyRepositories,recruitmentDomainForFeed,persistDiscoveredCandidate,deleteCompanyCandidateData,clearRecruitmentData,applyCandidateFilters,candidateCsvRow,matchAvailability,forumThreadUrl}});`,
'Company repository test export');
write('src/v45-app.js',app);

let pkg=read('package.json');
pkg=replaceOnce(pkg,
`node --check src/v46-company-core.js && node --check src/v45-app.js`,
`node --check src/v46-company-core.js && node --check src/v46-company-storage.js && node --check src/v45-app.js`,
'Company storage syntax');
write('package.json',pkg);

const harnesses=[
  'tests/v45-browser-duplicate-world.test.js',
  'tests/v45-browser-event-interference.test.js',
  'tests/v45-browser-hit-test.test.js',
  'tests/v45-browser-isolated-world.test.js',
  'tests/v45-browser-mobile.test.js',
  'tests/v45-browser-shell-ui.test.js',
  'tests/v45-browser-torn-host.test.js',
  'tests/v45-browser-upgrade.test.js'
];
for(const rel of harnesses){
  let text=read(rel);
  const old=`'v46-navigation.js','v45-app.js'`;
  const next=`'v46-navigation.js','v46-company-core.js','v46-company-storage.js','v45-app.js'`;
  if(!text.includes(old))throw new Error(`Missing module loader tail in ${rel}`);
  text=text.replace(old,next);
  write(rel,text);
}

let upgrade=read('tests/v45-browser-upgrade.test.js');
upgrade=replaceOnce(upgrade,
`test('v4.4 persisted DB11 upgrades through additive DB13 and remains physically interactive in Chrome'`,
`test('v4.4 persisted DB11 upgrades through additive DB14 and remains physically interactive in Chrome'`,
'upgrade test title');
upgrade=replaceOnce(upgrade,
`assert.equal(dbVersion,13);\n const launcher=`,
`assert.equal(dbVersion,14);\n const db14Stores=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('tornWorkerDB');r.onsuccess=()=>{resolve([...r.result.objectStoreNames]);r.result.close()};r.onerror=()=>reject(r.error)}));for(const store of ['playerIntelligence','companyRecruitment','factionRecruitment','companyVacancies','companyCampaigns','companyRecruitmentConfig','companyRecruitmentSessions'])assert.ok(db14Stores.includes(store),store);\n const launcher=`,
'upgrade DB14 assertion');
write('tests/v45-browser-upgrade.test.js',upgrade);

console.log('Applied guarded DB14 Company integration patch.');
