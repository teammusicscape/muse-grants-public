import type { Profile, ProfileItem } from "./types";

/** 초안 한 항목 (양식 목차 한 칸) */
export interface DraftSection {
  id: string;
  title: string;
  guide?: string;   // 무엇을 쓰는 칸인지 (양식 안내문)
  limit?: number;   // 글자 수 제한 (공백 포함)
  content: string;
}
export interface CheckItem { id: string; text: string; done?: boolean }

export interface Draft {
  id: string;
  noticeId: string;
  noticeTitle: string;
  entityId: string;
  sections: DraftSection[];
  /** 심사 기준 (양식·공고문에서 뽑음) */
  criteria: string[];
  /** 제출 서류 체크리스트 */
  checklist: CheckItem[];
  memo?: string;
  createdAt: string;
  updatedAt: string;
}
export interface DraftVersion { id: string; draftId: string; note: string; sections: DraftSection[]; createdAt: string }

export const uid = () => Math.random().toString(36).slice(2, 10);

/** 양식이 없을 때 쓰는 기본 목차 */
export const DEFAULT_OUTLINE: Omit<DraftSection, "id" | "content">[] = [
  { title: "사업 개요", guide: "사업명, 한 줄 요약, 기간·장소·규모", limit: 500 },
  { title: "신청자 소개 및 역량", guide: "대표 작업·경력 중 이 사업과 이어지는 것", limit: 900 },
  { title: "추진 배경 및 필요성", guide: "왜 지금, 왜 이 사업인가 (공고 목적과 연결)", limit: 800 },
  { title: "사업 목표", guide: "정성·정량 목표", limit: 500 },
  { title: "세부 추진 내용", guide: "무엇을 어떻게 (단계별)", limit: 900 },
  { title: "추진 일정", guide: "월별 일정 (표로 정리 가능)", limit: 500 },
  { title: "예산 계획", guide: "항목별 금액·산출 근거, 자부담", limit: 600 },
  { title: "기대효과 및 성과지표", guide: "측정 가능한 지표", limit: 600 },
  { title: "사업 이후 지속 계획", guide: "후속 활동·확장", limit: 500 },
];
/** 해외 레지던시·교류 지원에 맞춘 기본 목차 */
export const RESIDENCY_OUTLINE: Omit<DraftSection, "id" | "content">[] = [
  { title: "신청자 소개", guide: "활동 분야, 대표 작업, 국제 활동 이력", limit: 800 },
  { title: "참가 목적 및 동기", guide: "왜 이 레지던시·프로그램인가", limit: 800 },
  { title: "활동 계획", guide: "기간 중 리서치·창작·교류 계획 (주차별)", limit: 900 },
  { title: "기관·현지 네트워크와의 연계", guide: "현지 기관·예술가와의 협업 가능성", limit: 600 },
  { title: "기대효과 및 후속 계획", guide: "귀국 후 발표·확장 계획", limit: 700 },
  { title: "예산 계획", guide: "항공·체재비 등 산출 근거", limit: 500 },
];

export const newSections = (o = DEFAULT_OUTLINE): DraftSection[] => o.map((s) => ({ ...s, id: uid(), content: "" }));

/** 글자 수 (공백 포함 / 제외) */
export function charCount(t: string) {
  return { withSpace: [...t].length, noSpace: [...t.replace(/\s/g, "")].length };
}

/** 초안에 남긴 [확인 필요: …] 목록 */
export function todoItems(t: string): string[] {
  return [...t.matchAll(/\[확인\s*필요\s*[:：]?\s*([^\]]*)\]/g)].map((m) => m[1].trim() || "내용 확인");
}

