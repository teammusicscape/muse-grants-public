import * as cheerio from "cheerio";
import type { CollectContext, Collector, RawItem } from "../base";
import { addDays, todayISO, type Platform } from "@muse/core";
import { clean, normDate } from "../util";

/**
 * K-arts on the GO (한국국제문화교류진흥원) — 해외 우수 플랫폼(페스티벌·극장·미술관)에 초청받은 공연·전시 지원
 *  ① 공지사항의 "공모" 글 → 지원사업 공고
 *  ② 플랫폼 디렉토리 (공연 537 · 시각 331곳) → 참조 데이터: 해외 공고가 이 플랫폼이면 "K-GO 플랫폼" 표시
 * 2026-09-28 실제 페이지 구조 확인 (디렉토리는 POST /Platform/search JSON)
 */
const BASE = "https://www.k-go.or.kr";
const SKIP = /(결과|선정|발표|마감\s*안내|일정\s*안내|업데이트|신규\s*제안)/;

export function parseKgoNotices(html: string, since: string): RawItem[] {
  const $ = cheerio.load(html);
  const out: RawItem[] = [];
  $(".board_bd a[href^='/notice/']").each((_, a) => {
    const cat = clean($(a).find(".col2").text());
    const title = clean($(a).find(".col3").text()).replace(/\s+/g, " ");
    const posted = normDate($(a).find("span").first().text());
    if (cat !== "공모" || !title || SKIP.test(title)) return;
    // 목록에 마감일이 없어서(요강은 첨부 파일) 최근 게시된 공모만 가져옴
    if (!posted || posted < since) return;
    out.push({
      title, url: BASE + $(a).attr("href"), org: "한국국제문화교류진흥원", kind: "grant", postedAt: posted, overseas: true,
      summary: "해외 우수 플랫폼(페스티벌·극장·미술관)에 초청받은 공연·전시의 경비를 지원해요. 마감일·요강은 원문 첨부파일에서 확인하세요.",
    });
  });
  return out;
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/#/g, " ").split(/\s+/).filter(Boolean);

/** 플랫폼 디렉토리 전체 (공연·시각) */
export async function kgoPlatforms(ctx: CollectContext): Promise<Platform[]> {
  const out: Platform[] = [];
  for (const [category, label] of [["1", "공연"], ["2", "시각"]] as const) {
    for (let page = 1; page <= 30; page++) {
      const body = new URLSearchParams({ search: "", category, limit: "50", page: String(page), sort: "name", random_seed: "1", continent: "", country: "", city: "", isTour: "", kind: "", "genre[]": "0", overview: "N" });
      const txt = await ctx.fetchText(`${BASE}/Platform/search`, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded", "x-requested-with": "XMLHttpRequest", accept: "application/json" } });
      const j = JSON.parse(txt) as { item: Record<string, string | null>[]; total: number };
      for (const it of j.item) {
        out.push({
          id: `kgo-${category}-${(it.name_en || it.name || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").slice(0, 60)}`,
          source: "K-GO", field: label, name: clean(it.name ?? ""), nameEn: clean((it.name_en ?? "").split("\n")[0]),
          type: it.dvsn ?? undefined, genres: stripTags(it.gnr ?? ""), continent: it.continent ?? undefined,
          country: it.nation ?? undefined, city: it.city ?? undefined, homepage: it.homepage ?? undefined, tour: it.tour === "Y",
        });
      }
      if (j.item.length < 50) break;
    }
  }
  return out;
}

export const kgo: Collector = {
  id: "kgo",
  name: "K-GO",
  homepage: BASE,
  async list(ctx) {
    const since = addDays(todayISO(), -45);
    const got = parseKgoNotices(await ctx.fetchText(`${BASE}/notice`), since);
    ctx.log(`K-GO 공모 (최근 45일): ${got.length}건`);
    return got;
  },
};
