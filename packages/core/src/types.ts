/** 공고 종류 = 피드 탭 */
export type NoticeKind = "grant" | "service" | "edu" | "venue" | "residency";

export const KIND_LABEL: Record<NoticeKind, string> = {
  grant: "지원사업",
  service: "용역·입찰",
  edu: "교육",
  venue: "대관",
  residency: "레지던시",
};
export const ALL_KINDS: NoticeKind[] = ["grant", "service", "edu", "venue", "residency"];

/** 지원 가능성 판정 */
export type VerdictStatus = "now" | "prep" | "indirect" | "no";
export const VERDICT_LABEL: Record<VerdictStatus, string> = {
  now: "지금 지원 가능",
  prep: "준비하면 가능",
  indirect: "간접 참여 가능",
  no: "지원 불가",
};
export const VERDICT_EMOJI: Record<VerdictStatus, string> = {
  now: "🟢", prep: "🟡", indirect: "🔵", no: "🔴",
};

export type Grade = "강추" | "추천" | "검토" | "비추";
export type Decision = "강추" | "지원" | "보류" | "비추";
export const DECISIONS: Decision[] = ["강추", "지원", "보류", "비추"];

export type EntityType = "개인 예술가" | "예술단체" | "개인사업자" | "법인";
/** 시·도 + (선택) 시·군·구 */
export interface Place { sido: string; sigungu?: string }
/** 활동지역: 거주하지 않아도 "N년 이상 / N회 이상 활동" 조건을 확인하기 위한 이력 */
export interface ActivityRegion extends Place { years?: number; count?: number }

/** 프로필 항목 한 줄 (경력·작업·수상·레지던시 등) */
export interface ProfileItem { id: string; year?: string; title: string; detail?: string; link?: string }

/** 지원서 초안의 재료가 되는 프로필 — 문서·웹사이트로 자동 채우고 직접 고침 */
export interface Profile {
  headline?: string;           // 한 줄 소개
  bio?: string;                // 소개문
  genres?: string[];           // 분야·장르·매체
  education?: ProfileItem[];
  career?: ProfileItem[];      // 경력·직책·강의
  works?: ProfileItem[];       // 대표 작업·공연·전시
  awards?: ProfileItem[];      // 수상·선정·지원 이력
  residencies?: ProfileItem[]; // 레지던시·국제 교류
  members?: string;            // 단체: 구성원·역할
  links?: { label: string; url: string }[];
  notes?: string;              // AI에게 알려 둘 점 (강조점·문체 등)
  updatedAt?: string;
}

export interface Entity {
  id: string;
  name: string;
  short: string; // 카드에 표시할 짧은 이름
  type: EntityType;
  /** 예전 버전 호환: 주거지(소재지)의 시·도 */
  region: string;
  /** 개인: 주거지(주민등록 주소지) / 단체·사업자: 소재지 */
  residence?: Place;
  /** 활동지역 (여러 곳) */
  activityRegions?: ActivityRegion[];
  /** 개인: 활동 시작 연도 → 활동년차 계산 */
  activityStartYear?: number;
  /** 단체·사업자: 설립·개업일 */
  foundedAt?: string;
  documents: string[]; // 보유 서류 종류
  /** 경력·작업 등 초안 재료 */
  profile?: Profile;
}

export interface Verdict {
  entityId: string;
  status: VerdictStatus;
  reason?: string;
  gaps?: { item: string; how: string; days?: number }[];
}

export interface FitScore {
  eligibility: number; // /40
  purpose: number; // /30
  capacity: number; // /20
  scale: number; // /10
}

export interface Analysis {
  verdicts: Verdict[];
  fit?: FitScore;
  grade?: Grade;
  pros?: string[];
  cons?: string[];
  opinion?: string;
  by: "rule" | "api" | "manual";
  analyzedAt: string;
}

export interface GrantInfo { amount?: string; eligibility?: string; period?: string }
export interface ServiceInfo { budget?: string; qualification?: string; method?: string }
export interface EduInfo { period?: string; fee?: string; capacity?: string; mode?: "온라인" | "오프라인" | "혼합"; certificate?: boolean }
export interface ResidencyInfo { country?: string; city?: string; start?: string; end?: string; fee?: string; support?: string }
export interface VenueInfo { usePeriod?: string; space?: string; seats?: number; fee?: string; supportLink?: string }

/** 공고 첨부파일 (공고문·신청서 양식 등) */
export interface NoticeFile {
  name: string;
  url: string;
  /** 아트누리 문서 뷰어로 미리보기 (HWP·PDF 등) */
  preview?: { seNo: string; fileSn: string };
}

/** 내 보관함에 저장한 파일 */
export interface SavedFile {
  id: string;
  noticeId: string;
  noticeTitle?: string;
  name: string;
  path: string;
  size?: number;
  sourceUrl?: string;
  createdAt: string;
}

export interface Notice {
  id: string;
  kind: NoticeKind;
  title: string;
  org: string;
  sources: string[]; // 출처 배지 (아트누리, NCAS, IG, 웹 …)
  url: string;
  region?: string;
  fields: string[];
  tags: string[];
  overseas?: boolean;
  postedAt?: string;
  /** YYYY-MM-DD, 없으면 deadlineLabel 사용 */
  deadline: string | null;
  deadlineLabel?: "예정" | "상시" | "확인 필요";
  /** 접수 시작·마감 (YYYY-MM-DD 또는 YYYY-MM-DD HH:mm) */
  applyStart?: string;
  applyEnd?: string;
  /** 원문 신청 사이트 */
  applyUrl?: string;
  /** 첨부파일 */
  files?: NoticeFile[];
  /** 지원 대상 (개인/단체 등) */
  targets?: string[];
  /** 예정 공고: 작년 일정 */
  lastYear?: string;
  summary?: string;
  thumb?: string; // 포스터 이미지 URL
  posterColor?: string; // 썸네일이 없을 때 포스터 대체 색
  needsReview?: boolean; // 인스타 등 AI 추출 결과 확인 필요
  /** 내가 직접 추가한 공고 (삭제하면 클라우드에서도 지움) */
  manual?: boolean;
  checkedAt: string;
  grant?: GrantInfo;
  service?: ServiceInfo;
  edu?: EduInfo;
  venue?: VenueInfo;
  residency?: ResidencyInfo;
  analysis?: Analysis;
}

/** 사용자별 상태 (동기화 대상) */
export interface UserState {
  starred: Record<string, boolean>;
  decisions: Record<string, Decision | undefined>;
  hidden: Record<string, boolean>;
  seen: Record<string, boolean>;
  stages: Record<string, Stage | undefined>;
  /** 삭제한 공고 (다시 수집돼도 안 보임) */
  deleted: Record<string, boolean>;
  /** 삭제한 공고의 제목키 (제목·기관 기준 — 마감일이 바뀌어 다시 올라와도 숨김) */
  deletedKeys: Record<string, boolean>;
}

export type Stage = "관심" | "준비" | "초안" | "제출" | "선정" | "탈락";
export const STAGES: Stage[] = ["관심", "준비", "초안", "제출", "선정", "탈락"];
export const EDU_STAGES: Record<Stage, string> = {
  관심: "관심", 준비: "신청", 초안: "수강", 제출: "수료", 선정: "완료", 탈락: "취소",
};

export interface KeywordSet {
  include: string[];
  exclude: string[];
  regions: string[];
  kinds: NoticeKind[];
  /** 설정 버전 (새 탭이 생겼을 때 기존 사용자에게 켜 주기 위함) */
  v?: number;
}
