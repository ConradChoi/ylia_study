const test = require('node:test');
const assert = require('node:assert/strict');
const { renderPage, escapeHtml } = require('./render-page');

test('escapeHtml escapes special characters', () => {
  assert.equal(escapeHtml('<script>&"'), '&lt;script&gt;&amp;&quot;');
});

test('renderPage includes all of today\'s words, idiom, quiz, and verse content', () => {
  const day = {
    date: '2026-08-01',
    words: [{ word: 'apple', pronunciation: '/ˈæp.əl/', meaning: '사과', sentence: 'I ate an apple.' }],
    idiom: { idiom: 'break the ice', meaning: '어색한 분위기를 깨다', sentence: 'He told a joke to break the ice.' },
    quiz: [{ question: "'apple'의 뜻은?", answer: '사과' }],
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

  const html = renderPage(day);

  assert.match(html, /apple/);
  assert.match(html, /break the ice/);
  assert.match(html, /창세기 1:1/);
  assert.match(html, /bereshit/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /data-quiz-date="2026-08-01"/);
});
