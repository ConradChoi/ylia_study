# 매일 영어공부 + 성경구절 자동 발행 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매일 06:40(KST)에 영단어 10개+숙어 1개+성경구절 1개로 구성된 학습 페이지를 자동 생성해 GitHub(→AWS Amplify)에 배포하고 카카오톡으로 알린다.

**Architecture:** 콘텐츠(단어/숙어/구절)는 Supabase Postgres 테이블에 저장하고, 순수 함수(rotation.js)로 오늘 날짜 기준 결정론적 순환 선택을 한다. 클라우드 루틴(RemoteTrigger cron)이 매일 이 로직으로 오늘의 항목을 뽑고, 예문/퀴즈는 그 자리에서 새로 생성해 정적 HTML(render-page.js)로 렌더링한 뒤 git push한다. 학습 기록(방문/퀴즈결과)은 브라우저에서 Supabase publishable key로 직접 기록한다.

**Tech Stack:** Node.js 22 (내장 `fetch`, `node:test`, 외부 npm 의존성 없음), Supabase(Postgres + PostgREST), 순수 HTML/CSS/JS 정적 사이트, AWS Amplify(사용자가 직접 연결), Claude Code 클라우드 루틴(RemoteTrigger).

## Global Constraints

- Node.js 22 기준, 외부 npm 패키지 설치 없이 내장 모듈만 사용한다 (의존성 관리 부담을 없애기 위함).
- Supabase **secret(service_role) key는 저장소·프롬프트·클라우드 루틴 어디에도 절대 커밋/입력하지 않는다** — 로컬 터미널에서 환경변수로만 1회성 사용.
- Publishable key(`sb_publishable_Or19pdIs6WAUH-tWaxbj-Q_Ku0qkiC2`)와 Project URL(`https://jlsylkdjsjiiuitmwdpz.supabase.co`)은 공개돼도 안전하므로 코드에 그대로 넣는다.
- 모든 날짜/요일 계산은 **KST(Asia/Seoul) 캘린더 날짜** 기준이다 (클라우드 루틴 실행 서버의 로컬 타임존과 무관하게 always KST로 정규화).
- 콘텐츠 규모: 단어 600개(10개/일, 60일 주기), 숙어 100개(1개/일, 100일 주기), 성경구절 66개(1개/일, 66일 주기, epoch=2026-08-01).
- 성경구절은 구약=히브리어, 신약=그리스어 원문 + 단어별 어휘표(vocab)를 포함해야 한다.

---

### Task 1: 순환 선택 로직 (rotation.js)

**Files:**
- Create: `scripts/rotation.js`
- Test: `scripts/rotation.test.js`

