import * as cheerio from "cheerio";
import type { Collector, RawItem } from "../base";
import { clean, normDate } from "../util";
import { todayISO } from "@muse/core";

/**
 * 아트누리 › 해외레지던스 — 전 세계 레지던시 공모(Res Artis open calls)를 아트누리가 모아 보여주는 목록
 * 목록: /residence/crawler/list.do (sc_wDateS=오늘 → 마감 안 된 것만) / 상세: view.do?sn=
 * 2026-09-28 실제 페이지 구조 확인
 */
const BASE = "https://artnuri.or.kr/residence/crawler/";
const KEY = "2409100006";

export function parseResidenceList(html: string): RawItem[] {
  const $ = cheerio.load(html);
  const out: RawItem[] = [];
  $("a[onclick^=goView]").each((_, a) => {
    const sn = /goView\('(\d+)'\)/.exec($(a).attr("onclick") ?? "")?.[1];
    if (!sn) return;
    const title = clean($(a).find("strong").first().text());
    if (!title) return;
    const info: Record<string, string> = {};
    $(a).find(".bottom span").each((_, sp) => {
      const k = clean($(sp).find("em").text());
      if (k) info[k] = clean($(sp).text().replace(k, ""));
    });
    const country = info["Country"] && info["Country"] !== "empty" ? info["Country"] : undefined;
    const img = $(a).find("img").attr("src");
    out.push({
      title,
      url: `${BASE}view.do?key=${KEY}&sn=${sn}`,
      org: country ? `해외 · ${country}` : "해외 레지던시",
      kind: "residency",
      overseas: true,
      region: country,
      deadline: normDate(info["Deadline"]),
      applyEnd: normDate(info["Deadline"]),
      thumb: img ? `https://artnuri.or.kr${img.replace(/&amp;/g, "&")}` : undefined,
      details: { residency: { country } },
    });
  });
  return out;
}

export function parseResidenceDetail(html: string): Partial<RawItem> {
  const $ = cheerio.load(html);
  const info: Record<string, string> = {};
  let original: string | undefined;
  $(".supt-det ul.info-txt > li").each((_, li) => {
    const k = clean($(li).children("strong").text());
    info[k] = clean($(li).children("em").text());
    const href = $(li).find("a[href^=http]").attr("href");
    if (href) original = href;
  });
  const summary = clean($(".supt-content p").map((_, p) => $(p).text()).get().join(" ")).slice(0, 300);
  const country = info["Location"] || undefined;
  return {
    applyUrl: original,
    summary: summary || undefined,
    details: { residency: { country, start: normDate(info["Residency starts"]), end: normDate(info["Residency ends"]) } },
  };
}

export const artnuriResidence: Collector = {
  id: "artnuri-residence",
  name: "해외레지던스",
  homepage: `${BASE}list.do?key=${KEY}`,
  defaultKind: "residency",
  async list(ctx) {
    const all = new Map<string, RawItem>();
    const today = todayISO();
    for (let page = 1; page <= 8; page++) {
      const got = parseResidenceList(await ctx.fetchText(`${BASE}list.do?key=${KEY}&pageIndex=${page}&recordCountPerPage=30&orderBy=regYmd%20desc&sc_wDateS=${today}&sc_wDateE=2099-12-31`));
      got.forEach((it) => all.set(it.url, it));
      if (got.length < 30) break;
    }
    for (const it of all.values()) it.detail = async () => {
      const d = parseResidenceDetail(await ctx.fetchText(it.url));
      return { ...d, details: { residency: { ...it.details?.residency, ...Object.fromEntries(Object.entries(d.details?.residency ?? {}).filter(([, v]) => v)) } } };
    };
    return [...all.values()];
  },
};
