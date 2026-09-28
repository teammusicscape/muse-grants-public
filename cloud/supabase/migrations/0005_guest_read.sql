-- MUSE Grants · 0005: 로그인 없는 "체험 모드"
-- 로그인하지 않은 사람(anon)도 수집된 공고 목록을 볼 수 있게 합니다.
-- 0004 다음에 한 번 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 공개되는 것: 수집기가 모은 공고(created_by 없음), 해외 플랫폼 목록, 마지막 수집 시각
-- 공개되지 않는 것: 직접 추가한 공고, ★·결정·설정·파일 등 개인 데이터 (기존 정책 그대로)
-- 쓰기(추가·수정·삭제)는 anon에게 정책이 없어서 계속 막혀 있습니다.

-- 1) 공고: 수집된 공고만 읽기
drop policy if exists "notices guest read" on grants.notices;
create policy "notices guest read" on grants.notices for select to anon
  using (created_by is null);
grant select on grants.notices to anon;

-- 2) 해외 플랫폼 디렉토리 (K-GO)
drop policy if exists "platforms guest read" on grants.platforms;
create policy "platforms guest read" on grants.platforms for select to anon using (true);
grant select on grants.platforms to anon;

-- 3) 수집 기록: "마지막 수집 시각"만 (오류 내용은 안 보이게 열 단위로 허용)
drop policy if exists "runs guest read" on grants.collect_runs;
create policy "runs guest read" on grants.collect_runs for select to anon using (true);
revoke select on grants.collect_runs from anon;
grant select (finished_at) on grants.collect_runs to anon;

-- 되돌리려면 (체험 모드 끄기):
--   drop policy "notices guest read"   on grants.notices;
--   drop policy "platforms guest read" on grants.platforms;
--   drop policy "runs guest read"      on grants.collect_runs;
