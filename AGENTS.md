# AGENTS.md

## 코드 구조

- apps/web: Next.js 웹앱
- packages/core: 공통 타입·날짜·분류·매칭 로직
- packages/collectors: 사이트별 수집기와 실행기
- cloud/supabase: DB 스키마·RLS·마이그레이션
- .github/workflows/collect.yml: 정기 수집
- 변경 전에 README.md, INSTALL.md와 관련 코드·설정을 확인한다.

## 개발 규칙

- 변경은 목적에 맞게 작게 유지하고, 기존 작업을 덮어쓰지 않는다.
- 관련 파일만 명시적으로 stage하고 git add . 또는 git add -A는 사용하지 않는다.
- 생성 파일, 의존성 폴더, 무관한 변경을 포함하지 않는다.
- 수집처·데이터 형식·실행 방법이 바뀌면 관련 문서와 테스트를 갱신한다.

## 테스트와 수집

- Node.js와 pnpm 버전은 package.json을 따른다.
- 의존성 설치: pnpm install --frozen-lockfile
- 파서·고정 응답 테스트: pnpm --filter @muse/collectors test
- 저장 없는 수집 확인: pnpm --filter @muse/collectors collect:dry
- collect:dry도 외부 사이트에 요청한다. pnpm collect는 DB 입력·갱신·정리를 수행한다.
- 테스트·타입 검사·실제 사이트 수집 검증을 구분하고, 실행하지 않은 검증을 통과로 보고하지 않는다.

## 비밀값과 개인정보

- 실제 인증키·토큰·비밀번호·개인정보를 코드·문서·로그에 넣거나 커밋하지 않는다.
- 실제 .env 및 환경별 설정, 데이터 내보내기 JSON/CSV, DB 백업은 커밋하지 않는다.
- .env.example에는 실제 값 없는 설정 예시만 둔다.
- 압축파일·스크린샷도 민감한 정보가 없는지 확인한다.
- Supabase service_role·secret 키는 브라우저 공개 환경변수에 넣지 않는다.
- 오류 로그에 인증키가 포함된 URL을 남기지 않는다.
