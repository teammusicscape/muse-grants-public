import type { Notice } from "./types";

/** 해외 우수 플랫폼 (K-arts on the GO 디렉토리 등) — 참조 데이터 */
export interface Platform {
  id: string;
  source: string;        // "K-GO"
  field: "공연" | "시각";
  name: string;          // 한글 이름
  nameEn?: string;
  type?: string;         // 페스티벌 · 시설 · 미술관 …
  genres?: string[];
  continent?: string;
  country?: string;
  city?: string;
  homepage?: string;
  tour?: boolean;
}

const GENERIC = /^(festival|theatre|theater|museum|gallery|art center|arts centre|biennale|biennial|opera house|concert hall)$/i;
const host = (u?: string) => {
  if (!u) return "";
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
};
const SOCIAL = /(facebook|instagram|youtube|twitter|x\.com|linktr|naver|google)/;

/** 공고가 디렉토리의 플랫폼과 관련 있는지 (이름·홈페이지 주소로) */
export function matchPlatforms(n: Pick<Notice, "title" | "summary" | "org" | "url" | "applyUrl">, platforms: Platform[]): Platform[] {
  if (!platforms.length) return [];
  const text = `${n.title} ${n.org} ${n.summary ?? ""}`.toLowerCase();
  const hosts = [host(n.url), host(n.applyUrl)].filter((h) => h && !/artnuri|resartis|k-go/.test(h));
  return platforms.filter((p) => {
    const h = host(p.homepage);
    if (h && !SOCIAL.test(h) && hosts.some((x) => x === h || x.endsWith("." + h))) return true;
    const en = (p.nameEn ?? "").replace(/\(.*?\)|（.*?）/g, "").trim().toLowerCase();
    if (en.length >= 8 && !GENERIC.test(en) && text.includes(en)) return true;
    const ko = p.name.replace(/\(.*?\)/g, "").trim();
    return ko.length >= 5 && text.includes(ko.toLowerCase());
  }).filter((p, i, a) => a.findIndex((q) => (q.nameEn || q.name) === (p.nameEn || p.name)) === i).slice(0, 3);
}
