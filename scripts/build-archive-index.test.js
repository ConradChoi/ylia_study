const test = require('node:test');
const assert = require('node:assert/strict');
const { buildArchiveIndex } = require('./build-archive-index');

test('buildArchiveIndex lists dates newest first with correct links', () => {
  const html = buildArchiveIndex(['2026-08-01', '2026-08-03', '2026-08-02']);
  const order = [...html.matchAll(/archive\/(\d{4}-\d{2}-\d{2})\.html/g)].map(m => m[1]);
  assert.deepEqual(order, ['2026-08-03', '2026-08-02', '2026-08-01']);
});
