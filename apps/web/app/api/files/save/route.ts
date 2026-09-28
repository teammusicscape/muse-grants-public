import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { storageKey, typeOf } from "@/lib/fileTypes";

/**
 * 공고 첨부파일을 "내 보관함"(Supabase Storage)에 복사
 * - 브라우저는 다른 사이트 파일을 직접 가져올 수 없어서(CORS) 서버가 대신 받아 올림
 * - 로그인한 사용자 본인의 권한(토큰)으로 올리므로 비밀 키(service role)가 필요 없음
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX = 30 * 1024 * 1024;
/** 공공·문화기관 사이트만 허용 (아무 주소나 대신 받아 주는 통로가 되지 않도록) */
const ALLOW = /(^|\.)(or\.kr|go\.kr|re\.kr|ac\.kr|kr)$/i;
const UA = "Mozilla/5.0 (compatible; MUSE-Grants/0.5; saving an attachment for a signed-in user)";

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "grants";
  if (!url || !anon) return NextResponse.json({ error: "클라우드가 연결되지 않았어요" }, { status: 400 });
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });

  const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false }, db: { schema } });
  const { data: u, error: ue } = await sb.auth.getUser(token);
  if (ue || !u.user) return NextResponse.json({ error: "로그인이 만료됐어요. 다시 로그인해 주세요" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { noticeId?: string; noticeTitle?: string; url?: string; name?: string } | null;
  if (!body?.url || !body.noticeId || !body.name) return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  let src: URL;
  try { src = new URL(body.url); } catch { return NextResponse.json({ error: "파일 주소가 올바르지 않아요" }, { status: 400 }); }
  if (!/^https?:$/.test(src.protocol) || !ALLOW.test(src.hostname)) return NextResponse.json({ error: "이 사이트의 파일은 보관함에 저장할 수 없어요. 다운로드해서 '내 파일 올리기'로 올려 주세요" }, { status: 400 });

  const r = await fetch(src, { headers: { "user-agent": UA, referer: src.origin + "/" }, redirect: "follow" }).catch(() => null);
  if (!r || !r.ok) return NextResponse.json({ error: `원문 사이트에서 파일을 받지 못했어요 (${r?.status ?? "연결 실패"})` }, { status: 502 });
  const len = Number(r.headers.get("content-length") ?? 0);
  if (len > MAX) return NextResponse.json({ error: "파일이 30MB보다 커서 저장하지 못했어요" }, { status: 413 });
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX) return NextResponse.json({ error: "파일이 30MB보다 커서 저장하지 못했어요" }, { status: 413 });
  if (/text\/html/i.test(r.headers.get("content-type") ?? "") && buf.length < 20000) return NextResponse.json({ error: "파일 대신 웹페이지가 왔어요. 원문에서 직접 받아 주세요" }, { status: 502 });

  const path = storageKey(u.user.id, body.noticeId, body.name);
  const up = await sb.storage.from("grant-files").upload(path, buf, { contentType: typeOf(body.name), upsert: false });
  if (up.error) return NextResponse.json({ error: "보관함에 올리지 못했어요: " + up.error.message }, { status: 500 });
  const { data: row, error: ie } = await sb.from("user_files").insert({
    notice_id: body.noticeId, notice_title: body.noticeTitle ?? null, name: body.name, path, size: buf.length, source_url: body.url,
  }).select("*").single();
  if (ie) return NextResponse.json({ error: "목록에 기록하지 못했어요: " + ie.message }, { status: 500 });
  return NextResponse.json({ file: row });
}
