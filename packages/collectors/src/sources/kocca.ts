import * as cheerio from "cheerio";
import type { Collector, RawItem } from "../base";
import { clean, normDate } from "../util";

/**
 * 한국콘텐츠진흥원(KOCCA) — 알림마당 › 지원공고 (접수 중인 공고만 보이는 기본 목록)
 * 목록: /kocca/pims/list.do?menuNo=204104&pageIndex=N / 상세: /kocca/pims/view.do?intcNo=…&menuNo=204104
 * 첨부파일은 팝업(공고관련자료확인)이라 원문에서 받기
 * 2026-09-29 실제 페이지 구조 확인
 */
const BASE = "https://www.kocca.kr";

export function parseKoccaList(html: string): RawItem[] {
  const $ = cheerio.load(html);
  const out: RawItem[] = [];
  $("tbody tr").each((_, tr) => {
    const a = $(tr).find("td[data-label='제목'] a, td.AlignLeft a").first();
    const href = a.attr("href");
    if (!href || !/intcNo=/.test(href)) return;
    const intcNo = /intcNo=([^&]+)/.exec(href)![1];
    const cat = clean($(tr).find("td[data-label='구분']").text());
    const period = clean($(tr).find("td[data-label='접수기간']").text());
    const [s, e] = period.split("~").map((x) => normDate(x));
    out.push({
      title: clean(a.text()),
      url: `${BASE}/kocca/pims/view.do?intcNo=${intcNo}&menuNo=204104`,
      org: "한국콘텐츠진흥원",
      postedAt: normDate($(tr).find("td[data-label='공고일']").text()),
      applyStart: s, applyEnd: e, deadline: e,
      fields: cat ? [cat] : [],
    });
  });
  return out;
}

export function parseKoccaDetail(html: string): Partial<RawItem> {
  const $ = cheerio.load(html);
  const text = clean($(".board_view01 .board_cont").text());
  return { summary: text ? text.slice(0, 240) : undefined };
}

export const kocca: Collector = {
  id: "kocca",
  name: "한국콘텐츠진흥원",
  homepage: `${BASE}/kocca/pims/list.do?menuNo=204104`,
  async list(ctx) {
    const all = new Map<string, RawItem>();
    for (let page = 1; page <= 4; page++) {
      const got = parseKoccaList(await ctx.fetchText(`${BASE}/kocca/pims/list.do?menuNo=204104&pageIndex=${page}`));
      const before = all.size;
      got.forEach((it) => all.set(it.url, it));
      if (all.size === before || got.length < 10) break;
    }
    const today = new Date().toISOString().slice(0, 10);
    const items = [...all.values()].filter((it) => !it.deadline || it.deadline >= today);
    for (const it of items) it.detail = async () => parseKoccaDetail(await ctx.fetchText(it.url));
    ctx.log(`콘진원 지원공고 (접수 중): ${items.length}건`);
    return items;
  },
};
