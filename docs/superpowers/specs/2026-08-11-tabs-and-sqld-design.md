# 탭 구조 전환 + SQLD 탭 추가 — 설계 문서

날짜: 2026-08-11

## 목적

기존에는 매일 발행되는 페이지 하나에 영단어/숙어 학습과 성경구절이 세로로 쭉 나열되어 있었다. 이를 **3개 탭**으로 나누고, 새로운 학습 콘텐츠로 **SQLD(SQL 개발자) 자격증 문제 풀이 탭**을 추가한다.

- 영단어/숙어 탭 — 기존과 동일 (단어 10개 + 숙어 1개 + 퀴즈)
- 성경구절 탭 — 기존과 동일 (한/영/원어 + 원어 어휘표)
- SQLD 탭 — 신규. 데이터 모델링의 이해 + SQL 기본 및 활용 과목의 자체 제작 4지선다 문제

## 콘텐츠: SQLD 문제은행

- **저작권**: 실제 KDATA SQLD 기출문제를 그대로 복사하지 않는다. 기출에서 반복적으로 나오는 개념·유형·난이도를 참고해 **자체적으로 새로 작성**한 문제만 사용한다.
- **규모**: 총 400문제, 실제 SQLD 과목 비율(데이터 모델링의 이해 20% : SQL 기본 및 활용 80%)을 반영해 데이터 모델링 80문제 + SQL 기본/활용 320문제로 구성한다.
- **형식**: 4지선다 객관식. 각 문항은 문제, 보기 4개, 정답, 해설을 포함한다.
- **매일 발행량**: 40문제/일, 10일 주기로 순환 (기존 단어/숙어/구절과 동일한 날짜 기반 결정론적 순환 로직 재사용, 같은 epoch=2026-08-01 공유).
- 예문처럼 매일 새로 생성하는 것이 아니라, 문제은행에서 그날 배정된 40문제를 그대로 뽑아 보여준다 (클라우드 루틴의 LLM 생성 작업 부담 없음).

### Supabase 스키마 추가 (마이그레이션 `0002_add_sqld.sql`)

```sql
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
create policy "content read (sqld_questions)" on sqld_questions for select using (true);

-- quiz_results.item_type에 'sqld' 추가 (기존 체크 제약 재생성)
alter table quiz_results drop constraint if exists quiz_results_item_type_check;
alter table quiz_results add constraint quiz_results_item_type_check
  check (item_type in ('word', 'idiom', 'sqld'));
```

`sqld_questions`는 콘텐츠 뱅크이므로 words/idioms/verses와 동일하게 읽기 전용(anon SELECT만 허용), 쓰기는 service_role 로컬 seed 스크립트로만 가능하다.

## 일일 선택 로직 확장

기존 `rotation.js`의 `pickWindow(dayIndex, total, perDay)`를 그대로 재사용한다.

```
sqld_today = pickWindow(dayIndex, 400, 40)  // 40문제/일, 10일 주기
```

`select-today.js`가 `sqld_questions`도 함께 조회해 오늘의 40문제를 포함하도록 확장한다.

## 사이트 구조: 탭 UI

- `site/index.html` 한 페이지 안에 3개 탭 패널을 렌더링하고, 클라이언트 JS로 보이기/숨기기를 전환한다 (페이지 이동 없음).
- 기본 활성 탭은 "영단어/숙어". 탭 상태는 저장하지 않는다 (매번 첫 탭부터 시작 — YAGNI).
- 아카이브 페이지(`site/archive/<date>.html`)도 그날 발행된 3개 탭을 동일하게 포함한다.

## 정답률 추적

- 기존 `quiz_results` 테이블과 클라이언트 기록 로직을 그대로 재사용하되 `item_type: 'sqld'`, `item_id: sqld_questions.id`로 기록한다.
- 연속 출석(streak)은 지금처럼 탭과 무관하게 사이트 전체 방문(`visits`) 기준으로 유지한다 — SQLD 전용 streak는 만들지 않는다.
- SQLD 탭에는 오늘 40문제 기준 정답률(맞은 개수/40)을 별도로 표시한다. 정답률 계산은 오늘 날짜의 `quiz_results` 중 `item_type='sqld'` 행을 조회해 클라이언트에서 집계한다.

## 클라우드 루틴 변경

기존 9단계 프롬프트에 SQLD 문제 조회 단계를 추가한다. 예문/퀴즈처럼 LLM이 새로 생성할 필요가 없으므로 (문제은행에서 그대로 표시), 루틴 입장에서는 `select-today.js`의 확장된 출력에 `sqldQuestions` 배열이 추가로 들어오고, 그걸 그대로 렌더링 데이터에 옮겨 담는 단계만 늘어난다. 나머지(단어/숙어 예문·퀴즈 생성, 성경구절 처리, 렌더링, 아카이브, git push, 카카오 알림)는 동일하다.

## 이 작업 범위에 포함되지 않는 것

- 실제 KDATA 기출문제 원문 사용 (저작권 문제로 배제)
- SQLD 탭 전용 연속 출석(streak) — 전체 사이트 streak만 유지
- 탭 선택 상태 저장(localStorage 등)
