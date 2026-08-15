const test = require('node:test');
const assert = require('node:assert/strict');
const questions = require('./sqld_questions.json');

test('sqld_questions.json has the final 320 questions: 64 data_modeling + 256 sql_basic', () => {
  assert.equal(questions.length, 320);
  const dataModeling = questions.filter(q => q.subject === 'data_modeling');
  const sqlBasic = questions.filter(q => q.subject === 'sql_basic');
  assert.equal(dataModeling.length, 64);
  assert.equal(sqlBasic.length, 256);
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

// Regression guard: an earlier revision of this file assigned answer_index by a
// mechanical `i % 4` cycle, so the answer position alone gave the question away.
test('answer_index is neither concentrated on one position nor a mechanical i % 4 cycle', () => {
  const total = questions.length;

  const counts = [0, 0, 0, 0];
  for (const q of questions) counts[q.answer_index] += 1;
  for (let idx = 0; idx < 4; idx += 1) {
    const share = counts[idx] / total;
    assert.ok(
      share <= 0.35,
      `answer_index ${idx} accounts for ${(share * 100).toFixed(1)}% of questions (max 35%)`
    );
  }

  let run = 0;
  let longestRun = 0;
  for (let i = 0; i < total; i += 1) {
    run = questions[i].answer_index === i % 4 ? run + 1 : 0;
    if (run > longestRun) longestRun = run;
  }
  assert.ok(
    longestRun < 20,
    `answer_index follows the exact i % 4 cycle for ${longestRun} consecutive questions (max 19)`
  );
});

// Regression guard: an earlier revision wrote every correct answer as the fullest,
// longest-sounding choice, so "always click the longest option" scored above the
// 60% pass mark without reading a single question.
test('the correct answer is not systematically the longest or shortest choice', () => {
  const total = questions.length;
  let longest = 0;
  let shortest = 0;
  let alwaysPickLongest = 0;

  for (const q of questions) {
    const lengths = q.choices.map(c => c.length);
    const max = Math.max(...lengths);
    const min = Math.min(...lengths);
    const answerLength = lengths[q.answer_index];

    if (answerLength === max && lengths.filter(l => l === max).length === 1) longest += 1;
    if (answerLength === min && lengths.filter(l => l === min).length === 1) shortest += 1;
    if (lengths.indexOf(max) === q.answer_index) alwaysPickLongest += 1;
  }

  assert.ok(
    longest / total <= 0.4,
    `correct answer is the single longest choice in ${((longest / total) * 100).toFixed(1)}% of questions (max 40%)`
  );
  assert.ok(
    shortest / total <= 0.2,
    `correct answer is the single shortest choice in ${((shortest / total) * 100).toFixed(1)}% of questions (max 20%)`
  );
  assert.ok(
    alwaysPickLongest / total <= 0.4,
    `always picking the longest choice scores ${((alwaysPickLongest / total) * 100).toFixed(1)}% (max 40%)`
  );
});
