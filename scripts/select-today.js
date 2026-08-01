const { computeDayIndex, pickWindow, pickIndex, pickTranslation, todayInKST } = require('./rotation');
const { fetchAll } = require('./supabase-rest');

const EPOCH = new Date(Date.UTC(2026, 7, 1));

function selectToday({ words, idioms, verses }, today) {
  const dayIndex = computeDayIndex(today, EPOCH);
  const wordIndices = pickWindow(dayIndex, words.length, 10);

  return {
    dayIndex,
    words: wordIndices.map(i => words[i]),
    idiom: idioms[pickIndex(dayIndex, idioms.length)],
    verse: verses[pickIndex(dayIndex, verses.length)],
    translation: pickTranslation(today),
  };
}

async function main() {
  const [words, idioms, verses] = await Promise.all([
    fetchAll('words'),
    fetchAll('idioms'),
    fetchAll('verses'),
  ]);
  const today = todayInKST();
  const selection = selectToday({ words, idioms, verses }, today);
  console.log(JSON.stringify({ ...selection, date: today.toISOString().slice(0, 10) }, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { selectToday, EPOCH };