**Interfaces:**
- Produces: `todayInKST(): Date` (KST 자정 00:00을 UTC로 표현한 Date), `computeDayIndex(today: Date, epoch: Date): number`, `pickWindow(dayIndex: number, total: number, perDay: number): number[]`, `pickIndex(dayIndex: number, total: number): number`, `pickTranslation(today: Date): 'NIV' | 'KJV'`

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/rotation.test.js`:
```js
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test scripts/rotation.test.js`
Expected: FAIL (`rotation.js`가 없어서 `Cannot find module './rotation'`)

- [ ] **Step 3: 구현**

`scripts/rotation.js`:
```js
function todayInKST() {
  const now = new Date();
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test scripts/rotation.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add scripts/rotation.js scripts/rotation.test.js
git commit -m "feat: add deterministic day-based rotation logic"
```

---

### Task 2: Supabase REST 헬퍼 (supabase-rest.js)

**Files:**
- Create: `scripts/supabase-config.js`
- Create: `scripts/supabase-rest.js`

**Interfaces:**
- Consumes: 없음 (독립 모듈)
- Produces: `fetchAll(table: string, orderBy?: string): Promise<object[]>`, `upsert(table: string, rows: object[], onConflict: string): Promise<object[]>`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`

- [ ] **Step 1: 설정 파일 작성**

`scripts/supabase-config.js`:
```js
module.exports = {
  SUPABASE_URL: 'https://jlsylkdjsjiiuitmwdpz.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_Or19pdIs6WAUH-tWaxbj-Q_Ku0qkiC2',
};
```

- [ ] **Step 2: REST 헬퍼 작성**

`scripts/supabase-rest.js`:
```js
const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = require('./supabase-config');

async function fetchAll(table, orderBy = 'id') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=${orderBy}.asc`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase fetchAll(${table}) failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function upsert(table, rows, onConflict) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`Supabase upsert(${table}) failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

module.exports = { fetchAll, upsert, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY };
```

- [ ] **Step 3: 실제 Supabase 프로젝트에 연결되는지 수동 검증**

테이블은 비어있어도 되고(아직 콘텐츠 seed 전), 200 OK + 빈 배열이면 연결 성공이다.

Run: `node -e "require('./scripts/supabase-rest').fetchAll('words').then(r => console.log('OK, rows:', r.length)).catch(e => { console.error(e); process.exit(1); })"`
Expected: `OK, rows: 0` (또는 이미 데이터가 있다면 그 수)

- [ ] **Step 4: 커밋**

```bash
git add scripts/supabase-config.js scripts/supabase-rest.js
git commit -m "feat: add Supabase REST client helpers"
```

---

### Task 3: 영단어/숙어 콘텐츠 데이터 (words.json, idioms.json)

**Files:**
- Create: `data/words.json`
- Create: `data/idioms.json`
- Test: `data/validate-words-idioms.test.js`

**Interfaces:**
- Produces: `data/words.json` — 정확히 600개의 `{ word: string, pronunciation: string, meaning: string }` 배열, `word` 값은 서로 중복 없음. `data/idioms.json` — 정확히 100개의 `{ idiom: string, meaning: string }` 배열, `idiom` 값은 서로 중복 없음.

- [ ] **Step 1: 실패하는 검증 테스트 작성**

`data/validate-words-idioms.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const words = require('./words.json');
const idioms = require('./idioms.json');

test('words.json has exactly 600 unique entries with required fields', () => {
  assert.equal(words.length, 600);
  const seen = new Set();
  for (const w of words) {
    assert.equal(typeof w.word, 'string');
    assert.ok(w.word.length > 0);
    assert.equal(typeof w.pronunciation, 'string');
    assert.ok(w.pronunciation.length > 0);
    assert.equal(typeof w.meaning, 'string');
    assert.ok(w.meaning.length > 0);
    assert.ok(!seen.has(w.word.toLowerCase()), `duplicate word: ${w.word}`);
    seen.add(w.word.toLowerCase());
  }
});

test('idioms.json has exactly 100 unique entries with required fields', () => {
  assert.equal(idioms.length, 100);
  const seen = new Set();
  for (const i of idioms) {
    assert.equal(typeof i.idiom, 'string');
    assert.ok(i.idiom.length > 0);
    assert.equal(typeof i.meaning, 'string');
    assert.ok(i.meaning.length > 0);
    assert.ok(!seen.has(i.idiom.toLowerCase()), `duplicate idiom: ${i.idiom}`);
    seen.add(i.idiom.toLowerCase());
  }
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test data/validate-words-idioms.test.js`
Expected: FAIL (`words.json`/`idioms.json`이 없어서 모듈을 찾을 수 없음)

- [ ] **Step 3: 콘텐츠 작성**

`data/words.json`에 실용 영어 단어(초·중급 수준 우선, 예: 일상/비즈니스/시험 빈출 단어) 600개를 아래 형식으로 작성한다. 발음은 한글 표기 또는 IPA 둘 중 하나로 일관되게 통일한다.

```json
[
  { "word": "apple", "pronunciation": "/ˈæp.əl/", "meaning": "사과" },
  { "word": "benefit", "pronunciation": "/ˈben.ɪ.fɪt/", "meaning": "이익, 혜택" }
]
```

(실제 작업 시 600개 전체를 이 형식으로 채운다. 중복 금지, 알파벳순일 필요는 없음.)

`data/idioms.json`에 실용 영어 숙어 100개를 아래 형식으로 작성한다.

```json
[
  { "idiom": "break the ice", "meaning": "어색한 분위기를 깨다" },
  { "idiom": "hit the books", "meaning": "열심히 공부하다" }
]
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test data/validate-words-idioms.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add data/words.json data/idioms.json data/validate-words-idioms.test.js
git commit -m "content: add 600 words and 100 idioms with validation"
```

---

### Task 4: 성경구절 콘텐츠 데이터 (verses.json)

**Files:**
- Create: `data/verses.json`
- Test: `data/validate-verses.test.js`

**Interfaces:**
- Produces: `data/verses.json` — 정확히 66개, 성경 66권 각각 정확히 1개씩. 각 항목 구조는 아래 스키마.

**66권 목록 (정확히 이 39+27=66개가 각 1개씩, 중복/누락 없이 존재해야 함):**

구약(39): 창세기, 출애굽기, 레위기, 민수기, 신명기, 여호수아, 사사기, 룻기, 사무엘상, 사무엘하, 열왕기상, 열왕기하, 역대상, 역대하, 에스라, 느헤미야, 에스더, 욥기, 시편, 잠언, 전도서, 아가, 이사야, 예레미야, 예레미야애가, 에스겔, 다니엘, 호세아, 요엘, 아모스, 오바댜, 요나, 미가, 나훔, 하박국, 스바냐, 학개, 스가랴, 말라기

신약(27): 마태복음, 마가복음, 누가복음, 요한복음, 사도행전, 로마서, 고린도전서, 고린도후서, 갈라디아서, 에베소서, 빌립보서, 골로새서, 데살로니가전서, 데살로니가후서, 디모데전서, 디모데후서, 디도서, 빌레몬서, 히브리서, 야고보서, 베드로전서, 베드로후서, 요한일서, 요한이서, 요한삼서, 유다서, 요한계시록

**항목 스키마:**
```json
{
  "book_ko": "창세기",
  "book_en": "Genesis",
  "testament": "OT",
  "reference": "창세기 1:1",
  "krv": "태초에 하나님이 천지를 창조하시니라",
  "niv": "In the beginning God created the heavens and the earth.",
  "kjv": "In the beginning God created the heaven and the earth.",
  "original_language": "Hebrew",
  "original_text": "בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ׃",
  "vocab": [
    { "word": "בְּרֵאשִׁית", "translit": "bereshit", "gloss": "태초에" },
    { "word": "בָּרָא", "translit": "bara", "gloss": "창조하셨다" },
    { "word": "אֱלֹהִים", "translit": "elohim", "gloss": "하나님이" },
    { "word": "אֵת הַשָּׁמַיִם", "translit": "et ha-shamayim", "gloss": "하늘을" },
    { "word": "וְאֵת הָאָרֶץ", "translit": "ve-et ha-aretz", "gloss": "그리고 땅을" }
  ]
}
```

- `testament`은 `"OT"`(구약)/`"NT"`(신약). `original_language`는 OT→`"Hebrew"`, NT→`"Greek"`.
- 구절은 1~2절 이내로 짧게, 되도록 잘 알려진 구절 위주로 선정해 원어 표기 오류 가능성을 낮춘다.
- `vocab`은 구절에 나오는 단어를 등장 순서대로 모두 나열한다 (원어 단어 / 발음(음역) / 뜻).

- [ ] **Step 1: 실패하는 검증 테스트 작성**

`data/validate-verses.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const verses = require('./verses.json');

const OT_BOOKS = ['창세기','출애굽기','레위기','민수기','신명기','여호수아','사사기','룻기','사무엘상','사무엘하','열왕기상','열왕기하','역대상','역대하','에스라','느헤미야','에스더','욥기','시편','잠언','전도서','아가','이사야','예레미야','예레미야애가','에스겔','다니엘','호세아','요엘','아모스','오바댜','요나','미가','나훔','하박국','스바냐','학개','스가랴','말라기'];
const NT_BOOKS = ['마태복음','마가복음','누가복음','요한복음','사도행전','로마서','고린도전서','고린도후서','갈라디아서','에베소서','빌립보서','골로새서','데살로니가전서','데살로니가후서','디모데전서','디모데후서','디도서','빌레몬서','히브리서','야고보서','베드로전서','베드로후서','요한일서','요한이서','요한삼서','유다서','요한계시록'];
const ALL_BOOKS = [...OT_BOOKS, ...NT_BOOKS];

test('verses.json has exactly 66 entries, one per canonical book, no duplicates', () => {
  assert.equal(verses.length, 66);
  const booksInFile = verses.map(v => v.book_ko).sort();
  assert.deepEqual(booksInFile, [...ALL_BOOKS].sort());
});

test('every verse has required fields and correct original_language for its testament', () => {
  for (const v of verses) {
    assert.equal(typeof v.reference, 'string');
    assert.ok(v.krv.length > 0);
    assert.ok(v.niv.length > 0);
    assert.ok(v.kjv.length > 0);
    assert.ok(v.original_text.length > 0);
    assert.ok(Array.isArray(v.vocab) && v.vocab.length > 0);
    for (const entry of v.vocab) {
      assert.ok(entry.word && entry.translit && entry.gloss);
    }
    if (OT_BOOKS.includes(v.book_ko)) {
      assert.equal(v.testament, 'OT');
      assert.equal(v.original_language, 'Hebrew');
    } else {
      assert.equal(v.testament, 'NT');
      assert.equal(v.original_language, 'Greek');
    }
  }
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test data/validate-verses.test.js`
Expected: FAIL (`verses.json`이 없음)

- [ ] **Step 3: 콘텐츠 작성**

위 스키마와 66권 목록에 맞춰 `data/verses.json`을 작성한다 (66권 각 1개씩, 위에서 정의한 정확한 책 이름 문자열 사용).

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test data/validate-verses.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add data/verses.json data/validate-verses.test.js
git commit -m "content: add 66 Bible verses (OT Hebrew / NT Greek) with vocab glosses"
```

---

### Task 5: 콘텐츠 Seed 스크립트 (seed.js)

**Files:**
- Create: `scripts/seed.js`

**Interfaces:**
- Consumes: `data/words.json`, `data/idioms.json`, `data/verses.json`, 환경변수 `SUPABASE_SERVICE_ROLE_KEY`
- Produces: Supabase `words`/`idioms`/`verses` 테이블에 데이터 삽입 (일회성 실행)

- [ ] **Step 1: 스크립트 작성**

`scripts/seed.js`:
```js
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
```

- [ ] **Step 2: 실행 (사용자 로컬 터미널에서, secret key는 이 세션에 붙여넣지 않고 직접 입력)**

Run: `SUPABASE_SERVICE_ROLE_KEY=<Supabase 대시보드에서 복사한 Secret key> node scripts/seed.js`
Expected: `words: 600건 저장 완료`, `idioms: 100건 저장 완료`, `verses: 66건 저장 완료`

- [ ] **Step 3: publishable key로 카운트 검증**

Run: `node -e "require('./scripts/supabase-rest').fetchAll('words').then(r=>console.log(r.length))"` → `600`
Run: `node -e "require('./scripts/supabase-rest').fetchAll('idioms').then(r=>console.log(r.length))"` → `100`
Run: `node -e "require('./scripts/supabase-rest').fetchAll('verses').then(r=>console.log(r.length))"` → `66`

- [ ] **Step 4: 커밋**

```bash
git add scripts/seed.js
git commit -m "feat: add one-time Supabase content seed script"
```

---

### Task 6: 오늘의 선택 로직 (select-today.js)

**Files:**
- Create: `scripts/select-today.js`
- Test: `scripts/select-today.test.js`

**Interfaces:**
- Consumes: `todayInKST`, `computeDayIndex`, `pickWindow`, `pickIndex`, `pickTranslation` (Task 1), `fetchAll` (Task 2)
- Produces: `selectToday({ words, idioms, verses }, today): { dayIndex, words, idiom, verse, translation }`, CLI(`node scripts/select-today.js`)가 오늘의 선택 결과를 stdout에 JSON으로 출력

- [ ] **Step 1: 실패하는 테스트 작성 (고정 fixture로 순수 함수만 검증, 네트워크 불필요)**

`scripts/select-today.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { selectToday, EPOCH } = require('./select-today');

test('selectToday picks the first window/idiom/verse on the epoch date', () => {
  const words = Array.from({ length: 600 }, (_, i) => ({ id: i + 1, word: `w${i}` }));
  const idioms = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, idiom: `i${i}` }));
  const verses = Array.from({ length: 66 }, (_, i) => ({ id: i + 1, reference: `v${i}` }));

  const result = selectToday({ words, idioms, verses }, EPOCH);

  assert.equal(result.dayIndex, 0);
  assert.equal(result.words.length, 10);
  assert.equal(result.words[0].word, 'w0');
  assert.equal(result.words[9].word, 'w9');
  assert.equal(result.idiom.idiom, 'i0');
  assert.equal(result.verse.reference, 'v0');
  assert.equal(result.translation, 'NIV');
});

