const test = require('node:test');
const assert = require('node:assert/strict');
const { selectToday, EPOCH } = require('./select-today');

test('selectToday picks the first window/idiom/verse on the epoch date', () => {
  const words = Array.from({ length: 600 }, (_, i) => ({ id: i + 1, word: `w${i}` }));
  const idioms = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, idiom: `i${i}` }));
  const verses = Array.from({ length: 66 }, (_, i) => ({ id: i + 1, reference: `v${i}` }));

  const result = selectToday({ words, idioms, verses }, EPOCH);

  assert.equal(result.dayIndex, 0);
  assert.equal(result.words.length, 10);
  assert.equal(result.words[0].word, 'w0');
  assert.equal(result.words[9].word, 'w9');
  assert.equal(result.idiom.idiom, 'i0');
  assert.equal(result.verse.reference, 'v0');
  assert.equal(result.translation, 'NIV');
});

test('selectToday advances the window on the next day', () => {
  const words = Array.from({ length: 600 }, (_, i) => ({ id: i + 1, word: `w${i}` }));
  const idioms = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, idiom: `i${i}` }));
  const verses = Array.from({ length: 66 }, (_, i) => ({ id: i + 1, reference: `v${i}` }));
  const nextDay = new Date(Date.UTC(2026, 7, 2));

  const result = selectToday({ words, idioms, verses }, nextDay);

  assert.equal(result.dayIndex, 1);
  assert.equal(result.words[0].word, 'w10');
  assert.equal(result.idiom.idiom, 'i1');
  assert.equal(result.verse.reference, 'v1');
  assert.equal(result.translation, 'KJV');
});
