const test = require('node:test');
const assert = require('node:assert/strict');
const words = require('./words.json');
const idioms = require('./idioms.json');

test('words.json has exactly 600 unique entries with required fields', () => {
  assert.equal(words.length, 600);
  const seen = new Set();
  for (const w of words) {
    assert.equal(typeof w.word, 'string');
    assert.ok(w.word.length > 0);
    assert.equal(typeof w.pronunciation, 'string');
    assert.ok(w.pronunciation.length > 0);
    assert.equal(typeof w.meaning, 'string');
    assert.ok(w.meaning.length > 0);
    assert.ok(!seen.has(w.word.toLowerCase()), `duplicate word: ${w.word}`);
    seen.add(w.word.toLowerCase());
  }
});

test('idioms.json has exactly 100 unique entries with required fields', () => {
  assert.equal(idioms.length, 100);
  const seen = new Set();
  for (const i of idioms) {
    assert.equal(typeof i.idiom, 'string');
    assert.ok(i.idiom.length > 0);
    assert.equal(typeof i.meaning, 'string');
    assert.ok(i.meaning.length > 0);
    assert.ok(!seen.has(i.idiom.toLowerCase()), `duplicate idiom: ${i.idiom}`);
    seen.add(i.idiom.toLowerCase());
  }
});
