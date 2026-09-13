const test=require('node:test');
const assert=require('node:assert/strict');
const CompanyPlatform=require('../src/v46-company-platform');
const FactionPlatform=require('../src/v47-faction-platform');
const CompanyUI=require('../src/v46-company-ui');
const FactionUI=require('../src/v47-faction-ui');

const rows=[
  {userId:'1',name:'Charlie',man:100,int:300,end:null,lastActive:1000,onlineStatus:'Offline',currentCompany:'Bad Decisions',currentCompanyId:42,playerRecord:{currentCompany:'Bad Decisions',currentCompanyId:42},player:{factionName:'Night Watch',factionId:77}},
  {userId:'2',name:'Alice',man:300,int:null,end:200,lastActive:null,onlineStatus:'Online',currentCompany:'',currentCompanyId:0,playerRecord:{currentCompany:'',currentCompanyId:0},player:{factionName:'',factionId:0}},
  {userId:'3',name:'Bob',man:null,int:200,end:400,lastActive:3000,onlineStatus:'Idle',currentCompany:'',currentCompanyId:null,playerRecord:{},player:{factionName:'',factionId:91}},
  {userId:'4',name:'Delta',man:200,int:100,end:100,lastActive:null,onlineStatus:'Offline',currentCompany:'',currentCompanyId:84,playerRecord:{currentCompanyId:84},player:{}}
];

function ids(items){return items.map(row=>row.userId);}

for(const [label,platform,kind] of [
  ['Company',CompanyPlatform,'company'],
  ['Faction',FactionPlatform,'faction']
]){
  test(`${label} v4.8.2 exports bounded Search & Results helpers`,()=>{
    assert.equal(typeof platform._test.filterRows,'function');
    assert.equal(typeof platform._test.sortRows,'function');
    assert.equal(typeof platform._test.toggleSort,'function');
    assert.equal(typeof platform._test.organizationInfo,'function');
  });

  test(`${label} sorts Player and work stats while keeping unknown values last`,()=>{
    const p=platform._test;
    assert.deepEqual(ids(p.sortRows(rows,{key:'player',direction:'asc'})),['2','3','1','4']);
    assert.deepEqual(ids(p.sortRows(rows,{key:'player',direction:'desc'})),['4','1','3','2']);
    assert.deepEqual(ids(p.sortRows(rows,{key:'man',direction:'desc'})),['2','4','1','3']);
    assert.deepEqual(ids(p.sortRows(rows,{key:'man',direction:'asc'})),['1','4','2','3']);
    assert.deepEqual(ids(p.sortRows(rows,{key:'end',direction:'desc'})),['3','2','4','1']);
    assert.deepEqual(ids(p.sortRows(rows,{key:'int',direction:'asc'})),['4','3','1','2']);
  });

  test(`${label} Last Online sort uses underlying timestamp/status and leaves unknown last`,()=>{
    const p=platform._test;
    const sample=[...rows,{userId:'5',name:'Echo',lastActive:null,onlineStatus:''}];
    assert.deepEqual(ids(p.sortRows(sample,{key:'lastActive',direction:'desc'},5000)),['2','3','1','4','5']);
    assert.deepEqual(ids(p.sortRows(sample,{key:'lastActive',direction:'asc'},5000)),['4','1','3','2','5']);
  });

  test(`${label} sort toggle uses sensible first-click defaults`,()=>{
    const p=platform._test;
    assert.deepEqual(p.toggleSort({key:'player',direction:'asc'},'player'),{key:'player',direction:'desc'});
    assert.deepEqual(p.toggleSort({key:'player',direction:'desc'},'man'),{key:'man',direction:'desc'});
    assert.deepEqual(p.toggleSort({key:'man',direction:'desc'},'lastActive'),{key:'lastActive',direction:'desc'});
    assert.deepEqual(p.toggleSort({key:'lastActive',direction:'desc'},'player'),{key:'player',direction:'asc'});
  });

  test(`${label} status and organisation filters are exact/partial without treating Unknown as None`,()=>{
    const p=platform._test;
    assert.deepEqual(ids(p.filterRows(rows,{onlineStatus:'Online'})),['2']);
    assert.deepEqual(ids(p.filterRows(rows,{onlineStatus:'Idle'})),['3']);
    if(kind==='company'){
      assert.deepEqual(ids(p.filterRows(rows,{organization:'bad dec'})),['1']);
      assert.deepEqual(ids(p.filterRows(rows,{organizationPresence:'has'})),['1','4']);
      assert.deepEqual(ids(p.filterRows(rows,{organizationPresence:'none'})),['2']);
    }else{
      assert.deepEqual(ids(p.filterRows(rows,{organization:'night'})),['1']);
      assert.deepEqual(ids(p.filterRows(rows,{organization:'faction #91'})),['3']);
      assert.deepEqual(ids(p.filterRows(rows,{organizationPresence:'has'})),['1','3']);
      assert.deepEqual(ids(p.filterRows(rows,{organizationPresence:'none'})),['2']);
    }
  });
}

