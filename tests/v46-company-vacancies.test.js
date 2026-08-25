const test=require('node:test');
const assert=require('node:assert/strict');
const CompanyUI=require('../src/v46-company-ui');
const Platform=require('../src/v46-company-platform');

const row={
  userId:'101',name:'Alpha',ee:120000,fit:90,availability:'Available',desiredRole:'Sales',hardFailed:false,
  companyRecord:{userId:'101',pipelineStage:'Shortlisted',pinnedVacancyId:'v2',waivers:[]}
};
const vacancies=[
  {vacancyId:'v1',name:'Sales Lead',role:'Sales',status:'Open',openings:1,criteria:[{id:'ee',field:'ee',operator:'gte',value:100000,kind:'Hard',weight:1}]},
  {vacancyId:'v2',name:'Trainer',role:'Trainer',status:'Open',openings:2,criteria:[{id:'fit',field:'fit',operator:'gte',value:70,kind:'Preferred',weight:1}]},
  {vacancyId:'v3',name:'Paused Role',role:'Other',status:'Paused',openings:1,criteria:[]}
];

test('Vacancies page renders baseline controls, vacancy CRUD controls and exact approved states',()=>{
  const html=CompanyUI.renderVacanciesPage({
    config:{baseline:{criteria:[{id:'ee',field:'ee',operator:'gte',value:100000,kind:'Hard',label:'EE',weight:1}]}},
    vacancies,
    rows:[row]
  });
  assert.match(html,/id="ra-company-baseline-save"/);
  assert.match(html,/id="ra-company-vacancy-new"/);
  for(const state of ['Draft','Open','Paused','Filled','Archived'])assert.match(html,new RegExp(`>${state}<`));
  assert.match(html,/Sales Lead/);
  assert.match(html,/2 opening/);
});

test('candidate vacancy evaluation scores every Open vacancy and preserves a manual pin',()=>{
  const result=Platform._test.evaluateCandidateVacancies(row,vacancies);
  assert.deepEqual(result.evaluations.map(item=>item.vacancyId),['v1','v2']);
  assert.equal(result.selection.pinnedVacancyId,'v2');
  assert.ok(result.selection.suggestedVacancyId);
});

test('Hired is blocked only while Company baseline has an unwaived Hard failure',()=>{
  assert.equal(Platform._test.canMoveToStage({...row,hardFailed:true},'Hired'),false);
  assert.equal(Platform._test.canMoveToStage({...row,hardFailed:true},'Contacted'),true);
  assert.equal(Platform._test.canMoveToStage({...row,hardFailed:false},'Hired'),true);
});

test('Company Vacancies becomes an owned v4.6 route',()=>{
  assert.equal(Platform._test.IMPLEMENTED_ROUTES.has('company-vacancies'),true);
});
