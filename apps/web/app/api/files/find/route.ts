import { NextResponse } from "next/server";
import { dataUrlsFor, extractFiles, extractFilesFromJson, extractFileUrlsInText, type FoundFile } from "@/lib/findFiles";

/**
 * 공고 원문 페이지에서 첨부파일(공고문·신청서 양식 등)을 찾아 목록으로 돌려줌
 * - 브라우저는 다른 사이트 페이지를 직접 읽을 수 없어서(CORS) 서버가 대신 읽음
 * - 파일이 없으면 "신청사이트/원문 바로가기" 링크를 한 번 따라가서 다시 찾음 (아트누리 → 원 기관 게시판)
 * - 공공·문화기관(.kr) 사이트만 허용
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOW = /(^|\.)(or\.kr|go\.kr|re\.kr|ac\.kr|kr)$/i;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 MUSE-Grants/0.6";
async function fetchPage(u: URL): Promise<string | null> {
  const r = await fetch(u, { headers: { "user-agent": UA, "accept-language": "ko" }, redirect: "follow", signal: AbortSignal.timeout(12000) }).catch(() => null);
  if (!r || !r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 3 * 1024 * 1024) return null;
  // 한글 인코딩(EUC-KR) 사이트 처리
  const head = buf.subarray(0, 4000).toString("latin1");
  const cs = (/charset=([\w-]+)/i.exec(r.headers.get("content-type") ?? "")?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ?? "utf-8").toLowerCase();
  try { return new TextDecoder(/euc-kr|ks_c_5601|cp949|ms949/.test(cs) ? "euc-kr" : "utf-8").decode(buf); } catch { return buf.toString("utf8"); }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { urls?: string[] } | null;
  const urls = (body?.urls ?? []).filter(Boolean).slice(0, 3);
  if (!urls.length) return NextResponse.json({ error: "원문 주소가 없어요" }, { status: 400 });

  const visited = new Set<string>();
  const queue: URL[] = [];
  for (const s of urls) { try { queue.push(new URL(s)); } catch { /* skip */ } }
  let hidden = 0;
  let blocked = false;
  const out: FoundFile[] = [];
  const pages: string[] = [];

  // 최대 4쪽까지: 원문 → (파일이 없으면) 바로가기 링크 한 단계
  for (let depth = 0; depth < 2 && queue.length && out.length === 0; depth++) {
    const next: URL[] = [];
    for (const u of queue.splice(0)) {
      if (visited.has(u.href) || visited.size >= 4) continue;
      visited.add(u.href);
      if (!/^https?:$/.test(u.protocol) || !ALLOW.test(u.hostname)) { blocked = true; continue; }
      const push = (fs: FoundFile[]) => { for (const f of fs) if (!out.some((x) => x.url === f.url)) out.push(f); };
      // 화면을 스크립트로 그리는 사이트는 데이터 주소에서 바로 찾기
      for (const d of dataUrlsFor(u)) {
        const txt = await fetchPage(d);
        if (!txt) continue;
        try { push(extractFilesFromJson(JSON.parse(txt), d)); pages.push(d.href); } catch { /* JSON 아님 */ }
      }
      if (out.length) continue;
      const html = await fetchPage(u);
      if (!html) continue;
      pages.push(u.href);
      const r = extractFiles(html, u);
      hidden += r.hidden;
      push(r.files);
      // 링크 태그가 없으면 페이지 속 스크립트·데이터에 적힌 파일 주소
      if (!r.files.length) push(extractFileUrlsInText(html, u));
      next.push(...r.follow);
    }
    queue.push(...next);
  }
  return NextResponse.json({ files: out, hidden, blocked, pages });
}
