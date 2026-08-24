const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
function patch(file,replacements){
  const p=path.join(root,file);let text=fs.readFileSync(p,'utf8');
  for(const [label,oldText,newText] of replacements){
    const count=text.split(oldText).length-1;
    if(count!==1)throw new Error(`${file}: expected one ${label}, found ${count}`);
    text=text.replace(oldText,newText);
  }
  fs.writeFileSync(p,text);
}
patch('src/v45-app.js',[
  ['store list',"'playerIntelligence','companyRecruitment','factionRecruitment'","'playerIntelligence','companyRecruitment','factionRecruitment','companyBaselines','companyVacancies'"],
  ['recruitment clear stores',"['users','candidateLocal','companyRecruitment','factionRecruitment','forumSources','forumSyncState']","['users','candidateLocal','companyRecruitment','factionRecruitment','companyBaselines','companyVacancies','forumSources','forumSyncState']"]
]);
patch('tests/v45-browser-upgrade.test.js',[
  ['module list',"'v46-domain-core.js','v46-storage-core.js','v46-navigation.js','v45-app.js'","'v46-domain-core.js','v46-storage-core.js','v46-navigation.js','v46-company-core.js','v45-app.js'"],
  ['test title','v4.4 persisted DB11 upgrades through additive DB13','v4.4 persisted DB11 upgrades through additive DB14'],
  ['version assertion','assert.equal(dbVersion,13);','assert.equal(dbVersion,14);']
]);
patch('tests/v46-foundation-static.test.js',[
  ['foundation title','source foundation wires v4.6 dependencies and additive DB13','source foundation wires v4.6 dependencies and additive DB14'],
  ['owned stores',"['playerIntelligence','companyRecruitment','factionRecruitment']","['playerIntelligence','companyRecruitment','factionRecruitment','companyBaselines','companyVacancies']"]
]);
patch('tests/v46-storage-core.test.js',[
  ['storage title','DB13 declares only additive foundation stores and indexable keys','DB14 retains additive foundation stores and adds Company configuration stores'],
  ['version assertion','assert.equal(S.DB_VERSION,13);','assert.equal(S.DB_VERSION,14);'],
  ['store key assertion',"assert.deepEqual(Object.keys(S.STORE_DEFINITIONS),['playerIntelligence','companyRecruitment','factionRecruitment']);","assert.deepEqual(Object.keys(S.STORE_DEFINITIONS),['playerIntelligence','companyRecruitment','factionRecruitment','companyBaselines','companyVacancies']);"],
  ['privacy db version','const db=await openDb(name,13,db=>{createLegacyStores(db);S.applyUpgrade(db);});','const db=await openDb(name,14,db=>{createLegacyStores(db);S.applyUpgrade(db);});'],
  ['backfill upgrade','db=await openDb(name,13,db=>S.applyUpgrade(db));','db=await openDb(name,14,db=>S.applyUpgrade(db));']
]);
console.log('Applied guarded DB14 Company integration patch.');
