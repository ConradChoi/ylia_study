const test = require('node:test');
const assert = require('node:assert/strict');
const { selectToday, EPOCH, validateCounts } = require('./select-today');

function makeSqldFixture() {
  return Array.from({ length: 320 }, (_, i) => ({ id: i + 1, question: `sqld${i}` }));
}

test('selectToday picks the first window/idiom/verse/sqld-block on the epoch date', () => {
  const words = Array.from({ length: 600 }, (_, i) => ({ id: i + 1, word: `w${i}` }));
  const idioms = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, idiom: `i${i}` }));
  const verses = Array.from({ length: 66 }, (_, i) => ({ id: i + 1, reference: `v${i}` }));
  const sqldQuestions = makeSqldFixture();

  const result = selectToday({ words, idioms, verses, sqldQuestions }, EPOCH);

  assert.equal(result.dayIndex, 0);
  assert.equal(result.words.length, 10);
  assert.equal(result.words[0].word, 'w0');
  assert.equal(result.words[9].word, 'w9');
  assert.equal(result.idiom.idiom, 'i0');
  assert.equal(result.verse.reference, 'v0');
  assert.equal(result.sqldQuestions.length, 40);
  assert.equal(result.sqldQuestions[0].question, 'sqld0');
  assert.equal(result.sqldQuestions[39].question, 'sqld39');
  assert.equal(result.translation, 'NIV');
});

test('selectToday advances the window on the next day', () => {
  const words = Array.from({ length: 600 }, (_, i) => ({ id: i + 1, word: `w${i}` }));
  const idioms = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, idiom: `i${i}` }));
  const verses = Array.from({ length: 66 }, (_, i) => ({ id: i + 1, reference: `v${i}` }));
  const sqldQuestions = makeSqldFixture();
  const nextDay = new Date(Date.UTC(2026, 7, 2));

  const result = selectToday({ words, idioms, verses, sqldQuestions }, nextDay);

  assert.equal(result.dayIndex, 1);
  assert.equal(result.words[0].word, 'w10');
  assert.equal(result.idiom.idiom, 'i1');
  assert.equal(result.verse.reference, 'v1');
  assert.equal(result.sqldQuestions[0].question, 'sqld40');
  assert.equal(result.translation, 'KJV');
});

test('validateCounts does not throw when all tables have the expected row counts', () => {
  const words = Array.from({ length: 600 }, (_, i) => ({ id: i + 1 }));
  const idioms = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
  const verses = Array.from({ length: 66 }, (_, i) => ({ id: i + 1 }));
  const sqldQuestions = makeSqldFixture();

  assert.doesNotThrow(() => validateCounts({ words, idioms, verses, sqldQuestions }));
});

test('validateCounts throws naming the table when words has the wrong count', () => {
  const words = Array.from({ length: 599 }, (_, i) => ({ id: i + 1 }));
  const idioms = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
  const verses = Array.from({ length: 66 }, (_, i) => ({ id: i + 1 }));
  const sqldQuestions = makeSqldFixture();

  assert.throws(() => validateCounts({ words, idioms, verses, sqldQuestions }), /words/);
});

test('validateCounts throws naming the table when idioms has the wrong count', () => {
  const words = Array.from({ length: 600 }, (_, i) => ({ id: i + 1 }));
  const idioms = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
  const verses = Array.from({ length: 66 }, (_, i) => ({ id: i + 1 }));
  const sqldQuestions = makeSqldFixture();

  assert.throws(() => validateCounts({ words, idioms, verses, sqldQuestions }), /idioms/);
});

test('validateCounts throws naming the table when verses is empty', () => {
  const words = Array.from({ length: 600 }, (_, i) => ({ id: i + 1 }));
  const idioms = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
  const verses = [];
  const sqldQuestions = makeSqldFixture();

  assert.throws(() => validateCounts({ words, idioms, verses, sqldQuestions }), /verses/);
});

test('validateCounts throws naming sqldQuestions when its count is wrong', () => {
  const words = Array.from({ length: 600 }, (_, i) => ({ id: i + 1 }));
  const idioms = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
  const verses = Array.from({ length: 66 }, (_, i) => ({ id: i + 1 }));
  const sqldQuestions = Array.from({ length: 319 }, (_, i) => ({ id: i + 1 }));

  assert.throws(() => validateCounts({ words, idioms, verses, sqldQuestions }), /sqldQuestions/);
});
