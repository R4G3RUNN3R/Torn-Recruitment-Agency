const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/v45-messaging');

test('supported message placeholders are exactly the approved initial seven', () => {
  assert.deepEqual(M.PLACEHOLDERS,['name','player_id','looking_for','company_name','current_company','match_score','fit_score']);
});

test('prepared messages substitute approved values and remove unknown placeholders cleanly', () => {
  const text=M.prepareMessage('Hi {name}, looking for {looking_for}. Current company: {current_company}. Unknown {nope}.',{
    name:'Alice',looking_for:'10* AN',current_company:''
  });
  assert.equal(text,'Hi Alice, looking for 10* AN. Current company. Unknown.');
});

test('message plan is pre-addressed but never sends or changes pipeline stage', () => {
  const plan=M.messagePlan('Hi {name}',{userId:123,name:'Alice'});
  assert.equal(plan.userId,'123');
  assert.equal(plan.preparedText,'Hi Alice');
  assert.equal(plan.composeUrl,'https://www.torn.com/messages.php#/p=compose&XID=123');
  assert.equal(plan.autoSubmit,false);
  assert.equal(plan.stageChange,null);
});

test('invalid message target is rejected', () => {
  assert.throws(()=>M.messagePlan('Hi',{userId:'nope'}),/valid Torn player ID/);
  assert.equal(M.composeUrl('nope'),'');
});
