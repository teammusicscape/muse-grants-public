import * as cheerio from "cheerio";
import type { Collector, RawItem } from "../base";
import { clean, deadlineFromTitle, normDate } from "../util";

/**
 * 한국국제문화교류진흥원(KOFICE) — 사업공모 · 입찰공고 게시판 ("진행" 상태만)
 * 목록: /www/bbs/list.do?mnucd=169&scBbsMngSn=7 (사업공모), mnucd=171&scBbsMngSn=8 (입찰공고)
 * 상세: /www/bbs/view.do?bbsSn=&scBbsMngSn=&mnucd= — 첨부파일 /file/download.do?atchFileSn=… (로그인 없이 받기 가능)
 * 2026-09-29 실제 페이지 구조 확인
 */
const BASE = "https://www.kofice.or.kr";
const BOARDS = [
  { mnucd: "169", bbs: "7", kind: undefined, label: "사업공모" },
  { mnucd: "171", bbs: "8", kind: "service" as const, label: "입찰공고" },
];

export function parseKoficeList(html: string, b: (typeof BOARDS)[number]): RawItem[] {
  const $ = cheerio.load(html);
  const out: RawItem[] = [];
  $("tbody tr").each((_, tr) => {
    const a = $(tr).find("td.title a").first();
    const id = /goView\((\d+)/.exec(a.attr("onclick") ?? "")?.[1];
    if (!id) return;
    const state = clean($(tr).find("[data-th='상태']").text());
    if (!/진행/.test(state)) return;
    const title = clean(a.text());
    const posted = normDate($(tr).find("[data-th='게시일']").text());
    out.push({
      title, url: `${BASE}/www/bbs/view.do?bbsSn=${id}&scBbsMngSn=${b.bbs}&mnucd=${b.mnucd}`, org: "한국국제문화교류진흥원",
      kind: b.kind, postedAt: posted, deadline: deadlineFromTitle(title, posted), fields: [b.label],
    });
  });
  return out;
}

export function parseKoficeDetail(html: string): Partial<RawItem> {
  const $ = cheerio.load(html);
  const files: NonNullable<RawItem["files"]> = [];
  $(".board-view-file a[href*='/file/download.do']").each((_, a) => {
    const name = clean($(a).text()).replace(/\s*\[\s*[\d.,]+\s*[KMG]?B\s*\]\s*$/i, "");
    files.push({ name, url: new URL($(a).attr("href")!, BASE).href });
  });
  const text = clean($(".board-view-content").text());
  return { files: files.length ? files : undefined, summary: text ? text.slice(0, 220) : undefined };
}

export const kofice: Collector = {
  id: "kofice",
  name: "국제문화교류진흥원",
  homepage: BASE,
  async list(ctx) {
    const all: RawItem[] = [];
    for (const b of BOARDS) {
      const got = parseKoficeList(await ctx.fetchText(`${BASE}/www/bbs/list.do?mnucd=${b.mnucd}&scBbsMngSn=${b.bbs}`), b);
      ctx.log(`KOFICE ${b.label} (진행 중): ${got.length}건`);
      all.push(...got);
    }
    for (const it of all) it.detail = async () => parseKoficeDetail(await ctx.fetchText(it.url));
    return all;
  },
};
