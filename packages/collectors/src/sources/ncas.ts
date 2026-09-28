import * as cheerio from "cheerio";
import type { Collector, RawItem } from "../base";
import { clean, normDate } from "../util";

/**
 * NCAS 국가문화예술지원시스템 — 메인 화면의 "진행중인/전체 지원사업" 표 (접수 시각까지 제공)
 * 2026-09-24 실제 페이지 구조 확인
 */
function dt(s: string): string | undefined {
  const d = normDate(s);
  const t = /(\d{1,2}:\d{2})/.exec(s)?.[1];
  return d ? (t ? `${d} ${t.padStart(5, "0")}` : d) : undefined;
}

export const ncas: Collector = {
  id: "ncas",
  name: "NCAS",
  homepage: "https://www.ncas.or.kr",
  defaultKind: "grant",
  async list(ctx) {
    const html = await ctx.fetchText("https://www.ncas.or.kr/");
    const $ = cheerio.load(html);
    const out = new Map<string, RawItem>();
    $("div.tab__cont tbody tr").each((_, tr) => {
      const td = $(tr).find("td");
      if (td.length < 6) return;
      let status = "";
      try { status = JSON.parse($(tr).attr("data-item") ?? "{}").prgsStatus ?? ""; } catch { /* noop */ }
      if (/마감|종료/.test(status)) return;
      const org = clean(td.eq(0).text());
      const title = clean(td.eq(1).text());
      const start = dt(clean(td.eq(2).text()));
      const end = dt(clean(td.eq(3).text()).replace(/\(D-?\d+\)/, ""));
      const oc = td.eq(6).find("button").attr("onclick") ?? "";
      const link = /window\.open\('([^']+)'/.exec(oc)?.[1];
      if (!title || out.has(title + org)) return;
      out.set(title + org, {
        title, org, url: link ?? "https://www.ncas.or.kr/", applyUrl: "https://www.ncas.or.kr/",
        applyStart: start, applyEnd: end, deadline: end?.slice(0, 10),
        targets: clean(td.eq(4).text()).split(/[,\s]+/).filter(Boolean),
        fields: clean(td.eq(5).text()).split(/[,\s]+/).filter(Boolean),
      });
    });
    return [...out.values()];
  },
};
