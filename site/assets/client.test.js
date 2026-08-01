const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const CLIENT_PATH = path.join(__dirname, 'client.js');

function loadClient() {
  const calls = [];
  global.fetch = (url, opts) => {
    calls.push({ url, opts });
    return Promise.resolve({ ok: true, json: async () => [] });
  };
  global.document = {
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  delete require.cache[require.resolve(CLIENT_PATH)];
  const mod = require(CLIENT_PATH);
  return { mod, calls };
}

test('wireQuiz posts item_type/item_id read from the <li> dataset, not a hardcoded word type or array index', async () => {
  const { mod, calls } = loadClient();

  const feedback = { textContent: '' };
  const input = { value: '어색한 분위기를 깨다' };
  const questionP = { textContent: "'break the ice'의 뜻은?" };
  const li = {
    // itemType/itemId simulate a quiz question about the day's idiom (real idioms.id = 42),
    // while questionIndex (array position) is unrelated and must NOT be used for item_id.
    dataset: { answer: '어색한 분위기를 깨다', itemType: 'idiom', itemId: '42', questionIndex: '3' },
    querySelector: (sel) => {
      if (sel === '.quiz-input') return input;
      if (sel === '.quiz-feedback') return feedback;
      if (sel === 'p') return questionP;
      return null;
    },
  };
  let clickHandler;
  const button = {
    closest: () => li,
    addEventListener: (evt, handler) => {
      clickHandler = handler;
    },
  };
  const scriptTag = { dataset: { quizDate: '2026-08-01' } };

  global.document.querySelector = (sel) => (sel === 'script[data-quiz-date]' ? scriptTag : null);
  global.document.querySelectorAll = (sel) => (sel === '.quiz .quiz-check' ? [button] : []);

  mod.wireQuiz();
  assert.equal(typeof clickHandler, 'function');
  await clickHandler();

  const quizCall = calls.find(c => c.url.includes('quiz_results'));
  assert.ok(quizCall, 'expected a POST to quiz_results');
  const body = JSON.parse(quizCall.opts.body)[0];

  assert.equal(body.item_type, 'idiom');
  assert.equal(body.item_id, 42);
  assert.equal(body.quiz_date, '2026-08-01');
  assert.equal(body.is_correct, true);
});

test('todayStr returns a KST-normalized YYYY-MM-DD date string', () => {
  const { mod } = loadClient();
  assert.match(mod.todayStr(), /^\d{4}-\d{2}-\d{2}$/);
});
