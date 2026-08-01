const fs = require('node:fs');

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderWordRow(w) {
  return `<tr><td>${escapeHtml(w.word)}</td><td>${escapeHtml(w.pronunciation)}</td><td>${escapeHtml(w.meaning)}</td><td>${escapeHtml(w.sentence)}</td></tr>`;
}

function renderVocabRow(v) {
  return `<tr><td>${escapeHtml(v.word)}</td><td>${escapeHtml(v.translit)}</td><td>${escapeHtml(v.gloss)}</td></tr>`;
}

function renderQuizItem(q, i) {
  return `<li data-question-index="${i}" data-answer="${escapeHtml(q.answer)}"><p>${escapeHtml(q.question)}</p><input type="text" class="quiz-input" /><button type="button" class="quiz-check">확인</button> <span class="quiz-feedback"></span></li>`;
}

function renderPage(day) {
  const wordsRows = day.words.map(renderWordRow).join('\n');
  const vocabRows = day.verse.vocab.map(renderVocabRow).join('\n');
  const quizItems = day.quiz.map(renderQuizItem).join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>오늘의 영어 &amp; 말씀 — ${day.date}</title>
<link rel="stylesheet" href="/assets/styles.css">
</head>
<body>
<header>
  <h1>오늘의 영어 &amp; 말씀</h1>
  <p class="date">${day.date}</p>
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
  <p class="en"><span class="translation-label">[${day.verse.displayedTranslation}]</span> ${escapeHtml(day.verse.displayedText)}</p>
  <p class="original" dir="${day.verse.originalLanguage === 'Hebrew' ? 'rtl' : 'ltr'}">${escapeHtml(day.verse.originalText)}</p>
  <table class="vocab">
    <thead><tr><th>원어</th><th>발음</th><th>뜻</th></tr></thead>
    <tbody>
${vocabRows}
    </tbody>
  </table>
</section>

<script src="/assets/client.js" data-quiz-date="${day.date}"></script>
</body>
</html>
`;
}

if (require.main === module) {
  const inputPath = process.argv[2];
  const day = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  process.stdout.write(renderPage(day));
}

module.exports = { renderPage, escapeHtml };
