import { NextResponse } from "next/server";

/**
 * 아트누리 문서 뷰어로 첨부파일 미리보기 (HWP도 브라우저에서 열림)
 * 아트누리 페이지의 '미리보기' 버튼과 같은 방식: 뷰어 키를 받아 뷰어 주소로 이동
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const seNo = q.get("seNo") ?? "";
  const fileSn = q.get("fileSn") ?? "";
  if (!/^\w{1,10}$/.test(seNo) || !/^\d{1,15}$/.test(fileSn)) return new NextResponse("잘못된 요청이에요", { status: 400 });
  try {
    const r = await fetch("https://artnuri.or.kr/streamdocs/openviewer.do", {
      method: "POST",
      body: new URLSearchParams({ seNo, fileSn }),
      headers: { "user-agent": "Mozilla/5.0 (compatible; MUSE-Grants/0.5)" },
    });
    const j = (await r.json()) as { key?: string; msg?: string }[];
    const key = j?.[0]?.key;
    if (key) return NextResponse.redirect(`https://artnuri.or.kr:9100/streamdocs/view/sd;streamdocsId=${encodeURIComponent(key)}`, 302);
    return page(j?.[0]?.msg || "이 파일은 미리보기를 지원하지 않아요. 다운로드해서 열어 주세요.");
  } catch {
    return page("미리보기 서버에 연결하지 못했어요. 잠시 후 다시 시도하거나 다운로드해서 열어 주세요.");
  }
}

function page(msg: string) {
  return new NextResponse(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>미리보기</title><body style="font-family:system-ui,sans-serif;padding:32px;color:#1e2a2b"><p>${msg.replace(/</g, "&lt;")}</p><p><a href="javascript:history.back()">← 돌아가기</a></p></body>`, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}
