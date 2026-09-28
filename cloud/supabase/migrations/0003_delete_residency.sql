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
