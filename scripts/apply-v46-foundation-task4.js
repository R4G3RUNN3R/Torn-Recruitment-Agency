const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const APP_PATH = path.join(ROOT, 'src', 'v45-app.js');

function replaceOnce(text, oldText, newText, label) {
  const first = text.indexOf(oldText);
  if (first < 0) throw new Error(`Missing expected source for ${label}`);
  if (text.indexOf(oldText, first + oldText.length) >= 0) throw new Error(`Expected unique source for ${label}`);
  return text.slice(0, first) + newText + text.slice(first + oldText.length);
}

function replaceRegexOnce(text, regex, replacement, label) {
  const matches = [...text.matchAll(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`))];
  if (matches.length !== 1) throw new Error(`Expected exactly one match for ${label}, got ${matches.length}`);
  return text.replace(regex, replacement);
}

let app = fs.readFileSync(APP_PATH, 'utf8');

app = replaceOnce(app,
`    Discovery: root && root.RA_V45Discovery,
    Messaging: root && root.RA_V45Messaging
`,
`    Discovery: root && root.RA_V45Discovery,
    Messaging: root && root.RA_V45Messaging,
    V46Domain: root && root.RA_V46DomainCore,
    V46Storage: root && root.RA_V46StorageCore,
    V46Navigation: root && root.RA_V46Navigation
`, 'browser dependency map');

app = replaceOnce(app,
`    deps.Discovery = require('./v45-discovery');
    deps.Messaging = require('./v45-messaging');
`,
`    deps.Discovery = require('./v45-discovery');
    deps.Messaging = require('./v45-messaging');
    deps.V46Domain = require('./v46-domain-core');
    deps.V46Storage = require('./v46-storage-core');
    deps.V46Navigation = require('./v46-navigation');
`, 'CommonJS dependency map');

app = replaceOnce(app,
`  const {ScoutCore,ResultsCore,GlobalCore,MatchCore,ForumCore,Runtime,Candidates,Discovery,Messaging} = D;
  if (![ScoutCore,ResultsCore,GlobalCore,MatchCore,ForumCore,Runtime,Candidates,Discovery,Messaging].every(Boolean)) {
`,
`  const {ScoutCore,ResultsCore,GlobalCore,MatchCore,ForumCore,Runtime,Candidates,Discovery,Messaging,V46Domain,V46Storage,V46Navigation} = D;
  if (![ScoutCore,ResultsCore,GlobalCore,MatchCore,ForumCore,Runtime,Candidates,Discovery,Messaging,V46Domain,V46Storage,V46Navigation].every(Boolean)) {
`, 'dependency destructure');

app = replaceOnce(app, `  const DB_VERSION = 12;\n`, `  const DB_VERSION = V46Storage.DB_VERSION;\n`, 'DB version');
app = replaceOnce(app,
`  const STORE_NAMES = Object.freeze(['users','meta','scoutLatest','scoutHistory','globalLatest','globalHistory','globalSyncQueue','candidateLocal','matchProfiles','forumSources','forumSyncState','appLogs']);
`,
`  const STORE_NAMES = Object.freeze(['users','meta','scoutLatest','scoutHistory','globalLatest','globalHistory','globalSyncQueue','candidateLocal','matchProfiles','forumSources','forumSyncState','appLogs','playerIntelligence','companyRecruitment','factionRecruitment']);
`, 'scoped store list');

app = replaceOnce(app,
`        if(!db.objectStoreNames.contains('appLogs')) db.createObjectStore('appLogs',{keyPath:'logId'});
      };
`,
`        if(!db.objectStoreNames.contains('appLogs')) db.createObjectStore('appLogs',{keyPath:'logId'});
        V46Storage.applyUpgrade(db);
      };
`, 'DB13 upgrade hook');
app = replaceOnce(app,
`      req.onblocked=()=>reject(new Error('IndexedDB v12 upgrade is blocked by another Torn tab.'));
`,
`      req.onblocked=()=>reject(new Error(\`IndexedDB v\${DB_VERSION} upgrade is blocked by another Torn tab.\`));
`, 'blocked upgrade message');

app = replaceOnce(app,
`  };

  function mergeSettings(raw={}) {
`,
`  };
  const repositories=V46Storage.createRepositories(idb);

  function mergeSettings(raw={}) {
`, 'repository initialization');

app = replaceOnce(app,
`await idb.put('scoutLatest',snapshot);await idb.put('scoutHistory',snapshot);await enqueueGlobalObservation(snapshot).catch(()=>{});return snapshot;}`,
`await idb.put('scoutLatest',snapshot);await idb.put('scoutHistory',snapshot);await repositories.players.ensure(String(id),{name:profile.name,level:profile.level,factionId:profile.factionId,factionName:profile.factionName,networth:snapshot.extra?.networth,fit:snapshot.currentFit??snapshot.originalFit,fitType:snapshot.official?'official':(snapshot.provisionalSource?'provisional':'unmeasured'),lastActive:profile.lastActionTs?Number(profile.lastActionTs)*1000:null,lastScoutAt:capturedAt,activity30:(snapshot.w30||snapshot.provisionalSource||{}).activityHours,xanax30:(snapshot.w30||snapshot.provisionalSource||{}).xanax,refills30:(snapshot.w30||snapshot.provisionalSource||{}).refills,attacks30:(snapshot.w30||snapshot.provisionalSource||{}).attacks,rwHits30:(snapshot.w30||snapshot.provisionalSource||{}).rwHits,scoutStatus:ResultsCore.classifyScoutStatus(snapshot)},'scout',capturedAt);await enqueueGlobalObservation(snapshot).catch(()=>{});return snapshot;}`,
'scout shared mirror');

app = replaceRegexOnce(app,
/  function globalObservation\(snapshot\)\{[\s\S]*?\n  async function enqueueGlobalObservation/,
`  function globalObservation(snapshot){const profile=snapshot.profile||{};const w=snapshot.w30||snapshot.provisionalSource||{};return Promise.all([idb.get('playerIntelligence',String(snapshot.userId)),idb.get('candidateLocal',String(snapshot.userId))]).then(([player,candidate])=>GlobalCore.sanitizeObservation({playerId:Number(snapshot.userId),name:player?.name||candidate?.name||profile.name||\`User \${snapshot.userId}\`,observedAt:Number(snapshot.capturedAt||Date.now()),level:player?.level??profile.level,ee:player?.ee??candidate?.ee,activity30:w.activityHours,xanax30:w.xanax,refills30:w.refills,attacks30:w.attacks,rwHits30:w.rwHits,networth:snapshot.extra?.networth,fit:scoutFit(snapshot),fitType:snapshot.official?'official':(snapshot.provisionalSource?'provisional':'unmeasured'),lastActive:profile.lastActionTs?Number(profile.lastActionTs)*1000:null,scoutStatus:ResultsCore.classifyScoutStatus(snapshot)},SCRIPT_VERSION));}
  async function enqueueGlobalObservation`,
'Global Intelligence shared identity lookup');

app = replaceRegexOnce(app,
/  async function migrateLegacyUsers\(\)\{[\s\S]*?\n\n  async function fetchForumPage/,
`  async function migrateLegacyUsers(){const users=await idb.getAll('users');if(!users.length)return;let created=0,factionCreated=0;for(const row of users){const userId=text(row.userId);if(!/^\\d+$/.test(userId))continue;const faction=row.sourceMode==='faction';const candidate=faction?null:await idb.get('candidateLocal',userId);const sourceType=faction?'FACTION FORUM':'COMPANY FORUM';const observedAt=Number(row.lastSeenPost||Date.now());const source=ForumCore.normalizeSource({sourceType,threadId:text(row.threadId),postId:text(row.postId||'legacy'),userId:Number(userId),postedAt:observedAt,postUrl:forumThreadUrl(row.threadId),text:text(row.rawText),parsed:ForumCore.parseForumIntent(row.rawText||'')});source.authorName=text(row.name);await idb.put('forumSources',source);const merged=ForumCore.mergeCandidateFromSource(candidate||{userId,pipelineStage:'Not Contacted'},source);merged.userId=userId;merged.name=candidate?.name||text(row.name)||\`User \${userId}\`;merged.stats=candidate?.stats||row.stats||{};merged.ee=candidate?.ee??row.ee??null;merged.status=candidate?.status||row.status||'active';merged.latestForumSourceId=source.sourceId;if(faction){await repositories.faction.ensure(userId,{pipelineStage:'Prospect',availability:merged.availability,discoverySources:merged.discoverySources,latestForumSourceId:source.sourceId},{sharedPatch:{name:merged.name,ee:merged.ee},source:'legacy-user-faction',observedAt});factionCreated++;continue;}await idb.put('candidateLocal',merged);await repositories.company.ensure(userId,merged,{sharedPatch:{name:merged.name,ee:merged.ee},source:'legacy-user-company',observedAt});if(!candidate)created++;}if(created||factionCreated)await logEvent('migration','Legacy forum candidates migrated',{created,factionCreated});}

  async function fetchForumPage`,
'legacy users migration');

app = replaceOnce(app,
`candidate.companyCheckedAt=Date.now();candidate.updatedAt=new Date().toISOString();await idb.put('candidateLocal',candidate);`,
`candidate.companyCheckedAt=Date.now();candidate.updatedAt=new Date().toISOString();await idb.put('candidateLocal',candidate);await repositories.players.ensure(String(item.userId),{name:candidate.name,ee:candidate.ee,currentCompany:candidate.currentCompany,currentCompanyId:candidate.currentCompanyId,currentCompanyRating:candidate.currentCompanyRating,currentCompanyPosition:candidate.currentCompanyPosition,companyCheckedAt:candidate.companyCheckedAt},'company-enrichment',candidate.companyCheckedAt);`,
'Fill Companies shared mirror');

app = replaceOnce(app,
`await idb.put('meta',meta);await migrateLegacyUsers();await ensureDefaultMatchProfile();`,
`await idb.put('meta',meta);await migrateLegacyUsers();await repositories.backfillLegacy(Date.now());await ensureDefaultMatchProfile();`,
'startup backfill order');

app = replaceOnce(app,
`_test:{state,applyCandidateFilters,candidateCsvRow,matchAvailability,forumThreadUrl}});`,
`_test:{state,repositories,applyCandidateFilters,candidateCsvRow,matchAvailability,forumThreadUrl}});`,
'test repository export');

fs.writeFileSync(APP_PATH, app);

const browserFiles = fs.readdirSync(path.join(ROOT,'tests')).filter(name => /^v45-browser-.*\.test\.js$/.test(name));
for (const name of browserFiles) {
  const filePath=path.join(ROOT,'tests',name);
  let source=fs.readFileSync(filePath,'utf8');
  if (!source.includes('v45-app.js')) continue;
  if (!source.includes('v46-domain-core.js')) {
    const pattern=/(['"]v45-messaging\.js['"])\s*,\s*(['"]v45-app\.js['"])/;
    if (!pattern.test(source)) throw new Error(`Could not extend MODULES in ${name}`);
    source=source.replace(pattern,`$1,'v46-domain-core.js','v46-storage-core.js','v46-navigation.js',$2`);
  }
  if (name==='v45-browser-upgrade.test.js') {
    if (!source.includes('assert.equal(dbVersion,12);')) throw new Error('Expected DB12 assertion in legacy browser upgrade test');
    source=source.replace('assert.equal(dbVersion,12);','assert.equal(dbVersion,13);');
    source=source.replace('v4.4 persisted DB11 upgrades to DB12','v4.4 persisted DB11 upgrades through additive DB13');
  }
  fs.writeFileSync(filePath,source);
}

const staticPath=path.join(ROOT,'tests','userscript-static.test.js');
let staticSource=fs.readFileSync(staticPath,'utf8');
staticSource=replaceOnce(staticSource,
`test('v4.5 app targets additive DB12 and shared scheduler',()=>{assert.match(app,/DB_VERSION\\s*=\\s*12/);assert.doesNotMatch(app,/deleteObjectStore\\s*\\(/);assert.match(app,/HARD_API_RATE\\s*=\\s*75/);assert.match(app,/MIN_API_GAP_MS\\s*=\\s*800/);assert.match(app,/Math\\.max\\(MIN_API_GAP_MS,60000\\/clampRate/);});`,
`test('source app targets additive DB13 and shared scheduler',()=>{assert.match(app,/DB_VERSION\\s*=\\s*V46Storage\\.DB_VERSION/);assert.doesNotMatch(app,/deleteObjectStore\\s*\\(/);assert.match(app,/HARD_API_RATE\\s*=\\s*75/);assert.match(app,/MIN_API_GAP_MS\\s*=\\s*800/);assert.match(app,/Math\\.max\\(MIN_API_GAP_MS,60000\\/clampRate/);});`,
'userscript source DB test');
fs.writeFileSync(staticPath,staticSource);

console.log(`Patched ${path.relative(ROOT,APP_PATH)} and ${browserFiles.length} browser harness candidates.`);
