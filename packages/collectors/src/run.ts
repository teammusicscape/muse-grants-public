/**
 * 수집 실행기 — GitHub Actions에서 하루 2회 실행 (06:00, 18:00 KST)
 *   pnpm collect         → Supabase에 저장
 *   pnpm collect:dry     → 저장하지 않고 결과만 출력 (선택자 확인용)
 */
import { createClient } from "@supabase/supabase-js";
import { classifyKind, dedupeKey, extraTags, titleKey, todayISO, type NoticeKind } from "@muse/core";
import { COLLECTORS } from "./sources";
import { kgoPlatforms } from "./sources/kgo";
import { fetchJson, fetchText, hash } from "./util";
import type { CollectContext, RawItem } from "./base";

const DRY = process.argv.includes("--dry");
const DETAIL_VERSION = 2;
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const env = process.env;

interface Row {
  id: string; dedupe_key: string; kind: NoticeKind; title: string; org: string | null; sources: string[]; url: string;
  region: string | null; fields: string[]; tags: string[]; overseas: boolean; posted_at: string | null; deadline: string | null;
  deadline_label: string | null; summary: string | null; thumb: string | null; details: Record<string, unknown>; checked_at: string; updated_at: string;
}

function toRow(it: RawItem, sourceName: string, defaultKind?: NoticeKind, region?: string): Row {
  const kind = it.kind ?? defaultKind ?? classifyKind(it.title, sourceName);
  const tags = [...extraTags(it.title), ...(it.keywords ?? []).map((k) => `kw:${k}`)];
  const org = it.org ?? sourceName;
  const key = dedupeKey({ title: it.title, org, deadline: it.deadline ?? null });
  const details: Record<string, unknown> = { ...(it.details ?? {}) };
  if (it.applyStart || it.applyEnd) details.apply = { start: it.applyStart, end: it.applyEnd };
  if (it.applyUrl) details.applyUrl = it.applyUrl;
  if (it.targets?.length) details.targets = it.targets;
  if (it.files?.length) details.files = it.files;
  if (it.period && kind === "edu") details.edu = { ...(details.edu as object), period: it.period };
  return {
    id: hash(key), dedupe_key: key, kind, title: it.title, org, sources: [sourceName], url: it.url,
    region: it.region ?? region ?? null, fields: it.fields ?? [], tags, overseas: it.overseas ?? tags.includes("해외"),
    posted_at: it.postedAt ?? null, deadline: it.deadline ?? null, deadline_label: it.deadline ? null : "확인 필요",
    summary: it.summary ?? null, thumb: it.thumb ?? null, details, checked_at: todayISO(), updated_at: new Date().toISOString(),
  };
}

