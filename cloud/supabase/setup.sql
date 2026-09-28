-- ============================================================
-- MUSE Grants · 처음 설치용 SQL (한 번에 실행)
-- Supabase → SQL Editor → New query → 이 파일 전체를 붙여넣고 Run
-- 여러 번 실행해도 안전합니다.
--
-- 들어 있는 것: migrations/0001, 0002, 0003, 0004, 0007
-- 들어 있지 않은 것 (선택):
--   0005_guest_read.sql     로그인 없이 둘러보는 "체험 모드"를 열 때만
--   0006_guest_showcase.sql 체험 모드에 내 설정을 예시로 보여줄 때만
-- ============================================================


-- ─────────── 0001_init ───────────
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


-- ─────────── 0002_manual_notices ───────────
-- MUSE Grants · 0002: 직접 추가한 공고(인스타·링크)를 클라우드에 저장
-- 0001 다음에 한 번 실행하세요. 여러 번 실행해도 안전합니다.

alter table grants.notices
  add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete cascade;

-- 수집기가 모은 공고(created_by 없음)는 모두에게, 직접 추가한 공고는 추가한 사람에게만 보임
drop policy if exists "notices read" on grants.notices;
create policy "notices read" on grants.notices for select to authenticated
  using (created_by is null or created_by = auth.uid());

drop policy if exists "notices own insert" on grants.notices;
create policy "notices own insert" on grants.notices for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "notices own update" on grants.notices;
create policy "notices own update" on grants.notices for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists "notices own delete" on grants.notices;
create policy "notices own delete" on grants.notices for delete to authenticated
  using (created_by = auth.uid());


-- ─────────── 0003_delete_residency ───────────
-- MUSE Grants · 0003: 공고 삭제(다시 수집 안 함) + 레지던시 탭
-- 0001, 0002 다음에 한 번 실행하세요. 여러 번 실행해도 안전합니다.

-- ① 레지던시 종류 추가
alter table grants.notices drop constraint if exists notices_kind_check;
alter table grants.notices add constraint notices_kind_check
  check (kind in ('grant','service','edu','venue','residency'));

-- ② 삭제 표시 + 제목키 (마감일이 바뀌어 다시 올라와도 같은 공고로 보고 숨김)
alter table grants.user_notice_state add column if not exists deleted boolean not null default false;
alter table grants.user_notice_state add column if not exists title_key text;
create index if not exists user_notice_state_deleted_idx on grants.user_notice_state (title_key) where deleted;

-- ③ 새 사용자 기본 설정에 레지던시 포함
alter table grants.user_settings alter column keywords
  set default '{"include":[],"exclude":[],"regions":[],"kinds":["grant","service","edu","venue","residency"],"v":2}'::jsonb;

-- ④ 해외 우수 플랫폼 디렉토리 (K-arts on the GO) — 해외 공고에 "K-GO 플랫폼" 표시용 참조 데이터
create table if not exists grants.platforms (
  id         text primary key,
  source     text not null default 'K-GO',
  field      text,
  name       text not null,
  name_en    text,
  type       text,
  genres     text[] not null default '{}',
  continent  text,
  country    text,
  city       text,
  homepage   text,
  tour       boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table grants.platforms enable row level security;
drop policy if exists "platforms read" on grants.platforms;
create policy "platforms read" on grants.platforms for select to authenticated using (true);
grant select on grants.platforms to authenticated;
grant all on grants.platforms to service_role;


-- ─────────── 0004_files ───────────
-- MUSE Grants · 0004: 공고 첨부파일 "내 보관함" (Supabase Storage)
-- 0003 다음에 한 번 실행하세요. 여러 번 실행해도 안전합니다.

-- ① 저장소(버킷): 비공개, 파일당 50MB까지
insert into storage.buckets (id, name, public, file_size_limit)
values ('grant-files', 'grant-files', false, 52428800)
on conflict (id) do nothing;

-- ② 내 폴더(사용자 id)에만 읽기·쓰기·삭제
drop policy if exists "grant files own read" on storage.objects;
create policy "grant files own read" on storage.objects for select to authenticated
  using (bucket_id = 'grant-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "grant files own insert" on storage.objects;
create policy "grant files own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'grant-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "grant files own update" on storage.objects;
create policy "grant files own update" on storage.objects for update to authenticated
  using (bucket_id = 'grant-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "grant files own delete" on storage.objects;
create policy "grant files own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'grant-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- ③ 보관함 목록 (원래 파일 이름·어느 공고의 파일인지)
create table if not exists grants.user_files (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  notice_id    text not null,          -- 공고가 정리돼도 파일은 남도록 외래키 없음
  notice_title text,
  name         text not null,
  path         text not null,
  size         int,
  source_url   text,
  created_at   timestamptz not null default now(),
  unique (user_id, path)
);
create index if not exists user_files_notice_idx on grants.user_files (user_id, notice_id);
alter table grants.user_files enable row level security;
drop policy if exists "own rows" on grants.user_files;
create policy "own rows" on grants.user_files for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on grants.user_files to authenticated;
grant all on grants.user_files to service_role;


-- ─────────── 0007_drafts ───────────
-- MUSE Grants · 0007: 지원서 초안 편집기 + 프로필 버전
-- 0006 다음에 한 번 실행하세요. 여러 번 실행해도 안전합니다.

-- ① 초안 (공고 하나에 초안 하나, 항목별 내용은 sections에)
create table if not exists grants.drafts (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  notice_id    text not null,          -- 공고가 정리돼도 초안은 남도록 외래키 없음
  notice_title text,
  entity_id    text,
  sections     jsonb not null default '[]'::jsonb,
  criteria     jsonb not null default '[]'::jsonb,
  checklist    jsonb not null default '[]'::jsonb,
  memo         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, notice_id)
);

-- ② 초안 버전 (저장할 때마다 쌓이고 되돌릴 수 있음)
create table if not exists grants.draft_versions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  draft_id   text not null references grants.drafts(id) on delete cascade,
  note       text,
  sections   jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists draft_versions_idx on grants.draft_versions (draft_id, created_at desc);

-- ③ 프로필 버전
create table if not exists grants.profile_versions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_id  text not null,
  note       text,
  profile    jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists profile_versions_idx on grants.profile_versions (user_id, entity_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['drafts','draft_versions','profile_versions'] loop
    execute format('alter table grants.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on grants.%I', t);
    execute format('create policy "own rows" on grants.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('grant select, insert, update, delete on grants.%I to authenticated', t);
    execute format('grant all on grants.%I to service_role', t);
  end loop;
end $$;
