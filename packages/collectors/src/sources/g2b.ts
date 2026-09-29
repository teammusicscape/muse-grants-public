import type { Collector, RawItem } from "../base";

/**
 * 조달청 나라장터 — 용역 입찰공고 (공공데이터포털 공식 API)
 * 필요: DATA_GO_KR_KEY + data.go.kr에서 "조달청_나라장터 입찰공고정보서비스" 활용 신청
 * 공연·음악·영상·축제 같은 문화예술 키워드(+내 키워드)로 최근 30일 공고를 검색, 마감 전인 것만
 */
const API = "http://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServcPPSSrch";
export const G2B_BASE_KEYWORDS = ["공연", "음악", "음향", "영상", "미디어아트", "축제", "콘서트", "전시", "문화예술", "사운드", "뮤지컬", "페스티벌"];

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const won = (v?: string) => (v && +v > 0 ? `${Math.round(+v / 10000).toLocaleString("ko-KR")}만원` : undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function g2bRowToItem(r: any, kw: string): RawItem | null {
  if (!r?.bidNtceNm) return null;
  const close = String(r.bidClseDt ?? "").trim(); // "2026-10-05 10:00:00"
  const deadline = close.slice(0, 10) || undefined;
  return {
    title: String(r.bidNtceNm).trim(),
    url: r.bidNtceDtlUrl || `https://www.g2b.go.kr`,
    org: r.dminsttNm || r.ntceInsttNm || "조달청",
    kind: "service",
    postedAt: String(r.bidNtceDt ?? "").slice(0, 10) || undefined,
    applyStart: String(r.bidBeginDt ?? "").slice(0, 16) || undefined,
    applyEnd: close.slice(0, 16) || undefined,
    deadline,
    keywords: [kw],
    details: { service: { budget: won(r.presmptPrce) ? `추정가격 ${won(r.presmptPrce)}` : won(r.asignBdgtAmt) ? `배정예산 ${won(r.asignBdgtAmt)}` : undefined, method: r.cntrctCnclsMthdNm || undefined, qualification: r.rgnLmtBidLocplcJdgmBssNm ? `지역 제한: ${r.rgnLmtBidLocplcJdgmBssNm}` : undefined } },
    fields: ["용역 입찰"],
  };
}

export const g2b: Collector = {
  id: "g2b",
  name: "나라장터",
  homepage: "https://www.g2b.go.kr",
  defaultKind: "service",
  async list(ctx) {
    const key = ctx.env.DATA_GO_KR_KEY;
    if (!key) { ctx.log("나라장터: DATA_GO_KR_KEY가 없어 건너뜀"); return []; }
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 864e5);
    const kws = [...new Set([...G2B_BASE_KEYWORDS, ...ctx.keywords.filter((k) => /[가-힣]/.test(k))])].slice(0, 24);
    const byNo = new Map<string, RawItem>();
    const nowStr = now.toISOString().slice(0, 10);
    for (const kw of kws) {
      const url = `${API}?ServiceKey=${encodeURIComponent(key)}&type=json&inqryDiv=1&inqryBgnDt=${ymd(from)}0000&inqryEndDt=${ymd(now)}2359&bidNtceNm=${encodeURIComponent(kw)}&numOfRows=100&pageNo=1`;
      const txt = await ctx.fetchText(url);
      if (!txt.trim().startsWith("{")) {
        const msg = /<returnAuthMsg>([^<]+)/.exec(txt)?.[1] ?? /<resultMsg>([^<]+)/.exec(txt)?.[1] ?? txt.slice(0, 80);
        throw new Error(`나라장터 API 오류: ${msg} (data.go.kr에서 '조달청_나라장터 입찰공고정보서비스' 활용 신청을 확인하세요)`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = JSON.parse(txt) as any;
      const items = j?.response?.body?.items;
      const rows = Array.isArray(items) ? items : items?.item ? [].concat(items.item) : [];
      let n = 0;
      for (const r of rows) {
        const it = g2bRowToItem(r, kw);
        if (!it || (it.deadline && it.deadline < nowStr)) continue;
        const no = `${r.bidNtceNo}-${r.bidNtceOrd ?? ""}`;
        const ex = byNo.get(no);
        if (ex) ex.keywords = [...new Set([...(ex.keywords ?? []), kw])];
        else { byNo.set(no, it); n++; }
      }
      if (n) ctx.log(`나라장터 '${kw}': ${n}건`);
    }
    return [...byNo.values()];
  },
};
