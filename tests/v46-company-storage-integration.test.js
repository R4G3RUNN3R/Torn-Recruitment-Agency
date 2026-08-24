const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.join(__dirname,'..','src','v45-app.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'..','package.json'),'utf8'));

test('app wires CompanyCore and CompanyStorage as required source dependencies',()=>{
  assert.match(app,/RA_V46CompanyCore/);
  assert.match(app,/RA_V46CompanyStorage/);
  assert.match(app,/require\('\.\/v46-company-core'\)/);
  assert.match(app,/require\('\.\/v46-company-storage'\)/);
  assert.match(app,/const DB_VERSION = V46CompanyStorage\.DB_VERSION;/);
});

test('DB open applies Foundation then Company additive upgrades and owns new stores for hard reset',()=>{
  const foundationAt=app.indexOf('V46Storage.applyUpgrade(db);');
  const companyAt=app.indexOf('V46CompanyStorage.applyUpgrade(db);');
  assert.ok(foundationAt>=0);
  assert.ok(companyAt>foundationAt,'Company DB14 upgrade must run after Foundation DB13 upgrade');
  for(const store of ['companyVacancies','companyCampaigns','companyRecruitmentConfig','companyRecruitmentSessions'])assert.match(app,new RegExp(`['\"]${store}['\"]`));
});

test('Company repositories are created from the existing IndexedDB adapter',()=>{
  assert.match(app,/const companyRepositories=V46CompanyStorage\.createRepositories\(idb,V46CompanyCore\);/);
});

test('syntax script includes both Company source modules',()=>{
  assert.match(pkg.scripts.syntax,/src\/v46-company-core\.js/);
  assert.match(pkg.scripts.syntax,/src\/v46-company-storage\.js/);
});
