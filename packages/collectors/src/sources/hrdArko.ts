import * as cheerio from "cheerio";
import type { Collector, RawItem } from "../base";
import { clean, normDate } from "../util";

/** 문화예술, 내일 — 아르코 교육 신청 시스템 (교육 탭). "접수중"인 과정만 */
export const hrdArko: Collector = {
  id: "hrd-arko",
  name: "문화예술 내일",
  homepage: "https://hrd.arko.or.kr",
  defaultKind: "edu",
  async list(ctx) {
    const $ = cheerio.load(await ctx.fetchText("https://hrd.arko.or.kr/course/active/master/list.do"));
    const out: RawItem[] = [];
    $("tbody tr").each((_, tr) => {
      const td = $(tr).find("td");
      if (td.length < 4) return;
      const status = clean(td.eq(3).text());
      if (!/접수중|모집중/.test(status)) return;
      const a = td.eq(0).find("a");
      const m = /courseMasterSeq'\s*:\s*'(\d+)'.*courseActiveSeq'\s*:\s*'(\d+)'/.exec(a.attr("onclick") ?? "");
      const period = clean(td.eq(1).text());
      const [s, e] = period.split("~").map((x) => normDate(x));
      const mode = clean(td.eq(2).text());
      out.push({
        title: clean(a.text()), org: "한국문화예술위원회",
        url: m ? `https://hrd.arko.or.kr/course/active/detail.do?courseMasterSeq=${m[1]}&courseActiveSeq=${m[2]}` : "https://hrd.arko.or.kr/course/active/master/list.do",
        period,
        details: { edu: { period: s && e ? `${s} ~ ${e}` : period, mode: /온라인/.test(mode) && /오프/.test(mode) ? "혼합" : /온라인/.test(mode) ? "온라인" : "오프라인" } },
      });
    });
    return out;
  },
};
