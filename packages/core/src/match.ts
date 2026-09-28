import type { KeywordSet, Notice } from "./types";
import { daysLeft } from "./date";

/** 규칙 기반 매칭 점수 (0~100). 토큰 0. */
export function keywordScore(n: Notice, k: KeywordSet): number {
  const text = `${n.title} ${n.summary ?? ""} ${n.fields.join(" ")} ${n.tags.join(" ")}`;
  if (k.exclude.some((w) => w && text.includes(w))) return 0;
  const hits = k.include.filter((w) => w && text.includes(w)).length;
  const base = Math.min(100, hits * 25);
  const regionOk = !n.region || k.regions.length === 0 || k.regions.some((r) => n.region!.includes(r)) || n.region === "전국" || !!n.overseas;
  return regionOk ? base : Math.round(base * 0.3);
}

export function isOpen(n: Notice, now = new Date()): boolean {
  const d = daysLeft(n.deadline, now);
  return d === null || d >= 0;
}

export function fitTotal(n: Notice): number | undefined {
  const f = n.analysis?.fit;
  if (!f) return undefined;
  return f.eligibility + f.purpose + f.capacity + f.scale;
}

export function sortByDeadline(a: Notice, b: Notice, now = new Date()): number {
  const da = daysLeft(a.deadline, now);
  const db = daysLeft(b.deadline, now);
  const va = da === null ? 9999 : da < 0 ? 99999 : da;
  const vb = db === null ? 9999 : db < 0 ? 99999 : db;
  return va - vb;
}

/** 같은 공고 판별 키: 제목 정규화 + 기관 + 마감일 */
export function dedupeKey(n: Pick<Notice, "title" | "org" | "deadline">): string {
  const t = n.title.replace(/[\s()\[\]<>「」『』〈〉《》·,.:\-_'"]/g, "").toLowerCase();
  return `${t}|${n.org.replace(/\s/g, "")}|${n.deadline ?? ""}`;
}

/** 삭제 판별 키: 제목 정규화 + 기관 (마감일·연도 표기가 바뀌어 다시 올라와도 같은 공고로 봄) */
export function titleKey(n: Pick<Notice, "title" | "org">): string {
  const t = n.title.replace(/20\d\d년?도?/g, "").replace(/[\s()\[\]<>「」『』〈〉《》·,.:\-_'"]/g, "").toLowerCase();
  return `${t}|${n.org.replace(/\s|\(재\)/g, "")}`;
}

/** 영문 공고(해외 레지던시)용 한→영 동의어 */
const EN_SYN: Record<string, string[]> = {
  음악: ["music", "musician", "composer", "composition"],
  사운드: ["sound", "audio", "sonic", "acoustic"],
  미디어아트: ["media art", "new media", "digital art", "media arts"],
  공연: ["performance", "performing", "theatre", "theater", "dance"],
  다원예술: ["interdisciplinary", "multidisciplinary", "transdisciplinary"],
  융복합: ["interdisciplinary", "art and technology", "art & technology", "art-science", "art and science"],
  기술: ["technology", "tech", "science"],
  영상: ["film", "video", "moving image", "cinema"],
  전시: ["exhibition", "visual art", "visual arts"],
  창작: ["creation", "creative", "production"],
  레지던시: ["residency", "residence", "artist-in-residence"],
  해외: ["international"],
  국악: ["korean traditional music", "gugak"],
  미디어: ["media"],
  퍼포먼스: ["performance"],
  전자음악: ["electronic music", "electroacoustic", "electronics"],
};
/** 반대 방향 (영문 키워드 → 한글 본문) */
const KO_SYN: Record<string, string[]> = {};
for (const [ko, ens] of Object.entries(EN_SYN)) for (const en of ens) (KO_SYN[en] ??= []).push(ko);
Object.assign(KO_SYN, {
  music: [...(KO_SYN.music ?? []), "음악"], sound: ["사운드", "음향"], performance: ["공연", "퍼포먼스"], media: ["미디어"],
  "media art": ["미디어아트", "미디어 아트"], "new media": ["뉴미디어"], interdisciplinary: ["다원", "융복합"], electronic: ["전자음악", "일렉트로닉"],
  technology: ["기술", "테크"], dance: ["무용"], theatre: ["연극"], theater: ["연극"], exhibition: ["전시"], residency: ["레지던시", "레지던스"],
});
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 공고에 걸린 내 키워드 (제목·요약·분야·태그, 수집 때 검색한 키워드 kw:) */
export function matchedKeywords(n: Notice, keywords: string[]): string[] {
  const text = `${n.title} ${n.summary ?? ""} ${n.fields.join(" ")} ${n.org}`.toLowerCase();
  const searched = new Set(n.tags.filter((t) => t.startsWith("kw:")).map((t) => t.slice(3)));
  return keywords.filter((k) => {
    if (!k) return false;
    const kl = k.toLowerCase();
    if (searched.has(k)) return true;
    // 영문 키워드는 단어 단위로 (media ≠ multimedia)
    if (/^[a-z0-9 &'-]+$/.test(kl) ? new RegExp(`\\b${esc(kl)}\\b`).test(text) : text.includes(kl)) return true;
    if ((EN_SYN[k] ?? []).some((w) => new RegExp(`\\b${esc(w)}\\b`).test(text))) return true;
    return (KO_SYN[kl] ?? []).some((w) => text.includes(w));
  });
}
