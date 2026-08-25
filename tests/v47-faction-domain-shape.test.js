const test = require('node:test');
const assert = require('node:assert/strict');
const Domain = require('../src/v46-domain-core.js');

function richFactionRecord(){
  return {
    userId:'123',
    pipelineStage:'Evaluating',
    availability:'Available',
    recruiterNote:'note',
    discoverySources:['FACTION FORUM'],
    tags:['rw'],
    followUps:[{followUpId:'f1',state:'open'}],
    campaigns:['c1'],
    outcomes:[{outcomeId:'o1',result:'Interested'}],
    waivers:[{waiverId:'w1',requirementId:'rw',context:'baseline',state:'Active'}],
    specialistProfileId:'rw',
    pinnedSpecialistProfileId:'chain',
    stageChangedAt:500,
    timelineEvents:[{eventId:'e1',type:'stage-changed',at:500,payload:{from:'Replied',to:'Evaluating'}}],
    timelineNotes:[{noteId:'n1',text:'Promising',at:600}],
    doNotContact:true,
    doNotContactReason:'Asked us to stop',
    doNotContactChangedAt:700,
    archived:false,
    cycles:[{cycleId:'cycle-1',startedAt:100}],
    createdAt:1,
    updatedAt:800
  };
}

test('Faction normalization preserves detailed workflow state required by the v4.7 platform',()=>{
  const result=Domain.normalizeFactionRecruitment(richFactionRecord(),900);
  assert.equal(result.pipelineStage,'Evaluating');
  assert.equal(result.stageChangedAt,500);
  assert.equal(result.pinnedSpecialistProfileId,'chain');
  assert.equal(result.specialistProfileId,'rw');
  assert.equal(result.doNotContact,true);
  assert.equal(result.doNotContactReason,'Asked us to stop');
  assert.equal(result.doNotContactChangedAt,700);
  assert.deepEqual(result.timelineEvents,[{eventId:'e1',type:'stage-changed',at:500,payload:{from:'Replied',to:'Evaluating'}}]);
  assert.deepEqual(result.timelineNotes,[{noteId:'n1',text:'Promising',at:600}]);
  assert.equal(result.cycles.length,1);
});

test('Faction normalization deep-copies nested timeline payloads and recurrence state',()=>{
  const source=richFactionRecord();
  source.followUps[0].recurrence={unit:'days',interval:2};
  const result=Domain.normalizeFactionRecruitment(source,900);
  result.timelineEvents[0].payload.to='Joined';
  result.followUps[0].recurrence.interval=99;
  assert.equal(source.timelineEvents[0].payload.to,'Evaluating');
  assert.equal(source.followUps[0].recurrence.interval,2);
});
