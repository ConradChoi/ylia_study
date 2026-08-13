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