async function main() {
  const log = (m: string) => console.log(`[수집] ${m}`);
  const live = !DRY && !!env.SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY;
  const sb = live ? createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false }, db: { schema: env.SUPABASE_SCHEMA || "grants" } }) : null;

  // 사용자들이 설정에 등록한 키워드 모으기 (검색 가능한 사이트에서 이 키워드로도 검색)
  let keywords = (env.COLLECT_KEYWORDS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (sb) {
    const { data } = await sb.from("user_settings").select("keywords");
    data?.forEach((r) => (r.keywords?.include ?? []).forEach((k: string) => keywords.push(k)));
  }
  keywords = [...new Set(keywords)];
  log(`검색 키워드: ${keywords.join(", ") || "(없음)"}`);
  const ctx: CollectContext = { fetchText, fetchJson, env, log, keywords };
  const rawByKey = new Map<string, { it: RawItem; c: (typeof COLLECTORS)[number] }>();
  const rows = new Map<string, Row>();
  const errors: { source: string; error: string }[] = [];

  for (const c of COLLECTORS) {
    if (only && c.id !== only) continue;
    try {
      const items = await c.list(ctx);
      log(`${c.name}: ${items.length}건`);
      for (const it of items) {
        const r = toRow(it, c.name, c.defaultKind, c.region);
        rawByKey.set(r.dedupe_key, { it, c });
        const ex = rows.get(r.dedupe_key);
        if (ex) ex.sources = [...new Set([...ex.sources, ...r.sources])];
        else rows.set(r.dedupe_key, r);
      }
    } catch (e) {
      const msg = (e as Error).message;
      errors.push({ source: c.id, error: msg });
      log(`⚠️ ${c.name} 실패: ${msg}`);
    }
  }

  let list = [...rows.values()];

  // 모든 사용자가 삭제한 공고는 다시 수집하지 않음 (한 명이라도 남겨 둔 공고는 계속 갱신)
  if (sb) {
    const { count: users } = await sb.from("user_settings").select("user_id", { count: "exact", head: true });
    const { data: del } = await sb.from("user_notice_state").select("user_id, title_key").eq("deleted", true).not("title_key", "is", null);
    if (users && del?.length) {
      const by = new Map<string, Set<string>>();
      del.forEach((d) => by.set(d.title_key, (by.get(d.title_key) ?? new Set()).add(d.user_id)));
      const before = list.length;
      list = list.filter((r) => (by.get(titleKey({ title: r.title, org: r.org ?? "" }))?.size ?? 0) < users);
      if (before - list.length) log(`삭제한 공고 ${before - list.length}건은 다시 수집하지 않음`);
    }
  }

  // 새 공고만 상세 페이지 읽기 (접수기간·지역·요약 보강)
  const existingKeys = new Set<string>();
  if (sb) {
    const keys = list.map((r) => r.dedupe_key);
    for (let i = 0; i < keys.length; i += 200) {
      const { data } = await sb.from("notices").select("dedupe_key, details").in("dedupe_key", keys.slice(i, i + 200));
      // 상세를 이미 읽은 공고(_d)만 건너뜀 → 한 번에 다 못 읽은 공고는 다음 실행 때 이어서 읽음
      // _d: 상세 읽기 버전 (2 = 첨부파일까지) — 예전 버전으로 읽은 공고는 다시 읽어 첨부파일을 채움
      data?.forEach((d) => { if (Number((d.details as { _d?: number | boolean } | null)?._d) >= DETAIL_VERSION) existingKeys.add(d.dedupe_key); });
    }
  }
  let detailed = 0;
  const maxDetail = DRY ? 3 : 80;
  // 상세를 읽을 공고 고르기: 마감이 가까운 것부터 (한 번에 maxDetail건, 나머지는 다음 실행 때)
  const toDetail = new Set(list
    .filter((r) => rawByKey.get(r.dedupe_key)?.it.detail && !existingKeys.has(r.dedupe_key))
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"))
    .slice(0, maxDetail).map((r) => r.dedupe_key));
  list = await (async () => {
    const outList: Row[] = [];
    for (const r of list) {
      const src = rawByKey.get(r.dedupe_key);
      if (src?.it.detail && toDetail.has(r.dedupe_key)) {
        try {
          const more = await src.it.detail();
          detailed++;
          const merged = toRow({ ...src.it, ...Object.fromEntries(Object.entries(more).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0))) }, src.c.name, src.c.defaultKind, src.c.region);
          merged.sources = r.sources;
          merged.id = r.id; merged.dedupe_key = r.dedupe_key; // 키는 목록 기준으로 고정
          merged.details = { ...merged.details, _d: DETAIL_VERSION };
          outList.push(merged);
          continue;
        } catch (e) { log(`상세 읽기 실패: ${r.title.slice(0, 30)} — ${(e as Error).message}`); }
      }
      outList.push(r);
    }
    return outList;
  })();
  if (detailed) log(`새 공고 상세 ${detailed}건 읽음`);

  if (!sb) {
    console.table(list.slice(0, 40).map((r) => ({ 종류: r.kind, 제목: r.title.slice(0, 36), 기관: r.org, 마감: r.deadline, 접수: JSON.stringify((r.details as { apply?: unknown }).apply ?? ""), 키워드: r.tags.join(" ") })));
    log(`총 ${list.length}건 (저장 안 함${DRY ? ": --dry" : ": SUPABASE 환경변수 없음"})`);
    if (errors.length) process.exitCode = 1;
    return;
  }

  const { data: run } = await sb.from("collect_runs").insert({}).select("id").single();

  // 기존 공고와 출처·태그 합치기 (같은 공고가 아트누리·기관 사이트에 동시에 있을 때)
  const keys = list.map((r) => r.dedupe_key);
  const existing = new Map<string, { sources: string[]; tags: string[]; details: Record<string, unknown>; summary: string | null; region: string | null; fields: string[] }>();
  for (let i = 0; i < keys.length; i += 200) {
    const { data } = await sb.from("notices").select("dedupe_key, sources, tags, details, summary, region, fields").in("dedupe_key", keys.slice(i, i + 200));
    data?.forEach((d) => existing.set(d.dedupe_key, d));
  }
  const added = list.filter((r) => !existing.has(r.dedupe_key)).length;
  list.forEach((r) => {
    const ex = existing.get(r.dedupe_key);
    if (!ex) return;
    r.sources = [...new Set([...ex.sources, ...r.sources])];
    r.tags = [...new Set([...(ex.tags ?? []), ...r.tags])];
    r.details = { ...(ex.details ?? {}), ...r.details };   // 이전에 읽은 상세 정보 유지
    r.summary = r.summary ?? ex.summary;
    r.region = r.region ?? ex.region;
    r.fields = r.fields.length ? r.fields : ex.fields ?? [];
  });

  for (let i = 0; i < list.length; i += 200) {
    const { error } = await sb.from("notices").upsert(list.slice(i, i + 200), { onConflict: "dedupe_key" });
    if (error) errors.push({ source: "db", error: error.message });
  }
  // K-GO 해외 우수 플랫폼 디렉토리 (참조 데이터) — 월요일 아침 또는 비어 있을 때만 갱신
  if (!only || only === "kgo") {
    const { count } = await sb.from("platforms").select("id", { count: "exact", head: true });
    if (!count || new Date().getUTCDay() === 0 || only === "kgo") {
      try {
        const ps = await kgoPlatforms(ctx);
        const uniq = [...new Map(ps.map((p) => [p.id, p])).values()];
        for (let i = 0; i < uniq.length; i += 300) {
          const { error } = await sb.from("platforms").upsert(uniq.slice(i, i + 300).map((p) => ({
            id: p.id, source: p.source, field: p.field, name: p.name, name_en: p.nameEn ?? null, type: p.type ?? null, genres: p.genres ?? [],
            continent: p.continent ?? null, country: p.country ?? null, city: p.city ?? null, homepage: p.homepage ?? null, tour: !!p.tour, updated_at: new Date().toISOString(),
          })), { onConflict: "id" });
          if (error) errors.push({ source: "platforms", error: error.message });
        }
        log(`K-GO 플랫폼 디렉토리: ${uniq.length}곳 갱신`);
      } catch (e) { errors.push({ source: "kgo-platforms", error: (e as Error).message }); log(`⚠️ K-GO 플랫폼 디렉토리 실패: ${(e as Error).message}`); }
    }
  }

  const { data: cleaned } = await sb.rpc("cleanup_old_notices");
  await sb.from("collect_runs").update({ finished_at: new Date().toISOString(), found: list.length, added, errors }).eq("id", run?.id);
  log(`저장 완료: ${list.length}건 (새 공고 ${added}건, 정리 ${cleaned ?? 0}건, 오류 ${errors.length}건)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
