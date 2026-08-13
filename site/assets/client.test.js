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
    getElementById: () => null,
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

test('wireSqldQuiz posts item_type "sqld" with the real sqld id and marks correctness by comparing choice index to answer index', async () => {
  const { mod, calls } = loadClient();

  const feedback = { textContent: '' };
  const explanation = { hidden: true };
  const questionP = { textContent: 'SQL에서 NULL 값을 비교할 때 사용하는 연산자는?' };
  let choiceClickHandler;
  const choiceButton = {
    dataset: { choiceIndex: '2' },
    addEventListener: (evt, handler) => {
      choiceClickHandler = handler;
    },
  };
  const li = {
    dataset: { sqldId: '17', answerIndex: '2' },
    querySelector: (sel) => {
      if (sel === '.sqld-feedback') return feedback;
      if (sel === '.sqld-explanation') return explanation;
      if (sel === '.sqld-question') return questionP;
      return null;
    },
    querySelectorAll: (sel) => (sel === '.sqld-choice' ? [choiceButton] : []),
  };
  const scriptTag = { dataset: { quizDate: '2026-08-11' } };

  global.document.querySelector = (sel) => (sel === 'script[data-quiz-date]' ? scriptTag : null);
  global.document.querySelectorAll = (sel) => (sel === '.sqld-list > li' ? [li] : []);

  mod.wireSqldQuiz();
  assert.equal(typeof choiceClickHandler, 'function');
  await choiceClickHandler();

  const quizCall = calls.find(c => c.url.includes('quiz_results') && c.opts.method === 'POST');
  assert.ok(quizCall, 'expected a POST to quiz_results');
  const body = JSON.parse(quizCall.opts.body)[0];

  assert.equal(body.item_type, 'sqld');
  assert.equal(body.item_id, 17);
  assert.equal(body.quiz_date, '2026-08-11');
  assert.equal(body.is_correct, true);
  assert.equal(feedback.textContent, '✅ 정답');
  assert.equal(explanation.hidden, false);
});

test("showSqldScore reports how many of today's sqld answers were correct", async () => {
  const calls = [];
  global.fetch = (url) => {
    calls.push(url);
    if (url.includes('item_type=eq.sqld')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ is_correct: true }, { is_correct: false }, { is_correct: true }],
      });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  };
  const scoreEl = { textContent: '' };
  const scriptTag = { dataset: { quizDate: '2026-08-11' } };
  global.document = {
    addEventListener: () => {},
    querySelector: (sel) => (sel === 'script[data-quiz-date]' ? scriptTag : null),
    querySelectorAll: () => [],
    getElementById: (id) => (id === 'sqld-score' ? scoreEl : null),
  };
  delete require.cache[require.resolve(CLIENT_PATH)];
  const mod = require(CLIENT_PATH);

  await mod.showSqldScore();

  assert.match(scoreEl.textContent, /2 \/ 3/);
});