test('selectToday advances the window on the next day', () => {
  const words = Array.from({ length: 600 }, (_, i) => ({ id: i + 1, word: `w${i}` }));
  const idioms = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, idiom: `i${i}` }));
  const verses = Array.from({ length: 66 }, (_, i) => ({ id: i + 1, reference: `v${i}` }));
  const nextDay = new Date(Date.UTC(2026, 7, 2));

  const result = selectToday({ words, idioms, verses }, nextDay);

  assert.equal(result.dayIndex, 1);
  assert.equal(result.words[0].word, 'w10');
  assert.equal(result.idiom.idiom, 'i1');
  assert.equal(result.verse.reference, 'v1');
  assert.equal(result.translation, 'KJV');
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test scripts/select-today.test.js`
Expected: FAIL (`select-today.js` 없음)

- [ ] **Step 3: 구현**

`scripts/select-today.js`:
```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test scripts/select-today.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Task 5에서 seed한 실제 데이터로 수동 확인**

Run: `node scripts/select-today.js`
Expected: 오늘 날짜 기준 단어 10개(각각 word/pronunciation/meaning 포함), 숙어 1개, 구절 1개가 JSON으로 출력됨

- [ ] **Step 6: 커밋**

```bash
git add scripts/select-today.js scripts/select-today.test.js
git commit -m "feat: add today's content selection combining rotation + Supabase data"
```

