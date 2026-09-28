-- MUSE Grants · 클라우드 동기화 모드 스키마
-- Supabase SQL Editor에 붙여넣어 실행하거나, 설정 마법사가 자동 적용합니다.
-- 공고 앱 전용 공간(스키마) "grants"를 만들어 쓰므로, 다른 앱(MUSE OS 등)과 같은 프로젝트에 있어도 섞이지 않습니다.
-- ⚠️ 실행 후: Project Settings → Data API → Exposed schemas 에 grants 추가

create schema if not exists grants;
grant usage on schema grants to anon, authenticated, service_role;

-- 1) 공고 (공용: 수집기가 쓰고, 로그인한 사용자는 읽기)
create table if not exists grants.notices (
  id            text primary key,              -- 출처별 고유 ID 또는 dedupe 해시
  dedupe_key    text unique not null,          -- 제목 정규화 + 기관 + 마감일
  kind          text not null check (kind in ('grant','service','edu','venue')),
  title         text not null,
  org           text,
  sources       text[] not null default '{}',
  url           text not null,
  region        text,
  fields        text[] not null default '{}',
  tags          text[] not null default '{}',
  overseas      boolean not null default false,
  posted_at     date,
  deadline      date,
  deadline_label text check (deadline_label in ('예정','상시','확인 필요')),
  last_year     text,
  summary       text,
  thumb         text,
  needs_review  boolean not null default false,
  details       jsonb not null default '{}'::jsonb,  -- grant / service / edu / venue 별 정보
  checked_at    date not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists notices_deadline_idx on grants.notices (deadline);
create index if not exists notices_kind_idx on grants.notices (kind);

-- 2) 사용자별 상태 (★, 결정 도장, 숨김, 읽음, 지원 단계)
create table if not exists grants.user_notice_state (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  notice_id  text not null references grants.notices(id) on delete cascade,
  starred    boolean not null default false,
  decision   text check (decision in ('강추','지원','보류','비추')),
  hidden     boolean not null default false,
  seen       boolean not null default false,
  stage      text check (stage in ('관심','준비','초안','제출','선정','탈락')),
  updated_at timestamptz not null default now(),
  primary key (user_id, notice_id)
);

-- 3) 사용자별 분석 결과 (★한 공고만)
create table if not exists grants.user_analyses (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  notice_id  text not null references grants.notices(id) on delete cascade,
  analysis   jsonb not null,           -- verdicts, fit, grade, pros, cons, opinion, by
  updated_at timestamptz not null default now(),
  primary key (user_id, notice_id)
);

-- 4) 사용자 설정 (키워드·지역·관심 탭·주체 기본 정보)
create table if not exists grants.user_settings (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  keywords   jsonb not null default '{"include":[],"exclude":[],"regions":[],"kinds":["grant","service","edu","venue"]}'::jsonb,
  entities   jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 5) 수집 기록 (상태 바 "마지막 수집" 표시용)
create table if not exists grants.collect_runs (
  id          bigint generated always as identity primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  found       int not null default 0,
  added       int not null default 0,
  errors      jsonb not null default '[]'::jsonb
);

-- 6) 휴대폰 웹푸시 구독
create table if not exists grants.push_subscriptions (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint   text primary key,
  keys       jsonb not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table grants.notices            enable row level security;
alter table grants.user_notice_state  enable row level security;
alter table grants.user_analyses      enable row level security;
alter table grants.user_settings      enable row level security;
alter table grants.collect_runs       enable row level security;
alter table grants.push_subscriptions enable row level security;

-- 공고·수집 기록: 로그인한 사용자 읽기 전용 (쓰기는 service role 수집기만)
drop policy if exists "notices read" on grants.notices;
create policy "notices read" on grants.notices for select to authenticated using (true);
drop policy if exists "runs read" on grants.collect_runs;
create policy "runs read" on grants.collect_runs for select to authenticated using (true);

-- 개인 데이터: 본인 것만
do $$
declare t text;
begin
  foreach t in array array['user_notice_state','user_analyses','user_settings','push_subscriptions'] loop
    execute format('drop policy if exists "own rows" on grants.%I', t);
    execute format('create policy "own rows" on grants.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- 마감 30일 지난 공고 정리 (★·지원 단계가 있는 공고는 보존)
create or replace function grants.cleanup_old_notices() returns int
language sql security definer set search_path = grants as $$
  with del as (
    delete from grants.notices n
    where n.deadline < current_date - 30
      and not exists (
        select 1 from grants.user_notice_state s
        where s.notice_id = n.id and (s.starred or s.stage is not null)
      )
    returning 1
  )
  select count(*)::int from del;
$$;

-- API(PostgREST)에서 grants 스키마를 쓸 수 있도록 권한 부여 (행 단위 접근은 위 RLS가 막음)
grant all on all tables    in schema grants to anon, authenticated, service_role;
grant all on all sequences in schema grants to anon, authenticated, service_role;
grant execute on all functions in schema grants to service_role;
alter default privileges in schema grants grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema grants grant all on sequences to anon, authenticated, service_role;
