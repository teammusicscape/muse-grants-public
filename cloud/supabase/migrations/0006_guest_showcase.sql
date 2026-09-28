-- MUSE Grants · 0006: 체험 모드 "예시 계정" (선택 — 내 설정·분석을 체험자에게 예시로 보여주기)
-- 체험 모드로 들어온 사람에게 관리자 계정의 설정·AI 분석을 예시로 보여줍니다.
-- 0005 다음에 한 번 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 공개되는 것 (읽기만):
--   · 예시 계정의 키워드·지역·관심 탭 설정
--   · 지원 주체 중 단체·법인만 (개인 예술가·개인사업자는 빠짐)
--   · 수집된 공고에 대한 AI 분석 (등급·점수·장단점·의견, 단체 판정만)
-- 공개되지 않는 것: ★·결정·지원 관리·메모·파일·직접 추가한 공고, 개인 주체 정보

-- 1) 어떤 계정을 예시로 쓸지 (한 줄만)
create table if not exists grants.showcase (
  id       int primary key default 1 check (id = 1),
  owner_id uuid references auth.users(id) on delete cascade
);
alter table grants.showcase enable row level security;
revoke all on grants.showcase from anon, authenticated;

-- ▼ 예시로 보여줄 계정의 로그인 이메일 (다르면 바꿔서 실행하세요)
insert into grants.showcase (id, owner_id)
select 1, id from auth.users where email = 'you@example.com'
on conflict (id) do update set owner_id = excluded.owner_id;

-- 2) 체험 모드가 부르는 함수 (필요한 부분만 골라서 돌려줌)
create or replace function grants.guest_showcase()
returns jsonb
language sql
stable
security definer
set search_path = grants, public
as $$
  with c as (select owner_id from grants.showcase where id = 1),
  s as (select us.keywords, us.entities from grants.user_settings us join c on us.user_id = c.owner_id),
  ents as (
    select e from s, jsonb_array_elements(coalesce(s.entities, '[]'::jsonb)) e
    where e->>'type' in ('예술단체', '법인')
  ),
  ids as (select e->>'id' as id from ents)
  select jsonb_build_object(
    'keywords', (select keywords from s),
    'entities', coalesce((select jsonb_agg(e) from ents), '[]'::jsonb),
    'analyses', coalesce((
      select jsonb_object_agg(
        a.notice_id,
        a.analysis || jsonb_build_object('verdicts', coalesce((
          select jsonb_agg(v) from jsonb_array_elements(coalesce(a.analysis->'verdicts', '[]'::jsonb)) v
          where v->>'entityId' in (select id from ids)
        ), '[]'::jsonb))
      )
      from grants.user_analyses a
      join grants.notices n on n.id = a.notice_id
      join c on a.user_id = c.owner_id
      where n.created_by is null
    ), '{}'::jsonb)
  );
$$;
revoke all on function grants.guest_showcase() from public;
grant execute on function grants.guest_showcase() to anon, authenticated;

-- 확인: 아래를 실행해서 entities에 내 단체가 보이면 성공
-- select grants.guest_showcase();

-- 되돌리려면:
--   drop function grants.guest_showcase();
--   drop table grants.showcase;
