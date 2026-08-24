const test=require('node:test');
const assert=require('node:assert/strict');
const Company=require('../src/v46-company-core');

test('Company pipeline uses the approved canonical order',()=>{
  assert.deepEqual(Company.COMPANY_PIPELINE,['Not Contacted','Contacted','Replied','Shortlisted','Hired','Rejected']);
});

test('baseline Hard failures block eligibility while Preferred failures only affect raw Match',()=>{
  const baseline=Company.normalizeBaseline({requirements:[
    {requirementId:'man-hard',label:'MAN',field:'man',operator:'gte',value:5000,level:'Hard',weight:60},
    {requirementId:'fit-pref',label:'Fit',field:'fit',operator:'gte',value:80,level:'Preferred',weight:40}
  ]});
  const blocked=Company.evaluateRequirements({man:4000,fit:100},baseline.requirements,[]);
  assert.equal(blocked.eligibility,'NOT CURRENTLY ELIGIBLE');
  assert.deepEqual(blocked.hardFailures,['man-hard']);
  assert.equal(blocked.rawMatch,88);

  const preferredOnly=Company.evaluateRequirements({man:5000,fit:40},baseline.requirements,[]);
  assert.equal(preferredOnly.eligibility,'ELIGIBLE');
  assert.equal(preferredOnly.rawMatch,80);
});

test('unknown Hard facts produce NEEDS DATA instead of false pass or false fail',()=>{
  const result=Company.evaluateRequirements({},[
    Company.normalizeRequirement({requirementId:'ee-hard',field:'ee',operator:'gte',value:5,level:'Hard',weight:100})
  ],[]);
  assert.equal(result.eligibility,'NEEDS DATA');
  assert.deepEqual(result.hardUnknown,['ee-hard']);
  assert.equal(result.rawMatch,null);
});

test('per-requirement waiver changes eligibility but leaves the failed criterion failed/waived',()=>{
  const requirements=[Company.normalizeRequirement({requirementId:'man-hard',field:'man',operator:'gte',value:5000,level:'Hard',weight:100})];
  const result=Company.evaluateRequirements({man:3000},requirements,[{requirementId:'man-hard',state:'Active',reason:'Approved training hire'}]);
  assert.equal(result.eligibility,'ELIGIBLE BY WAIVER');
  assert.deepEqual(result.waivedFailures,['man-hard']);
  assert.equal(result.criteria[0].status,'WAIVED');
  assert.equal(result.criteria[0].underlyingStatus,'FAIL');
  assert.equal(result.rawMatch,60);
});

test('vacancy keeps raw Match visible when a Hard rule makes the candidate ineligible',()=>{
  const vacancy=Company.normalizeVacancy({
    vacancyId:'vac-ops',name:'Operations',role:'Operations',openings:2,status:'Open',
    requirements:[
      {requirementId:'man',field:'man',operator:'gte',value:10000,level:'Hard',weight:50},
      {requirementId:'fit',field:'fit',operator:'gte',value:80,level:'Preferred',weight:50}
    ]
  });
  const result=Company.evaluateVacancy({man:8000,fit:80},vacancy,[]);
  assert.equal(result.eligibility,'NOT ELIGIBLE');
  assert.equal(result.rawMatch,90);
  assert.deepEqual(result.hardFailures,['man']);
});

test('vacancy normalization clamps openings and restricts states',()=>{
  const vacancy=Company.normalizeVacancy({vacancyId:'v1',name:'Tester',role:'Tester',openings:0,status:'nonsense'});
  assert.equal(vacancy.openings,1);
  assert.equal(vacancy.status,'Draft');
  assert.ok(Company.VACANCY_STATES.includes(vacancy.status));
});

test('best eligible vacancy is suggested while a manual pin remains effective',()=>{
  const evaluations=[
    {vacancyId:'v1',status:'Open',eligibility:'ELIGIBLE',rawMatch:72},
    {vacancyId:'v2',status:'Open',eligibility:'ELIGIBLE',rawMatch:91},
    {vacancyId:'v3',status:'Open',eligibility:'NOT ELIGIBLE',rawMatch:99}
  ];
  assert.deepEqual(Company.chooseSuggestedVacancy(evaluations,''),{
    suggestedVacancyId:'v2',effectiveVacancyId:'v2',pinned:false,suggestionChanged:false
  });
  assert.deepEqual(Company.chooseSuggestedVacancy(evaluations,'v1'),{
    suggestedVacancyId:'v2',effectiveVacancyId:'v1',pinned:true,suggestionChanged:true
  });
});

test('company candidate evaluation returns baseline and active vacancy results only',()=>{
  const baseline=Company.normalizeBaseline({requirements:[{requirementId:'level',field:'level',operator:'gte',value:10,level:'Hard',weight:100}]});
  const vacancies=[
    Company.normalizeVacancy({vacancyId:'open',name:'Open',role:'A',status:'Open',requirements:[{requirementId:'fit',field:'fit',operator:'gte',value:50,level:'Preferred',weight:100}]}),
    Company.normalizeVacancy({vacancyId:'paused',name:'Paused',role:'B',status:'Paused',requirements:[]})
  ];
  const result=Company.evaluateCompanyCandidate({player:{level:20,fit:80},recruitment:{userId:'123'},baseline,vacancies});
  assert.equal(result.baseline.eligibility,'ELIGIBLE');
  assert.equal(result.vacancies.length,1);
  assert.equal(result.vacancies[0].vacancyId,'open');
  assert.equal(result.suggestedVacancyId,'open');
});
