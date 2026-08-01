const test = require('node:test');
const assert = require('node:assert/strict');
const {
  todayInKST,
  computeDayIndex,
  pickWindow,
  pickIndex,
  pickTranslation,
} = require('./rotation');

test('computeDayIndex returns 0 for the epoch date itself', () => {
  const epoch = new Date(Date.UTC(2026, 7, 1));
  assert.equal(computeDayIndex(epoch, epoch), 0);
});

test('computeDayIndex returns 1 for the day after epoch', () => {
  const epoch = new Date(Date.UTC(2026, 7, 1));
  const nextDay = new Date(Date.UTC(2026, 7, 2));
  assert.equal(computeDayIndex(nextDay, epoch), 1);
});

test('pickWindow returns perDay sequential indices starting at dayIndex*perDay mod total', () => {
  assert.deepEqual(pickWindow(0, 600, 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(pickWindow(1, 600, 10), [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
});

test('pickWindow wraps around when the window crosses the end of the list', () => {
  assert.deepEqual(pickWindow(59, 600, 10), [590, 591, 592, 593, 594, 595, 596, 597, 598, 599]);
  assert.deepEqual(pickWindow(60, 600, 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('pickIndex cycles through a list and wraps at the boundary', () => {
  assert.equal(pickIndex(0, 100), 0);
  assert.equal(pickIndex(99, 100), 99);
  assert.equal(pickIndex(100, 100), 0);
});

test('pickTranslation alternates NIV/KJV by day-of-month parity (odd=NIV, even=KJV)', () => {
  assert.equal(pickTranslation(new Date(Date.UTC(2026, 7, 1))), 'NIV');
  assert.equal(pickTranslation(new Date(Date.UTC(2026, 7, 2))), 'KJV');
});

test('todayInKST normalizes to midnight UTC representing the KST calendar date', () => {
  const d = todayInKST();
  assert.equal(d.getUTCHours(), 0);
  assert.equal(d.getUTCMinutes(), 0);
});

test('todayInKST applies +9h offset correctly: 2026-08-01T16:00:00Z → 2026-08-02 (KST)', () => {
  const utcInstant = new Date(Date.UTC(2026, 7, 1, 16, 0, 0));
  const result = todayInKST(utcInstant);
  const expected = new Date(Date.UTC(2026, 7, 2));
  assert.equal(result.getTime(), expected.getTime());
});
