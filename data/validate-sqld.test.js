const test = require('node:test');
const assert = require('node:assert/strict');
const questions = require('./sqld_questions.json');

test('sqld_questions.json has 192 questions so far: 64 data_modeling + 128 sql_basic', () => {
  assert.equal(questions.length, 192);
  const dataModeling = questions.filter(q => q.subject === 'data_modeling');
  const sqlBasic = questions.filter(q => q.subject === 'sql_basic');
  assert.equal(dataModeling.length, 64);
  assert.equal(sqlBasic.length, 128);
});

test('every sqld question has the required schema', () => {
  const seen = new Set();
  for (const q of questions) {
    assert.ok(q.subject === 'data_modeling' || q.subject === 'sql_basic');
    assert.equal(typeof q.question, 'string');
    assert.ok(q.question.trim().length > 0);
    assert.ok(Array.isArray(q.choices) && q.choices.length === 4);
    for (const c of q.choices) {
      assert.equal(typeof c, 'string');
      assert.ok(c.trim().length > 0);
    }
    assert.ok(Number.isInteger(q.answer_index) && q.answer_index >= 0 && q.answer_index <= 3);
    assert.equal(typeof q.explanation, 'string');
    assert.ok(q.explanation.trim().length > 0);
    const key = `${q.subject}::${q.question.toLowerCase()}`;
    assert.ok(!seen.has(key), `duplicate question: ${q.question}`);
    seen.add(key);
  }
});
