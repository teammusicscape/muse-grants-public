/**
 * 체험 모드에서 보여줄 예시 계정 이름 (Vercel 환경변수 NEXT_PUBLIC_SHOWCASE_NAME)
 * 비워 두면 "예시"로만 표시돼요.
 */
export const SHOWCASE_NAME = (process.env.NEXT_PUBLIC_SHOWCASE_NAME ?? "").trim();
export const showcaseLabel = SHOWCASE_NAME ? `${SHOWCASE_NAME} 기준 예시` : "예시 기준";

/**
 * 로그인 없는 체험 모드 켜기 (Vercel 환경변수 NEXT_PUBLIC_GUEST_MODE=1, 또는 예시 이름이 있으면 켜짐)
 * 켤 때는 Supabase에 0005_guest_read.sql도 실행해야 공고가 보여요.
 */
export const GUEST_ENABLED = process.env.NEXT_PUBLIC_GUEST_MODE === "1" || !!SHOWCASE_NAME;
