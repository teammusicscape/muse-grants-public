import * as cheerio from "cheerio";
import type { RawItem } from "./base";
import { absUrl, clean, deadlineFromPeriod, normDate } from "./util";

export interface BoardOptions {
  /** 공고 상세 링크만 고르는 조건 (예: /view\.do/) */
  link: RegExp;
  /** 행(row) 선택자. 기본: 표의 tr, 목록의 li */
  row?: string;
  /** 기관명이 들어 있는 칸 선택자 (선택) */
  org?: string;
  /** 제목에서 빼야 할 말머리 */
  stripPrefix?: RegExp;
}

/**
 * 대부분의 한국 공공기관 게시판(표 또는 목록형)에 쓰는 범용 파서.
 * 행마다 링크 1개를 찾고, 같은 행의 텍스트에서 날짜·기간을 뽑는다.
 */
export function parseBoard(html: string, baseUrl: string, o: BoardOptions): RawItem[] {
  const $ = cheerio.load(html);
  const rows = $(o.row ?? "tbody tr, ul li, .board-list li, .list li");
  const out: RawItem[] = [];
  const seen = new Set<string>();
  rows.each((_, el) => {
    const row = $(el);
    const a = row.find("a").filter((_, x) => {
      const h = $(x).attr("href") ?? "";
      const oc = $(x).attr("onclick") ?? "";
      return o.link.test(h) || o.link.test(oc);
    }).first();
    if (!a.length) return;
    let title = clean(a.attr("title") || a.text());
    if (o.stripPrefix) title = title.replace(o.stripPrefix, "").trim();
    if (title.length < 4) return;
    const href = a.attr("href") ?? "";
    const url = absUrl(href.startsWith("javascript") ? baseUrl : href, baseUrl);
    const text = clean(row.text());
    const periodMatch = /(\d{2,4}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2})\s*[~∼\-–]\s*(\d{2,4}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2})/.exec(text);
    const period = periodMatch?.[0];
    const dates = [...text.matchAll(/\d{2,4}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2}/g)].map((m) => normDate(m[0])!).filter(Boolean);
    const deadline = period ? deadlineFromPeriod(period) : dates.length > 1 ? dates[dates.length - 1] : undefined;
    const postedAt = period ? undefined : dates[0];
    const key = title + url;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      title, url, period, deadline, postedAt,
      org: o.org ? clean(row.find(o.org).first().text()) || undefined : undefined,
    });
  });
  return out;
}