const norm = (s: string) => s.replace(/^[\s#*\d.)\-·•Ⅰ-Ⅻ]+/, "").replace(/[\s:：*【】\[\]()]/g, "").toLowerCase();

/**
 * AI가 준 전체 초안을 항목별로 나누기
 * "### 1. 사업 개요" / "【사업 개요】" / "**사업 개요**" 같은 제목 줄로 나누고, 목차 제목과 맞춰 봄
 */
export function splitDraft(text: string, sections: DraftSection[]): { sectionId: string | null; title: string; content: string }[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: { title: string; body: string[] }[] = [];
  const isHead = (l: string) => /^\s*(#{1,4}\s+.+|【.+】\s*|\*\*[^*]{2,40}\*\*\s*:?\s*|\d{1,2}[.)]\s+[^.]{2,40})$/.test(l) && l.trim().length <= 60;
  for (const l of lines) {
    if (isHead(l)) out.push({ title: l.replace(/[#*【】]/g, "").trim(), body: [] });
    else if (out.length) out[out.length - 1].body.push(l);
    else if (l.trim()) out.push({ title: "", body: [l] });
  }
  // 첫 제목 앞의 인사말("네, 초안입니다") 등은 버림
  const blocks = out.filter((b) => b.title && (b.body.join("").trim() || b.title));
  const used = new Set<string>();
  const res: (DraftSection | undefined)[] = blocks.map(() => undefined);
  const take = (i: number, sec?: DraftSection) => { if (sec && !used.has(sec.id)) { res[i] = sec; used.add(sec.id); } };
  // ① 제목이 같은 칸
  blocks.forEach((b, i) => { const t = norm(b.title); take(i, sections.find((s) => !used.has(s.id) && (norm(s.title) === t))); });
  // ② 제목이 비슷한 칸
  blocks.forEach((b, i) => { if (res[i]) return; const t = norm(b.title); take(i, sections.find((s) => !used.has(s.id) && t && (t.includes(norm(s.title)) || norm(s.title).includes(t)))); });
  // ③ 번호 ("3. …" → 3번째 칸)
  blocks.forEach((b, i) => { if (res[i] || !/^\s*\d+/.test(b.title)) return; take(i, sections[parseInt(b.title.trim(), 10) - 1]); });
  return blocks.map((b, i) => ({ sectionId: res[i]?.id ?? null, title: b.title, content: b.body.join("\n").trim() }));
}

/** 프로필을 AI에게 보낼 글로 */
export function profileText(p?: Profile): string {
  if (!p) return "(프로필 미입력)";
  const list = (label: string, xs?: ProfileItem[]) => xs?.length ? `### ${label}\n` + xs.map((x) => `- ${x.year ? x.year + " " : ""}${x.title}${x.detail ? ` — ${x.detail}` : ""}${x.link ? ` (${x.link})` : ""}`).join("\n") : "";
  return [
    p.headline && `한 줄 소개: ${p.headline}`,
    p.genres?.length && `분야: ${p.genres.join(", ")}`,
    p.bio && `### 소개\n${p.bio}`,
    list("대표 작업", p.works), list("경력", p.career), list("수상·선정·지원", p.awards), list("레지던시·국제 교류", p.residencies), list("학력", p.education),
    p.members && `### 구성원\n${p.members}`,
    p.links?.length && `### 링크\n${p.links.map((l) => `- ${l.label}: ${l.url}`).join("\n")}`,
    p.notes && `### 작성 시 참고\n${p.notes}`,
  ].filter(Boolean).join("\n\n");
}

const key = (x: ProfileItem) => `${x.year ?? ""}|${x.title}`.replace(/\s/g, "").toLowerCase();
const LISTS = ["education", "career", "works", "awards", "residencies"] as const;

/** AI가 뽑은 프로필을 기존 프로필에 합치기: 빈 칸만 채우고, 목록은 겹치지 않는 항목만 추가 */
export function mergeProfile(cur: Profile = {}, add: Profile): { merged: Profile; added: number; kept: string[] } {
  const m: Profile = { ...cur };
  let added = 0;
  const kept: string[] = [];
  for (const f of ["headline", "bio", "members", "notes"] as const) {
    const v = add[f]?.trim();
    if (!v) continue;
    if (!m[f]?.trim()) { m[f] = v; added++; } else if (m[f] !== v) kept.push(f);
  }
  if (add.genres?.length) {
    const g = [...new Set([...(m.genres ?? []), ...add.genres.map((x) => x.trim()).filter(Boolean)])];
    added += g.length - (m.genres?.length ?? 0);
    m.genres = g;
  }
  for (const f of LISTS) {
    const have = new Set((m[f] ?? []).map(key));
    const fresh = (add[f] ?? []).filter((x) => x?.title?.trim() && !have.has(key(x))).map((x) => ({ ...x, id: uid(), title: x.title.trim() }));
    if (fresh.length) { m[f] = [...(m[f] ?? []), ...fresh]; added += fresh.length; }
  }
  if (add.links?.length) {
    const have = new Set((m.links ?? []).map((l) => l.url));
    const fresh = add.links.filter((l) => l?.url && !have.has(l.url));
    if (fresh.length) { m.links = [...(m.links ?? []), ...fresh]; added += fresh.length; }
  }
  m.updatedAt = new Date().toISOString();
  return { merged: m, added, kept };
}
