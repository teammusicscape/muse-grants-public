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
