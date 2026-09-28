import type { Notice, NoticeKind } from "@muse/core";

/** 목록 페이지에서 뽑은 공고 한 줄 */
export interface RawItem {
  title: string;
  url: string;
  org?: string;
  kind?: NoticeKind;   // 사이트가 종류를 알려주면
  postedAt?: string;   // YYYY-MM-DD
  deadline?: string;   // YYYY-MM-DD
  applyStart?: string; // YYYY-MM-DD[ HH:mm]
  applyEnd?: string;
  applyUrl?: string;
  period?: string;     // 원문 기간 표기
  region?: string;
  summary?: string;
  targets?: string[];
  fields?: string[];
  thumb?: string;
  /** 이 공고를 찾아낸 검색 키워드 (카드에 #키워드로 표시) */
  keywords?: string[];
  overseas?: boolean;
  files?: { name: string; url: string; preview?: { seNo: string; fileSn: string } }[];
  details?: Partial<Pick<Notice, "grant" | "service" | "edu" | "venue" | "residency">>;
  /** 새 공고일 때만 호출되는 상세 페이지 읽기 (요청 수 절약) */
  detail?: () => Promise<Partial<RawItem>>;
}

/** 수집기 = 사이트 하나. 새 사이트 추가 = 이 인터페이스를 구현한 파일 1개 */
export interface Collector {
  id: string;
  name: string;               // 출처 배지에 표시될 이름
  homepage: string;
  defaultKind?: NoticeKind;
  region?: string;
  list(ctx: CollectContext): Promise<RawItem[]>;
}

export interface CollectContext {
  fetchText(url: string, init?: RequestInit): Promise<string>;
  fetchJson<T = unknown>(url: string): Promise<T>;
  env: Record<string, string | undefined>;
  log(msg: string): void;
  /** 사용자들이 설정에 등록한 키워드 (검색을 지원하는 사이트는 이 키워드로도 검색) */
  keywords: string[];
}
