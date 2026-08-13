# 탭 구조 전환 + SQLD 탭 추가 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매일 발행되는 학습 페이지를 "영단어/숙어 · 성경구절 · SQLD" 3개 탭으로 재구성하고, SQLD(SQL 개발자 자격증) 문제 풀이 탭을 새로 추가한다.

**Architecture:** 기존 `render-page.js`가 만들던 세로 나열 페이지를 클라이언트 사이드 탭(페이지 이동 없음)으로 감싼다. SQLD 문제는 다른 콘텐츠처럼 Supabase 테이블에 저장하고 동일한 `rotation.js` 순환 로직(40문제/일, 10일 주기)으로 매일 선택하되, 단어/숙어와 달리 매일 새로 생성하지 않고 문제은행에서 그대로 꺼내 보여준다. 정답 체크는 기존 `quiz_results` 테이블을 그대로 재사용(`item_type='sqld'`)한다.

**Tech Stack:** Node.js 22 (내장 `fetch`, `node:test`, 외부 npm 의존성 없음), Supabase(Postgres + PostgREST), 순수 HTML/CSS/JS.

## Global Constraints

- Node.js 22 기준, 외부 npm 패키지 설치 없이 내장 모듈만 사용한다.
- Supabase **secret(service_role) key는 저장소·프롬프트·클라우드 루틴 어디에도 절대 커밋/입력하지 않는다** — 로컬 터미널 환경변수로만 1회성 사용.
- Publishable key(`sb_publishable_Or19pdIs6WAUH-tWaxbj-Q_Ku0qkiC2`)와 Project URL(`https://jlsylkdjsjiiuitmwdpz.supabase.co`)은 공개돼도 안전하므로 코드에 그대로 넣는다 (기존과 동일).
- 모든 날짜 계산은 KST(Asia/Seoul) 캘린더 날짜 기준이다 (기존 `rotation.js`/`todayInKST()` 재사용).
- **SQLD 문제는 실제 KDATA 기출문제 원문을 복제하지 않는다** — 기출 유형·난이도만 참고해 자체 제작한다.
- SQLD 콘텐츠 규모: 총 400문제 (데이터 모델링의 이해 80문제 + SQL 기본 및 활용 320문제), 매일 40문제씩 10일 주기로 순환, 기존 콘텐츠와 동일한 epoch(`2026-08-01`)를 공유한다.
- 탭 UI는 클라이언트 사이드 전환만 한다 (페이지 이동 없음, 탭 선택 상태 저장 안 함, 기본 활성 탭은 "영단어/숙어").
- 이미 프로덕션 Supabase에는 `words`(600)/`idioms`(100)/`verses`(66)가 이미 시드되어 있다. 새로 추가하는 시드 로직은 **테이블별로** 이미 데이터가 있으면 건너뛰고 없으면만 넣어야 한다 (전체를 막아버리는 방식이면 안 됨).

---

### Task 1: Supabase 마이그레이션 (SQLD 테이블 추가)

**Files:**
- Create: `supabase/migrations/0002_add_sqld.sql`

**Interfaces:**
- Produces: Supabase에 `sqld_questions` 테이블 (컬럼: `id serial`, `subject text`, `question text`, `choices jsonb`, `answer_index int`, `explanation text`, `created_at timestamptz`), RLS로 읽기 공개. `quiz_results.item_type` 체크 제약에 `'sqld'` 추가.

- [ ] **Step 1: 마이그레이션 SQL 작성**

`supabase/migrations/0002_add_sqld.sql`:
```sql
-- ylia_study: SQLD 문제 탭 추가
-- Supabase SQL Editor에서 그대로 실행하세요. 여러 번 실행해도 안전합니다.

create table if not exists sqld_questions (
  id serial primary key,
  subject text not null check (subject in ('data_modeling', 'sql_basic')),
  question text not null,
  choices jsonb not null, -- ["보기1", "보기2", "보기3", "보기4"]
  answer_index int not null check (answer_index between 0 and 3),
  explanation text not null,
  created_at timestamptz not null default now()
);

alter table sqld_questions enable row level security;

drop policy if exists "content read (sqld_questions)" on sqld_questions;
create policy "content read (sqld_questions)" on sqld_questions for select using (true);

alter table quiz_results drop constraint if exists quiz_results_item_type_check;
alter table quiz_results add constraint quiz_results_item_type_check
  check (item_type in ('word', 'idiom', 'sqld'));
```

- [ ] **Step 2: 실제 Supabase 프로젝트에 반영 (사용자 작업)**

이 파일 내용을 Supabase 대시보드 → **SQL Editor**에 붙여넣고 **Run**. 완료되면 다음 명령으로 연결을 확인한다 (테이블이 비어있어도 정상):

Run: `node -e "require('./scripts/supabase-rest').fetchAll('sqld_questions').then(r => console.log('OK, rows:', r.length)).catch(e => { console.error(e); process.exit(1); })"`
Expected: `OK, rows: 0`

(이 단계는 사용자가 Supabase SQL Editor에서 직접 실행해야 한다 — 에이전트는 secret key가 없어 DDL을 실행할 수 없다. 에이전트는 커밋만 진행하고, 실제 반영 확인은 사용자에게 요청한다.)

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/0002_add_sqld.sql
git commit -m "feat: add sqld_questions table and extend quiz_results item_type"
```

---

### Task 2: SQLD 콘텐츠 — 데이터 모델링의 이해 (80문제)

**Files:**
- Create: `data/sqld_questions.json`
- Test: `data/validate-sqld.test.js`

**Interfaces:**
- Produces: `data/sqld_questions.json` — 이 시점엔 정확히 80개, 전부 `subject: "data_modeling"`인 `{ subject, question, choices, answer_index, explanation }` 배열.

**주제 범위 (참고, 기출 유형만 참고하고 원문은 복제하지 않는다):** 엔터티/속성/관계, 식별자(주식별자/보조식별자), 정규화(1~3정규형, 반정규화), ERD 표기법, 슈퍼타입/서브타입, 트랜잭션의 특성(ACID), 인덱스 기본 개념 등 실제 SQLD 1과목 범위.

- [ ] **Step 1: 실패하는 검증 테스트 작성**

`data/validate-sqld.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const questions = require('./sqld_questions.json');

test('sqld_questions.json has exactly 80 data_modeling questions so far', () => {
  assert.equal(questions.length, 80);
  for (const q of questions) {
    assert.equal(q.subject, 'data_modeling');
  }
});

