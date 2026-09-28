import type { Collector, RawItem } from "../base";
import { normDate } from "../util";

/**
 * K-Startup 사업공고 — 공공데이터포털 공식 API (창업진흥원)
 * 필요: DATA_GO_KR_KEY (data.go.kr에서 "K-Startup 사업공고" 활용 신청 후 발급)
 * ⚠️ 응답 필드 이름은 첫 실행 때 --dry 로 확인하세요.
 */
export const kstartup: Collector = {
  id: "kstartup",
  name: "K-Startup",
  homepage: "https://www.k-startup.go.kr",
  defaultKind: "grant",
  async list(ctx) {
    const key = ctx.env.DATA_GO_KR_KEY;
    if (!key) { ctx.log("K-Startup: DATA_GO_KR_KEY가 없어 건너뜀"); return []; }
    const url = `https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?serviceKey=${encodeURIComponent(key)}&page=1&perPage=100&returnType=json&cond[rcrt_prgs_yn::EQ]=Y`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j = await ctx.fetchJson<any>(url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = j?.data ?? j?.response?.body?.items ?? [];
    return rows.map((r): RawItem => ({
      title: r.biz_pbanc_nm ?? r.pbanc_nm ?? r.title,
      url: r.detl_pg_url ?? r.biz_gdnc_url ?? "https://www.k-startup.go.kr",
      org: r.pbanc_ntrp_nm ?? r.sprv_inst ?? "창업진흥원",
      postedAt: normDate(r.pbanc_rcpt_bgng_dt),
      deadline: normDate(r.pbanc_rcpt_end_dt),
      region: r.supt_regin ?? undefined,
      summary: r.pbanc_ctnt ? String(r.pbanc_ctnt).slice(0, 200) : undefined,
    })).filter((x) => x.title);
  },
};
