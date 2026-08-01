const fs = require('node:fs');
const path = require('node:path');
const { SUPABASE_URL } = require('./supabase-config');

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function insertTable(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`seed ${table} failed: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  if (!SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요 (Supabase 대시보드 > Settings > API Keys > Secret keys)');
  }
  const dataDir = path.join(__dirname, '..', 'data');
  const words = JSON.parse(fs.readFileSync(path.join(dataDir, 'words.json'), 'utf8'));
  const idioms = JSON.parse(fs.readFileSync(path.join(dataDir, 'idioms.json'), 'utf8'));
  const verses = JSON.parse(fs.readFileSync(path.join(dataDir, 'verses.json'), 'utf8'));

  await insertTable('words', words);
  console.log(`words: ${words.length}건 저장 완료`);
  await insertTable('idioms', idioms);
  console.log(`idioms: ${idioms.length}건 저장 완료`);
  await insertTable('verses', verses);
  console.log(`verses: ${verses.length}건 저장 완료`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
