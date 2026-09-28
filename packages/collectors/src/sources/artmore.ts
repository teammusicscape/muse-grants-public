import * as cheerio from "cheerio";
import type { Collector, RawItem } from "../base";
import { absUrl, clean, deadlineFromPeriod, normDate } from "../util";

/** 아트모아 — 예술산업아카데미 정규·공개 과정 (교육 탭). 신청기간·교육기간·썸네일 제공 */
export const artmore: Collector = {
  id: "artmore",
  name: "아트모아",
  homepage: "https://www.artmore.kr",
  defaultKind: "edu",
  async list(ctx) {
    const out: RawItem[] = [];
    for (const path of ["/moaa_sub/lecture/expert_lect_list.do", "/moaa_sub/lecture/open_lect_list.do"]) {
      const base = `https://www.artmore.kr${path}`;
      const $ = cheerio.load(await ctx.fetchText(base));
      $("li.aca_card_box").each((_, li) => {
        const a = $(li).find("a").first();
        const lines = $(li).find(".active_name").map((_, x) => clean($(x).text())).get();
        const apply = lines.find((l) => l.startsWith("신청기간"))?.replace(/^신청기간\s*:\s*/, "");
        const edu = lines.find((l) => l.startsWith("교육기간"))?.replace(/^교육기간\s*:\s*/, "");
        const end = deadlineFromPeriod(apply);
        if (end && end < new Date().toISOString().slice(0, 10)) return;
        const mode = clean($(li).find("[class^=status_]").first().text());
        const img = $(li).find("img").first().attr("src");
        out.push({
          title: clean($(li).find(".aca_info_title").text()),
          org: "예술경영지원센터 (예술산업아카데미)",
          url: absUrl(a.attr("href") ?? path, base),
          applyStart: normDate(apply?.split("~")[0]), applyEnd: end, deadline: end,
          thumb: img ? absUrl(img, base) : undefined,
          details: { edu: { period: edu, mode: /온/.test(mode) && /오프/.test(mode) ? "혼합" : /온라인/.test(mode) ? "온라인" : "오프라인" } },
        });
      });
    }
    return out;
  },
};
