const test = require('node:test');
const assert = require('node:assert/strict');
const { seedTable } = require('./seed');

function mockFetch({ existingRows = [], insertOk = true } = {}) {
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    if (!opts || opts.method === undefined) {
      return { ok: true, json: async () => existingRows };
    }
    return { ok: insertOk, status: 500, text: async () => 'insert failed', json: async () => [] };
  };
  return calls;
}

test('seedTable skips insertion when the table already has rows', async () => {
  const calls = mockFetch({ existingRows: [{ id: 1 }, { id: 2 }] });

  await seedTable('words', [{ word: 'a' }, { word: 'b' }, { word: 'c' }]);

  const postCalls = calls.filter(c => c.opts && c.opts.method === 'POST');
  assert.equal(postCalls.length, 0, 'expected no insert POST when table already has rows');
});

test('seedTable inserts all rows when the table is empty', async () => {
  const calls = mockFetch({ existingRows: [] });

  await seedTable('sqld_questions', [{ question: 'q1' }, { question: 'q2' }]);

  const postCalls = calls.filter(c => c.opts && c.opts.method === 'POST');
  assert.equal(postCalls.length, 1, 'expected exactly one insert POST when table is empty');
  const body = JSON.parse(postCalls[0].opts.body);
  assert.equal(body.length, 2);
});
