import type { Collector, RawItem } from "../base";
import { todayISO } from "@muse/core";
import { ARTS_RE } from "../util";

/**
 * 보탬e (행정안전부 지방보조금관리시스템) — 전국 지자체 보조사업 공모
 * 목록: POST /sp/pbcnBizSrchInq (JSON) / 상세: /sp/pbcnBizCntt?id=&fyr=
 * 모든 분야가 섞여 있어서 문화예술 관련 공모(+내 키워드)만 가져옴. 지자체 공모는 대개 관내 주소·소재지 조건이 있음 → 지역 조건 배지로 표시
 * 2026-09-29 실제 요청 형식 확인
 */
const BASE = "https://www.losims.go.kr";

interface Row { pbacNo: string; pbacNm: string; allLafNm: string; fyr: string; pbacBgngYmd?: string; pbacEndYmd?: string; pbcnAplyRcptBgngYmd?: string; pbcnAplyRcptEndYmd?: string; comDtsCdNm?: string }

export function botameRowsToItems(rows: Row[], keywords: string[], today = todayISO()): RawItem[] {
  const kws = keywords.filter((k) => /[가-힣]/.test(k));
  return rows.filter((r) => {
    const end = r.pbcnAplyRcptEndYmd || r.pbacEndYmd;
    if (end && end < today) return false;
    return ARTS_RE.test(r.pbacNm) || kws.some((k) => r.pbacNm.includes(k));
  }).map((r) => {
    const [sido, ...rest] = (r.allLafNm ?? "").split(/\s+/);
    return {
      title: r.pbacNm.trim(),
      url: `${BASE}/sp/pbcnBizCntt?id=${r.pbacNo}&fyr=${r.fyr}`,
      org: r.allLafNm,
      region: sido,
      kind: "grant" as const,
      postedAt: r.pbacBgngYmd,
      applyStart: r.pbcnAplyRcptBgngYmd,
      applyEnd: r.pbcnAplyRcptEndYmd,
      deadline: r.pbcnAplyRcptEndYmd || r.pbacEndYmd,
      summary: `${r.allLafNm} 지방보조사업 공모${rest.length ? "" : " (광역)"} — 신청은 보탬e(회원가입·단체 인증 필요)에서 해요.`,
      fields: ["지방보조금"],
    };
  });
}

export const botame: Collector = {
  id: "botame",
  name: "보탬e",
  homepage: `${BASE}/sp/pbcnBizSrch`,
  async list(ctx) {
    const y = new Date().getFullYear();
    const years = new Date().getMonth() >= 10 ? [y, y + 1] : [y];
    const rows: Row[] = [];
    for (const fyr of years) {
      for (let page = 1; page <= 5; page++) {
        const txt = await ctx.fetchText(`${BASE}/sp/pbcnBizSrchInq`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json", "x-requested-with": "XMLHttpRequest" },
          body: JSON.stringify({ curPage: page, pageSize: 100, pbacNm: "", lafWa: "A", lafPry: "A", fyr: String(fyr), sPbacDate: "", ePbacDate: "", sAplyDate: "", eAplyDate: "" }),
        });
        const j = JSON.parse(txt) as { prtlPbcnBizSrchInqInfoDao?: Row[]; input?: { totCnt?: number } };
        const got = j.prtlPbcnBizSrchInqInfoDao ?? [];
        rows.push(...got);
        if (got.length < 100 || rows.length >= (j.input?.totCnt ?? 0)) break;
      }
    }
    const items = botameRowsToItems(rows, ctx.keywords);
    ctx.log(`보탬e 공모 ${rows.length}건 중 문화예술·내 키워드 ${items.length}건`);
    return items;
  },
};
