const test=require('node:test');
const assert=require('node:assert/strict');

const FactionUI=require('../src/v47-faction-ui');

const baseline={criteria:[{id:'level',label:'Level 50+',field:'level',operator:'gte',value:50,kind:'Hard',weight:1}]};
const profiles=[{profileId:'rw',name:'RW Fighter',status:'Active',criteria:[{id:'rw-hits',label:'RW Hits',field:'rwHits30',operator:'gte',value:50,kind:'Hard',weight:1}]}];
const rows=[{
  userId:'101',
  name:'Alpha',
  baselineEligibility:'NOT CURRENTLY ELIGIBLE',
  waivers:[
    {waiverId:'w-active',requirementId:'level',context:'baseline',profileId:'',reason:'Leadership-approved exception',state:'Active',grantedAt:1000,reviewAt:5000,resolvedAt:null,resolvedReason:''},
    {waiverId:'w-resolved',requirementId:'rw-hits',context:'specialist',profileId:'rw',reason:'Temporary specialist exception',state:'Resolved',grantedAt:2000,reviewAt:null,resolvedAt:4000,resolvedReason:'Profile changed'}
  ]
}];

test('Faction Requirements exposes individual waiver controls without hiding the underlying requirement',()=>{
  const html=FactionUI.renderRequirementsPage({config:{baseline},profiles,rows});
  assert.match(html,/Waiver Management/);
  assert.match(html,/id="ra-faction-waiver-player"/);
  assert.match(html,/id="ra-faction-waiver-context"/);
  assert.match(html,/value="baseline"/);
  assert.match(html,/value="specialist"/);
  assert.match(html,/id="ra-faction-waiver-profile"/);
  assert.match(html,/id="ra-faction-waiver-requirement"/);
  assert.match(html,/id="ra-faction-waiver-reason"/);
  assert.match(html,/id="ra-faction-waiver-review"/);
  assert.match(html,/id="ra-faction-waiver-grant"/);
  assert.match(html,/Level 50\+/);
  assert.match(html,/Leadership-approved exception/);
});

test('Faction waiver history keeps resolved entries and only active waivers expose Resolve',()=>{
  const html=FactionUI.renderRequirementsPage({config:{baseline},profiles,rows});
  assert.match(html,/Active/);
  assert.match(html,/Resolved/);
  assert.match(html,/Temporary specialist exception/);
  assert.match(html,/Profile changed/);
  assert.match(html,/data-faction-waiver-resolve="w-active"/);
  assert.match(html,/data-faction-waiver-player="101"/);
  assert.doesNotMatch(html,/data-faction-waiver-resolve="w-resolved"/);
});