test('Company organisation labels distinguish name, ID fallback, None and Unknown',()=>{
  const info=CompanyPlatform._test.organizationInfo;
  assert.deepEqual(info(rows[0]),{state:'has',label:'Bad Decisions'});
  assert.deepEqual(info(rows[1]),{state:'none',label:'None'});
  assert.deepEqual(info(rows[3]),{state:'has',label:'Company #84'});
  assert.deepEqual(info({playerRecord:{}}),{state:'unknown',label:'Unknown'});
});

test('Faction organisation labels distinguish name, ID fallback, None and Unknown',()=>{
  const info=FactionPlatform._test.organizationInfo;
  assert.deepEqual(info(rows[0]),{state:'has',label:'Night Watch'});
  assert.deepEqual(info(rows[1]),{state:'none',label:'None'});
  assert.deepEqual(info(rows[2]),{state:'has',label:'Faction #91'});
  assert.deepEqual(info({player:{}}),{state:'unknown',label:'Unknown'});
});

test('Company simplified Search & Results renders approved v4.8.2 controls and sortable headers',()=>{
  const html=CompanyUI.renderCandidates([{...rows[0],currentOrganizationLabel:'Bad Decisions'}],{filters:{onlineStatus:'',organization:'',organizationPresence:'any'},sort:{key:'man',direction:'desc'},total:1});
  assert.match(html,/id="ra-company-filter-status"/);
  assert.match(html,/id="ra-company-filter-organization"/);
  assert.match(html,/id="ra-company-filter-organization-presence"/);
  assert.match(html,/Current Company/);
  assert.match(html,/data-company-sort="player"/);
  assert.match(html,/data-company-sort="man"[^>]*>MAN ▼/);
  assert.match(html,/data-company-sort="lastActive"/);
  assert.match(html,/Bad Decisions/);
});

test('Faction simplified Search & Results renders approved v4.8.2 controls and sortable headers',()=>{
  const html=FactionUI.renderCandidates([{...rows[0],currentOrganizationLabel:'Night Watch'}],{filters:{onlineStatus:'',organization:'',organizationPresence:'any'},sort:{key:'lastActive',direction:'desc'},total:1});
  assert.match(html,/id="ra-faction-filter-status"/);
  assert.match(html,/id="ra-faction-filter-organization"/);
  assert.match(html,/id="ra-faction-filter-organization-presence"/);
  assert.match(html,/Current Faction/);
  assert.match(html,/data-faction-sort="player"/);
  assert.match(html,/data-faction-sort="lastActive"[^>]*>Last Online ▼/);
  assert.match(html,/Night Watch/);
});

test('Online fallback is explicit when no exact last-action timestamp exists',()=>{
  const company=CompanyUI.renderCandidates([{userId:'9',name:'Live',lastActive:null,onlineStatus:'Online',currentOrganizationLabel:'Unknown'}],{filters:{},sort:{key:'player',direction:'asc'},total:1});
  const faction=FactionUI.renderCandidates([{userId:'9',name:'Live',lastActive:null,onlineStatus:'Online',currentOrganizationLabel:'Unknown'}],{filters:{},sort:{key:'player',direction:'asc'},total:1});
  assert.match(company,/ra-online-live[^>]*>Online/);
  assert.match(faction,/ra-online-live[^>]*>Online/);
});
