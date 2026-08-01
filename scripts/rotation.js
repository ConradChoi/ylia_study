function todayInKST(now = new Date()) {
  const kstMillis = now.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMillis);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
}

function computeDayIndex(today, epoch) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const e = Date.UTC(epoch.getUTCFullYear(), epoch.getUTCMonth(), epoch.getUTCDate());
  return Math.round((t - e) / msPerDay);
}

function mod(n, total) {
  return ((n % total) + total) % total;
}

function pickWindow(dayIndex, total, perDay) {
  const start = mod(dayIndex * perDay, total);
  const indices = [];
  for (let i = 0; i < perDay; i++) {
    indices.push(mod(start + i, total));
  }
  return indices;
}

function pickIndex(dayIndex, total) {
  return mod(dayIndex, total);
}

function pickTranslation(today) {
  return today.getUTCDate() % 2 === 1 ? 'NIV' : 'KJV';
}

module.exports = { todayInKST, computeDayIndex, pickWindow, pickIndex, pickTranslation };
