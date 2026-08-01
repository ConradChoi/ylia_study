const { upsert } = require('./supabase-rest');

async function logDaily({ date, wordIds, idiomId, verseId, translation }) {
  await upsert('daily_log', [{
    log_date: date,
    word_ids: wordIds,
    idiom_id: idiomId,
    verse_id: verseId,
    en_translation: translation,
  }], 'log_date');
}

if (require.main === module) {
  const [date, wordIdsCsv, idiomId, verseId, translation] = process.argv.slice(2);
  logDaily({
    date,
    wordIds: wordIdsCsv.split(',').map(Number),
    idiomId: Number(idiomId),
    verseId: Number(verseId),
    translation,
  }).then(() => console.log('daily_log upsert 완료')).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { logDaily };
