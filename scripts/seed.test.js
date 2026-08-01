const test = require('node:test');
const assert = require('node:assert/strict');
const { assertTableEmpty } = require('./seed');

test('assertTableEmpty does not throw when the table has no rows', () => {
  assert.doesNotThrow(() => assertTableEmpty('words', []));
});

test('assertTableEmpty throws naming the table and row count when rows already exist', () => {
  const rows = Array.from({ length: 600 }, (_, i) => ({ id: i + 1 }));
  assert.throws(() => assertTableEmpty('words', rows), /words table already has 600 rows/);
});

test('assertTableEmpty throws for idioms table with existing rows', () => {
  const rows = [{ id: 1 }];
  assert.throws(() => assertTableEmpty('idioms', rows), /idioms table already has 1 rows/);
});
