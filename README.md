# MUSE Grants

> 👉 **처음 설치하시나요? [INSTALL.md](INSTALL.md)** 를 따라 하세요. (약 40분, 무료, 개발 지식 없이 가능)

지원사업 · 용역·입찰 · 교육 · 대관 공고를 모아 보고, 판정하고, 준비하는 대시보드.

## 지금 들어 있는 것 (v0.1 · 로드맵 1~3단계)

| 폴더 | 내용 |
|---|---|
| `apps/web` | 휴대폰·PC 브라우저용 웹앱 (Next.js). 공고 피드(종류 탭·목록/포스터 보기·검색·필터), 공고 상세(주체별 판정·적합도·의견·결정 도장), 공고 추가(링크·포스터·직접 입력), 대화로 분석하기(결과 붙여넣기), [○○와 작성하기], 캘린더, 지원 관리, 설정, 다크 모드 |
| `packages/core` | 공통 타입, D-day 계산, 종류 자동 분류, 규칙 매칭, 중복 판별, 샘플 데이터 |
| `packages/collectors` | 수집기: 아트누리 · NCAS · 예술경영지원센터 · K-Startup(API) · 문화예술 내일 · 아트모아 + 범용 게시판 파서 |
| `cloud/supabase` | 클라우드 DB 스키마 + 보안(RLS) |
| `.github/workflows` | 자동 일꾼 (하루 2회 수집) |

## 바로 실행해 보기 (데모 모드)

```bash
# Node 20 이상, pnpm 필요 (npm i -g pnpm)
pnpm install
pnpm dev          # http://localhost:3000
```
환경변수가 없으면 **데모 모드**로 샘플 공고를 보여줍니다. 휴대폰으로 보려면 같은 와이파이에서 `http://<PC IP>:3000`.

## 클라우드 연결 (휴대폰에서도 보기)

1. **Supabase** (공고 데이터는 전용 스키마 `grants`에 따로 저장 — 다른 앱과 같은 프로젝트를 써도 섞이지 않음)
   - 새로 설치: SQL Editor에 `cloud/supabase/setup.sql` 한 번만 실행 (아래 개별 파일 대신)
   - SQL Editor → New query → `cloud/supabase/migrations/0001_init.sql` 전체 붙여넣고 **Run**, 이어서 `0002_manual_notices.sql`, `0003_delete_residency.sql`, `0004_files.sql`, `0005_guest_read.sql`·`0006_guest_showcase.sql`(로그인 없는 체험 모드와 예시 계정, 원하지 않으면 생략. 0006의 이메일은 본인 것으로, Vercel 환경변수 `NEXT_PUBLIC_SHOWCASE_NAME`에 예시 이름), `0007_drafts.sql`(초안 편집기)도 순서대로 같은 방법으로 **Run**
   - Project Settings → Data API → **Exposed schemas**에 `grants` 추가 → Save
   - Authentication → URL Configuration → **Redirect URLs**에 `https://<Vercel 주소>/**` 추가 (같은 프로젝트를 다른 앱과 함께 쓰면 Site URL은 그대로 둘 것)
2. **GitHub**: 저장소 Settings → Secrets and variables → Actions에 등록
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API Keys의 secret/service_role 키)
   - `DATA_GO_KR_KEY` (선택, 공공데이터포털 인증키 — K-Startup · 조달청 나라장터 입찰공고. data.go.kr에서 "조달청_나라장터 입찰공고정보서비스" 활용 신청 필요)
3. **Vercel**: Project → Settings → Environment Variables → 추가 후 Redeploy
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable/anon 키)
4. GitHub Actions 탭 → "공고 수집" → **Run workflow** 로 첫 수집
5. **사용자 등록**: 새 가입은 막혀 있음 → Supabase → Authentication → Users → **Add user**(또는 Invite)로 쓸 사람 이메일 추가

> 나중에 PC 앱의 설정 마법사가 이 과정을 자동으로 해줍니다 (`guides/휴대폰에서도보기_설정가이드.md`).

## 수집기 확인·조정

```bash
pnpm --filter @muse/collectors collect:dry               # 저장 없이 결과 표 출력
pnpm --filter @muse/collectors collect:dry --only=artnuri
pnpm --filter @muse/collectors test                      # 파서 테스트
```
⚠️ 각 사이트의 목록 주소·구조는 **첫 실행 때 --dry로 확인**해야 합니다 (개발 환경에서 해당 사이트 접속이 막혀 있어 실제 페이지로는 아직 검증 전).
결과가 0건이거나 이상하면 `packages/collectors/src/sources/*.ts`의 주소와 `link` 조건을 조정하세요.

## 다음 단계
- 수집기 실제 사이트 검증 → 지역 문화재단·대관·나라장터 추가
- PC 앱(Electron)으로 감싸기 + 지원서 작업 폴더 + MCP 연결
- 휴대폰 웹푸시 마감 알림