test('every sqld question has the required schema', () => {
  const seen = new Set();
  for (const q of questions) {
    assert.ok(q.subject === 'data_modeling' || q.subject === 'sql_basic');
    assert.equal(typeof q.question, 'string');
    assert.ok(q.question.trim().length > 0);
    assert.ok(Array.isArray(q.choices) && q.choices.length === 4);
    for (const c of q.choices) {
      assert.equal(typeof c, 'string');
      assert.ok(c.trim().length > 0);
    }
    assert.ok(Number.isInteger(q.answer_index) && q.answer_index >= 0 && q.answer_index <= 3);
    assert.equal(typeof q.explanation, 'string');
    assert.ok(q.explanation.trim().length > 0);
    const key = `${q.subject}::${q.question.toLowerCase()}`;
    assert.ok(!seen.has(key), `duplicate question: ${q.question}`);
    seen.add(key);
  }
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test data/validate-sqld.test.js`
Expected: FAIL (`sqld_questions.json`이 없어서 모듈을 찾을 수 없음)

- [ ] **Step 3: 콘텐츠 작성**

`data/sqld_questions.json`에 데이터 모델링의 이해 과목 4지선다 문제 80개를 아래 형식으로 작성한다 (전부 `subject: "data_modeling"`):

```json
[
  {
    "subject": "data_modeling",
    "question": "다음 중 엔터티(Entity)에 대한 설명으로 가장 적절한 것은?",
    "choices": [
      "업무에서 관리하고자 하는 관심 대상이 되는 정보로서 서로 구분되는 것",
      "테이블의 특정 컬럼에 부여하는 제약조건",
      "두 릴레이션을 물리적으로 연결하는 SQL 구문",
      "데이터베이스 접근 권한을 관리하는 계정 단위"
    ],
    "answer_index": 0,
    "explanation": "엔터티는 업무상 관리 대상이 되는, 서로 구분 가능한 실체(사람/사물/사건 등)를 의미한다. 나머지 보기는 각각 제약조건, 조인, 계정 개념에 해당한다."
  }
]
```

(실제 작업 시 80개 전체를 이 형식으로 채운다. 중복 질문 금지.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test data/validate-sqld.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add data/sqld_questions.json data/validate-sqld.test.js
git commit -m "content: add 80 SQLD data-modeling questions"
```

---

### Task 3: SQLD 콘텐츠 — SQL 기본 및 활용 Part 1 (160문제 추가)

**Files:**
- Modify: `data/sqld_questions.json` (기존 80개에 160개 추가, 총 240개)
- Modify: `data/validate-sqld.test.js`

**Interfaces:**
- Consumes: Task 2가 만든 `data/sqld_questions.json`의 기존 80개 `data_modeling` 문제 (그대로 유지, 앞에 둔다).
- Produces: `data/sqld_questions.json` — 이 시점엔 정확히 240개 (`data_modeling` 80 + `sql_basic` 160).

**주제 범위:** SELECT 기본 문법, WHERE, GROUP BY/HAVING, ORDER BY, 조인(INNER/OUTER/CROSS/SELF), 서브쿼리 등 실제 SQLD 2과목 전반부 범위.

- [ ] **Step 1: 실패하는 테스트로 갱신**

`data/validate-sqld.test.js`의 첫 번째 테스트를 아래로 교체한다 (두 번째 "every sqld question..." 테스트는 그대로 둔다):

```js
test('sqld_questions.json has 240 questions so far: 80 data_modeling + 160 sql_basic', () => {
  assert.equal(questions.length, 240);
  const dataModeling = questions.filter(q => q.subject === 'data_modeling');
  const sqlBasic = questions.filter(q => q.subject === 'sql_basic');
  assert.equal(dataModeling.length, 80);
  assert.equal(sqlBasic.length, 160);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test data/validate-sqld.test.js`
Expected: FAIL (현재 80개뿐이라 240개 기대와 불일치)

- [ ] **Step 3: 콘텐츠 추가**

`data/sqld_questions.json`의 기존 80개 배열 뒤에 SQL 기본 및 활용 과목(`subject: "sql_basic"`) 문제 160개를 같은 스키마로 추가한다. 기존 80개는 순서/내용을 바꾸지 않는다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test data/validate-sqld.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add data/sqld_questions.json data/validate-sqld.test.js
git commit -m "content: add 160 SQLD sql-basic questions (part 1 of 2)"
```

---

### Task 4: SQLD 콘텐츠 — SQL 기본 및 활용 Part 2 (160문제 추가, 최종 400문제)

**Files:**
- Modify: `data/sqld_questions.json` (기존 240개에 160개 추가, 총 400개 — 최종)
- Modify: `data/validate-sqld.test.js`

**Interfaces:**
- Consumes: Task 3까지 만든 240개 (그대로 유지, 앞에 둔다).
- Produces: `data/sqld_questions.json` — 최종 정확히 400개 (`data_modeling` 80 + `sql_basic` 320).

**주제 범위:** 집합 연산자(UNION/UNION ALL/INTERSECT/MINUS), DML(INSERT/UPDATE/DELETE/MERGE), DDL/제약조건, 윈도우 함수, 계층형 질의(CONNECT BY 등), 그룹 함수(ROLLUP/CUBE) 등 나머지 SQLD 2과목 범위.

- [ ] **Step 1: 실패하는 테스트로 최종 갱신**

`data/validate-sqld.test.js`의 첫 번째 테스트를 최종 버전으로 교체한다:

```js
test('sqld_questions.json has the final 400 questions: 80 data_modeling + 320 sql_basic', () => {
  assert.equal(questions.length, 400);
  const dataModeling = questions.filter(q => q.subject === 'data_modeling');
  const sqlBasic = questions.filter(q => q.subject === 'sql_basic');
  assert.equal(dataModeling.length, 80);
  assert.equal(sqlBasic.length, 320);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test data/validate-sqld.test.js`
Expected: FAIL (현재 240개뿐)

- [ ] **Step 3: 콘텐츠 추가**

기존 240개 뒤에 나머지 SQL 기본/활용 문제 160개를 추가해 총 400개(데이터모델링 80 + SQL기본활용 320)를 완성한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test data/validate-sqld.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add data/sqld_questions.json data/validate-sqld.test.js
git commit -m "content: add final 160 SQLD sql-basic questions (400 total)"
```

---

### Task 5: seed.js 재설계 (테이블별 skip 방식) + sqld_questions 추가

**Files:**
- Modify: `scripts/seed.js`
- Modify: `scripts/seed.test.js`

**Interfaces:**
- Produces: `seedTable(table: string, rows: object[]): Promise<void>` — 테이블에 이미 행이 있으면 건너뛰고 로그만 남기고, 비어있으면 삽입한다. (기존 `assertTableEmpty`를 대체한다 — 아래 "왜 바꾸는가" 참고)

**왜 바꾸는가:** 기존 `assertTableEmpty`는 "테이블 중 하나라도 이미 데이터가 있으면 전체를 막고 에러"였다. 하지만 지금 프로덕션 Supabase에는 이미 `words`/`idioms`/`verses`가 시드되어 있다. 이 방식을 그대로 `sqld_questions`에도 적용하면, `seed.js`를 다시 실행하는 순간 `words`가 이미 있다는 이유로 `sqld_questions`조차 못 넣고 즉시 에러가 난다. 그래서 "테이블 단위로 이미 있으면 건너뛰고, 없는 테이블만 채우는" 방식으로 바꾼다.

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/seed.test.js` 전체를 아래로 교체한다:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { seedTable } = require('./seed');

function mockFetch({ existingRows = [], insertOk = true } = {}) {
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    if (!opts || opts.method === undefined) {
      return { ok: true, json: async () => existingRows };
    }
    return { ok: insertOk, status: 500, text: async () => 'insert failed', json: async () => [] };
  };
  return calls;
}

test('seedTable skips insertion when the table already has rows', async () => {
  const calls = mockFetch({ existingRows: [{ id: 1 }, { id: 2 }] });

  await seedTable('words', [{ word: 'a' }, { word: 'b' }, { word: 'c' }]);

  const postCalls = calls.filter(c => c.opts && c.opts.method === 'POST');
  assert.equal(postCalls.length, 0, 'expected no insert POST when table already has rows');
});

test('seedTable inserts all rows when the table is empty', async () => {
  const calls = mockFetch({ existingRows: [] });

  await seedTable('sqld_questions', [{ question: 'q1' }, { question: 'q2' }]);

  const postCalls = calls.filter(c => c.opts && c.opts.method === 'POST');
  assert.equal(postCalls.length, 1, 'expected exactly one insert POST when table is empty');
  const body = JSON.parse(postCalls[0].opts.body);
  assert.equal(body.length, 2);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test scripts/seed.test.js`
Expected: FAIL (`seedTable`가 없어서 `undefined is not a function` 류의 에러)

- [ ] **Step 3: 구현**

`scripts/seed.js` 전체를 아래로 교체한다:

```js
const fs = require('node:fs');
const path = require('node:path');
const { SUPABASE_URL } = require('./supabase-config');
const { fetchAll } = require('./supabase-rest');

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

async function seedTable(table, rows) {
  const existing = await fetchAll(table);
  if (Array.isArray(existing) && existing.length > 0) {
    console.log(`${table}: 이미 ${existing.length}건 있음 — 건너뜀`);
    return;
  }
  await insertTable(table, rows);
  console.log(`${table}: ${rows.length}건 저장 완료`);
}

async function main() {
  if (!SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요 (Supabase 대시보드 > Settings > API Keys > Secret keys)');
  }
  const dataDir = path.join(__dirname, '..', 'data');
  const words = JSON.parse(fs.readFileSync(path.join(dataDir, 'words.json'), 'utf8'));
  const idioms = JSON.parse(fs.readFileSync(path.join(dataDir, 'idioms.json'), 'utf8'));
  const verses = JSON.parse(fs.readFileSync(path.join(dataDir, 'verses.json'), 'utf8'));
  const sqldQuestions = JSON.parse(fs.readFileSync(path.join(dataDir, 'sqld_questions.json'), 'utf8'));

  await seedTable('words', words);
  await seedTable('idioms', idioms);
  await seedTable('verses', verses);
  await seedTable('sqld_questions', sqldQuestions);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seedTable };
```

주의: `insertTable`을 호출하는 실제 REST 요청은 `apikey`/`Authorization` 헤더에 `SERVICE_ROLE_KEY`를 쓴다 — 이 값은 여전히 로컬 환경변수로만 주입되고 코드에 하드코딩하지 않는다 (기존과 동일한 보안 원칙 유지).

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test scripts/seed.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add scripts/seed.js scripts/seed.test.js
git commit -m "refactor: make seed.js skip already-populated tables instead of blocking the whole run"
```

---

### Task 6: select-today.js 확장 (SQLD 문제 포함)

**Files:**
- Modify: `scripts/select-today.js`
- Modify: `scripts/select-today.test.js`

**Interfaces:**
- Consumes: `pickWindow`, `pickIndex`, `pickTranslation`, `computeDayIndex`, `todayInKST` (rotation.js, 기존), `fetchAll` (supabase-rest.js, 기존)
- Produces: `selectToday({words, idioms, verses, sqldQuestions}, today)`가 이제 `sqldQuestions` 필드(40개)도 포함해서 반환한다: `{dayIndex, words, idiom, verse, sqldQuestions, translation}`. `validateCounts({words, idioms, verses, sqldQuestions})`도 `sqldQuestions.length === 400`을 검증한다.

- [ ] **Step 1: 실패하는 테스트로 갱신**

`scripts/select-today.test.js` 전체를 아래로 교체한다:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { selectToday, EPOCH, validateCounts } = require('./select-today');

function makeSqldFixture() {
  return Array.from({ length: 400 }, (_, i) => ({ id: i + 1, question: `sqld${i}` }));
}

test('selectToday picks the first window/idiom/verse/sqld-block on the epoch date', () => {
  const words = Array.from({ length: 600 }, (_, i) => ({ id: i + 1, word: `w${i}` }));
  const idioms = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, idiom: `i${i}` }));
  const verses = Array.from({ length: 66 }, (_, i) => ({ id: i + 1, reference: `v${i}` }));
  const sqldQuestions = makeSqldFixture();

  const result = selectToday({ words, idioms, verses, sqldQuestions }, EPOCH);

  assert.equal(result.dayIndex, 0);
  assert.equal(result.words.length, 10);
  assert.equal(result.words[0].word, 'w0');
  assert.equal(result.words[9].word, 'w9');
  assert.equal(result.idiom.idiom, 'i0');
  assert.equal(result.verse.reference, 'v0');
  assert.equal(result.sqldQuestions.length, 40);
  assert.equal(result.sqldQuestions[0].question, 'sqld0');
  assert.equal(result.sqldQuestions[39].question, 'sqld39');
  assert.equal(result.translation, 'NIV');
});

test('selectToday advances the window on the next day', () => {
  const words = Array.from({ length: 600 }, (_, i) => ({ id: i + 1, word: `w${i}` }));
  const idioms = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, idiom: `i${i}` }));
  const verses = Array.from({ length: 66 }, (_, i) => ({ id: i + 1, reference: `v${i}` }));
  const sqldQuestions = makeSqldFixture();
  const nextDay = new Date(Date.UTC(2026, 7, 2));

  const result = selectToday({ words, idioms, verses, sqldQuestions }, nextDay);

  assert.equal(result.dayIndex, 1);
  assert.equal(result.words[0].word, 'w10');
  assert.equal(result.idiom.idiom, 'i1');
  assert.equal(result.verse.reference, 'v1');
  assert.equal(result.sqldQuestions[0].question, 'sqld40');
  assert.equal(result.translation, 'KJV');
});

test('validateCounts does not throw when all tables have the expected row counts', () => {
  const words = Array.from({ length: 600 }, (_, i) => ({ id: i + 1 }));
  const idioms = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
  const verses = Array.from({ length: 66 }, (_, i) => ({ id: i + 1 }));
  const sqldQuestions = makeSqldFixture();

  assert.doesNotThrow(() => validateCounts({ words, idioms, verses, sqldQuestions }));
});

test('validateCounts throws naming the table when words has the wrong count', () => {
  const words = Array.from({ length: 599 }, (_, i) => ({ id: i + 1 }));
  const idioms = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
  const verses = Array.from({ length: 66 }, (_, i) => ({ id: i + 1 }));
  const sqldQuestions = makeSqldFixture();

  assert.throws(() => validateCounts({ words, idioms, verses, sqldQuestions }), /words/);
});

test('validateCounts throws naming the table when idioms has the wrong count', () => {
  const words = Array.from({ length: 600 }, (_, i) => ({ id: i + 1 }));
  const idioms = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
  const verses = Array.from({ length: 66 }, (_, i) => ({ id: i + 1 }));
  const sqldQuestions = makeSqldFixture();

  assert.throws(() => validateCounts({ words, idioms, verses, sqldQuestions }), /idioms/);
});

test('validateCounts throws naming the table when verses is empty', () => {
  const words = Array.from({ length: 600 }, (_, i) => ({ id: i + 1 }));
  const idioms = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
  const verses = [];
  const sqldQuestions = makeSqldFixture();

  assert.throws(() => validateCounts({ words, idioms, verses, sqldQuestions }), /verses/);
});

test('validateCounts throws naming sqldQuestions when its count is wrong', () => {
  const words = Array.from({ length: 600 }, (_, i) => ({ id: i + 1 }));
  const idioms = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
  const verses = Array.from({ length: 66 }, (_, i) => ({ id: i + 1 }));
  const sqldQuestions = Array.from({ length: 399 }, (_, i) => ({ id: i + 1 }));

  assert.throws(() => validateCounts({ words, idioms, verses, sqldQuestions }), /sqldQuestions/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test scripts/select-today.test.js`
Expected: FAIL (`sqldQuestions`를 모르는 기존 코드라 undefined 관련 에러)

- [ ] **Step 3: 구현**

`scripts/select-today.js` 전체를 아래로 교체한다:

```js
const { computeDayIndex, pickWindow, pickIndex, pickTranslation, todayInKST } = require('./rotation');
const { fetchAll } = require('./supabase-rest');

const EPOCH = new Date(Date.UTC(2026, 7, 1));

const EXPECTED_COUNTS = { words: 600, idioms: 100, verses: 66, sqldQuestions: 400 };

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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test scripts/select-today.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add scripts/select-today.js scripts/select-today.test.js
git commit -m "feat: include today's 40 SQLD questions in selectToday output"
```

---

### Task 7: render-page.js — 탭 구조 전환 + SQLD 탭 렌더링

**Files:**
- Modify: `scripts/render-page.js`
- Modify: `scripts/render-page.test.js`

**Interfaces:**
- Consumes: 없음 (순수 함수, 데이터 구조만 받음)
- Produces: `renderPage(day)`가 이제 `day.sqldQuestions`(40개, 각 `{id, subject, question, choices, answerIndex, explanation}`)도 요구하고, 페이지를 3개 탭(`data-tab="words"|"verse"|"sqld"`, `id="tab-words"|"tab-verse"|"tab-sqld"`)으로 렌더링한다. `validateDay(day)`가 `day.sqldQuestions`도 검증한다.

- [ ] **Step 1: 실패하는 테스트로 갱신**

`scripts/render-page.test.js` 전체를 아래로 교체한다:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderPage, escapeHtml, validateDay } = require('./render-page');

function makeValidDay(overrides = {}) {
  const base = {
    date: '2026-08-01',
    words: Array.from({ length: 10 }, (_, i) => ({
      word: `word${i}`,
      pronunciation: `/prə.nʌn.si.eɪ.ʃən${i}/`,
      meaning: `뜻${i}`,
      sentence: `Sentence number ${i}.`,
    })),
    idiom: { idiom: 'break the ice', meaning: '어색한 분위기를 깨다', sentence: 'He told a joke to break the ice.' },
    quiz: Array.from({ length: 10 }, (_, i) => ({
      question: `질문 ${i}?`,
      answer: `답 ${i}`,
      itemType: i < 9 ? 'word' : 'idiom',
      itemId: i + 1,
    })),
    verse: {
      reference: '창세기 1:1',
      krv: '태초에 하나님이 천지를 창조하시니라',
      displayedTranslation: 'NIV',
      displayedText: 'In the beginning God created the heavens and the earth.',
      originalLanguage: 'Hebrew',
      originalText: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים',
      vocab: [{ word: 'בְּרֵאשִׁית', translit: 'bereshit', gloss: '태초에' }],
    },
    sqldQuestions: Array.from({ length: 40 }, (_, i) => ({
      id: i + 1,
      subject: i < 8 ? 'data_modeling' : 'sql_basic',
      question: `SQLD 문제 ${i}?`,
      choices: [`보기A${i}`, `보기B${i}`, `보기C${i}`, `보기D${i}`],
      answerIndex: i % 4,
      explanation: `해설 ${i}`,
    })),
  };
  return { ...base, ...overrides };
}

test('escapeHtml escapes special characters', () => {
  assert.equal(escapeHtml('<script>&"'), '&lt;script&gt;&amp;&quot;');
});

test('renderPage includes all of today\'s words, idiom, quiz, and verse content', () => {
  const day = makeValidDay();

  const html = renderPage(day);

  assert.match(html, /word0/);
  assert.match(html, /break the ice/);
  assert.match(html, /창세기 1:1/);
  assert.match(html, /bereshit/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /data-quiz-date="2026-08-01"/);
});

test('renderPage links to the archive index in the footer', () => {
  const html = renderPage(makeValidDay());
  assert.match(html, /<a href="\/archive\/">/);
});

test('renderPage emits data-item-type and data-item-id for each quiz entry', () => {
  const day = makeValidDay();
  const html = renderPage(day);

  assert.match(html, /data-item-type="idiom" data-item-id="10"/);
  assert.match(html, /data-item-type="word" data-item-id="1"/);
});

test('renderPage renders three tabs (words, verse, sqld) with the words tab active by default', () => {
  const html = renderPage(makeValidDay());

  assert.match(html, /<button type="button" class="tab-btn active" data-tab="words">/);
  assert.match(html, /<button type="button" class="tab-btn" data-tab="verse">/);
  assert.match(html, /<button type="button" class="tab-btn" data-tab="sqld">/);
  assert.match(html, /<div id="tab-words" class="tab-panel active">/);
  assert.match(html, /<div id="tab-verse" class="tab-panel">/);
  assert.match(html, /<div id="tab-sqld" class="tab-panel">/);
  assert.match(html, /<script src="\/assets\/tabs\.js"><\/script>/);
});

test('renderPage renders each SQLD question with its subject label, choices, and data attributes for the answer', () => {
  const day = makeValidDay();
  const html = renderPage(day);

  assert.match(html, /\[데이터 모델링의 이해\]/);
  assert.match(html, /\[SQL 기본 및 활용\]/);
  assert.match(html, /SQLD 문제 0\?/);
  assert.match(html, /보기A0/);
  assert.match(html, /data-sqld-id="1" data-answer-index="0"/);
});

test('validateDay throws when a word is missing its sentence', () => {
  const day = makeValidDay();
  day.words[3] = { ...day.words[3], sentence: '' };

  assert.throws(() => renderPage(day), /day\.words\[3\]\.sentence/);
});

test('validateDay throws when verse.displayedTranslation is not NIV or KJV', () => {
  const day = makeValidDay();
  day.verse = { ...day.verse, displayedTranslation: 'ESV' };

  assert.throws(() => renderPage(day), /displayedTranslation/);
});

test('validateDay throws when quiz is an empty array', () => {
  const day = makeValidDay();
  day.quiz = [];

  assert.throws(() => renderPage(day), /day\.quiz must be a non-empty array/);
});

test('validateDay throws when a quiz entry has an invalid itemType', () => {
  const day = makeValidDay();
  day.quiz[0] = { ...day.quiz[0], itemType: 'verse' };

  assert.throws(() => validateDay(day), /itemType/);
});

test('validateDay throws when a quiz entry has a non-positive-integer itemId', () => {
  const day = makeValidDay();
  day.quiz[0] = { ...day.quiz[0], itemId: 0 };

  assert.throws(() => validateDay(day), /itemId/);
});

test('validateDay throws when words is not exactly 10 items', () => {
  const day = makeValidDay();
  day.words = day.words.slice(0, 9);

  assert.throws(() => validateDay(day), /exactly 10 items/);
});

test('validateDay throws when verse.originalLanguage is invalid', () => {
  const day = makeValidDay();
  day.verse = { ...day.verse, originalLanguage: 'Aramaic' };

  assert.throws(() => validateDay(day), /originalLanguage/);
});

test('validateDay throws when verse.vocab is empty', () => {
  const day = makeValidDay();
  day.verse = { ...day.verse, vocab: [] };

  assert.throws(() => validateDay(day), /vocab must be a non-empty array/);
});

test('validateDay throws when sqldQuestions is not exactly 40 items', () => {
  const day = makeValidDay();
  day.sqldQuestions = day.sqldQuestions.slice(0, 39);

  assert.throws(() => validateDay(day), /sqldQuestions must be an array of exactly 40 items/);
});

test('validateDay throws when a sqldQuestion has an invalid subject', () => {
  const day = makeValidDay();
  day.sqldQuestions[0] = { ...day.sqldQuestions[0], subject: 'sql_advanced' };

  assert.throws(() => validateDay(day), /subject/);
});

test('validateDay throws when a sqldQuestion does not have exactly 4 choices', () => {
  const day = makeValidDay();
  day.sqldQuestions[0] = { ...day.sqldQuestions[0], choices: ['only one'] };

  assert.throws(() => validateDay(day), /choices must be an array of exactly 4 items/);
});

test('validateDay throws when a sqldQuestion has an out-of-range answerIndex', () => {
  const day = makeValidDay();
  day.sqldQuestions[0] = { ...day.sqldQuestions[0], answerIndex: 4 };

  assert.throws(() => validateDay(day), /answerIndex/);
});

test('validateDay does not throw for a valid day', () => {
  assert.doesNotThrow(() => validateDay(makeValidDay()));
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test scripts/render-page.test.js`
Expected: FAIL (`day.sqldQuestions`를 모르는 기존 `validateDay`/`renderPage`라 탭/SQLD 관련 검증들이 실패)

- [ ] **Step 3: 구현**

`scripts/render-page.js` 전체를 아래로 교체한다:

```js
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

const SQLD_SUBJECTS = ['data_modeling', 'sql_basic'];
const SQLD_SUBJECT_LABEL = {
  data_modeling: '데이터 모델링의 이해',
  sql_basic: 'SQL 기본 및 활용',
};

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

  if (!Array.isArray(day.sqldQuestions) || day.sqldQuestions.length !== 40) {
    throw new Error(`validateDay: day.sqldQuestions must be an array of exactly 40 items (got ${Array.isArray(day.sqldQuestions) ? day.sqldQuestions.length : typeof day.sqldQuestions})`);
  }
  day.sqldQuestions.forEach((q, i) => {
    if (!isPositiveInteger(q && q.id)) {
      throw new Error(`validateDay: day.sqldQuestions[${i}].id must be a positive integer (got ${JSON.stringify(q && q.id)})`);
    }
    if (!q || !SQLD_SUBJECTS.includes(q.subject)) {
      throw new Error(`validateDay: day.sqldQuestions[${i}].subject must be 'data_modeling' or 'sql_basic' (got ${JSON.stringify(q && q.subject)})`);
    }
    requireNonEmptyString(q.question, `day.sqldQuestions[${i}].question`);
    if (!Array.isArray(q.choices) || q.choices.length !== 4) {
      throw new Error(`validateDay: day.sqldQuestions[${i}].choices must be an array of exactly 4 items (got ${Array.isArray(q.choices) ? q.choices.length : typeof q.choices})`);
    }
    q.choices.forEach((c, ci) => requireNonEmptyString(c, `day.sqldQuestions[${i}].choices[${ci}]`));
    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) {
      throw new Error(`validateDay: day.sqldQuestions[${i}].answerIndex must be an integer between 0 and 3 (got ${JSON.stringify(q.answerIndex)})`);
    }
    requireNonEmptyString(q.explanation, `day.sqldQuestions[${i}].explanation`);
  });
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

function renderSqldChoice(choice, index) {
  return `<button type="button" class="sqld-choice" data-choice-index="${index}">${escapeHtml(choice)}</button>`;
}

function renderSqldQuestion(q) {
  const choices = q.choices.map(renderSqldChoice).join('\n');
  return `<li data-sqld-id="${q.id}" data-answer-index="${q.answerIndex}">
  <p class="sqld-subject">[${escapeHtml(SQLD_SUBJECT_LABEL[q.subject])}]</p>
  <p class="sqld-question">${escapeHtml(q.question)}</p>
  <div class="sqld-choices">
${choices}
  </div>
  <p class="sqld-feedback"></p>
  <p class="sqld-explanation" hidden>${escapeHtml(q.explanation)}</p>
</li>`;
}

function renderPage(day) {
  validateDay(day);
  const wordsRows = day.words.map(renderWordRow).join('\n');
  const vocabRows = day.verse.vocab.map(renderVocabRow).join('\n');
  const quizItems = day.quiz.map(renderQuizItem).join('\n');
  const sqldItems = day.sqldQuestions.map(renderSqldQuestion).join('\n');

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

<nav class="tabs">
  <button type="button" class="tab-btn active" data-tab="words">영단어/숙어</button>
  <button type="button" class="tab-btn" data-tab="verse">성경구절</button>
  <button type="button" class="tab-btn" data-tab="sqld">SQLD</button>
</nav>

<div id="tab-words" class="tab-panel active">
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
</div>

<div id="tab-verse" class="tab-panel">
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
</div>

<div id="tab-sqld" class="tab-panel">
<section class="sqld">
  <h2>오늘의 SQLD 문제 (40문제)</h2>
  <p id="sqld-score" class="sqld-score">정답률 확인 중...</p>
  <ol class="sqld-list">
${sqldItems}
  </ol>
</section>
</div>

<footer><a href="/archive/">지난 학습 기록 보기</a></footer>

<script src="/assets/tabs.js"></script>
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test scripts/render-page.test.js`
Expected: PASS (17 tests)

- [ ] **Step 5: 커밋**

```bash
git add scripts/render-page.js scripts/render-page.test.js
git commit -m "feat: restructure page into words/verse/sqld tabs and render SQLD questions"
```

---

### Task 8: 탭 전환 스크립트 (site/assets/tabs.js)

**Files:**
- Create: `site/assets/tabs.js`
- Test: `site/assets/tabs.test.js`

**Interfaces:**
- Produces: `wireTabs()` — `.tab-btn` 클릭 시 클릭된 버튼과 `data-tab` 값이 일치하는 `.tab-panel`에만 `active` 클래스를 남기고 나머지는 뗀다.

- [ ] **Step 1: 실패하는 테스트 작성**

`site/assets/tabs.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const TABS_PATH = path.join(__dirname, 'tabs.js');

function makeClassList(initial) {
  const list = new Set(initial);
  return {
    toggle(cls, on) {
      if (on) list.add(cls);
      else list.delete(cls);
    },
    contains(cls) {
      return list.has(cls);
    },
  };
}

function loadTabs() {
  global.document = { addEventListener: () => {}, querySelectorAll: () => [] };
  delete require.cache[require.resolve(TABS_PATH)];
  return require(TABS_PATH);
}

test('wireTabs switches active class to the clicked tab button and its matching panel only', () => {
  const mod = loadTabs();

  const wordsPanel = { id: 'tab-words', classList: makeClassList(['tab-panel', 'active']) };
  const versePanel = { id: 'tab-verse', classList: makeClassList(['tab-panel']) };
  const sqldPanel = { id: 'tab-sqld', classList: makeClassList(['tab-panel']) };

  function makeButton(tab, active) {
    const btn = {
      dataset: { tab },
      classList: makeClassList(active ? ['tab-btn', 'active'] : ['tab-btn']),
    };
    btn.addEventListener = (evt, handler) => { btn._click = handler; };
    return btn;
  }
  const wordsBtn = makeButton('words', true);
  const verseBtn = makeButton('verse', false);
  const sqldBtn = makeButton('sqld', false);

  global.document.querySelectorAll = (sel) => {
    if (sel === '.tab-btn') return [wordsBtn, verseBtn, sqldBtn];
    if (sel === '.tab-panel') return [wordsPanel, versePanel, sqldPanel];
    return [];
  };

  mod.wireTabs();
  sqldBtn._click();

  assert.equal(sqldBtn.classList.contains('active'), true);
  assert.equal(wordsBtn.classList.contains('active'), false);
  assert.equal(verseBtn.classList.contains('active'), false);
  assert.equal(sqldPanel.classList.contains('active'), true);
  assert.equal(wordsPanel.classList.contains('active'), false);
  assert.equal(versePanel.classList.contains('active'), false);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test site/assets/tabs.test.js`
Expected: FAIL (`tabs.js`가 없어서 모듈을 찾을 수 없음)

- [ ] **Step 3: 구현**

`site/assets/tabs.js`:
```js
(function () {
  function wireTabs() {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.toggle('active', b === btn);
        });
        document.querySelectorAll('.tab-panel').forEach(panel => {
          panel.classList.toggle('active', panel.id === `tab-${target}`);
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', wireTabs);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { wireTabs };
  }
})();
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test site/assets/tabs.test.js`
Expected: PASS (1 test)

- [ ] **Step 5: 커밋**

```bash
git add site/assets/tabs.js site/assets/tabs.test.js
git commit -m "feat: add client-side tab switching"
```

---

### Task 9: client.js 확장 — SQLD 퀴즈 체크 + 정답률 표시

**Files:**
- Modify: `site/assets/client.js`
- Modify: `site/assets/client.test.js`

**Interfaces:**
- Consumes: 없음 (브라우저에서 Supabase publishable key로 직접 REST 호출, 기존과 동일한 패턴)
- Produces: `wireSqldQuiz()` — `.sqld-list > li`의 `.sqld-choice` 버튼 클릭 시 `data-answer-index`와 비교해 정오 판정, `quiz_results`에 `item_type: 'sqld'`로 기록, 해설 표시. `showSqldScore()` — 오늘 날짜의 `item_type='sqld'` 기록을 조회해 `#sqld-score`에 정답률 표시.

- [ ] **Step 1: 실패하는 테스트로 갱신**

`site/assets/client.test.js` 전체를 아래로 교체한다:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const CLIENT_PATH = path.join(__dirname, 'client.js');

function loadClient() {
  const calls = [];
  global.fetch = (url, opts) => {
    calls.push({ url, opts });
    return Promise.resolve({ ok: true, json: async () => [] });
  };
  global.document = {
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
  };
  delete require.cache[require.resolve(CLIENT_PATH)];
  const mod = require(CLIENT_PATH);
  return { mod, calls };
}

test('wireQuiz posts item_type/item_id read from the <li> dataset, not a hardcoded word type or array index', async () => {
  const { mod, calls } = loadClient();

  const feedback = { textContent: '' };
  const input = { value: '어색한 분위기를 깨다' };
  const questionP = { textContent: "'break the ice'의 뜻은?" };
  const li = {
    dataset: { answer: '어색한 분위기를 깨다', itemType: 'idiom', itemId: '42', questionIndex: '3' },
    querySelector: (sel) => {
      if (sel === '.quiz-input') return input;
      if (sel === '.quiz-feedback') return feedback;
      if (sel === 'p') return questionP;
      return null;
    },
  };
  let clickHandler;
  const button = {
    closest: () => li,
    addEventListener: (evt, handler) => {
      clickHandler = handler;
    },
  };
  const scriptTag = { dataset: { quizDate: '2026-08-01' } };

  global.document.querySelector = (sel) => (sel === 'script[data-quiz-date]' ? scriptTag : null);
  global.document.querySelectorAll = (sel) => (sel === '.quiz .quiz-check' ? [button] : []);

  mod.wireQuiz();
  assert.equal(typeof clickHandler, 'function');
  await clickHandler();

  const quizCall = calls.find(c => c.url.includes('quiz_results'));
  assert.ok(quizCall, 'expected a POST to quiz_results');
  const body = JSON.parse(quizCall.opts.body)[0];

  assert.equal(body.item_type, 'idiom');
  assert.equal(body.item_id, 42);
  assert.equal(body.quiz_date, '2026-08-01');
  assert.equal(body.is_correct, true);
});

test('todayStr returns a KST-normalized YYYY-MM-DD date string', () => {
  const { mod } = loadClient();
  assert.match(mod.todayStr(), /^\d{4}-\d{2}-\d{2}$/);
});

test('wireSqldQuiz posts item_type "sqld" with the real sqld id and marks correctness by comparing choice index to answer index', async () => {
  const { mod, calls } = loadClient();

  const feedback = { textContent: '' };
  const explanation = { hidden: true };
  const questionP = { textContent: 'SQL에서 NULL 값을 비교할 때 사용하는 연산자는?' };
  let choiceClickHandler;
  const choiceButton = {
    dataset: { choiceIndex: '2' },
    addEventListener: (evt, handler) => {
      choiceClickHandler = handler;
    },
  };
  const li = {
    dataset: { sqldId: '17', answerIndex: '2' },
    querySelector: (sel) => {
      if (sel === '.sqld-feedback') return feedback;
      if (sel === '.sqld-explanation') return explanation;
      if (sel === '.sqld-question') return questionP;
      return null;
    },
    querySelectorAll: (sel) => (sel === '.sqld-choice' ? [choiceButton] : []),
  };
  const scriptTag = { dataset: { quizDate: '2026-08-11' } };

  global.document.querySelector = (sel) => (sel === 'script[data-quiz-date]' ? scriptTag : null);
  global.document.querySelectorAll = (sel) => (sel === '.sqld-list > li' ? [li] : []);

  mod.wireSqldQuiz();
  assert.equal(typeof choiceClickHandler, 'function');
  await choiceClickHandler();

  const quizCall = calls.find(c => c.url.includes('quiz_results') && c.opts.method === 'POST');
  assert.ok(quizCall, 'expected a POST to quiz_results');
  const body = JSON.parse(quizCall.opts.body)[0];

  assert.equal(body.item_type, 'sqld');
  assert.equal(body.item_id, 17);
  assert.equal(body.quiz_date, '2026-08-11');
  assert.equal(body.is_correct, true);
  assert.equal(feedback.textContent, '✅ 정답');
  assert.equal(explanation.hidden, false);
});

test("showSqldScore reports how many of today's sqld answers were correct", async () => {
  const calls = [];
  global.fetch = (url) => {
    calls.push(url);
    if (url.includes('item_type=eq.sqld')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ is_correct: true }, { is_correct: false }, { is_correct: true }],
      });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  };
  const scoreEl = { textContent: '' };
  const scriptTag = { dataset: { quizDate: '2026-08-11' } };
  global.document = {
    addEventListener: () => {},
    querySelector: (sel) => (sel === 'script[data-quiz-date]' ? scriptTag : null),
    querySelectorAll: () => [],
    getElementById: (id) => (id === 'sqld-score' ? scoreEl : null),
  };
  delete require.cache[require.resolve(CLIENT_PATH)];
  const mod = require(CLIENT_PATH);

  await mod.showSqldScore();

  assert.match(scoreEl.textContent, /2 \/ 3/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test site/assets/client.test.js`
Expected: FAIL (`wireSqldQuiz`/`showSqldScore`가 없어서 `mod.wireSqldQuiz is not a function`)

- [ ] **Step 3: 구현**

`site/assets/client.js` 전체를 아래로 교체한다:

```js
(function () {
  const SUPABASE_URL = 'https://jlsylkdjsjiiuitmwdpz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Or19pdIs6WAUH-tWaxbj-Q_Ku0qkiC2';

  function todayStr() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
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
            item_type: li.dataset.itemType,
            item_id: Number(li.dataset.itemId),
            question,
            is_correct: isCorrect,
          }]),
        });
      });
    });
  }

  function wireSqldQuiz() {
    const scriptTag = document.querySelector('script[data-quiz-date]');
    const quizDate = scriptTag ? scriptTag.dataset.quizDate : todayStr();

    document.querySelectorAll('.sqld-list > li').forEach(li => {
      const answerIndex = Number(li.dataset.answerIndex);
      const sqldId = Number(li.dataset.sqldId);

      li.querySelectorAll('.sqld-choice').forEach(button => {
        button.addEventListener('click', async () => {
          const feedback = li.querySelector('.sqld-feedback');
          const explanation = li.querySelector('.sqld-explanation');
          const question = li.querySelector('.sqld-question').textContent;
          const chosenIndex = Number(button.dataset.choiceIndex);
          const isCorrect = chosenIndex === answerIndex;

          feedback.textContent = isCorrect ? '✅ 정답' : '❌ 오답';
          explanation.hidden = false;

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
              item_type: 'sqld',
              item_id: sqldId,
              question,
              is_correct: isCorrect,
            }]),
          });

          showSqldScore();
        });
      });
    });
  }

  async function showSqldScore() {
    const scriptTag = document.querySelector('script[data-quiz-date]');
    const quizDate = scriptTag ? scriptTag.dataset.quizDate : todayStr();

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/quiz_results?select=is_correct&item_type=eq.sqld&quiz_date=eq.${quizDate}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await res.json();
    const correct = rows.filter(r => r.is_correct).length;

    const scoreEl = document.getElementById('sqld-score');
    if (scoreEl) scoreEl.textContent = `오늘 정답률: ${correct} / ${rows.length} (총 40문제 중 응시)`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    recordVisitAndShowStreak();
    wireQuiz();
    wireSqldQuiz();
    showSqldScore();
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { todayStr, recordVisitAndShowStreak, wireQuiz, wireSqldQuiz, showSqldScore };
  }
})();
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test site/assets/client.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add site/assets/client.js site/assets/client.test.js
git commit -m "feat: wire SQLD quiz answer checking and today's accuracy score"
```

---

### Task 10: styles.css — 탭 및 SQLD 스타일 추가

**Files:**
- Modify: `site/assets/styles.css`

**Interfaces:**
- Consumes: 없음 (순수 CSS)
- Produces: `.tabs`/`.tab-btn`/`.tab-btn.active`/`.tab-panel`/`.tab-panel.active` (탭 UI), `.sqld-score`/`.sqld-list`/`.sqld-subject`/`.sqld-question`/`.sqld-choices`/`.sqld-choice`/`.sqld-feedback`/`.sqld-explanation` (SQLD 탭 스타일)

- [ ] **Step 1: `site/assets/styles.css` 끝에 아래 내용 추가**

```css

.tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
.tab-btn {
  flex: 1;
  padding: 0.6rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--card);
  color: var(--fg);
  cursor: pointer;
  font-size: 0.95rem;
}
.tab-btn.active { background: var(--accent); color: #1c1917; border-color: var(--accent); }

.tab-panel { display: none; }
.tab-panel.active { display: block; }

.sqld-score { font-weight: 600; color: var(--accent); }
.sqld-list { list-style: none; padding: 0; }
.sqld-list > li { margin-bottom: 1.25rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--border); }
.sqld-subject { font-size: 0.85rem; color: color-mix(in srgb, var(--fg) 60%, transparent); margin: 0 0 0.3rem; }
.sqld-question { font-weight: 600; margin: 0 0 0.6rem; }
.sqld-choices { display: flex; flex-direction: column; gap: 0.4rem; }
.sqld-choice {
  text-align: left;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  background: var(--bg);
  color: var(--fg);
  cursor: pointer;
}
.sqld-feedback { font-weight: 600; margin: 0.5rem 0 0; }
.sqld-explanation { margin: 0.3rem 0 0; font-size: 0.9rem; color: color-mix(in srgb, var(--fg) 75%, transparent); }
```

- [ ] **Step 2: 로컬 렌더링으로 육안 확인 (수동, 자동 테스트 없음 — 순수 CSS)**

Task 7에서 만든 `renderPage`로 샘플 페이지를 만들어 확인한다:

```bash
node -e "
const { renderPage } = require('./scripts/render-page');
const fs = require('fs');
const day = {
  date: '2026-08-11',
  words: Array.from({length:10},(_, i)=>({word:'w'+i,pronunciation:'/p'+i+'/',meaning:'뜻'+i,sentence:'S'+i+'.'})),
  idiom: {idiom:'break the ice', meaning:'어색한 분위기를 깨다', sentence:'He told a joke.'},
  quiz: Array.from({length:10},(_, i)=>({question:'Q'+i, answer:'A'+i, itemType: i<9?'word':'idiom', itemId:i+1})),
  verse: {reference:'창세기 1:1', krv:'태초에', displayedTranslation:'NIV', displayedText:'In the beginning', originalLanguage:'Hebrew', originalText:'בְּרֵאשִׁית', vocab:[{word:'א',translit:'a',gloss:'g'}]},
  sqldQuestions: Array.from({length:40},(_, i)=>({id:i+1, subject: i<8?'data_modeling':'sql_basic', question:'SQLD Q'+i, choices:['A','B','C','D'], answerIndex:i%4, explanation:'해설'+i})),
};
fs.writeFileSync('/tmp/tab-preview.html', renderPage(day));
console.log('written to /tmp/tab-preview.html');
"
npx --yes serve /tmp -l 4321 &
sleep 1
curl -s http://localhost:4321/tab-preview.html -o /dev/null -w 'HTTP %{http_code}\n'
kill %1
```

브라우저가 있다면 `/tmp/tab-preview.html`을 직접 열어 탭 3개가 보이고 클릭 시 전환되는지, SQLD 탭에서 보기 버튼이 4개씩 보이는지 육안으로 확인한다. 브라우저가 없는 환경이면 파일이 정상 생성되고 HTTP 200으로 서빙되는 것으로 검증을 대신한다.

- [ ] **Step 3: 커밋**

```bash
git add site/assets/styles.css
git commit -m "style: add tab navigation and SQLD question styles"
```

---

### Task 11 (컨트롤러가 직접 수행 — 서브에이전트에 위임하지 않음): 마이그레이션 반영 + 시드 + 클라우드 루틴 업데이트 + 실행 검증

이 태스크는 실제 프로덕션 Supabase/GitHub/클라우드 루틴을 다루므로, 이전 프로젝트(Task 11, `docs/superpowers/plans/2026-08-01-daily-study-implementation.md`)와 동일하게 컨트롤러(오케스트레이터)가 직접 수행한다.

- [ ] Task 1의 `supabase/migrations/0002_add_sqld.sql`을 사용자에게 Supabase SQL Editor에서 실행하도록 안내
- [ ] `node -e "require('./scripts/supabase-rest').fetchAll('sqld_questions').then(r=>console.log(r.length))"`로 테이블 존재 확인 (0이어야 정상)
- [ ] 사용자에게 `SUPABASE_SERVICE_ROLE_KEY=<secret key> node scripts/seed.js`를 로컬 터미널에서 실행하도록 안내 — Task 5의 새 `seedTable` 덕분에 이미 채워진 `words`/`idioms`/`verses`는 건너뛰고 `sqld_questions` 400건만 새로 들어간다
- [ ] publishable key로 `fetchAll('sqld_questions')`이 400을 반환하는지 확인
- [ ] `node scripts/select-today.js`를 실행해 `sqldQuestions` 40개가 정상적으로 포함되는지 확인
- [ ] 기존 클라우드 루틴(`trig_01EACRQrzMFBbyW7UXD6rbZG`)의 프롬프트를 `RemoteTrigger` `update`로 갱신 — 2단계에 아래 내용 추가:
  - "`select-today.js` 출력의 `sqldQuestions` 배열(40개)을 그대로 사용한다. 각 항목의 `answer_index`를 `answerIndex`로 이름만 바꿔서 옮긴다 (LLM이 새로 만들 필요 없음, 그대로 복사)."
  - `/tmp/today-data.json` 구조 설명에 `sqldQuestions: [{id, subject, question, choices, answerIndex, explanation}, ...40개]` 추가
- [ ] `RemoteTrigger` `run`으로 수동 1회 실행, GitHub main에 새 커밋이 올라오는지 감시
- [ ] 성공하면 `https://ylia.life`에서 탭 3개(영단어/숙어, 성경구절, SQLD)가 실제로 보이고 전환되는지, SQLD 문제가 40개 나오는지 확인
- [ ] 실패하면 (특히 클라우드 환경 쪽 이슈) 그 지점만 개별적으로 조사해서 해결 — 지난번(네트워크 egress, GitHub 쓰기 권한) 같은 인프라 이슈가 재발할 수 있음을 감안

