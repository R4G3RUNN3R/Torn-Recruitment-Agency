const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'src','v45-app.js'),'utf8');

test('source foundation wires v4.6 dependencies and additive DB13',()=>{
  assert.match(app,/V46Domain:root&&root\.RA_V46DomainCore/);
  assert.match(app,/V46Storage:root&&root\.RA_V46StorageCore/);
  assert.match(app,/V46Navigation:root&&root\.RA_V46Navigation/);
  assert.match(app,/DB_VERSION\s*=\s*V46Storage\.DB_VERSION/);
  assert.match(app,/V46Storage\.applyUpgrade\(db\)/);
  assert.match(app,/V46Storage\.createRepositories\(idb\)/);
  assert.doesNotMatch(app,/deleteObjectStore\s*\(/);
});

test('source foundation preserves API pacing and public app version contract',()=>{
  assert.match(app,/SCRIPT_VERSION\s*=\s*'4\.5\.0'/);
  assert.match(app,/HARD_API_RATE\s*=\s*75/);
  assert.match(app,/MIN_API_GAP_MS\s*=\s*800/);
});

test('new stores are owned by scoped reset and startup backfill runs before match setup',()=>{
  for(const store of ['playerIntelligence','companyRecruitment','factionRecruitment']) assert.ok(app.includes(`'${store}'`),store);
  const migrate=app.indexOf('await migrateLegacyUsers()');
  const backfill=app.indexOf('await repositories.backfillLegacy(Date.now())');
  const match=app.indexOf('await ensureDefaultMatchProfile()');
  assert.ok(migrate>=0&&backfill>migrate&&match>backfill,'startup migration/backfill/match order');
});

test('Scout and Fill Companies mirror only shared facts into player intelligence',()=>{
  assert.match(app,/repositories\.players\.ensure\(String\(id\)/);
  assert.match(app,/repositories\.players\.ensure\(String\(item\.userId\)/);
  assert.match(app,/lastScoutAt:capturedAt/);
  assert.match(app,/companyCheckedAt:candidate\.companyCheckedAt/);
});
