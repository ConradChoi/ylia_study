const test = require('node:test');
const assert = require('node:assert/strict');
const { renderPage, escapeHtml, validateDay } = require('./render-page');

function makeValidDay(overrides = {}) {
  const base = {
    date: '2026-08-01',
    words: Array.from({ length: 10 }, (_, i) => ({
      word: `word${i}`,
      pronunciation: `/prə.nʌn.si.eɪ.ʃən${i}/`,
      meaning: `뜻${i}`,
      sentence: `Sentence number ${i}.`,
    })),
    idiom: { idiom: 'break the ice', meaning: '어색한 분위기를 깨다', sentence: 'He told a joke to break the ice.' },
    quiz: Array.from({ length: 10 }, (_, i) => ({
      question: `질문 ${i}?`,
      answer: `답 ${i}`,
      itemType: i < 9 ? 'word' : 'idiom',
      itemId: i + 1,
    })),
    verse: {
      reference: '창세기 1:1',
      krv: '태초에 하나님이 천지를 창조하시니라',
      displayedTranslation: 'NIV',
      displayedText: 'In the beginning God created the heavens and the earth.',
      originalLanguage: 'Hebrew',
      originalText: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים',
      vocab: [{ word: 'בְּרֵאשִׁית', translit: 'bereshit', gloss: '태초에' }],
    },
  };
  return { ...base, ...overrides };
}

test('escapeHtml escapes special characters', () => {
  assert.equal(escapeHtml('<script>&"'), '&lt;script&gt;&amp;&quot;');
});

test('renderPage includes all of today\'s words, idiom, quiz, and verse content', () => {
  const day = makeValidDay();

  const html = renderPage(day);

  assert.match(html, /word0/);
  assert.match(html, /break the ice/);
  assert.match(html, /창세기 1:1/);
  assert.match(html, /bereshit/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /data-quiz-date="2026-08-01"/);
});

test('renderPage links to the archive index in the footer', () => {
  const html = renderPage(makeValidDay());
  assert.match(html, /<a href="\/archive\/">/);
});

test('renderPage emits data-item-type and data-item-id for each quiz entry', () => {
  const day = makeValidDay();
  const html = renderPage(day);

  assert.match(html, /data-item-type="idiom" data-item-id="10"/);
  assert.match(html, /data-item-type="word" data-item-id="1"/);
});

test('validateDay throws when a word is missing its sentence', () => {
  const day = makeValidDay();
  day.words[3] = { ...day.words[3], sentence: '' };

  assert.throws(() => renderPage(day), /day\.words\[3\]\.sentence/);
});

test('validateDay throws when verse.displayedTranslation is not NIV or KJV', () => {
  const day = makeValidDay();
  day.verse = { ...day.verse, displayedTranslation: 'ESV' };

  assert.throws(() => renderPage(day), /displayedTranslation/);
});

test('validateDay throws when quiz is an empty array', () => {
  const day = makeValidDay();
  day.quiz = [];

  assert.throws(() => renderPage(day), /day\.quiz must be a non-empty array/);
});

test('validateDay throws when a quiz entry has an invalid itemType', () => {
  const day = makeValidDay();
  day.quiz[0] = { ...day.quiz[0], itemType: 'verse' };

  assert.throws(() => validateDay(day), /itemType/);
});

test('validateDay throws when a quiz entry has a non-positive-integer itemId', () => {
  const day = makeValidDay();
  day.quiz[0] = { ...day.quiz[0], itemId: 0 };

  assert.throws(() => validateDay(day), /itemId/);
});

test('validateDay throws when words is not exactly 10 items', () => {
  const day = makeValidDay();
  day.words = day.words.slice(0, 9);

  assert.throws(() => validateDay(day), /exactly 10 items/);
});

test('validateDay throws when verse.originalLanguage is invalid', () => {
  const day = makeValidDay();
  day.verse = { ...day.verse, originalLanguage: 'Aramaic' };

  assert.throws(() => validateDay(day), /originalLanguage/);
});

test('validateDay throws when verse.vocab is empty', () => {
  const day = makeValidDay();
  day.verse = { ...day.verse, vocab: [] };

  assert.throws(() => validateDay(day), /vocab must be a non-empty array/);
});

test('validateDay does not throw for a valid day', () => {
  assert.doesNotThrow(() => validateDay(makeValidDay()));
});
