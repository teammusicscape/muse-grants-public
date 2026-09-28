import * as cheerio from "cheerio";
import type { Collector, RawItem } from "../base";
import { clean, deadlineFromPeriod, normDate } from "../util";

/**
 * 아트누리 — 여러 기관의 예술지원사업을 모아둔 통합 플랫폼 (1순위)
 * 목록: search.do (서버 렌더링, 카드형 li) / 상세: view.do?docid=&source=&seNo=
 * 2026-09-24 실제 페이지 구조 확인
 */
const BASE = "https://artnuri.or.kr/crawler/info/";

function parseList(html: string, keyword?: string): RawItem[] {
  const $ = cheerio.load(html);
  const out: RawItem[] = [];
  const seen = new Set<string>();
  $("a.title").each((_, a) => {
    const oc = $(a).attr("onclick") ?? "";
    const m = /goView\('([^']+)',\s*'([^']*)',\s*'([^']*)'\)/.exec(oc);
    if (!m) return;
    const [, docid, source, seNo] = m;
    if (seen.has(docid)) return;
    seen.add(docid);
    const li = $(a).closest("li");
    const state = clean(li.find("[class*=state]").first().text());
    if (/마감/.test(state)) return;
    const info: Record<string, string> = {};
    li.find("ul.txt > li").each((_, x) => { info[clean($(x).find("strong").text())] = clean($(x).find("em").last().text()); });
    const url = `${BASE}view.do?docid=${encodeURIComponent(docid)}&source=${encodeURIComponent(source)}&seNo=${seNo}&key=2301170002`;
    out.push({
      title: clean($(a).text()),
      url,
      org: source,
      deadline: normDate(info["마감일"]),
      targets: info["지원대상"] ? info["지원대상"].split(/[,\s]+/).filter(Boolean) : undefined,
      keywords: keyword ? [keyword] : undefined,
      detail: async () => ({}),
    });
  });
  return out;
}

function parseDetail(html: string): Partial<RawItem> {
  const $ = cheerio.load(html);
  const info: Record<string, string> = {};
  let applyUrl: string | undefined;
  $("ul.info-txt > li").each((_, li) => {
    const k = clean($(li).children("strong").text());
    const v = $(li).find("ul.view-list li").map((_, x) => clean($(x).text())).get().join(", ") || clean($(li).children("em").text());
    info[k] = v;
    const link = $(li).find("a.site-link").attr("href");
    if (link) applyUrl = link;
  });
  // 첨부파일 (공고문·신청서 양식) — fileDown.do는 로그인 없이 받을 수 있음
  const files: NonNullable<RawItem["files"]> = [];
  $("ul.file-list > li").each((_, li) => {
    const a = $(li).find("a[href*='fileDown']").first();
    const href = a.attr("href");
    if (!href) return;
    const v = /openViewer\('([^']*)',\s*'([^']*)'/.exec($(li).find("button[onclick*=openViewer]").attr("onclick") ?? "");
    files.push({ name: clean(a.text()), url: new URL(href, "https://artnuri.or.kr").href, preview: v ? { seNo: v[1], fileSn: v[2] } : undefined });
  });
  const period = info["신청기간"];
  const [start] = (period ?? "").split("~").map((x) => normDate(x));
  const body = clean($(".sub-content-wrap").text() || $("body").text());
  const summaryStart = body.indexOf("미리보기 새창");
  const summary = clean(body.slice(summaryStart > 0 ? body.lastIndexOf("미리보기 새창") + 7 : 0)).slice(0, 220);
  return {
    applyStart: start,
    applyEnd: deadlineFromPeriod(period),
    deadline: deadlineFromPeriod(period),
    region: info["지역"]?.split(",")[0] || undefined,
    fields: [info["사업유형"], info["분야"]].filter(Boolean).flatMap((x) => x.split(", ")).filter((x) => x !== "전체"),
    applyUrl,
    files: files.length ? files : undefined,
    summary: summary || undefined,
  };
}

export const artnuri: Collector = {
  id: "artnuri",
  name: "아트누리",
  homepage: "https://artnuri.or.kr",
  async list(ctx) {
    const all = new Map<string, RawItem>();
    const add = (items: RawItem[]) => items.forEach((it) => {
      const ex = all.get(it.url);
      if (ex) ex.keywords = [...new Set([...(ex.keywords ?? []), ...(it.keywords ?? [])])];
      else all.set(it.url, it);
    });
    // ① 최신 공고 4쪽 (최근 등록순)
    for (let page = 1; page <= 4; page++) {
      const got = parseList(await ctx.fetchText(`${BASE}search.do?key=2301170002&recordCountPerPage=20&pageIndex=${page}`));
      add(got);
      if (got.length === 0) break;
    }
    ctx.log(`아트누리 최신 목록: ${all.size}건`);
    // ② 내 키워드로 검색 (키워드당 1쪽)
    // 한글 사이트라 한글 키워드만 검색 (영문 키워드는 해외 공고 매칭용)
    for (const kw of ctx.keywords.filter((k) => /[가-힣]/.test(k)).slice(0, 20)) {
      const got = parseList(await ctx.fetchText(`${BASE}search.do?key=2301170002&recordCountPerPage=20&pageIndex=1&sw=${encodeURIComponent(kw)}`), kw);
      add(got);
      ctx.log(`아트누리 '${kw}' 검색: ${got.length}건`);
    }
    // ③ 레지던시·입주작가·해외 파견 공모 (ARKO 등 국내 기관이 올리는 해외 레지던시 포함) (키워드 설정과 상관없이 항상)
    for (const kw of ["레지던시", "레지던스", "입주작가", "Residency", "해외 파견", "국제교류"]) {
      const got = parseList(await ctx.fetchText(`${BASE}search.do?key=2301170002&recordCountPerPage=20&pageIndex=1&sw=${encodeURIComponent(kw)}`), ctx.keywords.includes(kw) ? kw : undefined);
      add(got);
      ctx.log(`아트누리 '${kw}' 검색: ${got.length}건`);
    }
    // 상세 페이지는 새 공고일 때만 읽음
    for (const it of all.values()) it.detail = async () => parseDetail(await ctx.fetchText(it.url));
    return [...all.values()];
  },
};
