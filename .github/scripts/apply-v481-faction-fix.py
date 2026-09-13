from pathlib import Path

app = Path('src/v45-app.js')
text = app.read_text()
old = "  async function syncFeed(feed){let checkpoint=await idb.get('forumSyncState',feed.feedId);"
helper = "  async function getDiscoveryCandidate(domain,userId){const id=String(userId);if(domain!==\"faction\")return await idb.get(\"candidateLocal\",id)||await idb.get(\"candidateLocal\",Number(userId));const[record,player]=await Promise.all([idb.get(\"factionRecruitment\",id),idb.get(\"playerIntelligence\",id)]);if(!record)return null;const stats={};for(const key of [\"man\",\"int\",\"end\",\"total\"]){const value=finite(player?.[key]);if(value!==null)stats[key]=value;}return Object.keys(stats).length?{...record,stats}:record;}\n"
if old not in text:
    raise SystemExit('syncFeed anchor missing')
text = text.replace(old, helper + old, 1)

old_get = "getCandidate:async userId=>domain==='faction'?await idb.get('factionRecruitment',String(userId)):await idb.get('candidateLocal',String(userId))||await idb.get('candidateLocal',Number(userId))"
if old_get not in text:
    raise SystemExit('discovery candidate callback anchor missing')
text = text.replace(old_get, "getCandidate:async userId=>getDiscoveryCandidate(domain,userId)", 1)

old_export = "persistDiscoveredCandidate,syncDomainForums,normalizeApiSearchCandidate"
if old_export not in text:
    raise SystemExit('test export anchor missing')
text = text.replace(old_export, "persistDiscoveredCandidate,getDiscoveryCandidate,syncDomainForums,normalizeApiSearchCandidate", 1)
app.write_text(text)

test = Path('tests/v481-active-search.test.js')
t = test.read_text()
require_anchor = "const App=require('../src/v45-app');\n"
if "const ForumCore=require('../src/forum-core');" not in t:
    if require_anchor not in t:
        raise SystemExit('test require anchor missing')
    t = t.replace(require_anchor, require_anchor + "const ForumCore=require('../src/forum-core');\n", 1)
regression = """

test('older faction forum posts cannot downgrade newer shared work stats',async()=>{
  const db=await App.openDB(indexedDB);App._test.state.db=db;
  await App._test.clearRecruitmentData();
  await App._test.repositories.faction.ensure('990',{pipelineStage:'Prospect',discoverySources:['FACTION FORUM']},{sharedPatch:{name:'Newest Stats',man:500000,int:600000,end:700000,total:1800000},source:'newer-observation',observedAt:2000});
  const existing=await App._test.getDiscoveryCandidate('faction','990');
  assert.deepEqual(existing.stats,{man:500000,int:600000,end:700000,total:1800000});
  const merged=ForumCore.mergeCandidateFromSource(existing,{sourceType:'FACTION FORUM',threadId:'15909136',postId:'older',userId:990,postedAt:1000,observedAt:1000,parsed:{workStats:{man:100000,int:200000,end:300000,total:600000}}});
  await App._test.persistDiscoveredCandidate({feedId:'faction',sourceType:'FACTION FORUM'},merged,{sourceType:'FACTION FORUM',sourceId:'FACTION FORUM:15909136:older:990',observedAt:1000,postedAt:1000});
  const read=(store,key)=>new Promise((resolve,reject)=>{const req=db.transaction(store,'readonly').objectStore(store).get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  const player=await read('playerIntelligence','990');
  assert.equal(player.man,500000);assert.equal(player.int,600000);assert.equal(player.end,700000);assert.equal(player.total,1800000);
  db.close();
});
"""
if "older faction forum posts cannot downgrade newer shared work stats" not in t:
    t += regression
test.write_text(t)
