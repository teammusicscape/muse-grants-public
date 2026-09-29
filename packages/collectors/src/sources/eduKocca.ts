import * as cheerio from "cheerio";
import type { Collector, RawItem } from "../base";
import { clean, normDate } from "../util";

/**
 * 에듀코카 (한국콘텐츠진흥원 콘텐츠 교육) — 참여마당 › 교육모집·신청 ("진행" 카드만)
 * 목록: POST /edu/bbs/B0000048/list.do?menuNo=500203 (op3=2) / 상세: /edu/bbs/B0000048/view.do?nttId=…
 * 늘 열려 있는 온라인 강좌는 공고가 아니라서 제외하고, 모집 기간이 있는 교육(아카데미·워크숍·클래스)만
 * 2026-09-29 실제 페이지 구조 확인
 */
const BASE = "https://edu.kocca.kr";

export function parseEduKoccaList(html: string): RawItem[] {
  const $ = cheerio.load(html);
  const out: RawItem[] = [];
  const seen = new Set<string>();
  $("a.event_card").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    const id = /nttId=(\d+)/.exec(href)?.[1];
    if (!id || seen.has(id)) return;
    seen.add(id);
    const state = clean($(a).find("p[class^='date_tag']").text());
    if (state && !/진행/.test(state)) return;
    const [s, e] = $(a).find("p.event_date span").map((_, x) => normDate($(x).text())).get();
    const img = $(a).find("img").attr("src");
    out.push({
      title: clean($(a).find("h3").text()),
      url: `${BASE}/edu/bbs/B0000048/view.do?nttId=${id}&menuNo=500203&opt=2`,
      org: "한국콘텐츠진흥원 (에듀코카)",
      kind: "edu",
      applyStart: s, applyEnd: e, deadline: e,
      thumb: img ? new URL(img, BASE).href : undefined,
      fields: ["콘텐츠 교육"],
    });
  });
  return out;
}

export function parseEduKoccaDetail(html: string): Partial<RawItem> {
  const $ = cheerio.load(html);
  const text = clean($(".contents_view_area").text());
  return { summary: text ? text.slice(0, 240) : undefined };
}

export const eduKocca: Collector = {
  id: "edukocca",
  name: "에듀코카",
  homepage: `${BASE}/edu/bbs/B0000048/list.do?menuNo=500203`,
  defaultKind: "edu",
  async list(ctx) {
    const html = await ctx.fetchText(`${BASE}/edu/bbs/B0000048/list.do?menuNo=500203`, {
      method: "POST", body: new URLSearchParams({ op3: "2" }), headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    const today = new Date().toISOString().slice(0, 10);
    const items = parseEduKoccaList(html).filter((it) => !it.deadline || it.deadline >= today);
    for (const it of items) it.detail = async () => parseEduKoccaDetail(await ctx.fetchText(it.url));
    ctx.log(`에듀코카 교육모집 (진행 중): ${items.length}건`);
    return items;
  },
};
