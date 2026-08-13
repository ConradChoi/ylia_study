const { computeDayIndex, pickWindow, pickIndex, pickTranslation, todayInKST } = require('./rotation');
const { fetchAll } = require('./supabase-rest');

const EPOCH = new Date(Date.UTC(2026, 7, 1));

const EXPECTED_COUNTS = { words: 600, idioms: 100, verses: 66, sqldQuestions: 320 };

function validateCounts({ words, idioms, verses, sqldQuestions }) {
  const actual = { words, idioms, verses, sqldQuestions };
  for (const [table, expectedCount] of Object.entries(EXPECTED_COUNTS)) {
    const rows = actual[table];
    const actualCount = Array.isArray(rows) ? rows.length : typeof rows;
    if (!Array.isArray(rows) || rows.length !== expectedCount) {
      throw new Error(`select-today: expected ${expectedCount} rows in '${table}' table but found ${actualCount}`);
    }
  }
}

function selectToday({ words, idioms, verses, sqldQuestions }, today) {
  const dayIndex = computeDayIndex(today, EPOCH);
  const wordIndices = pickWindow(dayIndex, words.length, 10);
  const sqldIndices = pickWindow(dayIndex, sqldQuestions.length, 40);

  return {
    dayIndex,
    words: wordIndices.map(i => words[i]),
    idiom: idioms[pickIndex(dayIndex, idioms.length)],
    verse: verses[pickIndex(dayIndex, verses.length)],
    sqldQuestions: sqldIndices.map(i => sqldQuestions[i]),
    translation: pickTranslation(today),
  };
}

async function main() {
  const [words, idioms, verses, sqldQuestions] = await Promise.all([
    fetchAll('words'),
    fetchAll('idioms'),
    fetchAll('verses'),
    fetchAll('sqld_questions'),
  ]);
  validateCounts({ words, idioms, verses, sqldQuestions });
  const today = todayInKST();
  const selection = selectToday({ words, idioms, verses, sqldQuestions }, today);
  console.log(JSON.stringify({ ...selection, date: today.toISOString().slice(0, 10) }, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { selectToday, EPOCH, validateCounts };
