import * as cheerio from "cheerio";
import type { Collector, RawItem } from "../base";
import { clean, normDate } from "../util";

/**
 * 예술경영지원센터 공지사항 — 모집·공모 글만 (결과 발표 등은 제외)
 * 목록에는 게시일만 있어서 마감일은 제목의 "~9.20" 표기에서 추정
 */
const SKIP = /(결과|선정|발표|합격|취소|변경\s*안내|연기|정정)/;
const KEEP = /(모집|공모|지원|참가|신청|교육|아카데미|신청자|접수)/;

function deadlineFromTitle(t: string, posted?: string): string | undefined {
  const m = /~\s*(\d{1,2})[./](\d{1,2})/.exec(t);
  if (!m) return undefined;
  const y = posted ? +posted.slice(0, 4) : new Date().getFullYear();
  const mm = +m[1], dd = +m[2];
  const py = posted ? +posted.slice(5, 7) : 1;
  const year = mm < py - 6 ? y + 1 : y;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export const gokams: Collector = {
  id: "gokams",
  name: "예술경영지원센터",
  homepage: "https://www.gokams.or.kr",
  async list(ctx) {
    const out: RawItem[] = [];
    for (let page = 1; page <= 2; page++) {
      const url = `https://www.gokams.or.kr/01_news/notice_list.aspx?page=${page}`;
      const $ = cheerio.load(await ctx.fetchText(url));
      $("tr").each((_, tr) => {
        const a = $(tr).find('a[href*="notice_view"]').first();
        if (!a.length) return;
        const title = clean(a.text());
        if (!KEEP.test(title) || SKIP.test(title)) return;
        const idx = /Idx=(\d+)/.exec(a.attr("href") ?? "")?.[1];
        const posted = normDate($(tr).find("td").filter((_, td) => /^\d{4}-\d{2}-\d{2}$/.test(clean($(td).text()))).first().text());
        const deadline = deadlineFromTitle(title, posted);
        out.push({
          title, org: "예술경영지원센터", url: `https://www.gokams.or.kr/01_news/notice_view.aspx?Idx=${idx}`,
          postedAt: posted, deadline, applyEnd: deadline,
        });
      });
    }
    // 같은 글이 공지(상단 고정)와 목록에 두 번 나올 수 있음
    return [...new Map(out.map((x) => [x.url, x])).values()];
  },
};