---

### Task 7: 페이지 렌더러 (render-page.js)

**Files:**
- Create: `scripts/render-page.js`
- Test: `scripts/render-page.test.js`

**Interfaces:**
- Consumes: 없음 (순수 함수, 데이터 구조만 받음)
- Produces: `renderPage(day): string` (완성된 HTML 문자열), `escapeHtml(str): string`, CLI(`node scripts/render-page.js <input.json>`)가 stdout에 HTML 출력

`day` 객체 구조 (Task 11에서 클라우드 루틴이 만들어 넘김):
```
{
  date: "2026-08-01",
  words: [{ word, pronunciation, meaning, sentence }, ...10개],
  idiom: { idiom, meaning, sentence },
  quiz: [{ question, answer }, ...],
  verse: {
    reference, krv,
    displayedTranslation: "NIV"|"KJV", displayedText,
    originalLanguage: "Hebrew"|"Greek", originalText,
    vocab: [{ word, translit, gloss }, ...]
  }
}
```

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/render-page.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderPage, escapeHtml } = require('./render-page');

test('escapeHtml escapes special characters', () => {
  assert.equal(escapeHtml('<script>&"'), '&lt;script&gt;&amp;&quot;');
});

test('renderPage includes all of today\'s words, idiom, quiz, and verse content', () => {
  const day = {
    date: '2026-08-01',
    words: [{ word: 'apple', pronunciation: '/ˈæp.əl/', meaning: '사과', sentence: 'I ate an apple.' }],
    idiom: { idiom: 'break the ice', meaning: '어색한 분위기를 깨다', sentence: 'He told a joke to break the ice.' },
    quiz: [{ question: "'apple'의 뜻은?", answer: '사과' }],
    verse: {
      reference: '창세기 1:1',
      krv: '태초에 하나님이 천지를 창조하시니라',
      displayedTranslation: 'NIV',
      displayedText: 'In the beginning God created the heavens and the earth.',
      originalLanguage: 'Hebrew',
      originalText: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים',
      vocab: [{ word: 'בְּרֵאשִׁית', translit: 'bereshit', gloss: '태초에' }],
    },
  };

  const html = renderPage(day);

  assert.match(html, /apple/);
  assert.match(html, /break the ice/);
  assert.match(html, /창세기 1:1/);
  assert.match(html, /bereshit/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /data-quiz-date="2026-08-01"/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test scripts/render-page.test.js`
Expected: FAIL (`render-page.js` 없음)

- [ ] **Step 3: 구현**

`scripts/render-page.js`:
```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test scripts/render-page.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add scripts/render-page.js scripts/render-page.test.js
git commit -m "feat: add pure HTML renderer for daily study page"
```

---

### Task 8: 아카이브 인덱스 빌더 (build-archive-index.js)

**Files:**
- Create: `scripts/build-archive-index.js`
- Test: `scripts/build-archive-index.test.js`

**Interfaces:**
- Produces: `buildArchiveIndex(dates: string[]): string` (HTML), CLI(`node scripts/build-archive-index.js <archiveDir> <outputFile>`)

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/build-archive-index.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildArchiveIndex } = require('./build-archive-index');

test('buildArchiveIndex lists dates newest first with correct links', () => {
  const html = buildArchiveIndex(['2026-08-01', '2026-08-03', '2026-08-02']);
  const order = [...html.matchAll(/archive\/(\d{4}-\d{2}-\d{2})\.html/g)].map(m => m[1]);
  assert.deepEqual(order, ['2026-08-03', '2026-08-02', '2026-08-01']);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test scripts/build-archive-index.test.js`
Expected: FAIL (`build-archive-index.js` 없음)

- [ ] **Step 3: 구현**

`scripts/build-archive-index.js`:
```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test scripts/build-archive-index.test.js`
Expected: PASS (1 test)

- [ ] **Step 5: 커밋**

```bash
git add scripts/build-archive-index.js scripts/build-archive-index.test.js
git commit -m "feat: add archive index builder"
```

---

### Task 9: 발행 기록 로깅 (log-daily.js)

**Files:**
- Create: `scripts/log-daily.js`

**Interfaces:**
- Consumes: `upsert` (Task 2)
- Produces: `logDaily({ date, wordIds, idiomId, verseId, translation }): Promise<void>`, CLI(`node scripts/log-daily.js <date> <wordIdsCsv> <idiomId> <verseId> <translation>`)

- [ ] **Step 1: 구현**

`scripts/log-daily.js`:
```js
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
```

- [ ] **Step 2: 실제 Supabase에 대해 canary 값으로 수동 검증**

먼 미래 날짜(`2099-01-01`)를 써서 실제 오늘 기록과 겹치지 않게 확인한다.

Run: `node scripts/log-daily.js 2099-01-01 1,2,3 1 1 NIV`
Expected: `daily_log upsert 완료`

Run: `node -e "require('./scripts/supabase-rest').fetchAll('daily_log').then(r => console.log(r.find(x => x.log_date === '2099-01-01')))"`
Expected: 방금 넣은 행이 출력됨

(이 canary 행은 Supabase 대시보드 Table Editor에서 나중에 수동으로 지워도 되고 안 지워도 무해하다 — publishable key엔 delete 권한이 없어 스크립트로는 지울 수 없다.)

- [ ] **Step 3: 커밋**

```bash
git add scripts/log-daily.js
git commit -m "feat: add daily_log upsert helper"
```

---

### Task 10: 클라이언트 사이드 스크립트 + 스타일 (visits/streak/quiz)

**Files:**
- Create: `site/assets/client.js`
- Create: `site/assets/styles.css`
- Create: `amplify.yml`

**Interfaces:**
- Consumes: 없음 (브라우저에서 Supabase publishable key로 직접 REST 호출)
- Produces: 페이지 로드 시 `visits`에 오늘 방문 기록 + `#streak-badge`에 연속 출석일 표시, 퀴즈 `확인` 클릭 시 정답 여부 표시 + `quiz_results`에 기록

- [ ] **Step 1: client.js 작성**

`site/assets/client.js`:
```js
(function () {
  const SUPABASE_URL = 'https://jlsylkdjsjiiuitmwdpz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Or19pdIs6WAUH-tWaxbj-Q_Ku0qkiC2';

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  async function recordVisitAndShowStreak() {
    const date = todayStr();
    await fetch(`${SUPABASE_URL}/rest/v1/visits`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify([{ visited_date: date }]),
    });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/visits?select=visited_date&order=visited_date.desc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await res.json();
    const uniqueDates = [...new Set(rows.map(r => r.visited_date))];

    let streak = 0;
    const cursor = new Date(`${date}T00:00:00Z`);
    for (const d of uniqueDates) {
      const cursorStr = cursor.toISOString().slice(0, 10);
      if (d === cursorStr) {
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      } else if (d < cursorStr) {
        break;
      }
    }

    const badge = document.getElementById('streak-badge');
    if (badge) badge.textContent = `🔥 연속 ${streak}일째`;
  }

  function wireQuiz() {
    const scriptTag = document.querySelector('script[data-quiz-date]');
    const quizDate = scriptTag ? scriptTag.dataset.quizDate : todayStr();

    document.querySelectorAll('.quiz .quiz-check').forEach(button => {
      button.addEventListener('click', async () => {
        const li = button.closest('li');
        const input = li.querySelector('.quiz-input');
        const feedback = li.querySelector('.quiz-feedback');
        const question = li.querySelector('p').textContent;
        const expected = li.dataset.answer.trim();
        const given = input.value.trim();
        const isCorrect = given === expected;

        feedback.textContent = isCorrect ? '✅ 정답' : `❌ 오답 (정답: ${expected})`;

        await fetch(`${SUPABASE_URL}/rest/v1/quiz_results`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify([{
            quiz_date: quizDate,
            item_type: 'word',
            item_id: Number(li.dataset.questionIndex),
            question,
            is_correct: isCorrect,
          }]),
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    recordVisitAndShowStreak();
    wireQuiz();
  });
})();
```

- [ ] **Step 2: styles.css 작성 (모바일 우선, 라이트/다크 대응)**

`site/assets/styles.css`:
```css
:root {
  color-scheme: light dark;
  --bg: #fafaf9;
  --fg: #1c1917;
  --card: #ffffff;
  --accent: #b45309;
  --border: #e7e5e4;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1c1917;
    --fg: #f5f5f4;
    --card: #292524;
    --accent: #fbbf24;
    --border: #44403c;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  padding: 1.5rem 1rem 3rem;
  max-width: 42rem;
  margin-inline: auto;
  background: var(--bg);
  color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  line-height: 1.6;
}

header { text-align: center; margin-bottom: 2rem; }
header h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
.date { color: color-mix(in srgb, var(--fg) 60%, transparent); margin: 0; }
.streak { font-weight: 600; color: var(--accent); }

section {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
  overflow-x: auto;
}

section h2 { margin-top: 0; font-size: 1.1rem; }

table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
th, td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--border); }

.quiz ol { padding-left: 1.2rem; }
.quiz li { margin-bottom: 0.75rem; }
.quiz-input { padding: 0.3rem 0.5rem; border: 1px solid var(--border); border-radius: 0.4rem; background: var(--bg); color: var(--fg); }
.quiz-check { padding: 0.3rem 0.7rem; border-radius: 0.4rem; border: none; background: var(--accent); color: #1c1917; cursor: pointer; }
.quiz-feedback { margin-left: 0.5rem; font-weight: 600; }

.verse .original { font-size: 1.2rem; direction: rtl; }
.verse .original[dir="ltr"] { direction: ltr; }
.translation-label { font-weight: 700; color: var(--accent); }

.archive-list { list-style: none; padding: 0; }
.archive-list li { padding: 0.4rem 0; border-bottom: 1px solid var(--border); }
```

- [ ] **Step 3: amplify.yml 작성 (정적 사이트, 빌드 단계 없이 site/ 그대로 배포)**

`amplify.yml`:
```yaml
version: 1
frontend:
  phases:
    build:
      commands:
        - echo "정적 사이트 — 별도 빌드 단계 없음"
  artifacts:
    baseDirectory: site
    files:
      - '**/*'
  cache:
    paths: []
```

- [ ] **Step 4: 로컬 브라우저로 수동 검증**

먼저 Task 11에서 만들 `site/index.html` 샘플이 필요하므로, 임시로 아래 명령으로 샘플 데이터를 렌더링한다.

Run:
```bash
cat > /tmp/sample-day.json << 'EOF'
{
  "date": "2026-08-01",
  "words": [{ "word": "apple", "pronunciation": "/ˈæp.əl/", "meaning": "사과", "sentence": "I ate an apple." }],
  "idiom": { "idiom": "break the ice", "meaning": "어색한 분위기를 깨다", "sentence": "He told a joke to break the ice." },
  "quiz": [{ "question": "'apple'의 뜻은?", "answer": "사과" }],
  "verse": {
    "reference": "창세기 1:1",
    "krv": "태초에 하나님이 천지를 창조하시니라",
    "displayedTranslation": "NIV",
    "displayedText": "In the beginning God created the heavens and the earth.",
    "originalLanguage": "Hebrew",
    "originalText": "בְּרֵאשִׁית בָּרָא אֱלֹהִים",
    "vocab": [{ "word": "בְּרֵאשִׁית", "translit": "bereshit", "gloss": "태초에" }]
  }
}
EOF
node scripts/render-page.js /tmp/sample-day.json > site/index.html
npx --yes serve site
```

브라우저로 `http://localhost:3000` 접속해 확인:
- "🔥 연속 N일째" 배지가 표시되는지 (Supabase `visits` 테이블에 오늘 날짜 행이 추가됨)
- 퀴즈에 답을 입력하고 "확인" 클릭 시 정답/오답 표시되고 Supabase `quiz_results`에 행이 추가되는지 (Supabase 대시보드 Table Editor에서 확인)

- [ ] **Step 5: 커밋**

```bash
git add site/assets/client.js site/assets/styles.css amplify.yml
git commit -m "feat: add client-side streak/quiz tracking and Amplify build config"
```

---

### Task 11: GitHub push + 클라우드 루틴(RemoteTrigger) 생성

**Files:**
- Modify: (git remote 설정, 이 저장소를 GitHub에 최초 push)
- Create: RemoteTrigger 루틴 (파일 아님, claude.ai 쪽 리소스)

**Interfaces:**
- Consumes: Task 1~10에서 만든 모든 스크립트/데이터/RLS(스펙 문서의 `supabase/migrations/0001_init.sql`, 이미 적용됨)
- Produces: 매일 06:40 KST에 자동 발행되는 사이트 + 카카오톡 알림

- [ ] **Step 1: GitHub push**

```bash
git remote add origin https://github.com/ConradChoi/ylia_study.git
git branch -M main
git push -u origin main
```

Expected: push 성공, `https://github.com/ConradChoi/ylia_study`에서 커밋 히스토리 확인 가능

- [ ] **Step 2: (사용자 작업) AWS Amplify 앱 생성 및 저장소 연결**

사용자가 AWS 콘솔에서 Amplify 앱을 만들고 이 저장소(main 브랜치)에 연결, `ylia.life` 도메인을 연결한다. 완료 후 알려달라고 요청한다. (이 작업 범위 밖 — 완료 확인만 한다.)

- [ ] **Step 3: 클라우드 루틴 생성**

`RemoteTrigger` 도구로 아래 설정으로 루틴을 만든다.

- `name`: `ylia-daily-study`
- `cron_expression`: `"40 21 * * *"` (UTC 21:40 = KST 06:40 익일)
- `job_config.ccr.environment_id`: `env_01GYrPM4CiV2AYpVTKiQffk5` (YLIA)
- `job_config.ccr.session_context.sources`: `[{"git_repository": {"url": "https://github.com/ConradChoi/ylia_study"}}]`
- `job_config.ccr.session_context.allowed_tools`: `["Bash", "Read", "Write", "Edit", "Glob", "Grep"]`
- `mcp_connections`: PlayMCP (connector_uuid: `f1e23182-833d-4871-93b2-dcecd977afb8`, name: `PlayMCP`, url: `https://playmcp.kakao.com/mcp`)
- 프롬프트(`events[].data.message.content`)는 아래 내용을 그대로 사용한다:

```
저장소 루트에서 다음을 순서대로 실행해줘. 실패하면 그 단계에서 멈추고 에러를 그대로 보고해 (재시도하지 마).

1. `node scripts/select-today.js` 실행해서 오늘의 단어 10개/숙어 1개/성경구절 1개 원본 데이터(JSON)를 받는다.
2. 그 데이터를 바탕으로:
   - 단어 10개 각각에 대해 자연스러운 영어 예문 문장을 새로 만든다 (sentence 필드).
   - 숙어에 대해서도 예문 문장을 만든다 (sentence 필드).
   - 단어 10개 + 숙어 1개를 기준으로 퀴즈 10문항을 만든다 (각 {question, answer, itemType, itemId}, 단어/숙어의 뜻을 묻거나 빈칸을 채우는 형식). `itemType`은 그 문제가 단어에 대한 것이면 `"word"`, 숙어에 대한 것이면 `"idiom"`. `itemId`는 select-today.js 출력의 해당 단어(`words[i].id`) 또는 숙어(`idiom.id`)의 실제 Supabase `id` 값을 그대로 사용한다 (배열 인덱스나 임의의 번호가 아니라 실제 DB id).
   - 성경구절의 translation 값이 "NIV"면 niv 필드를, "KJV"면 kjv 필드를 displayedText로, translation 값을 displayedTranslation으로 사용한다. original_language를 originalLanguage로, original_text를 originalText로 그대로 옮긴다.
3. 위에서 만든 내용을 다음 구조의 JSON 객체로 만들어 `/tmp/today-data.json`에 저장한다:
   `{ date, words: [{word, pronunciation, meaning, sentence}, ...10개], idiom: {idiom, meaning, sentence}, quiz: [{question, answer, itemType, itemId}, ...10개], verse: {reference, krv, displayedTranslation, displayedText, originalLanguage, originalText, vocab} }`
   (date는 select-today.js 출력의 date 값을 그대로 쓴다. quiz 각 항목의 itemId는 select-today.js가 반환한 words/idiom 데이터의 실제 id 필드를 참조해야 한다.)
4. `node scripts/render-page.js /tmp/today-data.json > site/index.html` 실행
5. 같은 내용을 `site/archive/<date>.html`에도 저장 (site/archive 디렉터리가 없으면 만든다)
6. `node scripts/build-archive-index.js site/archive site/archive/index.html` 실행해서 아카이브 목록 갱신
7. `node scripts/log-daily.js <date> <오늘 단어 10개의 id를 콤마로 연결> <오늘 숙어의 id> <오늘 구절의 id> <translation>` 실행
8. `git add -A && git commit -m "study: <date> 콘텐츠 발행" && git push origin main` 실행
9. PlayMCP KakaotalkChat-MemoChat 도구로 "오늘의 영어공부 & 말씀이 도착했어요! https://ylia.life" 메시지 전송 (200자 이내 확인)
```

- [ ] **Step 4: 생성 직후 1회 수동 실행으로 전체 파이프라인 검증**

`RemoteTrigger`의 `run` 액션으로 즉시 1회 실행하고, 다음을 확인한다:
- GitHub 저장소에 새 커밋이 push되었는지 (`git log`로 확인)
- `site/index.html`/`site/archive/<오늘날짜>.html`이 기대한 내용으로 채워졌는지
- 카카오톡 메시지가 실제로 도착했는지
- (Amplify 연결이 이미 됐다면) `https://ylia.life`가 갱신됐는지

실패 지점이 있으면(특히 클라우드 환경의 git push 인증) 그 지점만 별도로 조사해서 해결한다.

- [ ] **Step 5: 최종 커밋 및 정리**

```bash
git add -A
git commit -m "chore: finalize daily study automation setup" --allow-empty
git push origin main
```

---

## Self-Review 결과

- **스펙 커버리지**: 콘텐츠 뱅크(Task 3,4) · 순환 로직(Task 1,6) · Supabase 연동(Task 2,5,9) · 페이지 렌더링/아카이브(Task 7,8) · 학습기록/streak/퀴즈(Task 10) · 배포(Task 11: git push + Amplify 안내 + 클라우드 루틴) 모두 태스크로 매핑됨.
- **플레이스홀더 스캔**: "TODO"/"나중에" 등 없음. 콘텐츠 작성(Task 3,4)은 실제 항목을 채우는 작업이라 정확한 스키마·개수·66권 목록을 명시해 실행자가 무엇을 만들어야 하는지 모호함이 없게 함.
- **타입/이름 일관성 확인**: `selectToday`가 반환하는 `{dayIndex, words, idiom, verse, translation}` 필드명이 Task 11 프롬프트의 `/tmp/today-data.json` 구조와 일치. `renderPage`가 기대하는 `day` 구조(`displayedTranslation`, `displayedText`, `originalLanguage`, `originalText`)와 Task 11 프롬프트의 매핑 지시가 정확히 일치하도록 맞춤.
