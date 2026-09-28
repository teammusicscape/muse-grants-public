import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Notice } from "@muse/core";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** 환경변수가 없으면 null → 데모 모드 */
/** 공고 앱 데이터는 "grants" 스키마에 있음 (MUSE OS와 같은 프로젝트를 써도 섞이지 않게) */
export const DB_SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "grants";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: SupabaseClient<any, any, any> | null = url && key ? createClient(url, key, { db: { schema: DB_SCHEMA } }) : null;
export const isLive = !!supabase;

/** DB 행 → Notice */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToNotice(r: any): Notice {
  const d = r.details ?? {};
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    org: r.org ?? "",
    sources: r.sources ?? [],
    url: r.url,
    region: r.region ?? undefined,
    fields: r.fields ?? [],
    tags: r.tags ?? [],
    overseas: r.overseas ?? false,
    postedAt: r.posted_at ?? undefined,
    deadline: r.deadline ?? null,
    deadlineLabel: r.deadline_label ?? undefined,
    lastYear: r.last_year ?? undefined,
    summary: r.summary ?? undefined,
    thumb: r.thumb ?? undefined,
    needsReview: r.needs_review ?? false,
    manual: !!r.created_by,
    checkedAt: r.checked_at,
    applyStart: d.apply?.start ?? undefined,
    applyEnd: d.apply?.end ?? undefined,
    applyUrl: d.applyUrl ?? undefined,
    targets: d.targets ?? undefined,
    files: Array.isArray(d.files) ? d.files : undefined,
    grant: d.grant,
    service: d.service,
    edu: d.edu,
    venue: d.venue,
    residency: d.residency,
    analysis: r.analysis ?? undefined,
  };
}
