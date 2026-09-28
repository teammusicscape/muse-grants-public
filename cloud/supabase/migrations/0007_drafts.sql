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
