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
