const fs = require('node:fs');

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function requireNonEmptyString(value, label) {
  if (!isNonEmptyString(value)) {
    throw new Error(`validateDay: ${label} must be a non-empty string (got ${JSON.stringify(value)})`);
  }
}

function validateDay(day) {
  if (!day || typeof day !== 'object') {
    throw new Error('validateDay: day must be an object');
  }

  if (!Array.isArray(day.words) || day.words.length !== 10) {
    throw new Error(`validateDay: day.words must be an array of exactly 10 items (got ${Array.isArray(day.words) ? day.words.length : typeof day.words})`);
  }
  day.words.forEach((w, i) => {
    for (const field of ['word', 'pronunciation', 'meaning', 'sentence']) {
      requireNonEmptyString(w && w[field], `day.words[${i}].${field}`);
    }
  });

  if (!day.idiom || typeof day.idiom !== 'object') {
    throw new Error('validateDay: day.idiom must be an object');
  }
  for (const field of ['idiom', 'meaning', 'sentence']) {
    requireNonEmptyString(day.idiom[field], `day.idiom.${field}`);
  }

  if (!Array.isArray(day.quiz) || day.quiz.length === 0) {
    throw new Error(`validateDay: day.quiz must be a non-empty array (got ${Array.isArray(day.quiz) ? 'empty array' : typeof day.quiz})`);
  }
  day.quiz.forEach((q, i) => {
    for (const field of ['question', 'answer']) {
      requireNonEmptyString(q && q[field], `day.quiz[${i}].${field}`);
    }
    if (!q || (q.itemType !== 'word' && q.itemType !== 'idiom')) {
      throw new Error(`validateDay: day.quiz[${i}].itemType must be 'word' or 'idiom' (got ${JSON.stringify(q && q.itemType)})`);
    }
    if (!isPositiveInteger(q.itemId)) {
      throw new Error(`validateDay: day.quiz[${i}].itemId must be a positive integer (got ${JSON.stringify(q && q.itemId)})`);
    }
  });

  if (!day.verse || typeof day.verse !== 'object') {
    throw new Error('validateDay: day.verse must be an object');
  }
  for (const field of ['reference', 'krv', 'displayedText', 'originalText']) {
    requireNonEmptyString(day.verse[field], `day.verse.${field}`);
  }
  if (day.verse.displayedTranslation !== 'NIV' && day.verse.displayedTranslation !== 'KJV') {
    throw new Error(`validateDay: day.verse.displayedTranslation must be 'NIV' or 'KJV' (got ${JSON.stringify(day.verse.displayedTranslation)})`);
  }
  if (day.verse.originalLanguage !== 'Hebrew' && day.verse.originalLanguage !== 'Greek') {
    throw new Error(`validateDay: day.verse.originalLanguage must be 'Hebrew' or 'Greek' (got ${JSON.stringify(day.verse.originalLanguage)})`);
  }
  if (!Array.isArray(day.verse.vocab) || day.verse.vocab.length === 0) {
    throw new Error(`validateDay: day.verse.vocab must be a non-empty array (got ${Array.isArray(day.verse.vocab) ? 'empty array' : typeof day.verse.vocab})`);
  }
}

function renderWordRow(w) {
  return `<tr><td>${escapeHtml(w.word)}</td><td>${escapeHtml(w.pronunciation)}</td><td>${escapeHtml(w.meaning)}</td><td>${escapeHtml(w.sentence)}</td></tr>`;
}

function renderVocabRow(v) {
  return `<tr><td>${escapeHtml(v.word)}</td><td>${escapeHtml(v.translit)}</td><td>${escapeHtml(v.gloss)}</td></tr>`;
}

function renderQuizItem(q, i) {
  return `<li data-question-index="${i}" data-item-type="${escapeHtml(q.itemType)}" data-item-id="${q.itemId}" data-answer="${escapeHtml(q.answer)}"><p>${escapeHtml(q.question)}</p><input type="text" class="quiz-input" /><button type="button" class="quiz-check">확인</button> <span class="quiz-feedback"></span></li>`;
}

function renderPage(day) {
  validateDay(day);
  const wordsRows = day.words.map(renderWordRow).join('\n');
  const vocabRows = day.verse.vocab.map(renderVocabRow).join('\n');
  const quizItems = day.quiz.map(renderQuizItem).join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>오늘의 영어 &amp; 말씀 — ${escapeHtml(day.date)}</title>
<link rel="stylesheet" href="/assets/styles.css">
</head>
<body>
<header>
  <h1>오늘의 영어 &amp; 말씀</h1>
  <p class="date">${escapeHtml(day.date)}</p>
  <p id="streak-badge" class="streak">연속 출석 확인 중...</p>
</header>

<section class="words">
  <h2>오늘의 영단어</h2>
  <table>
    <thead><tr><th>단어</th><th>발음</th><th>뜻</th><th>예문</th></tr></thead>
    <tbody>
${wordsRows}
    </tbody>
  </table>
</section>

<section class="idiom">
  <h2>오늘의 숙어</h2>
  <p><strong>${escapeHtml(day.idiom.idiom)}</strong> — ${escapeHtml(day.idiom.meaning)}</p>
  <p class="sentence">${escapeHtml(day.idiom.sentence)}</p>
</section>

<section class="quiz">
  <h2>오늘의 퀴즈</h2>
  <ol>
${quizItems}
  </ol>
</section>

<section class="verse">
  <h2>오늘의 성경구절 — ${escapeHtml(day.verse.reference)}</h2>
  <p class="krv">${escapeHtml(day.verse.krv)}</p>
  <p class="en"><span class="translation-label">[${escapeHtml(day.verse.displayedTranslation)}]</span> ${escapeHtml(day.verse.displayedText)}</p>
  <p class="original" dir="${day.verse.originalLanguage === 'Hebrew' ? 'rtl' : 'ltr'}">${escapeHtml(day.verse.originalText)}</p>
  <table class="vocab">
    <thead><tr><th>원어</th><th>발음</th><th>뜻</th></tr></thead>
    <tbody>
${vocabRows}
    </tbody>
  </table>
</section>

<footer><a href="/archive/">지난 학습 기록 보기</a></footer>

<script src="/assets/client.js" data-quiz-date="${escapeHtml(day.date)}"></script>
</body>
</html>
`;
}

if (require.main === module) {
  const inputPath = process.argv[2];
  const day = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  process.stdout.write(renderPage(day));
}

module.exports = { renderPage, escapeHtml, validateDay };
