const fs = require('node:fs');

function buildArchiveIndex(dates) {
  const sorted = [...dates].sort().reverse();
  const items = sorted.map(d => `<li><a href="/archive/${d}.html">${d}</a></li>`).join('\n');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>지난 학습 기록</title>
<link rel="stylesheet" href="/assets/styles.css">
</head>
<body>
<h1>지난 학습 기록</h1>
<ul class="archive-list">
${items}
</ul>
<p><a href="/">오늘로 돌아가기</a></p>
</body>
</html>
`;
}

if (require.main === module) {
  const archiveDir = process.argv[2];
  const outputFile = process.argv[3];
  const dates = fs.readdirSync(archiveDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
    .map(f => f.replace('.html', ''));
  fs.writeFileSync(outputFile, buildArchiveIndex(dates));
}

module.exports = { buildArchiveIndex };