---

## Self-Review 결과

- **스펙 커버리지**: 마이그레이션(Task 1) · SQLD 콘텐츠 400문제(Task 2~4) · 시드 재설계(Task 5) · 일일 선택 로직 확장(Task 6) · 탭 렌더링/SQLD 렌더링(Task 7) · 탭 전환(Task 8) · SQLD 정답 체크/정답률(Task 9) · 스타일(Task 10) · 실제 반영/검증(Task 11) 모두 스펙 문서의 각 섹션과 1:1로 대응됨.
- **플레이스홀더 스캔**: "TODO"/"나중에" 없음. 콘텐츠 작성(Task 2~4)은 실제 항목을 채우는 작업이라 정확한 스키마·개수·주제 범위를 명시해 모호함이 없게 함.
- **타입/이름 일관성 확인**: `selectToday`가 반환하는 `sqldQuestions`(id, subject, question, choices, answer_index — Supabase raw 컬럼명)가 Task 11의 클라우드 루틴 프롬프트에서 `answerIndex`로 리네임되어 `render-page.js`의 `validateDay`/`renderSqldQuestion`이 기대하는 필드명(`answerIndex`)과 정확히 일치하도록 맞춤. `data-sqld-id`/`data-answer-index` (HTML) ↔ `li.dataset.sqldId`/`li.dataset.answerIndex` (client.js) 매핑도 일치.
