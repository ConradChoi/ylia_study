-- ylia_study: 콘텐츠 뱅크 + 학습 기록 스키마
-- Supabase SQL Editor에서 그대로 실행하세요.

-- 1. 콘텐츠 뱅크 (읽기 전용, service_role로만 seed/수정)
create table if not exists words (
  id serial primary key,
  word text not null,
  pronunciation text not null,
  meaning text not null,
  created_at timestamptz not null default now()
);

create table if not exists idioms (
  id serial primary key,
  idiom text not null,
  meaning text not null,
  created_at timestamptz not null default now()
);

create table if not exists verses (
  id serial primary key,
  book_ko text not null,
  book_en text not null,
  testament text not null check (testament in ('OT', 'NT')),
  reference text not null,
  krv text not null,
  niv text not null,
  kjv text not null,
  original_language text not null check (original_language in ('Hebrew', 'Greek')),
  original_text text not null,
  vocab jsonb not null, -- [{word, translit, gloss}, ...]
  created_at timestamptz not null default now()
);

-- 2. 학습 기록 (클라우드 루틴 + 사이트 클라이언트가 publishable key로 기록)
create table if not exists daily_log (
  log_date date primary key,
  word_ids int[] not null,
  idiom_id int references idioms(id),
  verse_id int references verses(id),
  en_translation text not null check (en_translation in ('NIV', 'KJV')),
  published_at timestamptz not null default now()
);

create table if not exists visits (
  id bigserial primary key,
  visited_date date not null,
  visited_at timestamptz not null default now()
);

create table if not exists quiz_results (
  id bigserial primary key,
  quiz_date date not null,
  item_type text not null check (item_type in ('word', 'idiom')),
  item_id int not null,
  question text not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);

-- 3. RLS 활성화
alter table words enable row level security;
alter table idioms enable row level security;
alter table verses enable row level security;
alter table daily_log enable row level security;
alter table visits enable row level security;
alter table quiz_results enable row level security;

-- 4. 정책: 콘텐츠 뱅크는 읽기만 공개 (수정은 service_role로만, 정책 없이도 service_role은 RLS 우회)
-- drop policy if exists로 먼저 지운 뒤 다시 만들어서, 스크립트를 여러 번 실행해도 안전하다.
drop policy if exists "content read (words)" on words;
create policy "content read (words)" on words for select using (true);

drop policy if exists "content read (idioms)" on idioms;
create policy "content read (idioms)" on idioms for select using (true);

drop policy if exists "content read (verses)" on verses;
create policy "content read (verses)" on verses for select using (true);

-- 5. 정책: 학습 기록은 공개 키로 읽기/쓰기(insert) 허용, 수정/삭제는 불가
drop policy if exists "daily_log read" on daily_log;
create policy "daily_log read" on daily_log for select using (true);

drop policy if exists "daily_log insert" on daily_log;
create policy "daily_log insert" on daily_log for insert with check (true);

drop policy if exists "daily_log update" on daily_log;
-- 오늘/어제(KST) 행만 수정 가능 (같은 날 재실행 시 덮어쓰기는 허용하되, 지난 기록을 임의로 변조하는 건 막는다)
create policy "daily_log update" on daily_log
  for update
  using (log_date >= ((now() at time zone 'Asia/Seoul')::date - 1))
  with check (log_date >= ((now() at time zone 'Asia/Seoul')::date - 1));

drop policy if exists "visits read" on visits;
create policy "visits read" on visits for select using (true);

drop policy if exists "visits insert" on visits;
create policy "visits insert" on visits for insert with check (true);

drop policy if exists "quiz_results read" on quiz_results;
create policy "quiz_results read" on quiz_results for select using (true);

drop policy if exists "quiz_results insert" on quiz_results;
create policy "quiz_results insert" on quiz_results for insert with check (true);
