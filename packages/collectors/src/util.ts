const UA = "Mozilla/5.0 (compatible; MUSE-Grants/0.1; notice collector)";
let last = 0;

/** 사이트에 부담을 주지 않도록 요청 사이 1.2초 간격 */
async function polite() {
  const wait = last + 1200 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  await polite();
  const r = await fetch(url, { ...init, headers: { "user-agent": UA, "accept-language": "ko-KR,ko;q=0.9", ...(init?.headers ?? {}) } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url}`);
  return r.text();
}

export async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url, { headers: { accept: "application/json" } })) as T;
}

/** "2026.09.30", "2026-09-30", "2026/9/30", "26.09.30" → "2026-09-30" */
export function normDate(s: string | undefined | null): string | undefined {
  if (!s) return undefined;
  const m = /(\d{2,4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.exec(s);
  if (!m) return undefined;
  let y = +m[1];
  if (y < 100) y += 2000;
  return `${y}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
}

/** "2026.09.01 ~ 2026.09.30" 같은 기간 표기에서 마지막 날짜 = 마감일 */
export function deadlineFromPeriod(s: string | undefined | null): string | undefined {
  if (!s) return undefined;
  const all = [...s.matchAll(/(\d{2,4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/g)];
  if (!all.length) return undefined;
  return normDate(all[all.length - 1][0]);
}

export function absUrl(href: string, base: string): string {
  try { return new URL(href, base).toString(); } catch { return href; }
}

export function clean(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").replace(/\[?\s*(new|NEW|N)\s*\]?$/, "").trim();
}

/** 짧은 해시 (공고 ID용) */
export function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/** 제목의 "(10.3)", "(~9.20)", "(10. 3.)" 같은 마감 표기 → YYYY-MM-DD (게시일 기준으로 연도 추정) */
export function deadlineFromTitle(t: string, posted?: string): string | undefined {
  const m = /[(~∼\s]\s*~?\s*(\d{1,2})\s*[./]\s*(\d{1,2})\s*\.?\s*(?:\([월화수목금토일]\))?\s*(?:까지)?\s*\)?\s*$/.exec(t) ?? /~\s*(\d{1,2})[./](\d{1,2})/.exec(t);
  if (!m) return undefined;
  const mm = +m[1], dd = +m[2];
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined;
  const y = posted ? +posted.slice(0, 4) : new Date().getFullYear();
  const pm = posted ? +posted.slice(5, 7) : new Date().getMonth() + 1;
  const year = mm < pm - 6 ? y + 1 : y;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** 문화예술과 관련 있는 공고인지 (지자체 보조사업·조달 입찰처럼 모든 분야가 섞인 곳을 거를 때) */
export const ARTS_RE = /(문화|예술|공연|음악|음향|사운드|축제|콘서트|음악회|연주|전시|미술|영상|영화|미디어|뮤지컬|연극|무용|국악|오케스트라|합창|밴드|창작|레지던|페스티벌|아트|문예|버스킹|청년\s*예술|예술인|공연장|문화재단|문화원|행사\s*(기획|운영|대행))/;
